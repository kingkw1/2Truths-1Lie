"""
Challenge Video API Endpoints - Multi-video upload for server-side merging
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request, status
from fastapi.responses import JSONResponse, FileResponse, StreamingResponse
from typing import List, Optional, Dict, Any
from pathlib import Path
import logging
import uuid
from datetime import datetime

from services.auth_service import get_current_user
from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType
from services.video_merge_service import VideoMergeService, VideoMergeError, MergeSessionStatus
from models import UploadSession, UploadStatus

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/challenge-videos", tags=["challenge-videos"])

# Initialize services
upload_service = ChunkedUploadService()
merge_service = VideoMergeService()


class MultiVideoUploadRequest:
    """Request model for multi-video upload initiation"""
    def __init__(
        self,
        video_count: int,
        video_filenames: List[str],
        video_file_sizes: List[int],
        video_durations: List[float],
        video_mime_types: List[str],
        challenge_title: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.video_count = video_count
        self.video_filenames = video_filenames
        self.video_file_sizes = video_file_sizes
        self.video_durations = video_durations
        self.video_mime_types = video_mime_types
        self.challenge_title = challenge_title
        self.metadata = metadata or {}


class MultiVideoUploadResponse:
    """Response model for multi-video upload initiation"""
    def __init__(
        self,
        merge_session_id: str,
        upload_sessions: List[Dict[str, Any]],
        total_videos: int,
        estimated_merge_time_seconds: float
    ):
        self.merge_session_id = merge_session_id
        self.upload_sessions = upload_sessions
        self.total_videos = total_videos
        self.estimated_merge_time_seconds = estimated_merge_time_seconds


@router.post("/upload-for-merge/initiate")
async def initiate_multi_video_upload(
    video_count: int = Form(...),
    video_filenames: str = Form(...),  # JSON string of filenames
    video_file_sizes: str = Form(...),  # JSON string of file sizes
    video_durations: str = Form(...),  # JSON string of durations
    video_mime_types: str = Form(...),  # JSON string of MIME types
    challenge_title: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """
    Initiate multi-video upload session for server-side merging
    
    This endpoint accepts metadata for multiple videos that will be uploaded
    separately and then merged on the server side using FFmpeg.
    """
    try:
        import json
        
        # Parse JSON strings
        try:
            filenames = json.loads(video_filenames)
            file_sizes = json.loads(video_file_sizes)
            durations_ms = json.loads(video_durations)  # Mobile app sends durations in milliseconds
            mime_types = json.loads(video_mime_types)
            
            # Validate and convert durations from milliseconds to seconds
            durations = []
            for i, duration_ms in enumerate(durations_ms):
                # Assertion: Durations > 1000 should be in milliseconds (no video recording is > 1000 seconds)
                if duration_ms > 1000:
                    # Convert from milliseconds to seconds
                    duration_seconds = duration_ms / 1000.0
                    durations.append(duration_seconds)
                    logger.info(f"Video {i+1}: Converted duration {duration_ms}ms to {duration_seconds}s")
                else:
                    # Value seems to already be in seconds (unlikely but handle it)
                    durations.append(duration_ms)
                    logger.warning(f"Video {i+1}: Duration {duration_ms} appears to be in seconds (< 1000)")
                    
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON in request parameters: {str(e)}"
            )
        
        # Validate video count
        if video_count != 3:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Exactly 3 videos are required for challenge creation"
            )
        
        # Validate array lengths match video count
        if not all(len(arr) == video_count for arr in [filenames, file_sizes, durations, mime_types]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="All video metadata arrays must have the same length as video_count"
            )
        
        # Validate individual videos
        from config import settings
        total_size = 0
        total_duration = 0.0
        
        for i in range(video_count):
            # Validate file size
            if file_sizes[i] <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i+1} file size must be greater than 0"
                )
            
            if file_sizes[i] > settings.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i+1} file size exceeds maximum allowed size"
                )
            
            # Validate MIME type
            if mime_types[i] not in settings.ALLOWED_VIDEO_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i+1} MIME type {mime_types[i]} is not allowed"
                )
            
            # Validate duration
            if durations[i] <= 0:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i+1} duration must be greater than 0"
                )
            
            if durations[i] > settings.MAX_VIDEO_DURATION_SECONDS:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i+1} duration exceeds maximum allowed duration"
                )
            
            total_size += file_sizes[i]
            total_duration += durations[i]
        
        # Validate total constraints
        max_total_size = settings.MAX_FILE_SIZE * 3  # Allow up to 3x single file limit for merged videos
        if total_size > max_total_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total file size {total_size} exceeds maximum allowed total size {max_total_size}"
            )
        
        max_total_duration = settings.MAX_VIDEO_DURATION_SECONDS * 3  # Allow up to 3x single duration limit
        if total_duration > max_total_duration:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Total video duration {total_duration}s exceeds maximum allowed total duration {max_total_duration}s"
            )
        
        # Generate merge session ID
        merge_session_id = str(uuid.uuid4())
        
        # Create individual upload sessions for each video
        upload_sessions = []
        
        for i in range(video_count):
            try:
                # Create metadata for this video
                video_metadata = {
                    "merge_session_id": merge_session_id,
                    "video_index": i,
                    "video_count": video_count,
                    "challenge_title": challenge_title,
                    "is_merge_video": True,
                    "total_duration": total_duration,
                    "video_duration": durations[i]
                }
                
                # Initiate upload session for this video
                session = await upload_service.initiate_upload(
                    user_id=current_user,
                    filename=filenames[i],
                    file_size=file_sizes[i],
                    mime_type=mime_types[i],
                    metadata=video_metadata
                )
                
                upload_sessions.append({
                    "video_index": i,
                    "session_id": session.session_id,
                    "filename": filenames[i],
                    "file_size": file_sizes[i],
                    "duration_seconds": durations[i],
                    "upload_url": f"/api/v1/challenge-videos/upload/{session.session_id}/chunk",
                    "chunk_size": session.chunk_size,
                    "total_chunks": session.total_chunks
                })
                
            except UploadServiceError as e:
                # Clean up any sessions created so far
                for created_session in upload_sessions:
                    try:
                        await upload_service.cancel_upload(created_session["session_id"])
                    except:
                        pass  # Best effort cleanup
                
                if e.error_type == UploadErrorType.VALIDATION_ERROR:
                    raise HTTPException(status_code=400, detail=str(e))
                elif e.error_type == UploadErrorType.QUOTA_EXCEEDED:
                    raise HTTPException(status_code=429, detail=str(e))
                else:
                    raise HTTPException(status_code=500, detail="Failed to initiate video upload")
        
        # Estimate merge time (rough calculation based on total duration and file size)
        # Base time + duration-based time + size-based time
        base_merge_time = 10.0  # 10 seconds base processing time
        duration_factor = total_duration * 0.5  # 0.5 seconds per second of video
        size_factor = total_size / (1024 * 1024) * 0.1  # 0.1 seconds per MB
        estimated_merge_time = base_merge_time + duration_factor + size_factor
        
        logger.info(f"Multi-video upload session {merge_session_id} initiated for user {current_user}")
        logger.debug(f"Created {len(upload_sessions)} upload sessions for merge session {merge_session_id}")
        
        return JSONResponse(
            content={
                "merge_session_id": merge_session_id,
                "upload_sessions": upload_sessions,
                "total_videos": video_count,
                "total_duration_seconds": total_duration,
                "total_file_size_bytes": total_size,
                "estimated_merge_time_seconds": estimated_merge_time,
                "status": "initiated",
                "created_at": datetime.utcnow().isoformat()
            },
            headers={
                "X-Merge-Session-ID": merge_session_id,
                "X-Total-Videos": str(video_count),
                "X-Estimated-Merge-Time": str(int(estimated_merge_time))
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error initiating multi-video upload for user {current_user}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to initiate multi-video upload"
        )


@router.post("/upload/{session_id}/chunk/{chunk_number}")
async def upload_video_chunk_for_merge(
    session_id: str,
    chunk_number: int,
    file: UploadFile = File(...),
    chunk_hash: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """
    Upload a video chunk for a merge session
    
    This endpoint handles chunk uploads for videos that will be merged.
    It uses the same chunked upload mechanism as regular uploads but
    includes merge-specific metadata tracking.
    """
    try:
        # Verify session belongs to user and is a merge session
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload session not found"
            )
        
        if session.user_id != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this upload session"
            )
        
        # Verify this is a merge session
        if not session.metadata.get("is_merge_video", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This endpoint is only for merge video uploads"
            )
        
        # Read chunk data
        chunk_data = await file.read()
        
        # Upload chunk using the existing service
        updated_session, was_uploaded = await upload_service.upload_chunk(
            session_id=session_id,
            chunk_number=chunk_number,
            chunk_data=chunk_data,
            chunk_hash=chunk_hash
        )
        
        # Get merge session info
        merge_session_id = session.metadata.get("merge_session_id")
        video_index = session.metadata.get("video_index")
        
        logger.debug(f"Chunk {chunk_number} uploaded for merge session {merge_session_id}, video {video_index}")
        
        return JSONResponse(
            content={
                "session_id": session_id,
                "merge_session_id": merge_session_id,
                "video_index": video_index,
                "chunk_number": chunk_number,
                "status": "uploaded" if was_uploaded else "already_exists",
                "uploaded_chunks": updated_session.uploaded_chunks,
                "remaining_chunks": upload_service.get_remaining_chunks(session_id),
                "progress_percent": upload_service.get_progress_percent(session_id),
                "updated_at": updated_session.updated_at.isoformat()
            },
            headers={
                "X-Merge-Session-ID": merge_session_id or "",
                "X-Video-Index": str(video_index) if video_index is not None else "",
                "X-Progress-Percent": str(upload_service.get_progress_percent(session_id))
            }
        )
        
    except UploadServiceError as e:
        if e.error_type == UploadErrorType.VALIDATION_ERROR:
            raise HTTPException(status_code=400, detail=str(e))
        elif e.error_type == UploadErrorType.SESSION_NOT_FOUND:
            raise HTTPException(status_code=404, detail=str(e))
        elif e.error_type == UploadErrorType.SESSION_EXPIRED:
            raise HTTPException(status_code=410, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Chunk upload failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error uploading chunk {chunk_number} for session {session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to upload video chunk"
        )


@router.get("/upload/{session_id}/status")
async def get_merge_upload_status(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get the status of a merge video upload session
    
    Returns detailed status information including merge-specific metadata.
    """
    try:
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload session not found"
            )
        
        if session.user_id != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this upload session"
            )
        
        # Get merge-specific metadata
        merge_session_id = session.metadata.get("merge_session_id")
        video_index = session.metadata.get("video_index")
        video_count = session.metadata.get("video_count")
        is_merge_video = session.metadata.get("is_merge_video", False)
        
        return {
            "session_id": session_id,
            "merge_session_id": merge_session_id,
            "video_index": video_index,
            "video_count": video_count,
            "is_merge_video": is_merge_video,
            "filename": session.filename,
            "file_size": session.file_size,
            "status": session.status,
            "progress_percent": upload_service.get_progress_percent(session_id),
            "uploaded_chunks": session.uploaded_chunks,
            "remaining_chunks": upload_service.get_remaining_chunks(session_id),
            "total_chunks": session.total_chunks,
            "created_at": session.created_at.isoformat(),
            "updated_at": session.updated_at.isoformat(),
            "completed_at": session.completed_at.isoformat() if session.completed_at else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting upload status for session {session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get upload status"
        )


@router.post("/upload/{session_id}/complete")
async def complete_merge_video_upload(
    session_id: str,
    file_hash: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """
    Complete a single video upload within a merge session
    
    This completes the upload of one video file. The actual merging
    will be triggered when all videos in the merge session are completed.
    """
    try:
        # Verify session belongs to user
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload session not found"
            )
        
        if session.user_id != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this upload session"
            )
        
        # Verify this is a merge session
        if not session.metadata.get("is_merge_video", False):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="This endpoint is only for merge video uploads"
            )
        
        # Complete the upload
        final_path = await upload_service.complete_upload(
            session_id=session_id,
            final_file_hash=file_hash
        )
        
        # Get updated session
        completed_session = await upload_service.get_upload_status(session_id)
        
        # Get merge session info
        merge_session_id = session.metadata.get("merge_session_id")
        video_index = session.metadata.get("video_index")
        video_count = session.metadata.get("video_count")
        
        logger.info(f"Video {video_index} completed for merge session {merge_session_id}")
        
        # Check if all videos in merge session are complete and trigger merge
        merge_triggered = False
        merge_status = "pending"
        merged_video_url = None
        merged_video_metadata = None
        
        try:
            readiness = await merge_service.check_merge_readiness(merge_session_id, current_user)
            if readiness["ready"]:
                # All videos are ready, initiate merge with default quality
                merge_result = await merge_service.initiate_merge(merge_session_id, current_user, "medium")
                merge_triggered = True
                merge_status = merge_result["status"]
                logger.info(f"Merge initiated for session {merge_session_id}: {merge_result}")
                
                # Wait a moment and check if merge completed quickly (for small videos)
                import asyncio
                await asyncio.sleep(1.0)  # Give merge process a moment to potentially complete
                
                # Check if merge completed and get results
                merge_session_status = await merge_service.get_merge_status(merge_session_id)
                if merge_session_status and merge_session_status.get("status") == MergeSessionStatus.COMPLETED:
                    merged_video_url = merge_session_status.get("merged_video_url")
                    merged_video_metadata = merge_session_status.get("merged_video_metadata")
                    merge_status = "completed"
                    logger.info(f"Merge completed for session {merge_session_id}, returning merged video URL and metadata")
                
        except VideoMergeError as e:
            logger.warning(f"Failed to initiate merge for session {merge_session_id}: {e}")
            merge_status = "failed"
        except Exception as e:
            logger.error(f"Unexpected error checking merge readiness for session {merge_session_id}: {e}")
            merge_status = "error"
        
        response_content = {
            "session_id": session_id,
            "merge_session_id": merge_session_id,
            "video_index": video_index,
            "video_count": video_count,
            "status": completed_session.status,
            "file_path": str(final_path),
            "file_size": session.file_size,
            "completed_at": completed_session.completed_at.isoformat(),
            "ready_for_merge": True,  # Individual video is ready
            "merge_triggered": merge_triggered,
            "merge_status": merge_status
        }
        
        # Include merged video URL and metadata if merge completed
        if merged_video_url:
            response_content["merged_video_url"] = merged_video_url
        if merged_video_metadata:
            response_content["merged_video_metadata"] = merged_video_metadata
            # Extract segment metadata for easier client access
            if isinstance(merged_video_metadata, dict) and "segments" in merged_video_metadata:
                response_content["segment_metadata"] = merged_video_metadata["segments"]
        
        return JSONResponse(
            content=response_content,
            headers={
                "X-Merge-Session-ID": merge_session_id or "",
                "X-Video-Index": str(video_index) if video_index is not None else "",
                "X-Video-Status": "completed",
                "X-Merge-Triggered": str(merge_triggered).lower()
            }
        )
        
    except UploadServiceError as e:
        if e.error_type == UploadErrorType.SESSION_NOT_FOUND:
            raise HTTPException(status_code=404, detail=str(e))
        elif e.error_type == UploadErrorType.HASH_MISMATCH:
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Upload completion failed")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error completing upload for session {session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to complete video upload"
        )


@router.get("/merge-session/{merge_session_id}/status")
async def get_merge_session_status(
    merge_session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get the overall status of a merge session
    
    Returns the status of all videos in the merge session and overall merge progress.
    """
    try:
        # Find all upload sessions for this merge session
        merge_sessions = []
        for session_id, session in upload_service.sessions.items():
            if (session.user_id == current_user and 
                session.metadata.get("merge_session_id") == merge_session_id):
                merge_sessions.append({
                    "session_id": session_id,
                    "video_index": session.metadata.get("video_index"),
                    "filename": session.filename,
                    "status": session.status,
                    "progress_percent": upload_service.get_progress_percent(session_id),
                    "completed_at": session.completed_at.isoformat() if session.completed_at else None
                })
        
        if not merge_sessions:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merge session not found"
            )
        
        # Sort by video index
        merge_sessions.sort(key=lambda x: x.get("video_index", 0))
        
        # Calculate overall status
        total_videos = len(merge_sessions)
        completed_videos = sum(1 for s in merge_sessions if s["status"] == UploadStatus.COMPLETED)
        failed_videos = sum(1 for s in merge_sessions if s["status"] == UploadStatus.FAILED)
        
        if completed_videos == total_videos:
            overall_status = "ready_for_merge"
        elif failed_videos > 0:
            overall_status = "failed"
        elif completed_videos > 0:
            overall_status = "partially_uploaded"
        else:
            overall_status = "uploading"
        
        # Calculate overall progress
        total_progress = sum(s["progress_percent"] for s in merge_sessions)
        overall_progress = total_progress / total_videos if total_videos > 0 else 0.0
        
        # Check merge status
        merge_status_info = await merge_service.get_merge_status(merge_session_id)
        merge_triggered = merge_status_info is not None
        merge_progress = merge_status_info.get("progress", 0.0) if merge_status_info else 0.0
        merge_status = merge_status_info.get("status", "not_started") if merge_status_info else "not_started"
        
        return {
            "merge_session_id": merge_session_id,
            "overall_status": overall_status,
            "overall_progress_percent": overall_progress,
            "total_videos": total_videos,
            "completed_videos": completed_videos,
            "failed_videos": failed_videos,
            "videos": merge_sessions,
            "ready_for_merge": completed_videos == total_videos,
            "merge_triggered": merge_triggered,
            "merge_status": merge_status,
            "merge_progress_percent": merge_progress,
            "merged_video_url": merge_status_info.get("merged_video_url") if merge_status_info else None,
            "merged_video_metadata": merge_status_info.get("merged_video_metadata") if merge_status_info else None
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting merge session status for {merge_session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get merge session status"
        )


@router.delete("/upload/{session_id}")
async def cancel_merge_video_upload(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Cancel a merge video upload session
    
    Cancels the upload and cleans up temporary files for this video.
    """
    try:
        session = await upload_service.get_upload_status(session_id)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Upload session not found"
            )
        
        if session.user_id != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this upload session"
            )
        
        # Get merge session info before canceling
        merge_session_id = session.metadata.get("merge_session_id")
        video_index = session.metadata.get("video_index")
        
        # Cancel the upload
        success = await upload_service.cancel_upload(session_id)
        
        if success:
            logger.info(f"Video upload {session_id} cancelled for merge session {merge_session_id}, video {video_index}")
            return {
                "message": "Video upload cancelled successfully",
                "session_id": session_id,
                "merge_session_id": merge_session_id,
                "video_index": video_index
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to cancel video upload"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling upload session {session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel video upload"
        )


