#!/usr/bin/env python3
"""
Test script for video merge service functionality
"""
import asyncio
import tempfile
import shutil
from pathlib import Path
import subprocess
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.video_merge_service import VideoMergeService, VideoMergeError

async def create_test_video(output_path: Path, duration: int = 5, text: str = "Test"):
    """Create a test video using FFmpeg"""
    cmd = [
        "ffmpeg",
        "-f", "lavfi",
        "-i", f"testsrc=duration={duration}:size=640x480:rate=30",
        "-f", "lavfi", 
        "-i", f"sine=frequency=1000:duration={duration}",
        "-vf", f"drawtext=text='{text}':fontcolor=white:fontsize=24:x=(w-text_w)/2:y=(h-text_h)/2",
        "-c:v", "libx264",
        "-c:a", "aac",
        "-t", str(duration),
        "-y",
        str(output_path)
    ]
    
    try:
        result = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await result.communicate()
        
        if result.returncode != 0:
            print(f"Failed to create test video: {stderr.decode()}")
            return False
        
        return True
    except Exception as e:
        print(f"Error creating test video: {e}")
        return False

async def test_video_merge_service():
    """Test the video merge service"""
    print("Testing Video Merge Service...")
    
    # Create temporary directory for test
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        
        try:
            # Initialize merge service
            merge_service = VideoMergeService()
            print("✓ Video merge service initialized")
            
            # Create test videos
            print("Creating test videos...")
            video_files = []
            
            for i in range(3):
                video_path = temp_path / f"test_video_{i}.mp4"
                success = await create_test_video(
                    video_path, 
                    duration=3, 
                    text=f"Video {i+1}"
                )
                
                if not success:
                    print(f"✗ Failed to create test video {i}")
                    return False
                
                # Mock video file info (simulating upload session data)
                video_files.append({
                    "index": i,
                    "path": video_path,
                    "session": type('MockSession', (), {
                        "session_id": f"test_session_{i}",
                        "filename": f"test_video_{i}.mp4",
                        "file_size": video_path.stat().st_size,
                        "metadata": {
                            "video_duration": 3.0,
                            "merge_session_id": "test_merge_session",
                            "video_index": i,
                            "video_count": 3,
                            "is_merge_video": True
                        }
                    })()
                })
            
            print(f"✓ Created {len(video_files)} test videos")
            
            # Test video analysis
            print("Testing video analysis...")
            work_dir = temp_path / "work"
            work_dir.mkdir()
            
            video_info = await merge_service._analyze_videos(video_files, work_dir)
            
            if len(video_info["videos"]) != 3:
                print(f"✗ Expected 3 videos, got {len(video_info['videos'])}")
                return False
            
            if abs(video_info["total_duration"] - 9.0) > 0.5:  # Allow some tolerance
                print(f"✗ Expected ~9s total duration, got {video_info['total_duration']}")
                return False
            
            print("✓ Video analysis completed successfully")
            
            # Test video preparation
            print("Testing video preparation...")
            prepared_videos = await merge_service._prepare_videos_for_merge(
                video_files, video_info, work_dir
            )
            
            if len(prepared_videos) != 3:
                print(f"✗ Expected 3 prepared videos, got {len(prepared_videos)}")
                return False
            
            for video_path in prepared_videos:
                if not video_path.exists():
                    print(f"✗ Prepared video not found: {video_path}")
                    return False
            
            print("✓ Video preparation completed successfully")
            
            # Test video merging
            print("Testing video merging...")
            merged_path, segment_metadata = await merge_service._merge_videos(
                prepared_videos, work_dir
            )
            
            if not merged_path.exists():
                print(f"✗ Merged video not found: {merged_path}")
                return False
            
            if len(segment_metadata) != 3:
                print(f"✗ Expected 3 segments, got {len(segment_metadata)}")
                return False
            
            # Verify segment metadata
            total_duration = sum(seg.duration for seg in segment_metadata)
            if abs(total_duration - 9.0) > 1.0:  # Allow some tolerance
                print(f"✗ Segment duration mismatch: expected ~9s, got {total_duration}")
                return False
            
            print("✓ Video merging completed successfully")
            
            # Test compression
            print("Testing video compression...")
            compressed_path = await merge_service._compress_merged_video(
                merged_path, work_dir
            )
            
            if not compressed_path.exists():
                print(f"✗ Compressed video not found: {compressed_path}")
                return False
            
            # Check that compressed file is smaller or similar size
            original_size = merged_path.stat().st_size
            compressed_size = compressed_path.stat().st_size
            
            print(f"  Original size: {original_size} bytes")
            print(f"  Compressed size: {compressed_size} bytes")
            print(f"  Compression ratio: {compressed_size/original_size:.2f}")
            
            print("✓ Video compression completed successfully")
            
            print("\n🎉 All video merge service tests passed!")
            return True
            
        except VideoMergeError as e:
            print(f"✗ Video merge error: {e} (code: {e.error_code})")
            return False
        except Exception as e:
            print(f"✗ Unexpected error: {e}")
            import traceback
            traceback.print_exc()
            return False

async def test_ffmpeg_availability():
    """Test if FFmpeg is available and working"""
    print("Testing FFmpeg availability...")
    
    try:
        result = await asyncio.create_subprocess_exec(
            "ffmpeg", "-version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await result.communicate()
        
        if result.returncode == 0:
            version_line = stdout.decode().split('\n')[0]
            print(f"✓ FFmpeg found: {version_line}")
            return True
        else:
            print(f"✗ FFmpeg not working: {stderr.decode()}")
            return False
            
    except FileNotFoundError:
        print("✗ FFmpeg not found. Please install FFmpeg to run video merge tests.")
        print("  Ubuntu/Debian: sudo apt install ffmpeg")
        print("  macOS: brew install ffmpeg")
        print("  Windows: Download from https://ffmpeg.org/download.html")
        return False
    except Exception as e:
        print(f"✗ Error checking FFmpeg: {e}")
        return False

async def main():
    """Main test function"""
    print("Video Merge Service Test Suite")
    print("=" * 40)
    
    # Test FFmpeg availability first
    if not await test_ffmpeg_availability():
        return False
    
    print()
    
    # Test video merge service
    if not await test_video_merge_service():
        return False
    
    print("\n✅ All tests completed successfully!")
    return True

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)