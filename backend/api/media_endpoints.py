"""
Media Upload API Endpoints - Secure video upload and streaming
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Header, Request, status
from fastapi.responses import StreamingResponse, JSONResponse
from typing import Optional, Dict, Any
import aiofiles
from pathlib import Path
from datetime import datetime
import logging
import time

logger = logging.getLogger(__name__)

from models import InitiateUploadRequest, UploadChunkResponse, CompleteUploadResponse
from services.media_upload_service import MediaUploadService
from services.auth_service import (
    get_current_user, 
    get_current_user_with_permissions,
    require_permission,
    check_upload_rate_limit,
    check_download_rate_limit,
    auth_service
)
from services.upload_service import UploadServiceError, UploadErrorType

router = APIRouter(prefix="/api/v1/media", tags=["media"])
media_service = MediaUploadService()

@router.post("/upload/initiate")
async def initiate_video_upload(
    filename: str = Form(...),
    file_size: int = Form(...),
    duration_seconds: float = Form(...),
    mime_type: str = Form(...),
    file_hash: Optional[str] = Form(None),
    user_agent: Optional[str] = Header(None),
    current_user: str = Depends(check_upload_rate_limit)
):
    """Initiate secure video upload session"""
    try:
        # Validate video file
        validation = media_service.validate_video_file(filename, file_size)
        if not validation["valid"]:
            raise HTTPException(status_code=400, detail=validation["error"])
        
        # Prepare metadata
        metadata = {
            "user_agent": user_agent,
            "client_mime_type": mime_type
        }
        
        # Initiate upload
        result = await media_service.initiate_video_upload(
            user_id=current_user,
            filename=filename,
            file_size=file_size,
            duration_seconds=duration_seconds,
            metadata=metadata
        )
        
        return JSONResponse(
            content=result,
            headers={
                "X-Upload-Session-ID": result["session_id"],
                "X-Chunk-Size": str(result["chunk_size"]),
                "X-Total-Chunks": str(result["total_chunks"])
            }
        )
        
    except UploadServiceError as e:
        if e.error_type == UploadErrorType.VALIDATION_ERROR:
            raise HTTPException(status_code=400, detail=str(e))
        elif e.error_type == UploadErrorType.QUOTA_EXCEEDED:
            raise HTTPException(status_code=429, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Upload initiation failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.post("/upload/{session_id}/chunk/{chunk_number}")
async def upload_video_chunk(
    session_id: str,
    chunk_number: int,
    file: UploadFile = File(...),
    chunk_hash: Optional[str] = Form(None),
    current_user: str = Depends(require_permission("media:upload"))
):
    """Upload video chunk with validation"""
    try:
        # Verify session belongs to user
        session = await media_service.upload_service.get_upload_status(session_id)
        if not session or session.user_id != current_user:
            raise HTTPException(status_code=403, detail="Access denied")
        
        # Read chunk data
        chunk_data = await file.read()
        
        # Upload chunk
        updated_session, was_uploaded = await media_service.upload_service.upload_chunk(
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
            remaining_chunks=media_service.upload_service.get_remaining_chunks(session_id),
            progress_percent=media_service.upload_service.get_progress_percent(session_id)
        )
        
    except UploadServiceError as e:
        if e.error_type == UploadErrorType.VALIDATION_ERROR:
            raise HTTPException(status_code=400, detail=str(e))
        elif e.error_type == UploadErrorType.SESSION_NOT_FOUND:
            raise HTTPException(status_code=404, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Chunk upload failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.post("/upload/{session_id}/complete")
async def complete_video_upload(
    session_id: str,
    file_hash: Optional[str] = Form(None),
    current_user: str = Depends(require_permission("media:upload"))
):
    """Complete video upload and get streaming URL"""
    try:
        result = await media_service.complete_video_upload(
            session_id=session_id,
            user_id=current_user,
            file_hash=file_hash
        )
        
        return JSONResponse(
            content=result,
            headers={
                "X-Media-ID": result["media_id"],
                "X-Streaming-URL": result["streaming_url"]
            }
        )
        
    except UploadServiceError as e:
        if e.error_type == UploadErrorType.SESSION_NOT_FOUND:
            raise HTTPException(status_code=404, detail=str(e))
        elif e.error_type == UploadErrorType.HASH_MISMATCH:
            raise HTTPException(status_code=400, detail=str(e))
        else:
            raise HTTPException(status_code=500, detail="Upload completion failed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected error: {str(e)}")

@router.get("/stream/{media_id}")
async def stream_video(
    media_id: str,
    request: Request,
    range: Optional[str] = Header(None),
    user: Optional[str] = None,
    expires: Optional[str] = None,
    signature: Optional[str] = None
):
    """Stream video with range support for progressive download from cloud or local storage"""
    try:
        authorized_user = None
        
        # Check for signed URL access first (bypasses normal auth for direct links)
        if user and expires and signature:
            logger.info(f"=== SIGNED URL VERIFICATION ===")
            logger.info(f"Media ID: {media_id}")
            logger.info(f"User: {user}")
            logger.info(f"Expires: {expires}")
            logger.info(f"Signature: {signature}")
            
            if not auth_service.verify_signed_url(media_id, user, expires, signature):
                logger.error(f"Signed URL verification failed for media {media_id}, user {user}")
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid or expired signed URL"
                )
            # Use the signed URL user for media access
            authorized_user = user
            logger.info(f"✅ Signed URL verified successfully for user {user}")
        else:
            # Fall back to regular authentication
            try:
                from services.auth_service import get_current_user
                authorized_user = await get_current_user(request)
                
                # Check download rate limit for authenticated users
                if not auth_service.check_rate_limit(authorized_user, "download", limit=100, window=3600):
                    raise HTTPException(
                        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                        detail="Download rate limit exceeded. Try again later."
                    )
                logger.info(f"✅ Regular authentication successful for user {authorized_user}")
            except HTTPException as e:
                logger.error(f"❌ Authentication failed: {e.detail}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication required"
                )
        
        # Get media streaming info
        stream_info = await media_service.stream_media(media_id, authorized_user, range)
        
        # Handle cloud storage redirect
        if stream_info.get("streaming_type") == "redirect":
            # Redirect to signed URL for direct cloud streaming
            from fastapi.responses import RedirectResponse
            return RedirectResponse(
                url=stream_info["signed_url"],
                status_code=302,
                headers={
                    "Cache-Control": "public, max-age=300",  # 5 minutes cache for redirect
                    "X-Storage-Type": "cloud"
                }
            )
        
        # Handle local storage streaming
        elif stream_info.get("streaming_type") == "local":
            def generate_chunks():
                with open(stream_info["file_path"], "rb") as f:
                    f.seek(stream_info["start"])
                    remaining = stream_info["content_length"]
                    chunk_size = 8192  # 8KB chunks
                    
                    while remaining > 0:
                        read_size = min(chunk_size, remaining)
                        chunk = f.read(read_size)
                        if not chunk:
                            break
                        remaining -= len(chunk)
                        yield chunk
            
            # Prepare headers
            headers = {
                "Content-Type": stream_info["mime_type"],
                "Accept-Ranges": "bytes",
                "Content-Length": str(stream_info["content_length"]),
                "Cache-Control": "public, max-age=3600",
                "X-Storage-Type": "local"
            }
            
            # Add range headers if applicable
            if range and stream_info["supports_range"]:
                headers["Content-Range"] = f"bytes {stream_info['start']}-{stream_info['end']}/{stream_info['file_size']}"
                status_code = 206  # Partial Content
            else:
                status_code = 200
            
            return StreamingResponse(
                generate_chunks(),
                status_code=status_code,
                headers=headers,
                media_type=stream_info["mime_type"]
            )
        
        else:
            raise HTTPException(status_code=500, detail="Unknown streaming type")
        
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Media not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Streaming error: {str(e)}")

@router.get("/info/{media_id}")
async def get_media_info(
    media_id: str,
    current_user: str = Depends(require_permission("media:read"))
):
    """Get media information"""
    try:
        info = await media_service.get_media_info(media_id, current_user)
        if not info:
            raise HTTPException(status_code=404, detail="Media not found")
        
        return info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error retrieving media info: {str(e)}")

@router.delete("/delete/{media_id}")
async def delete_media(
    media_id: str,
    current_user: str = Depends(require_permission("media:delete"))
):
    """Delete media file"""
    try:
        success = await media_service.delete_media(media_id, current_user)
        if not success:
            raise HTTPException(status_code=404, detail="Media not found")
        
        return {"message": "Media deleted successfully"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error deleting media: {str(e)}")

@router.post("/validate")
async def validate_video_file(
    filename: str = Form(...),
    file_size: int = Form(...),
    duration_seconds: Optional[float] = Form(None),
    mime_type: Optional[str] = Form(None),
    current_user: str = Depends(get_current_user)
):
    """Validate video file before upload with comprehensive checks"""
    try:
        # Use provided mime_type or guess from filename
        if not mime_type:
            import mimetypes
            mime_type = mimetypes.guess_type(filename)[0]
        
        validation = media_service.validate_video_file(
            filename=filename, 
            file_size=file_size, 
            duration_seconds=duration_seconds
        )
        
        # Add additional validation context
        validation["validation_timestamp"] = datetime.utcnow().isoformat()
        validation["user_id"] = current_user
        
        return validation
        
    except Exception as e:
        logger.error(f"Validation error for user {current_user}: {e}")
        raise HTTPException(status_code=500, detail=f"Validation error: {str(e)}")

@router.get("/upload/{session_id}/status")
async def get_upload_status(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """Get upload session status"""
    try:
        session = await media_service.upload_service.get_upload_status(session_id)
        if not session or session.user_id != current_user:
            raise HTTPException(status_code=404, detail="Upload session not found")
        
        return {
            "session_id": session_id,
            "status": session.status,
            "progress_percent": media_service.upload_service.get_progress_percent(session_id),
            "uploaded_chunks": session.uploaded_chunks,
            "remaining_chunks": media_service.upload_service.get_remaining_chunks(session_id),
            "created_at": session.created_at,
            "updated_at": session.updated_at
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting upload status: {str(e)}")

@router.delete("/upload/{session_id}")
async def cancel_upload(
    session_id: str,
    current_user: str = Depends(get_current_user)
):
    """Cancel upload session"""
    try:
        session = await media_service.upload_service.get_upload_status(session_id)
        if not session or session.user_id != current_user:
            raise HTTPException(status_code=404, detail="Upload session not found")
        
        success = await media_service.upload_service.cancel_upload(session_id)
        if success:
            return {"message": "Upload cancelled successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to cancel upload")
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error cancelling upload: {str(e)}")

@router.get("/library")
async def get_user_media_library(
    page: int = 1,
    limit: int = 50,
    current_user: str = Depends(get_current_user)
):
    """Get user's media library for cross-device access"""
    try:
        library = await media_service.get_user_media_library(
            user_id=current_user,
            page=page,
            limit=limit
        )
        
        return JSONResponse(
            content=library,
            headers={
                "X-Total-Count": str(library["totalCount"]),
                "X-Page": str(page),
                "X-Has-More": str(library["hasMore"]).lower()
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching media library: {str(e)}")

@router.get("/verify/{media_id}")
async def verify_media_access(
    media_id: str,
    current_user: str = Depends(require_permission("media:read"))
):
    """Verify media accessibility across devices"""
    try:
        verification = await media_service.verify_media_access(
            media_id=media_id,
            user_id=current_user
        )
        
        return verification
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error verifying media access: {str(e)}")

@router.post("/generate-signed-url/{media_id}")
async def generate_signed_url(
    media_id: str,
    request: Request,
    expires_in: int = 3600,  # 1 hour default
    current_user: str = Depends(require_permission("media:read"))
):
    """Generate signed URL for secure media access without authentication"""
    try:
        # Verify user has access to this media
        verification = await media_service.verify_media_access(
            media_id=media_id,
            user_id=current_user
        )
        
        if not verification.get("accessible", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this media"
            )
        
        # Generate signed URL
        signed_url = auth_service.create_signed_url(media_id, current_user, expires_in)
        
        return {
            "signed_url": f"{request.base_url.rstrip('/')}{signed_url}",
            "expires_in": expires_in,
            "expires_at": int(time.time()) + expires_in,
            "media_id": media_id
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating signed URL: {str(e)}")

@router.post("/sync")
async def sync_media_state(
    request: Request,
    current_user: str = Depends(get_current_user)
):
    """Sync media state across devices"""
    try:
        body = await request.json()
        local_media_ids = body.get("localMediaIds", [])
        device_info = body.get("deviceInfo", {})
        
        sync_result = await media_service.sync_media_state(
            user_id=current_user,
            local_media_ids=local_media_ids,
            device_info=device_info
        )
        
        return sync_result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error syncing media state: {str(e)}")

@router.post("/cdn/signed-url/{media_id}")
async def generate_cdn_signed_url(
    media_id: str,
    request: Request,
    expires_in: int = 7200,  # 2 hours default for CDN
    current_user: str = Depends(require_permission("media:read"))
):
    """Generate CDN signed URL for global scalable delivery"""
    try:
        # Get client information for optimization
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        # Generate CDN signed URL
        cdn_result = await media_service.get_cdn_signed_url(
            media_id=media_id,
            user_id=current_user,
            expires_in=expires_in,
            client_ip=client_ip,
            user_agent=user_agent
        )
        
        if not cdn_result:
            raise HTTPException(
                status_code=503,
                detail="CDN signed URLs not available - check CDN configuration"
            )
        
        return JSONResponse(
            content=cdn_result,
            headers={
                "X-Delivery-Type": "cdn_signed",
                "X-Global-Delivery": "true",
                "X-CDN-Optimized": "true"
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating CDN signed URL: {str(e)}")

@router.get("/{id}")
async def serve_media_asset(
    id: str,
    expires_in: Optional[int] = 3600,  # Default 1 hour
    current_user: str = Depends(require_permission("media:read"))
):
    """
    Serve video assets with secure signed URLs
    
    - **id**: Unique media identifier
    - **expires_in**: URL expiration time in seconds (default: 3600 = 1 hour, max: 86400 = 24 hours)
    - **Returns**: Secure signed URL for media access
    - **Authentication**: Required
    """
    try:
        # Validate expires_in parameter
        if expires_in <= 0 or expires_in > 86400:  # Max 24 hours
            raise HTTPException(
                status_code=400,
                detail="expires_in must be between 1 and 86400 seconds (24 hours)"
            )
        
        # Verify user has access to this media
        verification = await media_service.verify_media_access(
            media_id=id,
            user_id=current_user
        )
        
        if not verification.get("accessible", False):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this media"
            )
        
        # Get media info to determine storage type
        media_info = await media_service.get_media_info(id, current_user)
        if not media_info:
            raise HTTPException(status_code=404, detail="Media not found")
        
        # Generate signed URL based on storage type
        if media_info.get("storage_type") == "cloud" and media_service.use_cloud_storage:
            # Generate cloud storage signed URL
            signed_url = await media_service.cloud_storage.get_file_url(
                key=media_info.get("cloud_key", f"media/{id}"),
                expires_in=expires_in
            )
        else:
            # Generate local signed URL using auth service
            from services.auth_service import auth_service
            signed_url_path = auth_service.create_signed_url(id, current_user, expires_in)
            # Convert relative path to full URL
            signed_url = f"/api/v1/media/stream{signed_url_path.replace('/api/v1/media/stream', '')}"
        
        # Calculate expiration timestamp
        import time
        expires_at = int(time.time()) + expires_in
        
        # Log access
        logger.info(f"Generated signed URL for user {current_user}: {id}")
        
        return JSONResponse(
            content={
                "success": True,
                "media_id": id,
                "signed_url": signed_url,
                "expires_in": expires_in,
                "expires_at": expires_at,
                "storage_type": media_info.get("storage_type", "local"),
                "content_type": media_info.get("content_type"),
                "file_size": media_info.get("file_size"),
                "message": "Signed URL generated successfully"
            },
            headers={
                "X-Media-ID": id,
                "X-URL-Expires-In": str(expires_in),
                "X-Storage-Type": media_info.get("storage_type", "local"),
                "Cache-Control": f"private, max-age={min(expires_in, 300)}"  # Cache for 5 min max
            }
        )
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error serving media asset for user {current_user}, media {id}: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to serve media asset: {str(e)}")

@router.get("/optimized/{media_id}")
async def get_optimized_streaming_url(
    media_id: str,
    request: Request,
    device_type: Optional[str] = None,
    prefer_signed: bool = True,
    current_user: str = Depends(require_permission("media:read"))
):
    """Get optimized streaming URL based on client capabilities and global delivery"""
    try:
        # Get client information
        client_ip = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")
        
        # Get optimized streaming URL
        result = await media_service.get_optimized_streaming_url(
            media_id=media_id,
            user_id=current_user,
            client_ip=client_ip,
            user_agent=user_agent,
            device_type=device_type,
            prefer_signed=prefer_signed
        )
        
        # Set appropriate headers based on delivery type
        headers = {
            "X-Delivery-Type": result.get("delivery_type", "direct"),
            "X-Global-Delivery": str(result.get("global_delivery", False)).lower()
        }
        
        if result.get("optimization"):
            headers["X-CDN-Optimized"] = "true"
            headers["Cache-Control"] = result["optimization"].get("cache_control", "public, max-age=3600")
        
        return JSONResponse(content=result, headers=headers)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting optimized streaming URL: {str(e)}")

@router.post("/cdn/invalidate/{media_id}")
async def invalidate_media_cache(
    media_id: str,
    current_user: str = Depends(require_permission("media:admin"))
):
    """Invalidate CDN cache for specific media (admin only)"""
    try:
        success = await media_service.invalidate_media_cache(media_id, current_user)
        
        if not success:
            raise HTTPException(
                status_code=503,
                detail="CDN cache invalidation not available or failed"
            )
        
        return {
            "message": f"CDN cache invalidated for media {media_id}",
            "media_id": media_id,
            "invalidated_at": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error invalidating CDN cache: {str(e)}")

@router.get("/cdn/stats")
async def get_global_delivery_stats(
    current_user: str = Depends(require_permission("media:admin"))
):
    """Get global delivery statistics from CDN (admin only)"""
    try:
        stats = await media_service.get_global_delivery_stats()
        
        if not stats:
            return {
                "cdn_enabled": False,
                "message": "CDN not configured or not available"
            }
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error getting global delivery stats: {str(e)}")

@router.get("/cdn/health")
async def check_cdn_health():
    """Check CDN service health and configuration"""
    try:
        from config import settings
        
        health_status = {
            "cdn_configured": bool(settings.CDN_BASE_URL),
            "cdn_enabled": settings.ENABLE_GLOBAL_CDN,
            "distribution_id": bool(settings.CDN_DISTRIBUTION_ID),
            "private_key_configured": bool(settings.CDN_PRIVATE_KEY_PATH),
            "key_pair_configured": bool(settings.CDN_KEY_PAIR_ID),
            "signed_urls_available": False,
            "cloud_storage_enabled": settings.USE_CLOUD_STORAGE,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        # Check if CDN service is properly initialized
        if media_service.use_cdn and media_service.cdn_service:
            health_status["signed_urls_available"] = media_service.cdn_service.is_enabled()
            
            # Try to get distribution info
            try:
                distribution_info = await media_service.cdn_service.get_distribution_info()
                if distribution_info:
                    health_status["distribution_status"] = distribution_info.get("status")
                    health_status["distribution_enabled"] = distribution_info.get("enabled")
            except Exception as e:
                health_status["distribution_error"] = str(e)
        
        # Determine overall health
        if health_status["cdn_enabled"] and health_status["signed_urls_available"]:
            health_status["overall_status"] = "healthy"
        elif health_status["cdn_configured"]:
            health_status["overall_status"] = "degraded"
        else:
            health_status["overall_status"] = "disabled"
        
        return health_status
        
    except Exception as e:
        return {
            "overall_status": "error",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }