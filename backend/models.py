"""
Data models for chunked upload system
"""
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class UploadStatus(str, Enum):
    """Upload session status"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class ChunkInfo(BaseModel):
    """Information about a single chunk"""
    chunk_number: int = Field(..., ge=0, description="Zero-based chunk index")
    chunk_size: int = Field(..., gt=0, description="Size of this chunk in bytes")
    chunk_hash: str = Field(..., description="SHA-256 hash of chunk data")
    uploaded_at: datetime = Field(default_factory=datetime.utcnow)

class UploadSession(BaseModel):
    """Upload session metadata"""
    session_id: str = Field(..., description="Unique session identifier")
    user_id: str = Field(..., description="User who initiated upload")
    filename: str = Field(..., description="Original filename")
    file_size: int = Field(..., gt=0, description="Total file size in bytes")
    chunk_size: int = Field(..., gt=0, description="Size of each chunk")
    total_chunks: int = Field(..., gt=0, description="Total number of chunks")
    file_hash: Optional[str] = Field(None, description="SHA-256 hash of complete file")
    mime_type: str = Field(..., description="MIME type of the file")
    status: UploadStatus = Field(default=UploadStatus.PENDING)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    uploaded_chunks: List[int] = Field(default_factory=list, description="List of uploaded chunk numbers")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

class InitiateUploadRequest(BaseModel):
    """Request to initiate a new upload session"""
    filename: str = Field(..., min_length=1, max_length=255)
    file_size: int = Field(..., gt=0, le=100_000_000)  # 100MB max
    chunk_size: int = Field(default=1_048_576, gt=0, le=10_485_760)  # 1MB default, 10MB max
    file_hash: Optional[str] = Field(None, description="SHA-256 hash for integrity check")
    mime_type: str = Field(..., description="MIME type of the file")
    metadata: Dict[str, Any] = Field(default_factory=dict)

class InitiateUploadResponse(BaseModel):
    """Response from upload initiation"""
    session_id: str
    upload_url: str
    chunk_size: int
    total_chunks: int
    expires_at: datetime

class UploadChunkRequest(BaseModel):
    """Request to upload a chunk"""
    session_id: str
    chunk_number: int = Field(..., ge=0)
    chunk_hash: str = Field(..., description="SHA-256 hash of chunk data")

class UploadChunkResponse(BaseModel):
    """Response from chunk upload"""
    session_id: str
    chunk_number: int
    status: str
    uploaded_chunks: List[int]
    remaining_chunks: List[int]
    progress_percent: float

class CompleteUploadRequest(BaseModel):
    """Request to complete upload"""
    session_id: str
    file_hash: Optional[str] = Field(None, description="Final file hash for verification")

class CompleteUploadResponse(BaseModel):
    """Response from upload completion"""
    session_id: str
    status: UploadStatus
    file_url: str
    file_size: int
    completed_at: datetime

class UploadStatusResponse(BaseModel):
    """Response for upload status check"""
    session_id: str
    status: UploadStatus
    progress_percent: float
    uploaded_chunks: List[int]
    remaining_chunks: List[int]
    created_at: datetime
    updated_at: datetime
    error_message: Optional[str] = None