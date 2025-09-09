"""
Unit tests for VideoMergeService - Backend video merging and processing logic
"""
import pytest
import asyncio
import tempfile
import shutil
from pathlib import Path
import hashlib
import os
import sys
import json
from unittest.mock import Mock, patch, AsyncMock, MagicMock
from datetime import datetime, timedelta

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from services.video_merge_service import VideoMergeService, VideoMergeError, MergeSessionStatus
from services.upload_service import ChunkedUploadService, UploadStatus
from models import VideoSegmentMetadata, MergedVideoMetadata, UploadSession
from config import Settings

@pytest.fixture
def temp_settings():
    """Create temporary settings for testing"""
    temp_dir = Path(tempfile.mkdtemp())
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    settings.USE_CLOUD_STORAGE = False  # Disable cloud storage for tests
    settings.MAX_FILE_SIZE = 50_000_000  # 50MB
    settings.MAX_VIDEO_DURATION_SECONDS = 300  # 5 minutes
    
    yield settings
    
    # Cleanup
    shutil.rmtree(temp_dir, ignore_errors=True)

@pytest.fixture
def mock_upload_service():
    """Mock upload service with test sessions"""
    service = Mock(spec=ChunkedUploadService)
    service.sessions = {}
    return service

@pytest.fixture
def video_merge_service(temp_settings, monkeypatch):
    """Create video merge service with temporary settings"""
    monkeypatch.setattr('config.settings', temp_settings)
    
    # Mock FFmpeg verification to avoid requiring actual FFmpeg
    with patch.object(VideoMergeService, '_verify_ffmpeg'):
        service = VideoMergeService()
        return service

@pytest.fixture
def sample_video_files(temp_settings):
    """Create sample video files for testing"""
    video_files = []
    
    for i in range(3):
        # Create mock video file
        video_path = temp_settings.UPLOAD_DIR / f"test_video_{i}.mp4"
        with open(video_path, 'wb') as f:
            # Write some dummy video data
            f.write(b"MOCK_VIDEO_DATA_" + str(i).encode() * 1000)
        
        video_files.append({
            "index": i,
            "path": video_path,
            "session": Mock(
                session_id=f"session_{i}",
                filename=f"test_video_{i}.mp4",
                metadata={"video_index": i, "merge_session_id": "test_merge_session"}
            )
        })
    
    yield video_files
    
    # Cleanup
    for video_file in video_files:
        video_file["path"].unlink(missing_ok=True)

@pytest.fixture
def mock_upload_sessions():
    """Create mock upload sessions for merge testing"""
    sessions = {}
    
    for i in range(3):
        session_id = f"session_{i}"
        session = Mock(spec=UploadSession)
        session.session_id = session_id
        session.user_id = "test_user"
        session.filename = f"test_video_{i}.mp4"
        session.status = UploadStatus.COMPLETED
        session.metadata = {
            "merge_session_id": "test_merge_session",
            "video_index": i,
            "video_count": 3,
            "is_merge_video": True
        }
        sessions[session_id] = session
    
    return sessions

