"""
Chunked upload service implementation with robust error handling
"""
import os
import json
import hashlib
import aiofiles
from pathlib import Path
from typing import Optional, Dict, List, Tuple
from datetime import datetime, timedelta
import uuid
import asyncio
import logging
from enum import Enum

from models import UploadSession, UploadStatus, ChunkInfo
from config import settings

logger = logging.getLogger(__name__)

class UploadErrorType(Enum):
    """Upload error types for better error handling"""
    VALIDATION_ERROR = "validation_error"
    FILE_TOO_LARGE = "file_too_large"
    UNSUPPORTED_FORMAT = "unsupported_format"
    QUOTA_EXCEEDED = "quota_exceeded"
    SESSION_NOT_FOUND = "session_not_found"
    SESSION_EXPIRED = "session_expired"
    CHUNK_MISMATCH = "chunk_mismatch"
    HASH_MISMATCH = "hash_mismatch"
    STORAGE_ERROR = "storage_error"
    NETWORK_ERROR = "network_error"
    UNKNOWN_ERROR = "unknown_error"

class UploadServiceError(Exception):
    """Custom exception for upload service errors"""
    def __init__(self, message: str, error_type: UploadErrorType, retryable: bool = False, **kwargs):
        super().__init__(message)
        self.error_type = error_type
        self.retryable = retryable
        self.details = kwargs

