"""
Data models for chunked upload system
"""
from pydantic import BaseModel, Field, ConfigDict
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
    model_config = ConfigDict(use_enum_values=True)
    
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

# Challenge and Game Models

class ChallengeStatus(str, Enum):
    """Challenge status"""
    DRAFT = "draft"
    PENDING_MODERATION = "pending_moderation"
    PUBLISHED = "published"
    MODERATED = "moderated"
    REJECTED = "rejected"
    FLAGGED = "flagged"
    ARCHIVED = "archived"

class StatementType(str, Enum):
    """Statement type"""
    TRUTH = "truth"
    LIE = "lie"

class VideoSegmentMetadata(BaseModel):
    """Metadata for a video segment within a merged video"""
    start_time: float = Field(..., ge=0, description="Start time in seconds within merged video")
    end_time: float = Field(..., gt=0, description="End time in seconds within merged video")
    duration: float = Field(..., gt=0, description="Duration of segment in seconds")
    statement_index: int = Field(..., ge=0, le=2, description="Index of the statement (0-2)")
    
    def model_post_init(self, __context):
        """Validate that end_time > start_time and duration matches"""
        if self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        
        calculated_duration = self.end_time - self.start_time
        if abs(calculated_duration - self.duration) > 0.1:  # Allow small floating point differences
            raise ValueError(f"Duration mismatch: calculated {calculated_duration:.2f}s, provided {self.duration:.2f}s")

class Statement(BaseModel):
    """Individual statement within a challenge"""
    statement_id: str = Field(..., description="Unique statement identifier")
    statement_type: StatementType = Field(..., description="Whether this is a truth or lie")
    media_url: str = Field(..., description="Persistent server URL for video streaming")
    media_file_id: str = Field(..., description="File ID from upload service")
    streaming_url: Optional[str] = Field(None, description="Optimized streaming URL (CDN or signed URL)")
    cloud_storage_key: Optional[str] = Field(None, description="Cloud storage key for direct access")
    storage_type: str = Field(default="local", description="Storage type: local, cloud, or cloud_fallback")
    duration_seconds: float = Field(..., gt=0, description="Duration of the video in seconds")
    # Segment metadata for merged videos (legacy fields for backward compatibility)
    segment_start_time: Optional[float] = Field(None, description="Start time in seconds within merged video")
    segment_end_time: Optional[float] = Field(None, description="End time in seconds within merged video")
    segment_duration: Optional[float] = Field(None, description="Duration of segment in seconds")
    # Enhanced segment metadata
    segment_metadata: Optional[VideoSegmentMetadata] = Field(None, description="Detailed segment metadata for merged videos")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
class MergedVideoMetadata(BaseModel):
    """Metadata for a merged video containing multiple statement segments"""
    total_duration: float = Field(..., gt=0, description="Total duration of merged video in seconds")
    segments: List[VideoSegmentMetadata] = Field(..., min_items=3, max_items=3, description="Segment metadata for each statement")
    video_file_id: str = Field(..., description="File ID of the merged video")
    compression_applied: bool = Field(default=False, description="Whether compression was applied to the merged video")
    original_total_duration: Optional[float] = Field(None, description="Original duration before compression")
    
    def model_post_init(self, __context):
        """Validate segment metadata consistency"""
        if len(self.segments) != 3:
            raise ValueError("Merged video must have exactly 3 segments")
        
        # Validate segments are in order and don't overlap
        sorted_segments = sorted(self.segments, key=lambda s: s.start_time)
        for i in range(len(sorted_segments) - 1):
            current_segment = sorted_segments[i]
            next_segment = sorted_segments[i + 1]
            
            if current_segment.end_time > next_segment.start_time:
                raise ValueError(f"Segments {current_segment.statement_index} and {next_segment.statement_index} overlap")
        
        # Validate total duration matches last segment end time
        last_segment_end = max(segment.end_time for segment in self.segments)
        if abs(last_segment_end - self.total_duration) > 0.1:
            raise ValueError(f"Total duration {self.total_duration}s doesn't match last segment end time {last_segment_end}s")

class Challenge(BaseModel):
    """Challenge containing three statements (2 truths, 1 lie)"""
    challenge_id: str = Field(..., description="Unique challenge identifier")
    creator_id: str = Field(..., description="User who created the challenge")
    title: Optional[str] = Field(None, max_length=200, description="Optional challenge title")
    statements: List[Statement] = Field(..., min_items=3, max_items=3, description="Exactly 3 statements")
    lie_statement_id: str = Field(..., description="ID of the statement that is the lie")
    status: ChallengeStatus = Field(default=ChallengeStatus.DRAFT)
    difficulty_level: Optional[str] = Field(None, description="Estimated difficulty: easy, medium, hard")
    tags: List[str] = Field(default_factory=list, description="Optional tags for categorization")
    # Merged video metadata
    is_merged_video: bool = Field(default=False, description="Whether this challenge uses a merged video")
    merged_video_metadata: Optional[MergedVideoMetadata] = Field(None, description="Structured metadata for merged video segments")
    # Legacy merged video metadata (for backward compatibility)
    legacy_merged_metadata: Optional[Dict[str, Any]] = Field(None, description="Legacy metadata format for merged video segments")
    # Server-side merged video fields
    merged_video_url: Optional[str] = Field(None, description="URL of the server-merged video file")
    merged_video_file_id: Optional[str] = Field(None, description="File ID of the server-merged video")
    merge_session_id: Optional[str] = Field(None, description="ID of the merge session that created this video")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None
    view_count: int = Field(default=0, ge=0)
    guess_count: int = Field(default=0, ge=0)
    correct_guess_count: int = Field(default=0, ge=0)
    
    @property
    def accuracy_rate(self) -> float:
        """Calculate the accuracy rate of guesses"""
        if self.guess_count == 0:
            return 0.0
        return self.correct_guess_count / self.guess_count

class CreateChallengeRequest(BaseModel):
    """Request to create a new challenge"""
    title: Optional[str] = Field(None, max_length=200)
    statements: List[Dict[str, Any]] = Field(..., min_items=3, max_items=3, description="Statement metadata (media file IDs)")
    lie_statement_index: int = Field(..., ge=0, le=2, description="Index (0-2) of the lie statement")
    tags: List[str] = Field(default_factory=list, max_items=10)
    is_merged_video: bool = Field(default=False, description="Whether this challenge uses a merged video")
    merged_video_metadata: Optional[MergedVideoMetadata] = Field(None, description="Structured metadata for merged video segments")
    # Legacy support for old metadata format
    legacy_merged_metadata: Optional[Dict[str, Any]] = Field(None, description="Legacy metadata format for merged video segments")
    # New fields for server-side merged video
    merged_video_url: Optional[str] = Field(None, description="URL of the server-merged video file")
    merged_video_file_id: Optional[str] = Field(None, description="File ID of the server-merged video")
    merge_session_id: Optional[str] = Field(None, description="ID of the merge session that created this video")
    
class CreateChallengeResponse(BaseModel):
    """Response from challenge creation"""
    challenge_id: str
    status: ChallengeStatus
    created_at: datetime
    statements: List[Statement]

class ChallengeListResponse(BaseModel):
    """Response for challenge listing"""
    challenges: List[Challenge]
    total_count: int
    page: int
    page_size: int
    has_next: bool

class GuessSubmission(BaseModel):
    """User's guess submission"""
    guess_id: str = Field(..., description="Unique guess identifier")
    challenge_id: str = Field(..., description="Challenge being guessed on")
    user_id: str = Field(..., description="User making the guess")
    guessed_lie_statement_id: str = Field(..., description="Statement ID the user thinks is the lie")
    is_correct: bool = Field(..., description="Whether the guess was correct")
    submitted_at: datetime = Field(default_factory=datetime.utcnow)
    response_time_seconds: Optional[float] = Field(None, ge=0, description="Time taken to make guess")

class SubmitGuessRequest(BaseModel):
    """Request to submit a guess"""
    challenge_id: str
    guessed_lie_statement_id: str
    response_time_seconds: Optional[float] = Field(None, ge=0)

class SubmitGuessResponse(BaseModel):
    """Response from guess submission"""
    guess_id: str
    is_correct: bool
    correct_lie_statement_id: str
    points_earned: int
    submitted_at: datetime

class FlagChallengeRequest(BaseModel):
    """Request to flag a challenge for review"""
    reason: str = Field(..., max_length=500, description="Reason for flagging")

class ModerationReviewRequest(BaseModel):
    """Request for manual moderation review"""
    decision: str = Field(..., description="approved, rejected, or flagged")
    reason: Optional[str] = Field(None, max_length=500, description="Reason for decision")