@router.delete("/merge-session/{merge_session_id}")
async def cancel_entire_merge_session(
    merge_session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Cancel an entire merge session
    
    Cancels all video uploads in the merge session and cleans up all temporary files.
    """
    try:
        # Find all upload sessions for this merge session
        sessions_to_cancel = []
        for session_id, session in upload_service.sessions.items():
            if (session.user_id == current_user and 
                session.metadata.get("merge_session_id") == merge_session_id):
                sessions_to_cancel.append(session_id)
        
        if not sessions_to_cancel:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merge session not found"
            )
        
        # Cancel all sessions
        cancelled_count = 0
        for session_id in sessions_to_cancel:
            try:
                success = await upload_service.cancel_upload(session_id)
                if success:
                    cancelled_count += 1
            except Exception as e:
                logger.warning(f"Failed to cancel session {session_id}: {str(e)}")
        
        logger.info(f"Merge session {merge_session_id} cancelled, {cancelled_count}/{len(sessions_to_cancel)} uploads cancelled")
        
        return {
            "message": "Merge session cancelled successfully",
            "merge_session_id": merge_session_id,
            "total_sessions": len(sessions_to_cancel),
            "cancelled_sessions": cancelled_count
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling merge session {merge_session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel merge session"
        )


@router.post("/merge-session/{merge_session_id}/trigger")
async def trigger_merge_manually(
    merge_session_id: str,
    quality_preset: str = Form("medium"),
    current_user: str = Depends(get_current_user)
):
    """
    Manually trigger video merging for a session
    
    This endpoint allows manual triggering of the merge process if it wasn't
    automatically triggered when the last video was uploaded.
    """
    try:
        # Check if merge is already in progress or completed
        merge_status = await merge_service.get_merge_status(merge_session_id)
        if merge_status:
            current_status = merge_status["status"]
            if current_status == MergeSessionStatus.COMPLETED:
                return {
                    "message": "Merge already completed",
                    "merge_session_id": merge_session_id,
                    "status": current_status,
                    "merged_video_url": merge_status.get("merged_video_url"),
                    "completed_at": merge_status.get("completed_at", "").isoformat() if merge_status.get("completed_at") else None
                }
            elif current_status == MergeSessionStatus.PROCESSING:
                return {
                    "message": "Merge already in progress",
                    "merge_session_id": merge_session_id,
                    "status": current_status,
                    "progress_percent": merge_status.get("progress", 0.0)
                }
        
        # Check readiness and initiate merge
        readiness = await merge_service.check_merge_readiness(merge_session_id, current_user)
        if not readiness["ready"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Videos not ready for merging: {readiness.get('error', 'Unknown error')}"
            )
        
        # Validate quality preset
        from config import settings
        if quality_preset not in settings.COMPRESSION_QUALITY_PRESETS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid quality preset '{quality_preset}'. Available presets: {list(settings.COMPRESSION_QUALITY_PRESETS.keys())}"
            )
        
        # Initiate merge
        merge_result = await merge_service.initiate_merge(merge_session_id, current_user, quality_preset)
        
        logger.info(f"Manual merge triggered for session {merge_session_id} by user {current_user}")
        
        return {
            "message": "Merge initiated successfully",
            "merge_session_id": merge_session_id,
            "status": merge_result["status"],
            "video_count": merge_result["video_count"],
            "estimated_duration_seconds": merge_result["estimated_duration_seconds"],
            "initiated_at": merge_result["initiated_at"]
        }
        
    except VideoMergeError as e:
        if e.error_code == "NOT_READY":
            raise HTTPException(status_code=400, detail=str(e))
        elif e.error_code == "FFMPEG_NOT_FOUND":
            raise HTTPException(status_code=503, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error triggering merge for session {merge_session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger merge"
        )


@router.get("/compression/presets")
async def get_compression_presets():
    """
    Get available compression quality presets
    
    Returns the available quality presets and their settings for video compression.
    """
    try:
        from config import settings
        
        presets = {}
        for preset_name, preset_config in settings.COMPRESSION_QUALITY_PRESETS.items():
            presets[preset_name] = {
                "name": preset_name,
                "description": f"CRF {preset_config['crf']}, {preset_config['preset']} preset, {preset_config['max_bitrate']} max bitrate",
                "crf": preset_config["crf"],
                "preset": preset_config["preset"],
                "max_bitrate": preset_config["max_bitrate"],
                "audio_bitrate": preset_config["audio_bitrate"],
                "recommended_for": {
                    "high": "Best quality, larger file size",
                    "medium": "Balanced quality and file size (recommended)",
                    "low": "Smaller file size, lower quality"
                }.get(preset_name, "Custom quality settings")
            }
        
        return {
            "available_presets": presets,
            "default_preset": "medium",
            "codec_info": {
                "video_codec": settings.VIDEO_CODEC,
                "audio_codec": settings.AUDIO_CODEC
            }
        }
        
    except Exception as e:
        logger.error(f"Error getting compression presets: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get compression presets"
        )


@router.get("/merge-session/{merge_session_id}/result")
async def get_merge_result(
    merge_session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Get the result of a completed merge session
    
    Returns the merged video URL and metadata if the merge is completed.
    """
    try:
        # Get merge status
        merge_status = await merge_service.get_merge_status(merge_session_id)
        if not merge_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merge session not found"
            )
        
        # Verify user access
        if merge_status["user_id"] != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this merge session"
            )
        
        status_value = merge_status["status"]
        
        if status_value == MergeSessionStatus.COMPLETED:
            merged_metadata = merge_status.get("merged_video_metadata", {})
            segments = merged_metadata.get("segments", [])
            
            return {
                "merge_session_id": merge_session_id,
                "status": status_value,
                "merged_video_url": merge_status.get("merged_video_url"),
                "merged_video_metadata": merged_metadata,
                "segment_metadata": segments,  # Extract segments for easier client access
                "file_size": merged_metadata.get("file_size"),
                "total_duration": merged_metadata.get("total_duration"),
                "segments": segments,  # Keep for backward compatibility
                "completed_at": merge_status.get("completed_at", "").isoformat() if merge_status.get("completed_at") else None,
                "storage_type": merged_metadata.get("storage_type", "unknown")
            }
        elif status_value == MergeSessionStatus.PROCESSING:
            return {
                "merge_session_id": merge_session_id,
                "status": status_value,
                "progress_percent": merge_status.get("progress", 0.0),
                "estimated_completion": None,  # Could calculate based on progress
                "started_at": merge_status.get("created_at", "").isoformat() if merge_status.get("created_at") else None
            }
        elif status_value == MergeSessionStatus.FAILED:
            return {
                "merge_session_id": merge_session_id,
                "status": status_value,
                "error_message": merge_status.get("error_message"),
                "failed_at": merge_status.get("failed_at", "").isoformat() if merge_status.get("failed_at") else None,
                "retryable": True  # Most merge failures are retryable
            }
        else:
            return {
                "merge_session_id": merge_session_id,
                "status": status_value,
                "created_at": merge_status.get("created_at", "").isoformat() if merge_status.get("created_at") else None
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting merge result for session {merge_session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get merge result"
        )


@router.delete("/merge-session/{merge_session_id}/cancel")
async def cancel_merge_session(
    merge_session_id: str,
    current_user: str = Depends(get_current_user)
):
    """
    Cancel an ongoing merge session
    
    Cancels the merge process and cleans up temporary files.
    """
    try:
        # Get merge status to verify user access
        merge_status = await merge_service.get_merge_status(merge_session_id)
        if not merge_status:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merge session not found"
            )
        
        # Verify user access
        if merge_status["user_id"] != current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this merge session"
            )
        
        # Check if merge can be cancelled
        current_status = merge_status["status"]
        if current_status in [MergeSessionStatus.COMPLETED, MergeSessionStatus.FAILED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot cancel merge with status: {current_status}"
            )
        
        # Cancel the merge
        success = await merge_service.cancel_merge(merge_session_id)
        
        if success:
            logger.info(f"Merge session {merge_session_id} cancelled by user {current_user}")
            return {
                "message": "Merge session cancelled successfully",
                "merge_session_id": merge_session_id,
                "previous_status": current_status,
                "cancelled_at": datetime.utcnow().isoformat()
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to cancel merge session"
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling merge session {merge_session_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel merge session"
        )


@router.get("/merged/{video_file_id}")
async def stream_merged_video(
    video_file_id: str,
    request: Request,
    current_user: str = Depends(get_current_user)
):
    """
    Stream a merged video file
    
    Provides streaming access to merged videos with range support for video playback.
    """
    try:
        import aiofiles
        
        # Find the merge session that produced this video
        merge_session = None
        for session_id, session in merge_service.merge_sessions.items():
            if (session.get("merged_video_metadata", {}).get("video_file_id") == video_file_id and
                session.get("user_id") == current_user):
                merge_session = session
                break
        
        if not merge_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merged video not found or access denied"
            )
        
        if merge_session["status"] != MergeSessionStatus.COMPLETED:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merged video not ready"
            )
        
        # Get video file path
        video_path = Path(merge_session["merged_video_path"])
        if not video_path.exists():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Merged video file not found"
            )
        
        # Handle range requests for video streaming
        range_header = request.headers.get('range')
        file_size = video_path.stat().st_size
        
        if range_header:
            # Parse range header
            range_match = range_header.replace('bytes=', '').split('-')
            start = int(range_match[0]) if range_match[0] else 0
            end = int(range_match[1]) if range_match[1] else file_size - 1
            
            # Ensure valid range
            start = max(0, start)
            end = min(file_size - 1, end)
            content_length = end - start + 1
            
            # Create streaming response for range request
            async def stream_range():
                async with aiofiles.open(video_path, 'rb') as f:
                    await f.seek(start)
                    remaining = content_length
                    chunk_size = 8192
                    
                    while remaining > 0:
                        read_size = min(chunk_size, remaining)
                        chunk = await f.read(read_size)
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            
            headers = {
                'Content-Range': f'bytes {start}-{end}/{file_size}',
                'Accept-Ranges': 'bytes',
                'Content-Length': str(content_length),
                'Content-Type': 'video/mp4'
            }
            
            return StreamingResponse(
                stream_range(),
                status_code=206,
                headers=headers
            )
        else:
            # Return full file
            return FileResponse(
                video_path,
                media_type='video/mp4',
                headers={
                    'Accept-Ranges': 'bytes',
                    'Content-Length': str(file_size)
                }
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error streaming merged video {video_file_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to stream merged video"
        )


@router.post("/upload-for-merge")
async def upload_videos_for_merge_direct(
    video_0: UploadFile = File(...),
    video_1: UploadFile = File(...),
    video_2: UploadFile = File(...),
    metadata_0: str = Form(...),
    metadata_1: str = Form(...),
    metadata_2: str = Form(...),
    current_user: str = Depends(get_current_user)
):
    """
    Direct upload endpoint for multiple videos that will be merged server-side
    
    This is a simplified endpoint that accepts 3 video files directly and
    immediately processes them for merging, returning the merged video URL
    and segment metadata.
    """
    try:
        import json
        import tempfile
        import shutil
        from pathlib import Path
        
        logger.info(f"Direct multi-video upload started for user {current_user}")
        
        # Parse metadata for each video
        try:
            meta_0 = json.loads(metadata_0)
            meta_1 = json.loads(metadata_1)
            meta_2 = json.loads(metadata_2)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid JSON in metadata: {str(e)}"
            )
        
        videos = [
            {"file": video_0, "metadata": meta_0},
            {"file": video_1, "metadata": meta_1},
            {"file": video_2, "metadata": meta_2}
        ]
        
        # Validate video files
        from config import settings
        for i, video_data in enumerate(videos):
            video_file = video_data["file"]
            
            # Check file size
            if video_file.size and video_file.size > settings.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i} file size exceeds maximum allowed size"
                )
            
            # Check MIME type
            if video_file.content_type not in settings.ALLOWED_VIDEO_TYPES:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Video {i} MIME type {video_file.content_type} is not allowed"
                )
        
        # Generate merge session ID
        merge_session_id = str(uuid.uuid4())
        
        # Create temporary directory for processing
        temp_dir = Path(tempfile.mkdtemp(prefix=f"merge_{merge_session_id}_"))
        
        try:
            # Save uploaded files to temporary directory
            video_paths = []
            for i, video_data in enumerate(videos):
                video_file = video_data["file"]
                video_path = temp_dir / f"video_{i}.mp4"
                
                # Save file
                with open(video_path, "wb") as buffer:
                    shutil.copyfileobj(video_file.file, buffer)
                
                video_paths.append(video_path)
                logger.debug(f"Saved video {i} to {video_path}")
            
            # Initiate merge using the video merge service
            logger.info(f"Initiating merge for session {merge_session_id}")
            
            # Create a mock merge session for the service
            merge_service.merge_sessions[merge_session_id] = {
                "user_id": current_user,
                "status": MergeSessionStatus.PROCESSING,
                "video_paths": [str(p) for p in video_paths],
                "video_metadata": [v["metadata"] for v in videos],
                "created_at": datetime.utcnow(),
                "progress": 0.0
            }
            
            # Process merge synchronously for direct response
            try:
                merge_result = await merge_service._process_merge_sync(
                    merge_session_id=merge_session_id,
                    video_paths=video_paths,
                    quality="medium"
                )
                
                if merge_result["success"]:
                    logger.info(f"Merge completed successfully for session {merge_session_id}")
                    
                    return JSONResponse(
                        content={
                            "success": True,
                            "merge_session_id": merge_session_id,
                            "merged_video_url": merge_result["merged_video_url"],
                            "segment_metadata": merge_result["segment_metadata"],
                            "total_duration": merge_result.get("total_duration", 0),
                            "created_at": datetime.utcnow().isoformat()
                        },
                        headers={
                            "X-Merge-Session-ID": merge_session_id,
                            "X-Merge-Status": "completed"
                        }
                    )
                else:
                    raise HTTPException(
                        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                        detail=f"Video merge failed: {merge_result.get('error', 'Unknown error')}"
                    )
                    
            except VideoMergeError as e:
                logger.error(f"Video merge error for session {merge_session_id}: {str(e)}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Video merge failed: {str(e)}"
                )
                
        finally:
            # Clean up temporary directory
            try:
                shutil.rmtree(temp_dir)
                logger.debug(f"Cleaned up temporary directory {temp_dir}")
            except Exception as e:
                logger.warning(f"Failed to clean up temporary directory {temp_dir}: {e}")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in direct multi-video upload for user {current_user}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process multi-video upload"
        )