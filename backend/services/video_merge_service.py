"""
Video Merge Service - Asynchronous video merging using FFmpeg
"""
import os
import asyncio
import subprocess
import json
import uuid
import logging
import time
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import tempfile
import shutil

from models import VideoSegmentMetadata, MergedVideoMetadata, UploadSession, UploadStatus
from services.upload_service import ChunkedUploadService
from services.cloud_storage_service import create_cloud_storage_service, CloudStorageError
from services.monitoring_service import media_monitor, ProcessingStage
from config import settings

logger = logging.getLogger(__name__)

class VideoMergeError(Exception):
    """Custom exception for video merge operations"""
    def __init__(self, message: str, error_code: str = "MERGE_ERROR", retryable: bool = False):
        super().__init__(message)
        self.error_code = error_code
        self.retryable = retryable

class MergeSessionStatus:
    """Status constants for merge sessions"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class VideoMergeService:
    """Service for merging multiple videos into a single file using FFmpeg"""
    
    def __init__(self):
        self.upload_service = ChunkedUploadService()
        self.merge_sessions: Dict[str, Dict[str, Any]] = {}
        self.temp_dir = settings.TEMP_DIR / "video_merge"
        self.temp_dir.mkdir(exist_ok=True)
        
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
                logger.info("Cloud storage initialized for video merge service")
            except Exception as e:
                logger.error(f"Failed to initialize cloud storage for merge service: {e}")
                self.use_cloud_storage = False
        
        # Verify FFmpeg is available
        self.ffmpeg_available = self._verify_ffmpeg()
    
    def _verify_ffmpeg(self):
        """Verify FFmpeg is installed and accessible"""
        try:
            result = subprocess.run(
                ["ffmpeg", "-version"], 
                capture_output=True, 
                text=True, 
                timeout=10
            )
            if result.returncode == 0:
                logger.info("FFmpeg verified and ready for video processing")
                return True
            else:
                logger.warning("FFmpeg not working properly - video merging will be disabled")
                return False
        except FileNotFoundError:
            logger.warning("FFmpeg not found - video merging will be disabled")
            return False
        except subprocess.TimeoutExpired:
            logger.warning("FFmpeg verification timed out - video merging will be disabled")
            return False
    
    async def check_merge_readiness(self, merge_session_id: str, user_id: str) -> Dict[str, Any]:
        """Check if all videos in a merge session are ready for merging"""
        
        # Find all upload sessions for this merge session
        video_sessions = []
        for session_id, session in self.upload_service.sessions.items():
            if (session.user_id == user_id and 
                session.metadata.get("merge_session_id") == merge_session_id and
                session.metadata.get("is_merge_video", False)):
                video_sessions.append(session)
        
        if not video_sessions:
            return {
                "ready": False,
                "error": "No video sessions found for merge session",
                "videos_found": 0
            }
        
        # Sort by video index
        video_sessions.sort(key=lambda s: s.metadata.get("video_index", 0))
        
        # Check if all videos are completed
        completed_videos = [s for s in video_sessions if s.status == UploadStatus.COMPLETED]
        expected_count = video_sessions[0].metadata.get("video_count", 3)
        
        if len(completed_videos) != expected_count:
            return {
                "ready": False,
                "videos_found": len(video_sessions),
                "videos_completed": len(completed_videos),
                "videos_expected": expected_count,
                "missing_videos": [i for i in range(expected_count) 
                                 if i not in [s.metadata.get("video_index") for s in completed_videos]]
            }
        
        # Verify all video files exist
        video_files = []
        for session in completed_videos:
            video_index = session.metadata.get("video_index")
            file_path = settings.UPLOAD_DIR / f"{session.session_id}_{session.filename}"
            
            if not file_path.exists():
                return {
                    "ready": False,
                    "error": f"Video file not found for video {video_index}",
                    "missing_file": str(file_path)
                }
            
            video_files.append({
                "index": video_index,
                "path": file_path,
                "session": session
            })
        
        return {
            "ready": True,
            "videos_found": len(video_sessions),
            "videos_completed": len(completed_videos),
            "video_files": video_files,
            "merge_session_id": merge_session_id
        }
    
    async def initiate_merge(
        self, 
        merge_session_id: str, 
        user_id: str, 
        quality_preset: str = "medium"
    ) -> Dict[str, Any]:
        """Initiate the video merging process"""
        
        # Check if merge is already in progress
        if merge_session_id in self.merge_sessions:
            existing_status = self.merge_sessions[merge_session_id]["status"]
            if existing_status in [MergeSessionStatus.PROCESSING, MergeSessionStatus.COMPLETED]:
                return {
                    "merge_session_id": merge_session_id,
                    "status": existing_status,
                    "message": f"Merge already {existing_status}"
                }
        
        # Check readiness
        readiness = await self.check_merge_readiness(merge_session_id, user_id)
        if not readiness["ready"]:
            raise VideoMergeError(
                f"Videos not ready for merging: {readiness.get('error', 'Unknown error')}",
                "NOT_READY"
            )
        
        # Create merge session record
        merge_session = {
            "merge_session_id": merge_session_id,
            "user_id": user_id,
            "status": MergeSessionStatus.PENDING,
            "video_files": readiness["video_files"],
            "quality_preset": quality_preset,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "progress": 0.0,
            "error_message": None,
            "merged_video_path": None,
            "merged_video_metadata": None
        }
        
        self.merge_sessions[merge_session_id] = merge_session
        
        # Start merge process asynchronously
        asyncio.create_task(self._process_merge(merge_session_id))
        
        logger.info(f"Video merge initiated for session {merge_session_id}")
        
        return {
            "merge_session_id": merge_session_id,
            "status": MergeSessionStatus.PENDING,
            "video_count": len(readiness["video_files"]),
            "estimated_duration_seconds": self._estimate_merge_duration(readiness["video_files"]),
            "initiated_at": merge_session["created_at"].isoformat()
        }
    
    async def _process_merge(self, merge_session_id: str):
        """Process video merge asynchronously"""
        
        merge_session = self.merge_sessions.get(merge_session_id)
        if not merge_session:
            logger.error(f"Merge session {merge_session_id} not found")
            return
        
        user_id = merge_session["user_id"]
        
        try:
            # Update status to processing
            merge_session["status"] = MergeSessionStatus.PROCESSING
            merge_session["updated_at"] = datetime.utcnow()
            merge_session["progress"] = 10.0
            
            logger.info(f"Starting video merge for session {merge_session_id}")
            
            # Create temporary working directory
            work_dir = self.temp_dir / merge_session_id
            work_dir.mkdir(exist_ok=True)
            
            try:
                # Step 1: Analyze input videos (20% progress)
                analysis_metrics = await media_monitor.start_processing(
                    merge_session_id, user_id, ProcessingStage.ANALYSIS
                )
                try:
                    video_info = await self._analyze_videos(merge_session["video_files"], work_dir)
                    merge_session["progress"] = 20.0
                    merge_session["video_analysis"] = video_info
                    
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.ANALYSIS, 
                        success=True, video_count=len(merge_session["video_files"])
                    )
                except Exception as e:
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.ANALYSIS,
                        success=False, error_message=str(e), 
                        error_code=getattr(e, 'error_code', 'ANALYSIS_ERROR')
                    )
                    raise
                
                # Step 2: Prepare videos for merging (40% progress)
                prep_metrics = await media_monitor.start_processing(
                    merge_session_id, user_id, ProcessingStage.PREPARATION
                )
                try:
                    prepared_videos = await self._prepare_videos_for_merge(
                        merge_session["video_files"], 
                        video_info, 
                        work_dir
                    )
                    merge_session["progress"] = 40.0
                    
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.PREPARATION,
                        success=True, video_count=len(prepared_videos)
                    )
                except Exception as e:
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.PREPARATION,
                        success=False, error_message=str(e),
                        error_code=getattr(e, 'error_code', 'PREPARATION_ERROR')
                    )
                    raise
                
                # Step 3: Merge videos (80% progress)
                merge_metrics = await media_monitor.start_processing(
                    merge_session_id, user_id, ProcessingStage.MERGING
                )
                try:
                    merged_path, segment_metadata = await self._merge_videos(
                        prepared_videos, 
                        work_dir,
                        original_video_files=merge_session["video_files"],  # Pass original session data
                        progress_callback=lambda p: self._update_merge_progress(merge_session_id, 40.0 + (p * 0.4))
                    )
                    merge_session["progress"] = 80.0
                    
                    # Get file size for metrics
                    file_size = merged_path.stat().st_size if merged_path.exists() else None
                    
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.MERGING,
                        success=True, file_size_bytes=file_size, video_count=len(prepared_videos)
                    )
                except Exception as e:
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.MERGING,
                        success=False, error_message=str(e),
                        error_code=getattr(e, 'error_code', 'MERGE_ERROR')
                    )
                    raise
                
                # Step 4: Apply compression (90% progress)
                compression_metrics = await media_monitor.start_processing(
                    merge_session_id, user_id, ProcessingStage.COMPRESSION
                )
                try:
                    quality_preset = merge_session.get("quality_preset", "medium")
                    compressed_path = await self._compress_merged_video(
                        merged_path, 
                        work_dir,
                        progress_callback=lambda p: self._update_merge_progress(merge_session_id, 80.0 + (p * 0.1)),
                        quality_preset=quality_preset
                    )
                    merge_session["progress"] = 90.0
                    
                    # Get compressed file size for metrics
                    compressed_size = compressed_path.stat().st_size if compressed_path.exists() else None
                    
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.COMPRESSION,
                        success=True, file_size_bytes=compressed_size
                    )
                except Exception as e:
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.COMPRESSION,
                        success=False, error_message=str(e),
                        error_code=getattr(e, 'error_code', 'COMPRESSION_ERROR')
                    )
                    raise
                
                # Step 5: Upload to storage and cleanup (100% progress)
                storage_metrics = await media_monitor.start_processing(
                    merge_session_id, user_id, ProcessingStage.STORAGE_UPLOAD
                )
                try:
                    final_result = await self._finalize_merge(
                        compressed_path, 
                        segment_metadata, 
                        merge_session_id,
                        merge_session["user_id"]
                    )
                    merge_session["progress"] = 100.0
                    
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.STORAGE_UPLOAD,
                        success=True, file_size_bytes=compressed_size
                    )
                except Exception as e:
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.STORAGE_UPLOAD,
                        success=False, error_message=str(e),
                        error_code=getattr(e, 'error_code', 'STORAGE_ERROR')
                    )
                    raise
                
                # Update session with results
                merge_session["status"] = MergeSessionStatus.COMPLETED
                merge_session["merged_video_path"] = str(final_result["storage_path"])
                merge_session["merged_video_url"] = final_result["streaming_url"]
                merge_session["merged_video_metadata"] = final_result["metadata"]
                merge_session["completed_at"] = datetime.utcnow()
                
                logger.info(f"Video merge completed successfully for session {merge_session_id}")
                
            finally:
                # Clean up temporary files
                cleanup_metrics = await media_monitor.start_processing(
                    merge_session_id, user_id, ProcessingStage.CLEANUP
                )
                try:
                    await self._cleanup_temp_files(work_dir)
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.CLEANUP, success=True
                    )
                except Exception as e:
                    await media_monitor.complete_processing(
                        merge_session_id, ProcessingStage.CLEANUP,
                        success=False, error_message=str(e),
                        error_code="CLEANUP_ERROR"
                    )
                    # Don't re-raise cleanup errors
                    logger.warning(f"Cleanup failed for session {merge_session_id}: {str(e)}")
                
        except Exception as e:
            logger.error(f"Video merge failed for session {merge_session_id}: {str(e)}")
            
            # Log the error with full context
            await media_monitor.log_processing_error(
                merge_session_id, user_id, ProcessingStage.MERGING, e,
                context={
                    "progress": merge_session.get("progress", 0),
                    "video_count": len(merge_session.get("video_files", [])),
                    "quality_preset": merge_session.get("quality_preset", "medium")
                }
            )
            
            merge_session["status"] = MergeSessionStatus.FAILED
            merge_session["error_message"] = str(e)
            merge_session["failed_at"] = datetime.utcnow()
        
        merge_session["updated_at"] = datetime.utcnow()
    
    async def _analyze_videos(self, video_files: List[Dict], work_dir: Path) -> Dict[str, Any]:
        """Analyze input videos to determine merge parameters"""
        
        video_info = {
            "videos": [],
            "total_duration": 0.0,
            "max_resolution": {"width": 0, "height": 0},
            "common_framerate": None,
            "audio_present": False
        }
        
        for video_file in video_files:
            file_path = video_file["path"]
            
            if self.ffmpeg_available:
                try:
                    # Use FFprobe to get video information
                    cmd = [
                        "ffprobe",
                        "-v", "quiet",
                        "-print_format", "json",
                        "-show_format",
                        "-show_streams",
                        str(file_path)
                    ]
                    
                    result = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, stderr = await result.communicate()
                    
                    if result.returncode != 0:
                        logger.warning(f"FFprobe failed for video {video_file['index']}: {stderr.decode()}")
                        # Fall back to default values
                        video_data = self._get_default_video_data(video_file, file_path)
                    else:
                        # Parse FFprobe output
                        probe_data = json.loads(stdout.decode())
                        video_data = self._parse_ffprobe_data(video_file, file_path, probe_data)
                        
                except (json.JSONDecodeError, FileNotFoundError, Exception) as e:
                    logger.warning(f"Video analysis failed for video {video_file['index']}: {str(e)} - using defaults")
                    video_data = self._get_default_video_data(video_file, file_path)
            else:
                # FFmpeg not available - use default values
                logger.info(f"FFmpeg not available - using default values for video {video_file['index']}")
                video_data = self._get_default_video_data(video_file, file_path)
            
            video_info["videos"].append(video_data)
            video_info["total_duration"] += video_data["duration"]
            
            # Update max resolution
            if video_data["width"] > video_info["max_resolution"]["width"]:
                video_info["max_resolution"]["width"] = video_data["width"]
            if video_data["height"] > video_info["max_resolution"]["height"]:
                video_info["max_resolution"]["height"] = video_data["height"]
            
            # Check for audio
            if video_data["has_audio"]:
                video_info["audio_present"] = True
            
            # Determine common framerate
            if video_info["common_framerate"] is None:
                video_info["common_framerate"] = video_data["framerate"]
        
        # Sort videos by index to ensure correct order
        video_info["videos"].sort(key=lambda v: v["index"])
        
        logger.info(f"Video analysis complete: {len(video_info['videos'])} videos, total duration {video_info['total_duration']:.2f}s")
        
        return video_info
    
    def _get_default_video_data(self, video_file: Dict, file_path: Path) -> Dict[str, Any]:
        """Get default video data when FFprobe is not available"""
        # Use file size as a rough estimate for duration (very rough approximation)
        try:
            file_size = file_path.stat().st_size
            # Rough estimate: assume 1MB per second for mobile video
            estimated_duration = max(5.0, min(30.0, file_size / (1024 * 1024)))
        except:
            estimated_duration = 10.0  # Default to 10 seconds
        
        return {
            "index": video_file["index"],
            "path": str(file_path),
            "duration": estimated_duration,
            "width": 720,  # Reasonable default for mobile
            "height": 1280,  # Reasonable default for mobile (portrait)
            "framerate": 30.0,
            "has_audio": True,  # Assume audio is present
            "codec": "h264",  # Common codec
            "bitrate": 2000000  # 2 Mbps default
        }
    
    def _parse_ffprobe_data(self, video_file: Dict, file_path: Path, probe_data: Dict) -> Dict[str, Any]:
        """Parse FFprobe data into video metadata"""
        # Extract video stream info
        video_stream = None
        audio_stream = None
        
        for stream in probe_data.get("streams", []):
            if stream.get("codec_type") == "video" and not video_stream:
                video_stream = stream
            elif stream.get("codec_type") == "audio" and not audio_stream:
                audio_stream = stream
        
        if not video_stream:
            logger.warning(f"No video stream found in video {video_file['index']} - using defaults")
            return self._get_default_video_data(video_file, file_path)
        
        # Extract video properties
        duration = float(probe_data.get("format", {}).get("duration", 10.0))
        width = int(video_stream.get("width", 720))
        height = int(video_stream.get("height", 1280))
        framerate = video_stream.get("r_frame_rate", "30/1")
        
        # Parse framerate
        if "/" in framerate:
            num, den = framerate.split("/")
            fps = float(num) / float(den) if float(den) != 0 else 30.0
        else:
            fps = float(framerate)
        
        return {
            "index": video_file["index"],
            "path": str(file_path),
            "duration": duration,
            "width": width,
            "height": height,
            "framerate": fps,
            "has_audio": audio_stream is not None,
            "codec": video_stream.get("codec_name", "h264"),
            "bitrate": int(probe_data.get("format", {}).get("bit_rate", 2000000))
        }
    
    async def _prepare_videos_for_merge(
        self, 
        video_files: List[Dict], 
        video_info: Dict[str, Any], 
        work_dir: Path
    ) -> List[Path]:
        """Prepare videos for merging by normalizing format and resolution"""
        
        # If FFmpeg is not available, just return the original video paths
        if not self.ffmpeg_available:
            logger.warning("FFmpeg not available - returning original videos without processing")
            original_paths = []
            for video_data in video_info["videos"]:
                input_path = Path(video_data["path"])
                # Copy to work directory with standardized names
                output_path = work_dir / f"prepared_{video_data['index']:02d}.mp4"
                try:
                    shutil.copy2(input_path, output_path)
                    original_paths.append(output_path)
                    logger.debug(f"Video {video_data['index']} copied without FFmpeg processing")
                except Exception as e:
                    logger.error(f"Failed to copy video {video_data['index']}: {e}")
                    # Return original path if copy fails
                    original_paths.append(input_path)
            return original_paths
        
        prepared_videos = []
        target_width = video_info["max_resolution"]["width"]
        target_height = video_info["max_resolution"]["height"]
        target_fps = video_info["common_framerate"]
        
        # Ensure even dimensions for H.264 compatibility
        if target_width % 2 != 0:
            target_width += 1
        if target_height % 2 != 0:
            target_height += 1
        
        for video_data in video_info["videos"]:
            input_path = Path(video_data["path"])
            output_path = work_dir / f"prepared_{video_data['index']:02d}.mp4"
            
            # Check if video needs processing
            needs_processing = (
                video_data["width"] != target_width or
                video_data["height"] != target_height or
                abs(video_data["framerate"] - target_fps) > 0.1 or
                video_data["codec"] != "h264"
            )
            
            if not needs_processing:
                # Copy file as-is
                shutil.copy2(input_path, output_path)
                logger.debug(f"Video {video_data['index']} copied without processing")
            else:
                # First, verify the input file exists and is readable
                if not input_path.exists():
                    raise VideoMergeError(
                        f"Input video file does not exist: {input_path}",
                        "FILE_NOT_FOUND"
                    )
                
                # Check file size
                file_size = input_path.stat().st_size
                if file_size == 0:
                    raise VideoMergeError(
                        f"Input video file is empty: {input_path}",
                        "EMPTY_FILE"
                    )
                
                logger.debug(f"Processing video {video_data['index']}: {input_path} ({file_size} bytes)")
                
                # First, verify FFmpeg can read the file by probing it
                probe_cmd = [
                    "ffprobe", "-v", "quiet", "-print_format", "json", 
                    "-show_format", "-show_streams", str(input_path)
                ]
                
                try:
                    logger.debug(f"Probing video metadata: {' '.join(probe_cmd)}")
                    probe_process = await asyncio.create_subprocess_exec(
                        *probe_cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    probe_stdout, probe_stderr = await probe_process.communicate()
                    
                    if probe_process.returncode != 0:
                        probe_error = probe_stderr.decode() if probe_stderr else "Unknown probe error"
                        logger.error(f"FFprobe failed for {input_path}: {probe_error}")
                        raise VideoMergeError(
                            f"Cannot read video metadata for {video_data['index']}: {probe_error}",
                            "INVALID_VIDEO_FILE"
                        )
                    
                    logger.debug(f"Probe successful for video {video_data['index']}")
                    
                except Exception as e:
                    if not isinstance(e, VideoMergeError):
                        logger.error(f"Exception during probe of video {video_data['index']}: {str(e)}")
                        raise VideoMergeError(
                            f"Failed to probe video {video_data['index']}: {str(e)}",
                            "PROBE_ERROR"
                        )
                
                # Use a simpler FFmpeg command that's more compatible
                cmd = [
                    "ffmpeg",
                    "-i", str(input_path),
                    "-c:v", "libx264",
                    "-preset", "fast",  # Changed from "medium" to "fast" for better compatibility
                    "-crf", "23",
                    "-vf", f"scale={target_width}:{target_height}:force_original_aspect_ratio=decrease",  # Simplified scaling
                    "-r", str(target_fps),
                    "-c:a", "aac" if video_info["audio_present"] else "-an",
                    "-movflags", "+faststart",
                    "-y",  # Overwrite output file
                    str(output_path)
                ]
                
                logger.debug(f"Processing video {video_data['index']} with command: {' '.join(cmd)}")
                
                try:
                    process = await asyncio.create_subprocess_exec(
                        *cmd,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    
                    # Add timeout to prevent hanging (5 minutes max per video)
                    try:
                        stdout, stderr = await asyncio.wait_for(
                            process.communicate(), 
                            timeout=300.0
                        )
                    except asyncio.TimeoutError:
                        process.kill()
                        await process.wait()
                        raise VideoMergeError(
                            f"Video {video_data['index']} processing timed out after 5 minutes",
                            "PROCESSING_TIMEOUT",
                            retryable=True
                        )
                    
                    if process.returncode != 0:
                        error_msg = stderr.decode() if stderr else "Unknown FFmpeg error"
                        stdout_msg = stdout.decode() if stdout else "No output"
                        
                        # Log more detailed error information
                        logger.error(f"FFmpeg failed for video {video_data['index']}:")
                        logger.error(f"Command: {' '.join(cmd)}")
                        logger.error(f"Return code: {process.returncode}")
                        logger.error(f"STDERR: {error_msg}")
                        logger.error(f"STDOUT: {stdout_msg}")
                        logger.error(f"Input file: {input_path} (exists: {input_path.exists()}, size: {input_path.stat().st_size if input_path.exists() else 'N/A'})")
                        
                        # Include more context in the error message but limit length
                        truncated_error = error_msg[:500] + "..." if len(error_msg) > 500 else error_msg
                        raise VideoMergeError(
                            f"Failed to prepare video {video_data['index']}: {truncated_error}",
                            "PREPARATION_ERROR",
                            retryable=True
                        )
                    
                    logger.debug(f"Video {video_data['index']} processed successfully")
                    
                except Exception as e:
                    if not isinstance(e, VideoMergeError):
                        logger.error(f"Unexpected error processing video {video_data['index']}: {str(e)}")
                        raise VideoMergeError(
                            f"Error preparing video {video_data['index']}: {str(e)}",
                            "PREPARATION_ERROR",
                            retryable=True
                        )
                    raise
            
            prepared_videos.append(output_path)
        
        return prepared_videos
    
    async def _merge_videos(
        self, 
        prepared_videos: List[Path], 
        work_dir: Path,
        original_video_files: List[Dict] = None,
        progress_callback: Optional[callable] = None
    ) -> Tuple[Path, List[VideoSegmentMetadata]]:
        """Merge prepared videos into a single file"""
        
        output_path = work_dir / "merged_video.mp4"
        
        # If FFmpeg is not available, use the first video as the output
        if not self.ffmpeg_available:
            logger.warning("FFmpeg not available - using first video as merged output")
            if prepared_videos:
                # Copy the first video as the "merged" result
                try:
                    shutil.copy2(prepared_videos[0], output_path)
                    # Create basic segment metadata
                    segments = []
                    for i, video_path in enumerate(prepared_videos):
                        segments.append(VideoSegmentMetadata(
                            segment_index=i,
                            start_time=i * 10.0,  # Assume 10 seconds per video
                            end_time=(i + 1) * 10.0,
                            duration=10.0,
                            statement_index=i
                        ))
                    
                    if progress_callback:
                        progress_callback(100)
                    
                    logger.info(f"Video 'merged' (copied) successfully without FFmpeg: {output_path}")
                    return output_path, segments
                except Exception as e:
                    raise VideoMergeError(
                        f"Failed to copy video when FFmpeg unavailable: {str(e)}",
                        "COPY_ERROR"
                    )
            else:
                raise VideoMergeError(
                    "No videos to merge and FFmpeg not available",
                    "NO_VIDEOS"
                )
        
        # Create FFmpeg concat file
        concat_file = work_dir / "concat_list.txt"
        
        with open(concat_file, 'w') as f:
            for video_path in prepared_videos:
                f.write(f"file '{video_path.absolute()}'\n")
        
        # Merge videos using concat demuxer (fastest method for same format)
        cmd = [
            "ffmpeg",
            "-f", "concat",
            "-safe", "0",
            "-i", str(concat_file),
            "-c", "copy",  # Copy streams without re-encoding
            "-movflags", "+faststart",
            "-y",
            str(output_path)
        ]
        
        logger.debug(f"Merging videos with command: {' '.join(cmd)}")
        
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Monitor progress if callback provided
            if progress_callback:
                # FFmpeg doesn't provide reliable progress for concat, so simulate
                for i in range(10):
                    await asyncio.sleep(0.5)
                    progress_callback(i * 10)
                    if process.returncode is not None:
                        break
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown FFmpeg error"
                raise VideoMergeError(
                    f"Failed to merge videos: {error_msg}",
                    "MERGE_ERROR"
                )
            
            # Calculate segment metadata using original video files with session data
            segment_metadata = await self._calculate_segment_metadata(original_video_files or prepared_videos)
            
            logger.info(f"Videos merged successfully: {output_path}")
            
            if progress_callback:
                progress_callback(100)
            
            return output_path, segment_metadata
            
        except Exception as e:
            raise VideoMergeError(
                f"Error merging videos: {str(e)}",
                "MERGE_ERROR"
            )
    
    async def _calculate_segment_metadata(self, video_files) -> List[VideoSegmentMetadata]:
        """Calculate segment start/end times for merged video using actual upload session durations"""
        
        segments = []
        current_time = 0.0
        
        for i, video_file in enumerate(video_files):
            # Handle different input formats (Dict with session vs Path only)
            if isinstance(video_file, dict):
                video_path = video_file["path"]
                session = video_file.get("session")
            else:
                # Fallback to path-only mode
                video_path = video_file
                session = None
            
            actual_duration_seconds = None
            
            # CRITICAL FIX: Use actual uploaded video duration from session metadata
            if session and hasattr(session, 'metadata') and session.metadata:
                # Extract duration from session metadata (already in seconds)
                video_duration_seconds = session.metadata.get("video_duration")
                if video_duration_seconds and isinstance(video_duration_seconds, (int, float)):
                    actual_duration_seconds = float(video_duration_seconds)  # Duration already in seconds
                    logger.info(f"Video {i}: Using actual uploaded duration from session = {actual_duration_seconds}s")
            
            # If we don't have session duration, try FFprobe as fallback
            if actual_duration_seconds is None:
                if self.ffmpeg_available:
                    try:
                        # Get video duration using FFprobe
                        cmd = [
                            "ffprobe",
                            "-v", "quiet",
                            "-show_entries", "format=duration",
                            "-of", "csv=p=0",
                            str(video_path)
                        ]
                        
                        result = await asyncio.create_subprocess_exec(
                            *cmd,
                            stdout=asyncio.subprocess.PIPE,
                            stderr=asyncio.subprocess.PIPE
                        )
                        stdout, stderr = await result.communicate()
                        
                        if result.returncode != 0:
                            logger.warning(f"FFprobe failed for video {i}: {stderr.decode()} - using default duration")
                            actual_duration_seconds = 10.0  # Default fallback
                        else:
                            actual_duration_seconds = float(stdout.decode().strip())
                            logger.info(f"Video {i}: FFmpeg detected duration = {actual_duration_seconds}s")
                            
                    except Exception as e:
                        logger.warning(f"Error getting duration for video {i}: {str(e)} - using default")
                        actual_duration_seconds = 10.0  # Default fallback
                else:
                    # FFmpeg not available - use default duration
                    logger.warning(f"Video {i}: No session metadata and FFmpeg not available - using default duration")
                    actual_duration_seconds = 10.0  # Default to 10 seconds per video
            
            segment = VideoSegmentMetadata(
                segment_index=i,
                start_time=current_time,
                end_time=current_time + actual_duration_seconds,
                duration=actual_duration_seconds,
                statement_index=i
            )
            
            logger.info(f"Video {i}: Segment metadata created - start_time={current_time}s, end_time={current_time + actual_duration_seconds}s, duration={actual_duration_seconds}s")
            
            segments.append(segment)
            current_time += actual_duration_seconds
        
        return segments
    
    async def _compress_merged_video(
        self, 
        merged_path: Path, 
        work_dir: Path,
        progress_callback: Optional[callable] = None,
        quality_preset: str = "medium"
    ) -> Path:
        """Apply compression to the merged video with configurable quality settings"""
        
        compressed_path = work_dir / "compressed_merged_video.mp4"
        
        # Get compression settings from config
        compression_settings = self._get_compression_settings(quality_preset)
        
        # Use more conservative compression parameters for Railway deployment
        # Build FFmpeg command with Railway-optimized parameters
        cmd = [
            "ffmpeg",
            "-i", str(merged_path),
            "-c:v", "libx264",
            "-preset", "fast",  # Use faster preset for Railway environment
            "-crf", "23",  # Fixed CRF for consistency
            "-maxrate", "1500k",  # Conservative bitrate for Railway
            "-bufsize", "3000k",  # Conservative buffer
            "-c:a", "aac",
            "-b:a", "128k",
            "-movflags", "+faststart",  # Enable fast start for web streaming
            "-pix_fmt", "yuv420p",  # Ensure compatibility with most players
            "-profile:v", "baseline",  # Use baseline profile for better compatibility
            "-level", "3.1",  # Lower H.264 level for broader compatibility
            "-threads", "2",  # Limit threads for Railway environment
            "-y",  # Overwrite output file
            str(compressed_path)
        ]
        
        logger.info(f"Compressing merged video with {quality_preset} quality preset (Railway-optimized)")
        logger.debug(f"Compression command: {' '.join(cmd)}")
        
        try:
            # Record compression start time for progress monitoring
            import time
            self._compression_start_time = time.time()
            
            # Add timeout for Railway environment
            compression_timeout = 300  # 5 minutes timeout
            
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            # Monitor progress if callback provided
            progress_task = None
            if progress_callback:
                progress_task = asyncio.create_task(
                    self._monitor_compression_progress(process, merged_path, progress_callback)
                )
            
            # Wait for compression with timeout
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), 
                    timeout=compression_timeout
                )
            except asyncio.TimeoutError:
                # Kill the process if it times out
                try:
                    process.kill()
                    await process.wait()
                except:
                    pass
                raise VideoMergeError(
                    f"Video compression timed out after {compression_timeout} seconds",
                    "COMPRESSION_TIMEOUT"
                )
            finally:
                if progress_task and not progress_task.done():
                    progress_task.cancel()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown FFmpeg error"
                raise VideoMergeError(
                    f"Failed to compress merged video: {error_msg}",
                    "COMPRESSION_ERROR"
                )
            
            # Verify compressed file was created and has reasonable size
            if not compressed_path.exists():
                raise VideoMergeError(
                    "Compressed video file was not created",
                    "COMPRESSION_ERROR"
                )
            
            original_size = merged_path.stat().st_size
            compressed_size = compressed_path.stat().st_size
            compression_ratio = compressed_size / original_size if original_size > 0 else 1.0
            
            logger.info(
                f"Video compressed successfully: {compressed_path} "
                f"(original: {original_size} bytes, compressed: {compressed_size} bytes, "
                f"ratio: {compression_ratio:.2f})"
            )
            
            if progress_callback:
                progress_callback(100)
            
            return compressed_path
            
        except Exception as e:
            raise VideoMergeError(
                f"Error compressing merged video: {str(e)}",
                "COMPRESSION_ERROR"
            )
    
    def _get_compression_settings(self, quality_preset: str = "medium") -> Dict[str, Any]:
        """Get compression settings based on quality preset"""
        
        # Use preset from config if available, otherwise fall back to defaults
        if quality_preset in settings.COMPRESSION_QUALITY_PRESETS:
            preset_settings = settings.COMPRESSION_QUALITY_PRESETS[quality_preset]
            return {
                "video_codec": settings.VIDEO_CODEC,
                "audio_codec": settings.AUDIO_CODEC,
                "crf": preset_settings["crf"],
                "preset": preset_settings["preset"],
                "max_bitrate": preset_settings["max_bitrate"],
                "buffer_size": preset_settings["buffer_size"],
                "audio_bitrate": preset_settings["audio_bitrate"]
            }
        else:
            # Fall back to default settings from config
            return {
                "video_codec": settings.VIDEO_CODEC,
                "audio_codec": settings.AUDIO_CODEC,
                "crf": settings.VIDEO_COMPRESSION_CRF,
                "preset": settings.VIDEO_COMPRESSION_PRESET,
                "max_bitrate": settings.VIDEO_MAX_BITRATE,
                "buffer_size": settings.VIDEO_BUFFER_SIZE,
                "audio_bitrate": settings.AUDIO_BITRATE
            }
    
    async def _monitor_compression_progress(
        self, 
        process: asyncio.subprocess.Process,
        input_path: Path,
        progress_callback: callable
    ):
        """Monitor FFmpeg compression progress by parsing stderr output"""
        
        try:
            # Get input video duration for progress calculation
            duration_cmd = [
                "ffprobe",
                "-v", "quiet",
                "-show_entries", "format=duration",
                "-of", "csv=p=0",
                str(input_path)
            ]
            
            duration_result = await asyncio.create_subprocess_exec(
                *duration_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            duration_stdout, _ = await duration_result.communicate()
            
            total_duration = 0.0
            if duration_result.returncode == 0:
                try:
                    total_duration = float(duration_stdout.decode().strip())
                except (ValueError, AttributeError):
                    total_duration = 0.0
            
            # Monitor FFmpeg stderr for progress information
            progress_reported = False
            while process.returncode is None:
                try:
                    # Read a small chunk of stderr
                    chunk = await asyncio.wait_for(
                        process.stderr.read(1024), 
                        timeout=1.0
                    )
                    
                    if chunk:
                        stderr_text = chunk.decode('utf-8', errors='ignore')
                        
                        # Parse FFmpeg progress from stderr
                        if total_duration > 0 and "time=" in stderr_text:
                            import re
                            time_match = re.search(r'time=(\d{2}):(\d{2}):(\d{2}\.\d{2})', stderr_text)
                            if time_match:
                                hours, minutes, seconds = time_match.groups()
                                current_time = (
                                    int(hours) * 3600 + 
                                    int(minutes) * 60 + 
                                    float(seconds)
                                )
                                progress = min(100, (current_time / total_duration) * 100)
                                progress_callback(progress)
                                progress_reported = True
                    
                    await asyncio.sleep(0.1)
                    
                except asyncio.TimeoutError:
                    # No new data, continue monitoring
                    if not progress_reported:
                        # Simulate progress if we can't parse it
                        import time
                        elapsed = time.time() - getattr(self, '_compression_start_time', time.time())
                        estimated_progress = min(90, elapsed * 10)  # Rough estimate
                        progress_callback(estimated_progress)
                    continue
                except Exception:
                    # Error reading stderr, fall back to simple progress simulation
                    break
            
        except Exception as e:
            logger.debug(f"Progress monitoring failed, falling back to simulation: {e}")
            # Fall back to simple progress simulation
            for i in range(10):
                await asyncio.sleep(1.0)
                progress_callback(i * 10)
                if process.returncode is not None:
                    break
    
    async def _finalize_merge(
        self, 
        compressed_path: Path, 
        segment_metadata: List[VideoSegmentMetadata], 
        merge_session_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """Upload merged video to storage and generate final URLs"""
        
        # Generate unique filename for merged video
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        final_filename = f"merged_{merge_session_id}_{timestamp}.mp4"
        
        # Get file info
        file_size = compressed_path.stat().st_size
        total_duration = sum(segment.duration for segment in segment_metadata)
        
        # Create merged video metadata
        merged_metadata = MergedVideoMetadata(
            total_duration=total_duration,
            segments=segment_metadata,
            video_file_id=str(uuid.uuid4()),
            compression_applied=True,
            original_total_duration=total_duration  # Same since we compress after merge
        )
        
        try:
            if self.use_cloud_storage and self.cloud_storage:
                # Upload to cloud storage
                cloud_key = f"merged_videos/{user_id}/{merged_metadata.video_file_id}/{final_filename}"
                
                cloud_metadata = {
                    "user_id": user_id,
                    "merge_session_id": merge_session_id,
                    "video_file_id": merged_metadata.video_file_id,
                    "total_duration": str(total_duration),
                    "segment_count": str(len(segment_metadata)),
                    "compression_applied": "true",
                    "created_at": datetime.utcnow().isoformat()
                }
                
                try:
                    with open(compressed_path, 'rb') as file_stream:
                        cloud_url = await self.cloud_storage.upload_file_stream(
                            file_stream=file_stream,
                            key=cloud_key,
                            content_type="video/mp4",
                            file_size=file_size,
                            metadata=cloud_metadata
                        )
                    
                    streaming_url = cloud_url
                    storage_path = cloud_key
                    storage_type = "cloud"
                    
                    logger.info(f"Merged video uploaded to cloud storage: {cloud_key}")
                    
                    # Clean up individual uploaded videos after successful S3 upload
                    cleanup_result = await self._cleanup_individual_videos(merge_session_id, user_id)
                    logger.info(f"Individual video cleanup result: {cleanup_result}")
                    
                except Exception as upload_error:
                    logger.error(f"Failed to upload merged video to cloud storage: {upload_error}")
                    raise VideoMergeError(
                        f"Failed to upload merged video to cloud storage: {str(upload_error)}",
                        "CLOUD_UPLOAD_ERROR"
                    )
                
            else:
                # Store locally
                local_path = settings.UPLOAD_DIR / "merged_videos" / final_filename
                local_path.parent.mkdir(exist_ok=True)
                
                try:
                    shutil.copy2(compressed_path, local_path)
                    
                    streaming_url = f"/api/v1/media/merged/{merged_metadata.video_file_id}"
                    storage_path = str(local_path)
                    storage_type = "local"
                    
                    logger.info(f"Merged video stored locally: {local_path}")
                    
                    # Clean up individual uploaded videos after successful local storage
                    cleanup_result = await self._cleanup_individual_videos(merge_session_id, user_id)
                    logger.info(f"Individual video cleanup result: {cleanup_result}")
                    
                except Exception as storage_error:
                    logger.error(f"Failed to store merged video locally: {storage_error}")
                    raise VideoMergeError(
                        f"Failed to store merged video locally: {str(storage_error)}",
                        "LOCAL_STORAGE_ERROR"
                    )
            
            return {
                "storage_path": storage_path,
                "streaming_url": streaming_url,
                "storage_type": storage_type,
                "file_size": file_size,
                "metadata": merged_metadata.dict()
            }
            
        except VideoMergeError:
            # Re-raise VideoMergeError as-is
            raise
        except Exception as e:
            raise VideoMergeError(
                f"Failed to finalize merged video: {str(e)}",
                "FINALIZATION_ERROR"
            )
    
    async def _cleanup_individual_videos(self, merge_session_id: str, user_id: str):
        """Clean up individual uploaded videos after successful merge"""
        try:
            # Find all upload sessions for this merge session
            video_sessions = []
            for session_id, session in self.upload_service.sessions.items():
                if (session.user_id == user_id and 
                    session.metadata.get("merge_session_id") == merge_session_id and
                    session.metadata.get("is_merge_video", False) and
                    session.status == UploadStatus.COMPLETED):
                    video_sessions.append(session)
            
            cleanup_results = {
                "files_deleted": 0,
                "files_failed": 0,
                "sessions_cleaned": 0,
                "errors": []
            }
            
            for session in video_sessions:
                try:
                    # Delete the individual video file
                    video_file_path = settings.UPLOAD_DIR / f"{session.session_id}_{session.filename}"
                    
                    if video_file_path.exists():
                        video_file_path.unlink()
                        cleanup_results["files_deleted"] += 1
                        logger.info(f"Deleted individual video file: {video_file_path}")
                    else:
                        logger.warning(f"Individual video file not found: {video_file_path}")
                    
                    # Clean up session temporary directory if it exists
                    session_temp_dir = settings.TEMP_DIR / session.session_id
                    if session_temp_dir.exists():
                        shutil.rmtree(session_temp_dir)
                        logger.debug(f"Cleaned up session temp directory: {session_temp_dir}")
                    
                    # Mark session as cleaned up in metadata
                    session.metadata["cleaned_up"] = True
                    session.metadata["cleanup_timestamp"] = datetime.utcnow().isoformat()
                    cleanup_results["sessions_cleaned"] += 1
                    
                except Exception as e:
                    cleanup_results["files_failed"] += 1
                    error_msg = f"Failed to cleanup video for session {session.session_id}: {str(e)}"
                    cleanup_results["errors"].append(error_msg)
                    logger.error(error_msg)
            
            # Save updated session metadata
            try:
                await self.upload_service._save_sessions()
            except Exception as e:
                logger.error(f"Failed to save session metadata after cleanup: {e}")
            
            logger.info(
                f"Individual video cleanup completed for merge session {merge_session_id}: "
                f"{cleanup_results['files_deleted']} files deleted, "
                f"{cleanup_results['files_failed']} failed, "
                f"{cleanup_results['sessions_cleaned']} sessions updated"
            )
            
            if cleanup_results["errors"]:
                logger.warning(f"Cleanup errors: {cleanup_results['errors']}")
            
            return cleanup_results
            
        except Exception as e:
            error_msg = f"Critical error during individual video cleanup for merge session {merge_session_id}: {str(e)}"
            logger.error(error_msg)
            # Don't raise exception here as the merge itself was successful
            # Just log the error and continue
            return {
                "files_deleted": 0,
                "files_failed": 0,
                "sessions_cleaned": 0,
                "errors": [error_msg]
            }

    async def _cleanup_temp_files(self, work_dir: Path):
        """Clean up temporary files after merge completion"""
        try:
            if work_dir.exists():
                shutil.rmtree(work_dir)
                logger.debug(f"Cleaned up temporary directory: {work_dir}")
        except Exception as e:
            logger.warning(f"Failed to clean up temporary directory {work_dir}: {e}")
    
    def _update_merge_progress(self, merge_session_id: str, progress: float):
        """Update merge progress for a session"""
        if merge_session_id in self.merge_sessions:
            self.merge_sessions[merge_session_id]["progress"] = progress
            self.merge_sessions[merge_session_id]["updated_at"] = datetime.utcnow()
    
    def _estimate_merge_duration(self, video_files: List[Dict]) -> float:
        """Estimate merge duration based on video files"""
        # Base processing time + duration-based factor + size-based factor
        base_time = 30.0  # 30 seconds base
        
        total_duration = sum(
            video["session"].metadata.get("video_duration", 30.0) 
            for video in video_files
        )
        total_size = sum(
            video["session"].file_size 
            for video in video_files
        )
        
        duration_factor = total_duration * 0.8  # 0.8 seconds per second of video
        size_factor = total_size / (1024 * 1024) * 0.2  # 0.2 seconds per MB
        
        return base_time + duration_factor + size_factor
    
    async def get_merge_status(self, merge_session_id: str) -> Optional[Dict[str, Any]]:
        """Get the status of a merge session"""
        return self.merge_sessions.get(merge_session_id)
    
    async def cancel_merge(self, merge_session_id: str) -> bool:
        """Cancel an ongoing merge session"""
        merge_session = self.merge_sessions.get(merge_session_id)
        if not merge_session:
            return False
        
        if merge_session["status"] in [MergeSessionStatus.COMPLETED, MergeSessionStatus.FAILED]:
            return False  # Cannot cancel completed or failed merges
        
        merge_session["status"] = MergeSessionStatus.CANCELLED
        merge_session["updated_at"] = datetime.utcnow()
        merge_session["cancelled_at"] = datetime.utcnow()
        
        # Clean up temporary files
        work_dir = self.temp_dir / merge_session_id
        await self._cleanup_temp_files(work_dir)
        
        logger.info(f"Merge session {merge_session_id} cancelled")
        return True
    
    async def cleanup_individual_videos_for_session(self, merge_session_id: str, user_id: str) -> Dict[str, Any]:
        """Public method to manually clean up individual videos for a specific merge session"""
        try:
            # Verify the merge session exists and is completed
            merge_session = self.merge_sessions.get(merge_session_id)
            if not merge_session:
                return {
                    "success": False,
                    "error": f"Merge session {merge_session_id} not found"
                }
            
            if merge_session["user_id"] != user_id:
                return {
                    "success": False,
                    "error": "User ID does not match merge session owner"
                }
            
            if merge_session["status"] != MergeSessionStatus.COMPLETED:
                return {
                    "success": False,
                    "error": f"Cannot cleanup videos for merge session with status: {merge_session['status']}"
                }
            
            # Perform cleanup
            cleanup_result = await self._cleanup_individual_videos(merge_session_id, user_id)
            
            return {
                "success": True,
                "merge_session_id": merge_session_id,
                "cleanup_result": cleanup_result
            }
            
        except Exception as e:
            logger.error(f"Error in manual cleanup for merge session {merge_session_id}: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    async def cleanup_old_sessions(self, max_age_hours: int = 24):
        """Clean up old merge sessions and temporary files"""
        cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
        
        sessions_to_remove = []
        cleanup_stats = {
            "sessions_removed": 0,
            "individual_videos_cleaned": 0,
            "errors": []
        }
        
        for session_id, session in self.merge_sessions.items():
            if session["updated_at"] < cutoff_time:
                try:
                    # Clean up temporary files
                    work_dir = self.temp_dir / session_id
                    await self._cleanup_temp_files(work_dir)
                    
                    # If session was completed, also clean up individual videos
                    if session["status"] == MergeSessionStatus.COMPLETED:
                        cleanup_result = await self._cleanup_individual_videos(session_id, session["user_id"])
                        cleanup_stats["individual_videos_cleaned"] += cleanup_result.get("files_deleted", 0)
                    
                    sessions_to_remove.append(session_id)
                    
                except Exception as e:
                    error_msg = f"Error cleaning up session {session_id}: {str(e)}"
                    cleanup_stats["errors"].append(error_msg)
                    logger.error(error_msg)
        
        for session_id in sessions_to_remove:
            del self.merge_sessions[session_id]
        
        cleanup_stats["sessions_removed"] = len(sessions_to_remove)
        
        logger.info(
            f"Cleaned up {cleanup_stats['sessions_removed']} old merge sessions, "
            f"{cleanup_stats['individual_videos_cleaned']} individual videos"
        )
        
        if cleanup_stats["errors"]:
            logger.warning(f"Cleanup errors: {cleanup_stats['errors']}")
        
        return cleanup_stats
    
    async def _process_merge_sync(
        self, 
        merge_session_id: str, 
        video_paths: List[Path], 
        quality: str = "medium"
    ) -> Dict[str, Any]:
        """
        Synchronous merge processing for direct upload endpoint
        
        This is a simplified version of _process_merge that processes videos
        directly without the full session management overhead.
        """
        try:
            logger.info(f"Starting synchronous merge for session {merge_session_id}")
            
            # Create temporary working directory
            work_dir = self.temp_dir / merge_session_id
            work_dir.mkdir(exist_ok=True)
            
            try:
                # Step 1: Analyze videos
                video_files = [{"path": path, "index": i} for i, path in enumerate(video_paths)]
                video_info = await self._analyze_videos(video_files, work_dir)
                
                # Step 2: Prepare videos for merging
                prepared_videos = await self._prepare_videos_for_merge(
                    video_files, video_info, work_dir
                )
                
                # Step 3: Merge videos
                merged_path, segment_metadata = await self._merge_videos(
                    prepared_videos, work_dir, original_video_files=video_files
                )
                
                # Step 4: Apply compression
                compressed_path = await self._compress_merged_video(
                    merged_path, work_dir, quality_preset=quality
                )
                
                # Step 5: Upload to storage
                final_result = await self._finalize_merge(
                    compressed_path, segment_metadata, merge_session_id, "direct_upload"
                )
                
                logger.info(f"Synchronous merge completed for session {merge_session_id}")
                
                return {
                    "success": True,
                    "merged_video_url": final_result["streaming_url"],
                    "segment_metadata": [
                        {
                            "statementIndex": seg.statement_index,
                            "startTime": int(seg.start_time * 1000),  # Convert seconds to milliseconds
                            "endTime": int(seg.end_time * 1000)       # Convert seconds to milliseconds
                        }
                        for seg in segment_metadata
                    ],
                    "total_duration": sum(seg.end_time - seg.start_time for seg in segment_metadata),
                    "metadata": final_result["metadata"]
                }
                
            finally:
                # Clean up temporary files
                try:
                    await self._cleanup_temp_files(work_dir)
                except Exception as e:
                    logger.warning(f"Cleanup failed for sync merge {merge_session_id}: {e}")
                
        except Exception as e:
            logger.error(f"Synchronous merge failed for session {merge_session_id}: {str(e)}")
            return {
                "success": False,
                "error": str(e)
            }

    async def merge_temp_videos(
        self, 
        temp_video_files: List[str], 
        user_id: str, 
        quality_preset: str = "medium"
    ) -> Dict[str, Any]:
        """
        Merge videos from temporary files directly without using upload sessions.
        
        Args:
            temp_video_files: List of temporary video file paths
            user_id: User ID for the merge
            quality_preset: Quality preset for the merge
            
        Returns:
            Dict with merge results including final video URL
        """
        merge_session_id = f"temp_merge_{user_id}_{int(time.time())}"
        
        logger.info(f"Starting temp video merge {merge_session_id} for {len(temp_video_files)} files")
        
        try:
            # Create work directory
            work_dir = self.temp_dir / f"merge_{merge_session_id}"
            work_dir.mkdir(parents=True, exist_ok=True)
            
            # Validate and process temp video files
            video_files = []
            for i, temp_file_path in enumerate(temp_video_files):
                temp_file = Path(temp_file_path)
                if not temp_file.exists():
                    raise VideoMergeError(f"Temporary video file not found: {temp_file_path}")
                
                # Create video file info similar to what we expect from upload sessions
                video_info = {
                    "file_id": f"temp_{i}",
                    "user_id": user_id,
                    "filename": f"statement_{i}.mp4",
                    "file_path": str(temp_file),
                    "metadata": {
                        "statement_index": i,
                        "temp_file": True
                    }
                }
                
                # Get video data using FFprobe
                try:
                    video_data = self._get_default_video_data(video_info, temp_file)
                    video_info.update(video_data)
                except Exception as e:
                    logger.warning(f"Could not get video data for {temp_file}: {e}")
                    # Use defaults
                    video_info.update({
                        "duration": 10.0,
                        "width": 1080,
                        "height": 1920,
                        "fps": 30.0,
                        "format": "mp4"
                    })
                
                video_files.append(video_info)
            
            logger.info(f"Processed {len(video_files)} temp video files for merge")
            
            # Create merge session
            merge_session = {
                "merge_session_id": merge_session_id,
                "user_id": user_id,
                "status": MergeSessionStatus.PROCESSING,
                "video_files": video_files,
                "quality_preset": quality_preset,
                "created_at": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
                "progress": 0.0,
                "error_message": None,
                "merged_video_path": None,
                "merged_video_metadata": None
            }
            
            self.merge_sessions[merge_session_id] = merge_session
            
            # Process merge synchronously since we're in temp mode
            self._update_merge_progress(merge_session_id, 10.0)
            
            # Generate output filename
            output_filename = f"merged_video_{user_id}_{int(time.time())}.mp4"
            output_path = work_dir / output_filename
            
            # Prepare video list for FFmpeg
            video_list_file = work_dir / "video_list.txt"
            with open(video_list_file, 'w') as f:
                for video_file in video_files:
                    # video_file is a dict with file_path, extract the actual path
                    if isinstance(video_file, dict):
                        file_path = video_file['file_path']
                    else:
                        # For direct string paths from temp storage
                        file_path = str(video_file)
                    
                    logger.debug(f"Adding to video list: {file_path}")
                    # Ensure path exists
                    if not Path(file_path).exists():
                        logger.error(f"Video file does not exist: {file_path}")
                        raise VideoMergeError(f"Video file not found: {file_path}")
                    f.write(f"file '{file_path}'\n")
            
            # Log the video list contents for debugging
            with open(video_list_file, 'r') as f:
                video_list_contents = f.read()
                logger.info(f"Video list file contents:\n{video_list_contents}")
            
            self._update_merge_progress(merge_session_id, 20.0)
            
            # Get compression settings
            compression_settings = self._get_compression_settings(quality_preset)
            
            # Build FFmpeg command
            ffmpeg_cmd = [
                'ffmpeg',
                '-f', 'concat',
                '-safe', '0',
                '-i', str(video_list_file),
                '-c:v', compression_settings['video_codec'],
                '-preset', compression_settings['preset'],
                '-crf', str(compression_settings['crf']),
                '-c:a', compression_settings['audio_codec'],
                '-b:a', compression_settings['audio_bitrate'],
                '-movflags', '+faststart',
                '-y',  # Overwrite output file
                str(output_path)
            ]
            
            logger.info(f"Running FFmpeg merge: {' '.join(ffmpeg_cmd)}")
            self._update_merge_progress(merge_session_id, 30.0)
            
            # Execute FFmpeg
            process = await asyncio.create_subprocess_exec(
                *ffmpeg_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            stdout, stderr = await process.communicate()
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown FFmpeg error"
                logger.error(f"FFmpeg merge failed: {error_msg}")
                merge_session["status"] = MergeSessionStatus.FAILED
                merge_session["error_message"] = error_msg
                raise VideoMergeError(f"Video merge failed: {error_msg}")
            
            self._update_merge_progress(merge_session_id, 70.0)
            
            # Verify output file
            if not output_path.exists():
                raise VideoMergeError("Merged video file was not created")
            
            file_size = output_path.stat().st_size
            if file_size == 0:
                raise VideoMergeError("Merged video file is empty")
            
            logger.info(f"Merge completed, file size: {file_size} bytes")
            self._update_merge_progress(merge_session_id, 80.0)
            
            # Upload to S3
            try:
                with open(output_path, 'rb') as f:
                    video_content = f.read()
                
                # Upload merged video to S3
                s3_result = await self.cloud_storage.upload_file(
                    file_content=video_content,
                    filename=output_filename,
                    content_type="video/mp4",
                    user_id=user_id,
                    metadata={
                        "merge_session_id": merge_session_id,
                        "video_count": len(video_files),
                        "quality_preset": quality_preset,
                        "file_size": file_size,
                        "created_at": datetime.utcnow().isoformat()
                    }
                )
                
                self._update_merge_progress(merge_session_id, 95.0)
                
                # Update merge session
                merge_session["status"] = MergeSessionStatus.COMPLETED
                merge_session["merged_video_path"] = s3_result["file_url"]
                merge_session["merged_video_metadata"] = {
                    "file_id": s3_result["file_id"],
                    "file_url": s3_result["file_url"],
                    "file_size": file_size,
                    "video_count": len(video_files),
                    "quality_preset": quality_preset
                }
                
                self._update_merge_progress(merge_session_id, 100.0)
                
                logger.info(f"Temp video merge completed successfully: {s3_result['file_url']}")
                
                return {
                    "success": True,
                    "status": MergeSessionStatus.COMPLETED,
                    "video_file_id": s3_result["file_id"],
                    "final_video_url": s3_result["file_url"],
                    "metadata": merge_session["merged_video_metadata"],
                    "merge_session_id": merge_session_id
                }
                
            except Exception as e:
                logger.error(f"S3 upload failed for temp merge {merge_session_id}: {str(e)}")
                merge_session["status"] = MergeSessionStatus.FAILED
                merge_session["error_message"] = f"Upload failed: {str(e)}"
                raise VideoMergeError(f"Failed to upload merged video: {str(e)}")
                
        except VideoMergeError:
            raise
        except Exception as e:
            logger.error(f"Temp video merge failed for session {merge_session_id}: {str(e)}")
            if merge_session_id in self.merge_sessions:
                self.merge_sessions[merge_session_id]["status"] = MergeSessionStatus.FAILED
                self.merge_sessions[merge_session_id]["error_message"] = str(e)
            raise VideoMergeError(f"Merge processing failed: {str(e)}")
            
        finally:
            # Clean up work directory
            try:
                await self._cleanup_temp_files(work_dir)
            except Exception as e:
                logger.warning(f"Cleanup failed for temp merge {merge_session_id}: {e}")