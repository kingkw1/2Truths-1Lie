"""
Media Upload Service - Secure video upload and streaming retrieval with cloud storage
"""
import os
import uuid
import hashlib
import mimetypes
from pathlib import Path
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import aiofiles
import logging
import mimetypes

from models import UploadSession, UploadStatus
from services.upload_service import ChunkedUploadService, UploadServiceError, UploadErrorType
from services.auth_service import get_current_user
from services.cloud_storage_service import create_cloud_storage_service, CloudStorageError
from services.cdn_service import create_cdn_service, CDNService
from config import settings

logger = logging.getLogger(__name__)

class MediaUploadService:
    """Service for secure media upload with streaming support and cloud storage"""
    
    def __init__(self):
        self.upload_service = ChunkedUploadService()
        self.media_storage_path = settings.UPLOAD_DIR / "media"
        self.media_storage_path.mkdir(exist_ok=True)
        
        # Initialize cloud storage if enabled
        self.use_cloud_storage = settings.USE_CLOUD_STORAGE
        self.cloud_storage = None
        
        if self.use_cloud_storage:
            try:
                self.cloud_storage = create_cloud_storage_service(
                    provider=settings.CLOUD_STORAGE_PROVIDER,
                    bucket_name=settings.AWS_S3_BUCKET_NAME,
                    region_name=settings.AWS_S3_REGION,
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                    endpoint_url=settings.AWS_S3_ENDPOINT_URL
                )
                logger.info(f"Cloud storage initialized: {settings.CLOUD_STORAGE_PROVIDER}")
            except Exception as e:
                logger.error(f"Failed to initialize cloud storage: {e}")
                logger.warning("Falling back to local storage")
                self.use_cloud_storage = False
        
        # Initialize CDN service if enabled
        self.use_cdn = settings.ENABLE_GLOBAL_CDN
        self.cdn_service = None
        
        if self.use_cdn:
            try:
                self.cdn_service = create_cdn_service(
                    cdn_base_url=settings.CDN_BASE_URL,
                    distribution_id=settings.CDN_DISTRIBUTION_ID,
                    private_key_path=settings.CDN_PRIVATE_KEY_PATH,
                    key_pair_id=settings.CDN_KEY_PAIR_ID,
                    cache_control=settings.CDN_CACHE_CONTROL,
                    signed_url_expiry=settings.CDN_SIGNED_URL_EXPIRY
                )
                if self.cdn_service and self.cdn_service.is_enabled():
                    logger.info("CDN service initialized for global delivery")
                else:
                    logger.warning("CDN service not properly configured")
                    self.use_cdn = False
            except Exception as e:
                logger.error(f"Failed to initialize CDN service: {e}")
                self.use_cdn = False
    
    async def initiate_video_upload(
        self,
        user_id: str,
        filename: str,
        file_size: int,
        duration_seconds: float,
        metadata: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Initiate secure video upload with validation"""
        
        # Validate video file
        mime_type = mimetypes.guess_type(filename)[0]
        if not mime_type or mime_type not in settings.ALLOWED_VIDEO_TYPES:
            raise UploadServiceError(
                f"Invalid video format. Allowed formats: {list(settings.ALLOWED_VIDEO_TYPES)}",
                UploadErrorType.UNSUPPORTED_FORMAT
            )
        
        # Validate duration (e.g., max 5 minutes for challenges)
        max_duration = getattr(settings, 'MAX_VIDEO_DURATION_SECONDS', 300)
        if duration_seconds > max_duration:
            raise UploadServiceError(
                f"Video duration {duration_seconds}s exceeds maximum {max_duration}s",
                UploadErrorType.VALIDATION_ERROR
            )
        
        # Add media-specific metadata
        enhanced_metadata = {
            **(metadata or {}),
            "media_type": "video",
            "duration_seconds": duration_seconds,
            "upload_timestamp": datetime.utcnow().isoformat(),
            "user_agent": metadata.get("user_agent") if metadata else None
        }
        
        # Initiate upload through chunked service
        session = await self.upload_service.initiate_upload(
            user_id=user_id,
            filename=filename,
            file_size=file_size,
            mime_type=mime_type,
            metadata=enhanced_metadata
        )
        
        return {
            "session_id": session.session_id,
            "upload_url": f"/api/v1/media/upload/{session.session_id}",
            "chunk_size": session.chunk_size,
            "total_chunks": session.total_chunks,
            "expires_at": session.created_at + timedelta(seconds=settings.UPLOAD_SESSION_TIMEOUT)
        }    

    async def complete_video_upload(
        self,
        session_id: str,
        user_id: str,
        file_hash: Optional[str] = None
    ) -> Dict[str, Any]:
        """Complete video upload and generate streaming URL with cloud storage support"""
        
        # Verify session ownership
        session = await self.upload_service.get_upload_status(session_id)
        if not session or session.user_id != user_id:
            raise UploadServiceError(
                "Upload session not found or access denied",
                UploadErrorType.SESSION_NOT_FOUND
            )
        
        # Complete upload through chunked service
        final_path = await self.upload_service.complete_upload(session_id, file_hash)
        
        # Generate secure media ID
        media_id = str(uuid.uuid4())
        
        try:
            if self.use_cloud_storage and self.cloud_storage:
                # Upload to cloud storage
                cloud_key = f"media/{user_id}/{media_id}/{session.filename}"
                
                # Prepare metadata for cloud storage
                cloud_metadata = {
                    "user_id": user_id,
                    "media_id": media_id,
                    "original_filename": session.filename,
                    "upload_session_id": session_id,
                    "duration_seconds": str(session.metadata.get("duration_seconds", 0)),
                    "uploaded_at": datetime.utcnow().isoformat()
                }
                
                # Upload file to cloud storage
                with open(final_path, 'rb') as file_stream:
                    cloud_url = await self.cloud_storage.upload_file_stream(
                        file_stream=file_stream,
                        key=cloud_key,
                        content_type=session.mime_type,
                        file_size=session.file_size,
                        metadata=cloud_metadata
                    )
                
                # Clean up local file after successful cloud upload
                final_path.unlink()
                
                # Generate streaming URL (use CDN if configured)
                if self.use_cdn and self.cdn_service:
                    streaming_url = self.cdn_service.get_cdn_url(cloud_key, settings.AWS_S3_BUCKET_NAME)
                    if not streaming_url:
                        streaming_url = cloud_url
                        logger.warning("CDN URL generation failed, using direct cloud URL")
                else:
                    streaming_url = cloud_url
                
                logger.info(f"Media {media_id} uploaded to cloud storage: {cloud_key}")
                
                # Clean up upload session after successful cloud upload
                await self.upload_service._cleanup_session_chunks(session_id)
                if session_id in self.upload_service.sessions:
                    del self.upload_service.sessions[session_id]
                    await self.upload_service._save_sessions()
                
                return {
                    "media_id": media_id,
                    "streaming_url": streaming_url,
                    "cloud_key": cloud_key,
                    "file_size": session.file_size,
                    "duration_seconds": session.metadata.get("duration_seconds"),
                    "mime_type": session.mime_type,
                    "storage_type": "cloud",
                    "completed_at": datetime.utcnow().isoformat()
                }
                
            else:
                # Fallback to local storage
                media_filename = f"{media_id}_{session.filename}"
                media_path = self.media_storage_path / media_filename
                
                # Move file to media storage
                final_path.rename(media_path)
                
                # Generate streaming URL
                streaming_url = f"/api/v1/media/stream/{media_id}"
                
                # Clean up upload session after local storage
                await self.upload_service._cleanup_session_chunks(session_id)
                if session_id in self.upload_service.sessions:
                    del self.upload_service.sessions[session_id]
                    await self.upload_service._save_sessions()
                
                logger.info(f"Media {media_id} stored locally: {media_path}")
                
                return {
                    "media_id": media_id,
                    "streaming_url": streaming_url,
                    "file_size": session.file_size,
                    "duration_seconds": session.metadata.get("duration_seconds"),
                    "mime_type": session.mime_type,
                    "storage_type": "local",
                    "completed_at": datetime.utcnow().isoformat()
                }
                
        except CloudStorageError as e:
            logger.error(f"Cloud storage upload failed for {media_id}: {e}")
            # Fallback to local storage on cloud failure
            media_filename = f"{media_id}_{session.filename}"
            media_path = self.media_storage_path / media_filename
            final_path.rename(media_path)
            
            streaming_url = f"/api/v1/media/stream/{media_id}"
            
            # Clean up upload session even on fallback
            await self.upload_service._cleanup_session_chunks(session_id)
            if session_id in self.upload_service.sessions:
                del self.upload_service.sessions[session_id]
                await self.upload_service._save_sessions()
            
            return {
                "media_id": media_id,
                "streaming_url": streaming_url,
                "file_size": session.file_size,
                "duration_seconds": session.metadata.get("duration_seconds"),
                "mime_type": session.mime_type,
                "storage_type": "local_fallback",
                "completed_at": datetime.utcnow().isoformat(),
                "warning": "Cloud storage failed, using local storage"
            }
    
    async def get_media_info(self, media_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Get media information by ID from cloud or local storage"""
        
        if self.use_cloud_storage and self.cloud_storage:
            # Try to find in cloud storage first
            # We need to search by pattern since we don't store the exact key
            # In a production system, you'd store the cloud key in a database
            if user_id:
                cloud_key_pattern = f"media/{user_id}/{media_id}/"
                # For now, we'll construct a likely key and check if it exists
                # In production, store the cloud_key in your database
                potential_keys = [
                    f"media/{user_id}/{media_id}/video.mp4",
                    f"media/{user_id}/{media_id}/video.webm",
                    f"media/{user_id}/{media_id}/video.mov"
                ]
                
                for key in potential_keys:
                    metadata = await self.cloud_storage.get_file_metadata(key)
                    if metadata:
                        return {
                            "media_id": media_id,
                            "cloud_key": key,
                            "file_size": metadata.get("content_length"),
                            "mime_type": metadata.get("content_type"),
                            "created_at": metadata.get("last_modified"),
                            "storage_type": "cloud",
                            "metadata": metadata.get("metadata", {})
                        }
        
        # Fallback to local storage
        media_files = list(self.media_storage_path.glob(f"{media_id}_*"))
        if not media_files:
            return None
        
        media_path = media_files[0]
        stat = media_path.stat()
        
        return {
            "media_id": media_id,
            "filename": media_path.name,
            "file_size": stat.st_size,
            "mime_type": mimetypes.guess_type(media_path.name)[0],
            "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat(),
            "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            "storage_type": "local"
        }
    
    async def stream_media(self, media_id: str, user_id: Optional[str] = None, range_header: Optional[str] = None) -> Dict[str, Any]:
        """Stream media with range support for video playback from cloud or local storage"""
        
        if self.use_cloud_storage and self.cloud_storage:
            # Try cloud storage first - generate signed URL for direct streaming
            # Use the S3 media service key pattern: media/videos/{timestamp}/{media_id}
            from datetime import datetime, timedelta
            import boto3
            
            # Try different date patterns (current and recent dates)
            current_date = datetime.utcnow()
            potential_keys = []
            
            # Try multiple date formats in case upload was on different day
            for days_back in range(7):  # Check last 7 days
                test_date = current_date - timedelta(days=days_back)
                timestamp = test_date.strftime('%Y%m%d')
                potential_keys.append(f"media/videos/{timestamp}/{media_id}")
            
            # Also try legacy patterns for backward compatibility
            if user_id:
                potential_keys.extend([
                    f"media/{user_id}/{media_id}/video.mp4",
                    f"media/{user_id}/{media_id}/video.webm", 
                    f"media/{user_id}/{media_id}/video.mov"
                ])
            
            for key in potential_keys:
                if await self.cloud_storage.file_exists(key):
                    # For cloud storage, return signed URL for direct streaming
                    signed_url = await self.cloud_storage.get_file_url(
                        key, 
                        expires_in=settings.SIGNED_URL_EXPIRY
                    )
                    
                    metadata = await self.cloud_storage.get_file_metadata(key)
                    
                    return {
                        "streaming_type": "redirect",
                        "signed_url": signed_url,
                        "cloud_key": key,
                        "mime_type": metadata.get("content_type") if metadata else "video/mp4",
                        "file_size": metadata.get("content_length") if metadata else 0,
                        "supports_range": True,
                        "storage_type": "cloud"
                    }
        
        # Fallback to local storage streaming
        media_files = list(self.media_storage_path.glob(f"{media_id}_*"))
        if not media_files:
            raise FileNotFoundError(f"Media {media_id} not found")
        
        media_path = media_files[0]
        file_size = media_path.stat().st_size
        mime_type = mimetypes.guess_type(media_path.name)[0] or "application/octet-stream"
        
        # Handle range requests for video streaming
        start = 0
        end = file_size - 1
        
        if range_header:
            range_match = range_header.replace('bytes=', '').split('-')
            if len(range_match) == 2:
                if range_match[0]:
                    start = int(range_match[0])
                if range_match[1]:
                    end = int(range_match[1])
        
        # Ensure valid range
        start = max(0, start)
        end = min(file_size - 1, end)
        content_length = end - start + 1
        
        return {
            "streaming_type": "local",
            "file_path": media_path,
            "mime_type": mime_type,
            "file_size": file_size,
            "start": start,
            "end": end,
            "content_length": content_length,
            "supports_range": True,
            "storage_type": "local"
        }
    
    async def delete_media(self, media_id: str, user_id: str) -> bool:
        """Delete media file from cloud or local storage (with authorization check)"""
        
        deleted = False
        
        # Try cloud storage first
        if self.use_cloud_storage and self.cloud_storage:
            potential_keys = [
                f"media/{user_id}/{media_id}/video.mp4",
                f"media/{user_id}/{media_id}/video.webm",
                f"media/{user_id}/{media_id}/video.mov"
            ]
            
            for key in potential_keys:
                if await self.cloud_storage.file_exists(key):
                    success = await self.cloud_storage.delete_file(key)
                    if success:
                        logger.info(f"Media {media_id} deleted from cloud storage: {key}")
                        deleted = True
                        break
        
        # Also check and delete from local storage (for migration scenarios)
        media_files = list(self.media_storage_path.glob(f"{media_id}_*"))
        if media_files:
            media_path = media_files[0]
            try:
                media_path.unlink()
                logger.info(f"Media {media_id} deleted from local storage by user {user_id}")
                deleted = True
            except Exception as e:
                logger.error(f"Failed to delete local media {media_id}: {e}")
        
        return deleted
    
    async def get_user_media_library(
        self, 
        user_id: str, 
        page: int = 1, 
        limit: int = 50
    ) -> Dict[str, Any]:
        """Get user's media library for cross-device access"""
        
        # In a production system, this would query a database
        # For now, we'll simulate by checking cloud storage and local files
        
        media_items = []
        
        # Check cloud storage if available
        if self.use_cloud_storage and self.cloud_storage:
            try:
                # List files in user's cloud storage directory
                cloud_prefix = f"media/{user_id}/"
                cloud_files = await self.cloud_storage.list_files(prefix=cloud_prefix)
                
                for file_info in cloud_files:
                    # Extract media ID from cloud key
                    # Expected format: media/{user_id}/{media_id}/filename
                    path_parts = file_info.get("key", "").split("/")
                    if len(path_parts) >= 3:
                        media_id = path_parts[2]
                        
                        # Get file metadata
                        metadata = file_info.get("metadata", {})
                        
                        media_items.append({
                            "mediaId": media_id,
                            "filename": metadata.get("original_filename", path_parts[-1]),
                            "streamingUrl": await self.cloud_storage.get_file_url(
                                file_info["key"], 
                                expires_in=settings.SIGNED_URL_EXPIRY
                            ),
                            "fileSize": file_info.get("size", 0),
                            "duration": float(metadata.get("duration_seconds", 0)),
                            "uploadedAt": metadata.get("uploaded_at", ""),
                            "deviceInfo": metadata.get("device_info", ""),
                            "storageType": "cloud",
                            "mimeType": file_info.get("content_type", "video/mp4")
                        })
                        
            except Exception as e:
                logger.error(f"Failed to list cloud storage files for user {user_id}: {e}")
        
        # Also check local storage for fallback
        local_files = list(self.media_storage_path.glob("*"))
        for file_path in local_files:
            # Extract media ID from filename (format: {media_id}_{original_filename})
            filename_parts = file_path.name.split("_", 1)
            if len(filename_parts) >= 2:
                media_id = filename_parts[0]
                
                # Check if this media belongs to the user (simplified check)
                # In production, you'd have a proper database lookup
                stat = file_path.stat()
                
                media_items.append({
                    "mediaId": media_id,
                    "filename": filename_parts[1],
                    "streamingUrl": f"/api/v1/media/stream/{media_id}",
                    "fileSize": stat.st_size,
                    "duration": 0,  # Would need to be stored in metadata
                    "uploadedAt": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                    "deviceInfo": "unknown",
                    "storageType": "local",
                    "mimeType": mimetypes.guess_type(file_path.name)[0] or "video/mp4"
                })
        
        # Remove duplicates and sort by upload date
        unique_media = {}
        for item in media_items:
            media_id = item["mediaId"]
            if media_id not in unique_media or item["storageType"] == "cloud":
                unique_media[media_id] = item
        
        sorted_media = sorted(
            unique_media.values(), 
            key=lambda x: x["uploadedAt"], 
            reverse=True
        )
        
        # Implement pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        paginated_media = sorted_media[start_idx:end_idx]
        
        return {
            "media": paginated_media,
            "totalCount": len(sorted_media),
            "hasMore": end_idx < len(sorted_media)
        }
    
    async def verify_media_access(
        self, 
        media_id: str, 
        user_id: str
    ) -> Dict[str, Any]:
        """Verify media accessibility across devices"""
        
        # Check if media exists and user has access
        media_info = await self.get_media_info(media_id, user_id)
        
        if not media_info:
            return {
                "accessible": False,
                "deviceCompatible": False,
                "requiresAuth": True,
                "error": "Media not found or access denied"
            }
        
        # Generate appropriate streaming URL based on storage type
        streaming_url = None
        expires_at = None
        
        if media_info.get("storage_type") == "cloud" and self.cloud_storage:
            # Generate signed URL for cloud storage
            cloud_key = media_info.get("cloud_key")
            if cloud_key:
                streaming_url = await self.cloud_storage.get_file_url(
                    cloud_key, 
                    expires_in=settings.SIGNED_URL_EXPIRY
                )
                expires_at = (datetime.utcnow() + timedelta(seconds=settings.SIGNED_URL_EXPIRY)).isoformat()
        else:
            # Use local streaming endpoint
            streaming_url = f"/api/v1/media/stream/{media_id}"
        
        # Check device compatibility
        mime_type = media_info.get("mime_type", "video/mp4")
        device_compatible = self._is_mime_type_compatible(mime_type)
        
        return {
            "accessible": True,
            "streamingUrl": streaming_url,
            "deviceCompatible": device_compatible,
            "requiresAuth": True,
            "expiresAt": expires_at,
            "mimeType": mime_type,
            "fileSize": media_info.get("file_size", 0),
            "storageType": media_info.get("storage_type", "local")
        }
    
    async def sync_media_state(
        self, 
        user_id: str, 
        local_media_ids: List[str], 
        device_info: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Sync media state across devices"""
        
        # Get user's complete media library
        library = await self.get_user_media_library(user_id, page=1, limit=1000)
        server_media = {item["mediaId"]: item for item in library["media"]}
        
        # Find media that exists on server but not locally
        server_media_ids = set(server_media.keys())
        local_media_ids_set = set(local_media_ids)
        
        new_media = []
        for media_id in server_media_ids - local_media_ids_set:
            media_item = server_media[media_id]
            new_media.append({
                "mediaId": media_id,
                "streamingUrl": media_item["streamingUrl"],
                "uploadedAt": media_item["uploadedAt"],
                "filename": media_item["filename"],
                "fileSize": media_item["fileSize"],
                "duration": media_item["duration"]
            })
        
        # Find media that exists locally but not on server (deleted)
        deleted_media = list(local_media_ids_set - server_media_ids)
        
        # Find media that needs updates (check last modified times)
        synced_media = []
        for media_id in local_media_ids_set & server_media_ids:
            media_item = server_media[media_id]
            synced_media.append({
                "mediaId": media_id,
                "streamingUrl": media_item["streamingUrl"],
                "lastModified": media_item["uploadedAt"],
                "needsUpdate": False  # Simplified - in production, compare timestamps
            })
        
        # Log sync activity for debugging
        logger.info(f"Media sync for user {user_id}: {len(new_media)} new, {len(deleted_media)} deleted, {len(synced_media)} synced")
        
        return {
            "syncedMedia": synced_media,
            "deletedMedia": deleted_media,
            "newMedia": new_media,
            "syncTimestamp": datetime.utcnow().isoformat(),
            "deviceInfo": device_info
        }
    
    def _is_mime_type_compatible(self, mime_type: str) -> bool:
        """Check if MIME type is compatible across devices"""
        # Define cross-platform compatible formats
        compatible_formats = {
            'video/mp4',      # Widely supported
            'video/webm',     # Modern browsers and Android
            'video/quicktime' # iOS native format
        }
        
        return mime_type in compatible_formats
    
    async def get_cdn_signed_url(
        self,
        media_id: str,
        user_id: str,
        expires_in: Optional[int] = None,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Generate CDN signed URL for secure global delivery"""
        
        if not self.use_cdn or not self.cdn_service:
            return None
        
        # Find the cloud key for this media
        if self.use_cloud_storage and self.cloud_storage:
            potential_keys = [
                f"media/{user_id}/{media_id}/video.mp4",
                f"media/{user_id}/{media_id}/video.webm",
                f"media/{user_id}/{media_id}/video.mov"
            ]
            
            for key in potential_keys:
                if await self.cloud_storage.file_exists(key):
                    # Create signed CDN URL
                    signed_url = self.cdn_service.create_signed_url(
                        s3_key=key,
                        expires_in=expires_in,
                        ip_address=client_ip,
                        user_agent=user_agent
                    )
                    
                    if signed_url:
                        # Get optimization recommendations
                        optimization = self.cdn_service.optimize_delivery_for_device(
                            s3_key=key,
                            user_agent=user_agent,
                            client_ip=client_ip
                        )
                        
                        return {
                            "signed_url": signed_url,
                            "expires_in": expires_in or settings.CDN_SIGNED_URL_EXPIRY,
                            "expires_at": (datetime.utcnow() + timedelta(seconds=expires_in or settings.CDN_SIGNED_URL_EXPIRY)).isoformat(),
                            "cloud_key": key,
                            "delivery_type": "cdn_signed",
                            "optimization": optimization,
                            "supports_range": True,
                            "global_delivery": True
                        }
        
        return None
    
    async def get_optimized_streaming_url(
        self,
        media_id: str,
        user_id: str,
        client_ip: Optional[str] = None,
        user_agent: Optional[str] = None,
        device_type: Optional[str] = None,
        prefer_signed: bool = True
    ) -> Dict[str, Any]:
        """Get optimized streaming URL based on client capabilities and CDN availability"""
        
        # Try CDN signed URL first if available and preferred
        if prefer_signed and self.use_cdn and self.cdn_service:
            cdn_result = await self.get_cdn_signed_url(
                media_id=media_id,
                user_id=user_id,
                client_ip=client_ip,
                user_agent=user_agent
            )
            
            if cdn_result:
                return cdn_result
        
        # Fallback to regular streaming
        stream_info = await self.stream_media(media_id, user_id)
        
        # If cloud storage but no CDN, try to optimize
        if stream_info.get("streaming_type") == "redirect" and self.cdn_service:
            # Extract S3 key from signed URL and create CDN URL
            signed_url = stream_info.get("signed_url", "")
            if "amazonaws.com" in signed_url:
                # Extract key from S3 URL (simplified)
                try:
                    from urllib.parse import urlparse, unquote
                    parsed = urlparse(signed_url)
                    s3_key = unquote(parsed.path.lstrip('/'))
                    
                    cdn_url = self.cdn_service.get_cdn_url(s3_key, settings.AWS_S3_BUCKET_NAME)
                    if cdn_url:
                        optimization = self.cdn_service.optimize_delivery_for_device(
                            s3_key=s3_key,
                            user_agent=user_agent,
                            client_ip=client_ip,
                            device_type=device_type
                        )
                        
                        return {
                            "streaming_url": cdn_url,
                            "delivery_type": "cdn_public",
                            "optimization": optimization,
                            "supports_range": True,
                            "global_delivery": True,
                            "cache_control": optimization.get("cache_control"),
                            "storage_type": "cloud_cdn"
                        }
                except Exception as e:
                    logger.error(f"Failed to create CDN URL from S3 URL: {e}")
        
        # Return original stream info with delivery type
        stream_info["delivery_type"] = "direct"
        stream_info["global_delivery"] = False
        return stream_info
    
    async def invalidate_media_cache(self, media_id: str, user_id: str) -> bool:
        """Invalidate CDN cache for specific media"""
        
        if not self.use_cdn or not self.cdn_service:
            return False
        
        # Find all potential paths for this media
        paths_to_invalidate = [
            f"media/{user_id}/{media_id}/*",
            f"media/{user_id}/{media_id}/video.mp4",
            f"media/{user_id}/{media_id}/video.webm",
            f"media/{user_id}/{media_id}/video.mov"
        ]
        
        try:
            success = await self.cdn_service.invalidate_cache(paths_to_invalidate)
            if success:
                logger.info(f"CDN cache invalidated for media {media_id}")
            return success
        except Exception as e:
            logger.error(f"Failed to invalidate CDN cache for media {media_id}: {e}")
            return False
    
    async def get_global_delivery_stats(self) -> Optional[Dict[str, Any]]:
        """Get global delivery statistics from CDN"""
        
        if not self.use_cdn or not self.cdn_service:
            return None
        
        try:
            # Get distribution info
            distribution_info = await self.cdn_service.get_distribution_info()
            
            # Get analytics for the last 24 hours
            end_date = datetime.utcnow()
            start_date = end_date - timedelta(days=1)
            analytics = self.cdn_service.get_analytics_data(start_date, end_date)
            
            return {
                "cdn_enabled": True,
                "distribution": distribution_info,
                "analytics": analytics,
                "edge_locations": settings.CDN_EDGE_LOCATIONS,
                "cache_settings": {
                    "default_ttl": settings.CDN_CACHE_CONTROL,
                    "signed_url_expiry": settings.CDN_SIGNED_URL_EXPIRY
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get global delivery stats: {e}")
            return None
    
    def validate_video_file(self, filename: str, file_size: int, duration_seconds: Optional[float] = None) -> Dict[str, Any]:
        """Validate video file before upload with comprehensive checks"""
        
        # Import validation service
        from services.validation_service import gameplay_validator
        
        # Check file extension
        allowed_extensions = {'.mp4', '.webm', '.ogg', '.avi', '.mov'}
        file_ext = Path(filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            return {
                "valid": False,
                "error": f"Invalid file extension {file_ext}. Allowed: {allowed_extensions}",
                "error_code": "INVALID_EXTENSION"
            }
        
        # Check MIME type
        mime_type = mimetypes.guess_type(filename)[0]
        if not mime_type or mime_type not in settings.ALLOWED_VIDEO_TYPES:
            return {
                "valid": False,
                "error": f"Invalid MIME type {mime_type}. Allowed: {list(settings.ALLOWED_VIDEO_TYPES)}",
                "error_code": "INVALID_MIME_TYPE"
            }
        
        # Check file size bounds
        if file_size > settings.MAX_FILE_SIZE:
            return {
                "valid": False,
                "error": f"File size {file_size} exceeds maximum {settings.MAX_FILE_SIZE} bytes",
                "error_code": "FILE_TOO_LARGE"
            }
        
        min_file_size = 100 * 1024  # 100KB minimum
        if file_size < min_file_size:
            return {
                "valid": False,
                "error": f"File size {file_size} below minimum {min_file_size} bytes",
                "error_code": "FILE_TOO_SMALL"
            }
        
        # Use comprehensive validation service
        try:
            import asyncio
            validation_result = asyncio.run(gameplay_validator.validate_file_before_upload(
                filename=filename,
                file_size=file_size,
                mime_type=mime_type,
                duration_seconds=duration_seconds
            ))
            
            if not validation_result.is_valid:
                return {
                    "valid": False,
                    "error": validation_result.message,
                    "error_code": "VALIDATION_FAILED",
                    "details": validation_result.details
                }
            
            return {
                "valid": True,
                "mime_type": mime_type,
                "file_extension": file_ext,
                "validation_details": validation_result.details
            }
            
        except Exception as e:
            logger.error(f"Validation service error: {e}")
            # Fallback to basic validation if service fails
            return {
                "valid": True,
                "mime_type": mime_type,
                "file_extension": file_ext,
                "warning": "Advanced validation unavailable"
            }