class ChunkedUploadService:
    """Service for handling chunked file uploads with resumable support"""
    
    def __init__(self):
        self.sessions: Dict[str, UploadSession] = {}
        self.session_file = settings.TEMP_DIR / "upload_sessions.json"
        self._load_sessions()
    
    def _load_sessions(self):
        """Load existing sessions from disk"""
        try:
            if self.session_file.exists():
                with open(self.session_file, 'r') as f:
                    data = json.load(f)
                    for session_data in data.values():
                        session = UploadSession(**session_data)
                        self.sessions[session.session_id] = session
        except Exception as e:
            print(f"Error loading sessions: {e}")
            self.sessions = {}
    
    async def _save_sessions(self):
        """Save sessions to disk"""
        try:
            data = {
                session_id: session.dict() 
                for session_id, session in self.sessions.items()
            }
            async with aiofiles.open(self.session_file, 'w') as f:
                await f.write(json.dumps(data, default=str, indent=2))
        except Exception as e:
            print(f"Error saving sessions: {e}")
    
    def _calculate_file_hash(self, file_path: Path) -> str:
        """Calculate SHA-256 hash of a file"""
        hash_sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hash_sha256.update(chunk)
        return hash_sha256.hexdigest()
    
    def _calculate_chunk_hash(self, chunk_data: bytes) -> str:
        """Calculate SHA-256 hash of chunk data"""
        return hashlib.sha256(chunk_data).hexdigest()
    
    def _get_session_dir(self, session_id: str) -> Path:
        """Get directory for session files"""
        session_dir = settings.TEMP_DIR / session_id
        session_dir.mkdir(exist_ok=True)
        return session_dir
    
    def _get_chunk_path(self, session_id: str, chunk_number: int) -> Path:
        """Get path for a specific chunk file"""
        session_dir = self._get_session_dir(session_id)
        return session_dir / f"chunk_{chunk_number:06d}"
    
    def _get_final_path(self, session_id: str, filename: str) -> Path:
        """Get path for the final assembled file"""
        return settings.UPLOAD_DIR / f"{session_id}_{filename}"
    
    async def initiate_upload(
        self, 
        user_id: str, 
        filename: str, 
        file_size: int,
        mime_type: str,
        chunk_size: int = None,
        file_hash: str = None,
        metadata: Dict = None
    ) -> UploadSession:
        """Initiate a new chunked upload session with enhanced error handling"""
        
        try:
            # Validate inputs
            if file_size <= 0:
                raise UploadServiceError(
                    "File size must be greater than 0",
                    UploadErrorType.VALIDATION_ERROR
                )
            
            if file_size > settings.MAX_FILE_SIZE:
                raise UploadServiceError(
                    f"File size {file_size} exceeds maximum allowed size of {settings.MAX_FILE_SIZE} bytes",
                    UploadErrorType.FILE_TOO_LARGE
                )
            
            if mime_type not in settings.allowed_mime_types:
                raise UploadServiceError(
                    f"MIME type {mime_type} is not allowed",
                    UploadErrorType.UNSUPPORTED_FORMAT
                )
            
            if chunk_size is None:
                chunk_size = settings.DEFAULT_CHUNK_SIZE
            elif chunk_size > settings.MAX_CHUNK_SIZE:
                raise UploadServiceError(
                    f"Chunk size {chunk_size} exceeds maximum allowed size of {settings.MAX_CHUNK_SIZE} bytes",
                    UploadErrorType.VALIDATION_ERROR
                )
            
            # Check user quota (if implemented)
            if hasattr(settings, 'MAX_USER_UPLOADS') and settings.MAX_USER_UPLOADS:
                user_uploads = sum(1 for session in self.sessions.values() 
                                 if session.user_id == user_id and 
                                 session.status in [UploadStatus.PENDING, UploadStatus.IN_PROGRESS])
                if user_uploads >= settings.MAX_USER_UPLOADS:
                    raise UploadServiceError(
                        f"User has reached maximum concurrent uploads limit of {settings.MAX_USER_UPLOADS}",
                        UploadErrorType.QUOTA_EXCEEDED,
                        retryable=True
                    )
            
            # Generate session ID
            session_id = str(uuid.uuid4())
            
            # Calculate total chunks
            total_chunks = (file_size + chunk_size - 1) // chunk_size
            
            # Create session
            session = UploadSession(
                session_id=session_id,
                user_id=user_id,
                filename=filename,
                file_size=file_size,
                chunk_size=chunk_size,
                total_chunks=total_chunks,
                file_hash=file_hash,
                mime_type=mime_type,
                metadata=metadata or {}
            )
            
            # Store session
            self.sessions[session_id] = session
            await self._save_sessions()
            
            logger.info(f"Upload session {session_id} initiated for user {user_id}, file {filename}")
            return session
            
        except UploadServiceError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error initiating upload: {e}")
            raise UploadServiceError(
                f"Failed to initiate upload: {str(e)}",
                UploadErrorType.UNKNOWN_ERROR,
                retryable=True
            )
    
    async def upload_chunk(
        self, 
        session_id: str, 
        chunk_number: int, 
        chunk_data: bytes,
        chunk_hash: str = None
    ) -> Tuple[UploadSession, bool]:
        """Upload a single chunk with enhanced error handling"""
        
        try:
            # Get session
            session = self.sessions.get(session_id)
            if not session:
                raise UploadServiceError(
                    f"Upload session {session_id} not found",
                    UploadErrorType.SESSION_NOT_FOUND
                )
            
            # Check if session expired
            if hasattr(settings, 'UPLOAD_SESSION_TIMEOUT'):
                cutoff_time = datetime.utcnow() - timedelta(seconds=settings.UPLOAD_SESSION_TIMEOUT)
                if session.updated_at < cutoff_time:
                    session.status = UploadStatus.CANCELLED
                    await self._save_sessions()
                    raise UploadServiceError(
                        f"Upload session {session_id} has expired",
                        UploadErrorType.SESSION_EXPIRED
                    )
            
            if session.status not in [UploadStatus.PENDING, UploadStatus.IN_PROGRESS]:
                raise UploadServiceError(
                    f"Upload session {session_id} is not active (status: {session.status})",
                    UploadErrorType.SESSION_EXPIRED
                )
            
            # Validate chunk number
            if chunk_number < 0 or chunk_number >= session.total_chunks:
                raise UploadServiceError(
                    f"Invalid chunk number {chunk_number}. Expected 0-{session.total_chunks-1}",
                    UploadErrorType.VALIDATION_ERROR
                )
            
            # Check if chunk already uploaded
            if chunk_number in session.uploaded_chunks:
                logger.debug(f"Chunk {chunk_number} already uploaded for session {session_id}")
                return session, False  # Already uploaded
            
            # Validate chunk hash if provided
            if chunk_hash:
                calculated_hash = self._calculate_chunk_hash(chunk_data)
                if calculated_hash != chunk_hash:
                    raise UploadServiceError(
                        f"Chunk hash mismatch for chunk {chunk_number}",
                        UploadErrorType.HASH_MISMATCH
                    )
            
            # Validate chunk size (last chunk can be smaller)
            expected_size = session.chunk_size
            if chunk_number == session.total_chunks - 1:
                # Last chunk might be smaller
                remaining_bytes = session.file_size - (chunk_number * session.chunk_size)
                expected_size = min(expected_size, remaining_bytes)
            
            if len(chunk_data) != expected_size:
                raise UploadServiceError(
                    f"Invalid chunk size for chunk {chunk_number}. Expected {expected_size}, got {len(chunk_data)}",
                    UploadErrorType.CHUNK_MISMATCH
                )
            
            # Save chunk to disk with error handling
            chunk_path = self._get_chunk_path(session_id, chunk_number)
            try:
                async with aiofiles.open(chunk_path, 'wb') as f:
                    await f.write(chunk_data)
            except OSError as e:
                logger.error(f"Failed to write chunk {chunk_number} for session {session_id}: {e}")
                raise UploadServiceError(
                    f"Failed to save chunk {chunk_number}: {str(e)}",
                    UploadErrorType.STORAGE_ERROR,
                    retryable=True
                )
            
            # Update session
            session.uploaded_chunks.append(chunk_number)
            session.uploaded_chunks.sort()
            session.status = UploadStatus.IN_PROGRESS
            session.updated_at = datetime.utcnow()
            
            await self._save_sessions()
            
            logger.debug(f"Chunk {chunk_number} uploaded successfully for session {session_id}")
            return session, True
            
        except UploadServiceError:
            raise
        except Exception as e:
            logger.error(f"Unexpected error uploading chunk {chunk_number} for session {session_id}: {e}")
            raise UploadServiceError(
                f"Failed to upload chunk {chunk_number}: {str(e)}",
                UploadErrorType.UNKNOWN_ERROR,
                retryable=True
            )
    
    async def complete_upload(self, session_id: str, final_file_hash: str = None) -> Path:
        """Complete the upload by assembling all chunks"""
        
        # Get session
        session = self.sessions.get(session_id)
        if not session:
            raise ValueError(f"Upload session {session_id} not found")
        
        if session.status != UploadStatus.IN_PROGRESS:
            raise ValueError(f"Upload session {session_id} is not in progress")
        
        # Check all chunks are uploaded
        expected_chunks = list(range(session.total_chunks))
        if set(session.uploaded_chunks) != set(expected_chunks):
            missing_chunks = set(expected_chunks) - set(session.uploaded_chunks)
            raise ValueError(f"Missing chunks: {sorted(missing_chunks)}")
        
        # Assemble file
        final_path = self._get_final_path(session_id, session.filename)
        
        async with aiofiles.open(final_path, 'wb') as output_file:
            for chunk_number in range(session.total_chunks):
                chunk_path = self._get_chunk_path(session_id, chunk_number)
                async with aiofiles.open(chunk_path, 'rb') as chunk_file:
                    chunk_data = await chunk_file.read()
                    await output_file.write(chunk_data)
        
        # Verify file hash if provided
        if final_file_hash or session.file_hash:
            calculated_hash = self._calculate_file_hash(final_path)
            expected_hash = final_file_hash or session.file_hash
            if calculated_hash != expected_hash:
                # Clean up and raise error
                final_path.unlink(missing_ok=True)
                raise ValueError("Final file hash mismatch")
        
        # Update session
        session.status = UploadStatus.COMPLETED
        session.completed_at = datetime.utcnow()
        session.updated_at = datetime.utcnow()
        
        await self._save_sessions()
        
        # Clean up temporary chunks
        await self._cleanup_session_chunks(session_id)
        
        return final_path
    
    async def get_upload_status(self, session_id: str) -> Optional[UploadSession]:
        """Get the status of an upload session"""
        return self.sessions.get(session_id)
    
    async def cancel_upload(self, session_id: str) -> bool:
        """Cancel an upload session"""
        session = self.sessions.get(session_id)
        if not session:
            return False
        
        session.status = UploadStatus.CANCELLED
        session.updated_at = datetime.utcnow()
        
        await self._save_sessions()
        await self._cleanup_session_chunks(session_id)
        
        return True
    
    async def _cleanup_session_chunks(self, session_id: str):
        """Clean up temporary chunk files for a session"""
        session_dir = self._get_session_dir(session_id)
        try:
            # Remove all chunk files
            for chunk_file in session_dir.glob("chunk_*"):
                chunk_file.unlink(missing_ok=True)
            # Remove session directory if empty
            if not any(session_dir.iterdir()):
                session_dir.rmdir()
        except Exception as e:
            print(f"Error cleaning up session {session_id}: {e}")
    
    async def cleanup_expired_sessions(self):
        """Clean up expired upload sessions"""
        cutoff_time = datetime.utcnow() - timedelta(seconds=settings.UPLOAD_SESSION_TIMEOUT)
        
        expired_sessions = [
            session_id for session_id, session in self.sessions.items()
            if session.updated_at < cutoff_time and session.status in [
                UploadStatus.PENDING, UploadStatus.IN_PROGRESS
            ]
        ]
        
        for session_id in expired_sessions:
            await self.cancel_upload(session_id)
            del self.sessions[session_id]
        
        if expired_sessions:
            await self._save_sessions()
        
        return len(expired_sessions)
    
    def get_remaining_chunks(self, session_id: str) -> List[int]:
        """Get list of remaining chunks to upload"""
        session = self.sessions.get(session_id)
        if not session:
            return []
        
        all_chunks = set(range(session.total_chunks))
        uploaded_chunks = set(session.uploaded_chunks)
        return sorted(list(all_chunks - uploaded_chunks))
    
    def get_progress_percent(self, session_id: str) -> float:
        """Get upload progress as percentage"""
        session = self.sessions.get(session_id)
        if not session:
            return 0.0
        
        if session.total_chunks == 0:
            return 0.0
        
        return (len(session.uploaded_chunks) / session.total_chunks) * 100.0