"""
FastAPI backend for 2Truths-1Lie game with chunked upload support
"""
from fastapi import FastAPI, HTTPException, Depends, UploadFile, File, Form, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
import aiofiles
import os
import hashlib
import json
from pathlib import Path
from typing import Optional, Dict, Any
import uuid
from datetime import datetime, timedelta

from models import (
    UploadSession, ChunkInfo, UploadStatus,
    InitiateUploadRequest, InitiateUploadResponse,
    UploadChunkResponse, CompleteUploadRequest, CompleteUploadResponse,
    UploadStatusResponse
)
from services.upload_service import ChunkedUploadService
from services.auth_service import get_current_user
from config import settings

app = FastAPI(
    title="2Truths-1Lie API",
    description="Backend API for chunked media uploads and game management",
    version="1.0.0"
)

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize upload service
upload_service = ChunkedUploadService()

@app.get("/")
async def root():
    """Health check endpoint"""
    return {"message": "2Truths-1Lie API is running", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "upload_directory": str(settings.UPLOAD_DIR),
        "max_file_size": settings.MAX_FILE_SIZE
    }

# Upload endpoints
@app.post("/api/v1/upload/initiate")
async def initiate_upload(
    request: InitiateUploadRequest,
    current_user: str = Depends(get_current_user)
):
    """Initiate a new chunked upload session"""
    try:
        session = await upload_service.initiate_upload(
            user_id=current_user,
            filename=request.filename,
            file_size=request.file_size,
            mime_type=request.mime_type,
            chunk_size=request.chunk_size,
            file_hash=request.file_hash,
            metadata=request.metadata
        )
        
        return InitiateUploadResponse(
            session_id=session.session_id,
            upload_url=f"/api/v1/upload/{session.session_id}/chunk",
            chunk_size=session.chunk_size,
            total_chunks=session.total_chunks,
            expires_at=session.created_at + timedelta(seconds=settings.UPLOAD_SESSION_TIMEOUT)
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to initiate upload")

@app.post("/api/v1/upload/{session_id}/chunk/{chunk_number}")
async def upload_chunk(
    session_id: str,
    chunk_number: int,
    file: UploadFile = File(...),
    chunk_hash: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """Upload a single chunk"""
    try:
        # Verify session belongs to user
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Upload session not found")
        
        if session.user_id != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Read chunk data
        chunk_data = await file.read()
        
        # Upload chunk
        updated_session, was_uploaded = await upload_service.upload_chunk(
            session_id=session_id,
            chunk_number=chunk_number,
            chunk_data=chunk_data,
            chunk_hash=chunk_hash
        )
        
        return UploadChunkResponse(
            session_id=session_id,
            chunk_number=chunk_number,
            status="uploaded" if was_uploaded else "already_exists",
            uploaded_chunks=updated_session.uploaded_chunks,
            remaining_chunks=upload_service.get_remaining_chunks(session_id),
            progress_percent=upload_service.get_progress_percent(session_id)
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to upload chunk")

@app.post("/api/v1/upload/{session_id}/complete")
async def complete_upload(
    session_id: str,
    request: CompleteUploadRequest,
    current_user: str = Depends(get_current_user)
):
    """Complete the upload by assembling all chunks"""
    try:
        # Verify session belongs to user
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Upload session not found")
        
        if session.user_id != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Complete upload
        final_path = await upload_service.complete_upload(
            session_id=session_id,
            final_file_hash=request.file_hash
        )
        
        # Get updated session
        completed_session = await upload_service.get_upload_status(session_id)
        
        return CompleteUploadResponse(
            session_id=session_id,
            status=completed_session.status,
            file_url=f"/api/v1/files/{session_id}_{session.filename}",
            file_size=session.file_size,
            completed_at=completed_session.completed_at
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to complete upload")

@app.get("/api/v1/upload/{session_id}/status")
async def get_upload_status(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get the status of an upload session"""
    session = await upload_service.get_upload_status(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if session.user_id != current_user:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return UploadStatusResponse(
        session_id=session_id,
        status=session.status,
        progress_percent=upload_service.get_progress_percent(session_id),
        uploaded_chunks=session.uploaded_chunks,
        remaining_chunks=upload_service.get_remaining_chunks(session_id),
        created_at=session.created_at,
        updated_at=session.updated_at
    )

@app.delete("/api/v1/upload/{session_id}")
async def cancel_upload(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """Cancel an upload session"""
    session = await upload_service.get_upload_status(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Upload session not found")
    
    if session.user_id != current_user:
        raise HTTPException(status_code=403, detail="Access denied")
    
    success = await upload_service.cancel_upload(session_id)
    if success:
        return {"message": "Upload cancelled successfully"}
    else:
        raise HTTPException(status_code=500, detail="Failed to cancel upload")

@app.get("/api/v1/files/{filename}")
async def get_file(filename: str):
    """Serve uploaded files"""
    file_path = settings.UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    return FileResponse(file_path)

# Cleanup task (would typically run as a background task)
@app.post("/api/v1/admin/cleanup")
async def cleanup_expired_sessions():
    """Clean up expired upload sessions (admin endpoint)"""
    cleaned_count = await upload_service.cleanup_expired_sessions()
    return {"message": f"Cleaned up {cleaned_count} expired sessions"}