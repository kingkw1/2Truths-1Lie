"""
S3 Media API Endpoints - Direct AWS S3 integration for media upload, streaming, and deletion
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, status
from fastapi.responses import JSONResponse
from typing import Optional
from pydantic import BaseModel
import logging
import base64

from services.s3_media_service import get_s3_media_service, S3MediaService
from services.auth_service import get_current_user  # Using simpler auth dependency

logger = logging.getLogger(__name__)

# Create router for S3 media endpoints
router = APIRouter(prefix="/api/v1/s3-media", tags=["s3-media"])

# Base64 upload model for React Native compatibility
class Base64UploadRequest(BaseModel):
    filename: str
    contentType: str
    fileContent: str  # base64 encoded file content
    metadata: Optional[str] = None

@router.post("/upload-base64")
async def upload_video_base64(
    request: Base64UploadRequest,
    current_user: str = Depends(get_current_user),
    s3_service: S3MediaService = Depends(get_s3_media_service)
):
    """
    Upload video file from base64 content (React Native compatibility)
    
    - **filename**: Original filename
    - **contentType**: MIME type (should be video/mp4)
    - **fileContent**: Base64 encoded file content
    - **metadata**: Optional JSON metadata string
    - **Returns**: Media ID and storage URL for successful upload
    - **Authentication**: Required
    """
    try:
        # Decode base64 content
        try:
            file_content = base64.b64decode(request.fileContent)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 content: {str(e)}"
            )
        
        # Validate file content
        if len(file_content) == 0:
            raise HTTPException(
                status_code=400,
                detail="Decoded file content is empty"
            )
        
        # Parse metadata if provided
        parsed_metadata = None
        if request.metadata:
            try:
                import json
                parsed_metadata = json.loads(request.metadata)
                logger.info(f"Received video metadata: {parsed_metadata}")
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid metadata JSON: {e}")
        
        # Upload to S3
        media_id = await s3_service.upload_video_to_s3(
            file_content=file_content,
            content_type=request.contentType,
            metadata=parsed_metadata
        )
        
        # Generate signed URL
        storage_url = await s3_service.generate_signed_url(media_id, expires_in=3600)
        
        logger.info(f"Base64 video uploaded successfully by user {current_user}: {media_id}")
        
        return JSONResponse(
            content={
                "success": True,
                "media_id": media_id,
                "storage_url": storage_url,
                "message": "Video uploaded successfully from base64",
                "file_info": {
                    "original_filename": request.filename,
                    "content_type": request.contentType,
                    "file_size": len(file_content)
                },
                "metadata": parsed_metadata
            },
            status_code=status.HTTP_201_CREATED,
            headers={
                "X-Media-ID": media_id,
                "X-Storage-Provider": "AWS-S3"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected base64 upload error for user {current_user}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during base64 upload"
        )

@router.post("/upload")
async def upload_video_to_s3(
    file: UploadFile = File(...),
    metadata: Optional[str] = None,  # JSON string with video metadata
    current_user: str = Depends(get_current_user),  # Authentication required
    s3_service: S3MediaService = Depends(get_s3_media_service)
):
    """
    Upload video file directly to AWS S3
    
    - **file**: Video file (multipart/form-data)
    - **Returns**: Media ID and storage URL for successful upload
    - **Authentication**: Required
    - **File validation**: Only video/* MIME types accepted, max 100MB
    """
    try:
        # Validate that a file was uploaded
        if not file:
            raise HTTPException(
                status_code=400,
                detail="No file provided"
            )
        
        # Get file content and metadata
        file_content = await file.read()
        content_type = file.content_type or "application/octet-stream"
        
        # Additional validation for empty files
        if len(file_content) == 0:
            raise HTTPException(
                status_code=400,
                detail="Uploaded file is empty"
            )
        
        # Parse metadata if provided
        parsed_metadata = None
        if metadata:
            try:
                import json
                parsed_metadata = json.loads(metadata)
                logger.info(f"Received video metadata: {parsed_metadata}")
            except json.JSONDecodeError as e:
                logger.warning(f"Invalid metadata JSON: {e}")
                # Continue without metadata rather than failing
        
        # Upload to S3 (includes validation)
        media_id = await s3_service.upload_video_to_s3(
            file_content=file_content,
            content_type=content_type,
            metadata=parsed_metadata
        )
        
        # Generate initial signed URL for immediate access
        storage_url = await s3_service.generate_signed_url(media_id, expires_in=3600)
        
        # Log successful upload
        logger.info(f"Video uploaded successfully by user {current_user}: {media_id}")
        
        return JSONResponse(
            content={
                "success": True,
                "media_id": media_id,
                "storage_url": storage_url,
                "message": "Video uploaded successfully to S3",
                "file_info": {
                    "original_filename": file.filename,
                    "content_type": content_type,
                    "file_size": len(file_content)
                },
                "metadata": parsed_metadata
            },
            status_code=status.HTTP_201_CREATED,
            headers={
                "X-Media-ID": media_id,
                "X-Storage-Provider": "AWS-S3"
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors, etc.)
        raise
    except Exception as e:
        logger.error(f"Unexpected upload error for user {current_user}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Internal server error during upload"
        )

@router.get("/{media_id}")
async def get_video_streaming_url(
    media_id: str,
    expires_in: Optional[int] = 3600,  # Default 1 hour
    current_user: str = Depends(get_current_user),  # Authentication required
    s3_service: S3MediaService = Depends(get_s3_media_service)
):
    """
    Generate signed URL for secure video streaming from S3
    
    - **media_id**: Unique identifier for the video
    - **expires_in**: URL expiration time in seconds (default: 3600 = 1 hour)
    - **Returns**: Signed URL for video streaming
    - **Authentication**: Required
    """
    try:
        # Validate expires_in parameter
        if expires_in <= 0 or expires_in > 86400:  # Max 24 hours
            raise HTTPException(
                status_code=400,
                detail="expires_in must be between 1 and 86400 seconds (24 hours)"
            )
        
        # Check if media exists before generating URL
        if not await s3_service.check_media_exists(media_id):
            raise HTTPException(
                status_code=404,
                detail=f"Media with ID '{media_id}' not found"
            )
        
        # Generate signed URL for streaming
        signed_url = await s3_service.generate_signed_url(
            media_id=media_id,
            expires_in=expires_in
        )
        
        # Log access
        logger.info(f"Generated streaming URL for user {current_user}: {media_id}")
        
        return JSONResponse(
            content={
                "success": True,
                "media_id": media_id,
                "signed_url": signed_url,
                "expires_in": expires_in,
                "expires_at": None,  # Could calculate actual expiration timestamp
                "message": "Signed URL generated successfully"
            },
            headers={
                "X-Media-ID": media_id,
                "X-URL-Expires-In": str(expires_in),
                "Cache-Control": f"private, max-age={min(expires_in, 300)}"  # Cache for 5 min max
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error generating signed URL for user {current_user}, media {media_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to generate streaming URL"
        )

@router.delete("/{media_id}")
async def delete_video_from_s3(
    media_id: str,
    current_user: str = Depends(get_current_user),  # Authentication required
    s3_service: S3MediaService = Depends(get_s3_media_service)
):
    """
    Delete video from AWS S3 bucket
    
    - **media_id**: Unique identifier for the video to delete
    - **Returns**: Success or error response
    - **Authentication**: Required
    - **Security**: Only authenticated users can delete media
    """
    try:
        # Check if media exists first
        if not await s3_service.check_media_exists(media_id):
            raise HTTPException(
                status_code=404,
                detail=f"Media with ID '{media_id}' not found"
            )
        
        # Delete from S3
        success = await s3_service.delete_video_from_s3(media_id)
        
        if success:
            logger.info(f"Video deleted successfully by user {current_user}: {media_id}")
            return JSONResponse(
                content={
                    "success": True,
                    "media_id": media_id,
                    "message": "Video deleted successfully from S3"
                },
                status_code=status.HTTP_200_OK,
                headers={
                    "X-Media-ID": media_id,
                    "X-Operation": "DELETE"
                }
            )
        else:
            # This shouldn't happen since we check existence first
            raise HTTPException(
                status_code=404,
                detail="Media not found during deletion"
            )
            
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error deleting video for user {current_user}, media {media_id}: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete video from S3"
        )

# Health check endpoint for S3 connectivity
@router.get("/health/s3")
async def check_s3_health(
    s3_service: S3MediaService = Depends(get_s3_media_service)
):
    """
    Check S3 service health and connectivity
    
    - **Returns**: S3 connection status and bucket info
    - **No authentication required** (for monitoring)
    """
    try:
        # Test S3 connectivity by listing bucket (minimal operation)
        s3_service.s3_client.head_bucket(Bucket=s3_service.bucket_name)
        
        return JSONResponse(
            content={
                "success": True,
                "service": "S3 Media Service",
                "bucket": s3_service.bucket_name,
                "region": s3_service.aws_region,
                "status": "healthy",
                "message": "S3 connection successful"
            },
            status_code=status.HTTP_200_OK
        )
        
    except Exception as e:
        logger.error(f"S3 health check failed: {e}")
        return JSONResponse(
            content={
                "success": False,
                "service": "S3 Media Service",
                "status": "unhealthy",
                "error": str(e),
                "message": "S3 connection failed"
            },
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE
        )