class TestVideoMergeService:
    """Test cases for VideoMergeService"""
    
    def test_init_without_ffmpeg(self, temp_settings, monkeypatch):
        """Test initialization when FFmpeg is not available"""
        monkeypatch.setattr('config.settings', temp_settings)
        
        # Mock subprocess to simulate FFmpeg not found
        with patch('subprocess.run', side_effect=FileNotFoundError):
            with pytest.raises(VideoMergeError, match="FFmpeg not found"):
                VideoMergeService()
    
    def test_init_ffmpeg_not_working(self, temp_settings, monkeypatch):
        """Test initialization when FFmpeg is not working properly"""
        monkeypatch.setattr('config.settings', temp_settings)
        
        # Mock subprocess to simulate FFmpeg error
        mock_result = Mock()
        mock_result.returncode = 1
        with patch('subprocess.run', return_value=mock_result):
            with pytest.raises(VideoMergeError, match="FFmpeg not working properly"):
                VideoMergeService()
    
    @pytest.mark.asyncio
    async def test_check_merge_readiness_no_sessions(self, video_merge_service):
        """Test merge readiness check when no video sessions exist"""
        video_merge_service.upload_service.sessions = {}
        
        result = await video_merge_service.check_merge_readiness("test_merge_session", "test_user")
        
        assert result["ready"] is False
        assert "No video sessions found" in result["error"]
        assert result["videos_found"] == 0
    
    @pytest.mark.asyncio
    async def test_check_merge_readiness_incomplete_videos(self, video_merge_service, mock_upload_sessions):
        """Test merge readiness check when not all videos are completed"""
        # Make one video incomplete
        mock_upload_sessions["session_1"].status = UploadStatus.IN_PROGRESS
        video_merge_service.upload_service.sessions = mock_upload_sessions
        
        result = await video_merge_service.check_merge_readiness("test_merge_session", "test_user")
        
        assert result["ready"] is False
        assert result["videos_completed"] == 2
        assert result["videos_expected"] == 3
        assert 1 in result["missing_videos"]
    
    @pytest.mark.asyncio
    async def test_check_merge_readiness_missing_files(self, video_merge_service, mock_upload_sessions, temp_settings):
        """Test merge readiness check when video files are missing"""
        video_merge_service.upload_service.sessions = mock_upload_sessions
        
        result = await video_merge_service.check_merge_readiness("test_merge_session", "test_user")
        
        assert result["ready"] is False
        assert "Video file not found" in result["error"]
    
    @pytest.mark.asyncio
    async def test_check_merge_readiness_success(self, video_merge_service, mock_upload_sessions, sample_video_files, temp_settings):
        """Test successful merge readiness check"""
        # Update mock sessions to point to actual files
        for i, video_file in enumerate(sample_video_files):
            session_id = f"session_{i}"
            mock_upload_sessions[session_id].session_id = session_id
            mock_upload_sessions[session_id].filename = video_file["session"].filename
        
        video_merge_service.upload_service.sessions = mock_upload_sessions
        
        result = await video_merge_service.check_merge_readiness("test_merge_session", "test_user")
        
        assert result["ready"] is True
        assert result["videos_completed"] == 3
        assert len(result["video_files"]) == 3
    
    @pytest.mark.asyncio
    async def test_initiate_merge_already_in_progress(self, video_merge_service):
        """Test merge initiation when merge is already in progress"""
        # Set up existing merge session
        video_merge_service.merge_sessions["test_merge_session"] = {
            "status": MergeSessionStatus.PROCESSING
        }
        
        result = await video_merge_service.initiate_merge("test_merge_session", "test_user")
        
        assert result["status"] == MergeSessionStatus.PROCESSING
        assert "already processing" in result["message"]
    
    @pytest.mark.asyncio
    async def test_initiate_merge_not_ready(self, video_merge_service):
        """Test merge initiation when videos are not ready"""
        # Mock check_merge_readiness to return not ready
        with patch.object(video_merge_service, 'check_merge_readiness') as mock_check:
            mock_check.return_value = {
                "ready": False,
                "error": "Missing videos"
            }
            
            with pytest.raises(VideoMergeError, match="Videos not ready for merging"):
                await video_merge_service.initiate_merge("test_merge_session", "test_user")
    
    @pytest.mark.asyncio
    async def test_initiate_merge_success(self, video_merge_service, sample_video_files):
        """Test successful merge initiation"""
        # Mock check_merge_readiness to return ready
        with patch.object(video_merge_service, 'check_merge_readiness') as mock_check:
            mock_check.return_value = {
                "ready": True,
                "video_files": sample_video_files
            }
            
            # Mock _process_merge to avoid actual processing
            with patch.object(video_merge_service, '_process_merge'):
                result = await video_merge_service.initiate_merge("test_merge_session", "test_user")
                
                assert result["status"] == MergeSessionStatus.PENDING
                assert result["video_count"] == 3
                assert "estimated_duration_seconds" in result
                assert "test_merge_session" in video_merge_service.merge_sessions
    
    @pytest.mark.asyncio
    async def test_analyze_videos_success(self, video_merge_service, sample_video_files, temp_settings):
        """Test successful video analysis"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Mock FFprobe output
        mock_probe_output = {
            "streams": [
                {
                    "codec_type": "video",
                    "codec_name": "h264",
                    "width": 1920,
                    "height": 1080,
                    "r_frame_rate": "30/1"
                },
                {
                    "codec_type": "audio",
                    "codec_name": "aac"
                }
            ],
            "format": {
                "duration": "10.5",
                "bit_rate": "1000000"
            }
        }
        
        # Mock subprocess for FFprobe
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate.return_value = (json.dumps(mock_probe_output).encode(), b"")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            result = await video_merge_service._analyze_videos(sample_video_files, work_dir)
            
            assert len(result["videos"]) == 3
            assert result["total_duration"] == 31.5  # 3 videos * 10.5 seconds
            assert result["max_resolution"]["width"] == 1920
            assert result["max_resolution"]["height"] == 1080
            assert result["audio_present"] is True
            assert result["common_framerate"] == 30.0
    
    @pytest.mark.asyncio
    async def test_analyze_videos_ffprobe_error(self, video_merge_service, sample_video_files, temp_settings):
        """Test video analysis when FFprobe fails"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Mock subprocess to simulate FFprobe error
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = (b"", b"FFprobe error")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with pytest.raises(VideoMergeError, match="Failed to analyze video"):
                await video_merge_service._analyze_videos(sample_video_files, work_dir)
    
    @pytest.mark.asyncio
    async def test_analyze_videos_no_video_stream(self, video_merge_service, sample_video_files, temp_settings):
        """Test video analysis when no video stream is found"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Mock FFprobe output with no video stream
        mock_probe_output = {
            "streams": [
                {
                    "codec_type": "audio",
                    "codec_name": "aac"
                }
            ],
            "format": {
                "duration": "10.5"
            }
        }
        
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate.return_value = (json.dumps(mock_probe_output).encode(), b"")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with pytest.raises(VideoMergeError, match="No video stream found"):
                await video_merge_service._analyze_videos(sample_video_files, work_dir)
    
    @pytest.mark.asyncio
    async def test_prepare_videos_for_merge_no_processing_needed(self, video_merge_service, sample_video_files, temp_settings):
        """Test video preparation when no processing is needed"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Mock video info indicating no processing needed
        video_info = {
            "videos": [
                {
                    "index": i,
                    "path": str(video_file["path"]),
                    "width": 1920,
                    "height": 1080,
                    "framerate": 30.0,
                    "codec": "h264"
                }
                for i, video_file in enumerate(sample_video_files)
            ],
            "max_resolution": {"width": 1920, "height": 1080},
            "common_framerate": 30.0,
            "audio_present": True
        }
        
        with patch('shutil.copy2') as mock_copy:
            result = await video_merge_service._prepare_videos_for_merge(
                sample_video_files, video_info, work_dir
            )
            
            assert len(result) == 3
            assert mock_copy.call_count == 3  # All videos copied without processing
    
    @pytest.mark.asyncio
    async def test_prepare_videos_for_merge_processing_needed(self, video_merge_service, sample_video_files, temp_settings):
        """Test video preparation when processing is needed"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Mock video info indicating processing needed (different resolutions)
        video_info = {
            "videos": [
                {
                    "index": 0,
                    "path": str(sample_video_files[0]["path"]),
                    "width": 1280,  # Different resolution
                    "height": 720,
                    "framerate": 30.0,
                    "codec": "h264"
                },
                {
                    "index": 1,
                    "path": str(sample_video_files[1]["path"]),
                    "width": 1920,
                    "height": 1080,
                    "framerate": 30.0,
                    "codec": "h264"
                },
                {
                    "index": 2,
                    "path": str(sample_video_files[2]["path"]),
                    "width": 1920,
                    "height": 1080,
                    "framerate": 24.0,  # Different framerate
                    "codec": "h264"
                }
            ],
            "max_resolution": {"width": 1920, "height": 1080},
            "common_framerate": 30.0,
            "audio_present": True
        }
        
        # Mock FFmpeg subprocess
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate.return_value = (b"", b"")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            result = await video_merge_service._prepare_videos_for_merge(
                sample_video_files, video_info, work_dir
            )
            
            assert len(result) == 3
            # Verify FFmpeg was called for videos that need processing
            assert mock_process.communicate.call_count >= 2  # At least 2 videos processed
    
    @pytest.mark.asyncio
    async def test_prepare_videos_ffmpeg_error(self, video_merge_service, sample_video_files, temp_settings):
        """Test video preparation when FFmpeg fails"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        video_info = {
            "videos": [
                {
                    "index": 0,
                    "path": str(sample_video_files[0]["path"]),
                    "width": 1280,
                    "height": 720,
                    "framerate": 30.0,
                    "codec": "h264"
                }
            ],
            "max_resolution": {"width": 1920, "height": 1080},
            "common_framerate": 30.0,
            "audio_present": True
        }
        
        # Mock FFmpeg subprocess failure
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = (b"", b"FFmpeg processing error")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with pytest.raises(VideoMergeError, match="Failed to prepare video"):
                await video_merge_service._prepare_videos_for_merge(
                    [sample_video_files[0]], video_info, work_dir
                )
    
    @pytest.mark.asyncio
    async def test_merge_videos_success(self, video_merge_service, sample_video_files, temp_settings):
        """Test successful video merging"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Create prepared video files
        prepared_videos = []
        for i in range(3):
            prepared_path = work_dir / f"prepared_{i:02d}.mp4"
            with open(prepared_path, 'wb') as f:
                f.write(b"PREPARED_VIDEO_" + str(i).encode() * 100)
            prepared_videos.append(prepared_path)
        
        # Mock FFmpeg subprocess for merging
        mock_process = AsyncMock()
        mock_process.returncode = 0
        mock_process.communicate.return_value = (b"", b"")
        
        # Mock segment metadata calculation
        expected_segments = [
            VideoSegmentMetadata(start_time=0.0, end_time=10.0, duration=10.0, statement_index=0),
            VideoSegmentMetadata(start_time=10.0, end_time=20.0, duration=10.0, statement_index=1),
            VideoSegmentMetadata(start_time=20.0, end_time=30.0, duration=10.0, statement_index=2)
        ]
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with patch.object(video_merge_service, '_calculate_segment_metadata', return_value=expected_segments):
                merged_path, segment_metadata = await video_merge_service._merge_videos(
                    prepared_videos, work_dir
                )
                
                assert merged_path.name == "merged_video.mp4"
                assert len(segment_metadata) == 3
                assert segment_metadata[0].start_time == 0.0
                assert segment_metadata[2].end_time == 30.0
    
    @pytest.mark.asyncio
    async def test_merge_videos_ffmpeg_error(self, video_merge_service, temp_settings):
        """Test video merging when FFmpeg fails"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        prepared_videos = [work_dir / "prepared_00.mp4"]
        prepared_videos[0].touch()
        
        # Mock FFmpeg subprocess failure
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = (b"", b"FFmpeg merge error")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with pytest.raises(VideoMergeError, match="Failed to merge videos"):
                await video_merge_service._merge_videos(prepared_videos, work_dir)
    
    @pytest.mark.asyncio
    async def test_calculate_segment_metadata(self, video_merge_service, temp_settings):
        """Test segment metadata calculation"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        # Create test video files
        video_files = []
        for i in range(3):
            video_path = work_dir / f"video_{i}.mp4"
            video_path.touch()
            video_files.append(video_path)
        
        # Mock FFprobe to return different durations
        durations = ["5.5", "7.2", "3.8"]
        
        async def mock_subprocess(*args, **kwargs):
            # Determine which video is being probed based on the path argument
            video_path = args[0][-1]  # Last argument is the video path
            for i, path in enumerate(video_files):
                if str(path) in video_path:
                    mock_process = AsyncMock()
                    mock_process.returncode = 0
                    mock_process.communicate.return_value = (durations[i].encode(), b"")
                    return mock_process
            
            # Default mock
            mock_process = AsyncMock()
            mock_process.returncode = 0
            mock_process.communicate.return_value = (b"10.0", b"")
            return mock_process
        
        with patch('asyncio.create_subprocess_exec', side_effect=mock_subprocess):
            segments = await video_merge_service._calculate_segment_metadata(video_files)
            
            assert len(segments) == 3
            assert segments[0].start_time == 0.0
            assert segments[0].end_time == 5.5
            assert segments[0].duration == 5.5
            assert segments[1].start_time == 5.5
            assert segments[1].end_time == 12.7  # 5.5 + 7.2
            assert segments[2].start_time == 12.7
            assert segments[2].end_time == 16.5  # 12.7 + 3.8
    
    @pytest.mark.asyncio
    async def test_calculate_segment_metadata_ffprobe_error(self, video_merge_service, temp_settings):
        """Test segment metadata calculation when FFprobe fails"""
        work_dir = temp_settings.TEMP_DIR / "test_work"
        work_dir.mkdir(exist_ok=True)
        
        video_files = [work_dir / "video_0.mp4"]
        video_files[0].touch()
        
        # Mock FFprobe failure
        mock_process = AsyncMock()
        mock_process.returncode = 1
        mock_process.communicate.return_value = (b"", b"FFprobe duration error")
        
        with patch('asyncio.create_subprocess_exec', return_value=mock_process):
            with pytest.raises(VideoMergeError, match="Failed to get duration"):
                await video_merge_service._calculate_segment_metadata(video_files)
    
    def test_estimate_merge_duration(self, video_merge_service, sample_video_files):
        """Test merge duration estimation"""
        duration = video_merge_service._estimate_merge_duration(sample_video_files)
        
        # Should return a positive number
        assert duration > 0
        assert isinstance(duration, (int, float))
    
    def test_update_merge_progress(self, video_merge_service):
        """Test merge progress update"""
        merge_session_id = "test_session"
        video_merge_service.merge_sessions[merge_session_id] = {
            "progress": 0.0,
            "updated_at": datetime.utcnow()
        }
        
        video_merge_service._update_merge_progress(merge_session_id, 50.0)
        
        session = video_merge_service.merge_sessions[merge_session_id]
        assert session["progress"] == 50.0
        assert isinstance(session["updated_at"], datetime)
    
    @pytest.mark.asyncio
    async def test_get_merge_status_not_found(self, video_merge_service):
        """Test getting merge status for non-existent session"""
        result = await video_merge_service.get_merge_status("nonexistent_session")
        assert result is None
    
    @pytest.mark.asyncio
    async def test_get_merge_status_success(self, video_merge_service):
        """Test getting merge status for existing session"""
        merge_session_id = "test_session"
        expected_status = {
            "merge_session_id": merge_session_id,
            "status": MergeSessionStatus.PROCESSING,
            "progress": 75.0,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow()
        }
        
        video_merge_service.merge_sessions[merge_session_id] = expected_status
        
        result = await video_merge_service.get_merge_status(merge_session_id)
        
        assert result["merge_session_id"] == merge_session_id
        assert result["status"] == MergeSessionStatus.PROCESSING
        assert result["progress"] == 75.0

class TestVideoMergeServiceIntegration:
    """Integration tests for VideoMergeService with mocked external dependencies"""
    
    @pytest.mark.asyncio
    async def test_full_merge_workflow_success(self, video_merge_service, sample_video_files, temp_settings):
        """Test complete merge workflow from initiation to completion"""
        merge_session_id = "integration_test_session"
        
        # Mock all external dependencies
        with patch.object(video_merge_service, 'check_merge_readiness') as mock_check:
            mock_check.return_value = {
                "ready": True,
                "video_files": sample_video_files
            }
            
            # Mock video analysis
            mock_video_info = {
                "videos": [
                    {"index": i, "path": str(vf["path"]), "duration": 10.0, "width": 1920, "height": 1080, "framerate": 30.0, "codec": "h264", "has_audio": True}
                    for i, vf in enumerate(sample_video_files)
                ],
                "total_duration": 30.0,
                "max_resolution": {"width": 1920, "height": 1080},
                "common_framerate": 30.0,
                "audio_present": True
            }
            
            with patch.object(video_merge_service, '_analyze_videos', return_value=mock_video_info):
                with patch.object(video_merge_service, '_prepare_videos_for_merge') as mock_prepare:
                    # Mock prepared video paths
                    prepared_paths = [temp_settings.TEMP_DIR / f"prepared_{i}.mp4" for i in range(3)]
                    for path in prepared_paths:
                        path.touch()
                    mock_prepare.return_value = prepared_paths
                    
                    with patch.object(video_merge_service, '_merge_videos') as mock_merge:
                        # Mock merge result
                        merged_path = temp_settings.TEMP_DIR / "merged.mp4"
                        merged_path.touch()
                        mock_segments = [
                            VideoSegmentMetadata(start_time=0.0, end_time=10.0, duration=10.0, statement_index=0),
                            VideoSegmentMetadata(start_time=10.0, end_time=20.0, duration=10.0, statement_index=1),
                            VideoSegmentMetadata(start_time=20.0, end_time=30.0, duration=10.0, statement_index=2)
                        ]
                        mock_merge.return_value = (merged_path, mock_segments)
                        
                        with patch.object(video_merge_service, '_compress_merged_video') as mock_compress:
                            compressed_path = temp_settings.TEMP_DIR / "compressed.mp4"
                            compressed_path.touch()
                            mock_compress.return_value = compressed_path
                            
                            with patch.object(video_merge_service, '_finalize_merge') as mock_finalize:
                                mock_finalize.return_value = {
                                    "storage_path": "s3://bucket/merged_video.mp4",
                                    "streaming_url": "https://cdn.example.com/merged_video.mp4",
                                    "metadata": {
                                        "total_duration": 30.0,
                                        "segments": mock_segments
                                    }
                                }
                                
                                with patch.object(video_merge_service, '_cleanup_temp_files'):
                                    # Initiate merge
                                    result = await video_merge_service.initiate_merge(
                                        merge_session_id, "test_user", "medium"
                                    )
                                    
                                    assert result["status"] == MergeSessionStatus.PENDING
                                    assert result["video_count"] == 3
                                    
                                    # Wait for processing to complete (mocked)
                                    await asyncio.sleep(0.1)
                                    
                                    # Verify merge session was created
                                    assert merge_session_id in video_merge_service.merge_sessions
                                    session = video_merge_service.merge_sessions[merge_session_id]
                                    assert session["user_id"] == "test_user"
                                    assert session["quality_preset"] == "medium"

if __name__ == "__main__":
    pytest.main([__file__, "-v"])