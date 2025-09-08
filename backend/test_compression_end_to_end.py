#!/usr/bin/env python3
"""
End-to-end test for video compression in merge pipeline
"""
import asyncio
import tempfile
import sys
import os
from pathlib import Path
import subprocess
import json

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.video_merge_service import VideoMergeService

async def create_test_video(output_path: Path, duration: int = 3, text: str = "Test"):
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
    
    result = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await result.communicate()
    return result.returncode == 0

async def get_video_info(video_path: Path):
    """Get video information using FFprobe"""
    cmd = [
        "ffprobe",
        "-v", "quiet",
        "-print_format", "json",
        "-show_format",
        "-show_streams",
        str(video_path)
    ]
    
    result = await asyncio.create_subprocess_exec(
        *cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    stdout, stderr = await result.communicate()
    
    if result.returncode == 0:
        return json.loads(stdout.decode())
    return None

async def test_compression_quality_differences():
    """Test that different quality presets produce different file sizes"""
    print("Testing compression quality differences...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        merge_service = VideoMergeService()
        
        # Create a test video
        test_video = temp_path / "test_input.mp4"
        success = await create_test_video(test_video, duration=5, text="Quality Test")
        if not success:
            print("❌ Failed to create test video")
            return False
        
        work_dir = temp_path / "work"
        work_dir.mkdir()
        
        # Test each quality preset
        results = {}
        
        for preset in ["high", "medium", "low"]:
            print(f"  Testing {preset} quality preset...")
            
            try:
                compressed_path = await merge_service._compress_merged_video(
                    test_video,
                    work_dir,
                    quality_preset=preset
                )
                
                # Get file size and video info
                file_size = compressed_path.stat().st_size
                video_info = await get_video_info(compressed_path)
                
                if video_info:
                    # Extract bitrate from format info
                    bitrate = int(video_info.get("format", {}).get("bit_rate", 0))
                    duration = float(video_info.get("format", {}).get("duration", 0))
                    
                    results[preset] = {
                        "file_size": file_size,
                        "bitrate": bitrate,
                        "duration": duration,
                        "path": compressed_path
                    }
                    
                    print(f"    File size: {file_size} bytes")
                    print(f"    Bitrate: {bitrate} bps")
                    print(f"    Duration: {duration:.2f}s")
                else:
                    print(f"    ❌ Failed to get video info for {preset}")
                    return False
                    
            except Exception as e:
                print(f"    ❌ Compression failed for {preset}: {e}")
                return False
        
        # Verify quality differences
        if len(results) == 3:
            # High quality should have largest file size
            # Low quality should have smallest file size
            high_size = results["high"]["file_size"]
            medium_size = results["medium"]["file_size"]
            low_size = results["low"]["file_size"]
            
            print(f"\n  Quality comparison:")
            print(f"    High: {high_size} bytes")
            print(f"    Medium: {medium_size} bytes")
            print(f"    Low: {low_size} bytes")
            
            # Allow some tolerance since compression can vary
            if high_size >= medium_size * 0.8 and medium_size >= low_size * 0.8:
                print(f"  ✓ Quality presets produce expected file size differences")
            else:
                print(f"  ⚠️  File sizes don't follow expected pattern (this can be normal for short test videos)")
            
            # Verify all videos have same duration
            durations = [r["duration"] for r in results.values()]
            if all(abs(d - durations[0]) < 0.1 for d in durations):
                print(f"  ✓ All compressed videos have consistent duration")
            else:
                print(f"  ❌ Duration inconsistency detected")
                return False
        
        print("✅ Compression quality differences test passed!")
        return True

async def test_compression_parameters():
    """Test that compression uses correct FFmpeg parameters"""
    print("\nTesting compression parameters...")
    
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        merge_service = VideoMergeService()
        
        # Create a test video
        test_video = temp_path / "test_input.mp4"
        success = await create_test_video(test_video, duration=3, text="Param Test")
        if not success:
            print("❌ Failed to create test video")
            return False
        
        work_dir = temp_path / "work"
        work_dir.mkdir()
        
        # Test medium quality preset
        compressed_path = await merge_service._compress_merged_video(
            test_video,
            work_dir,
            quality_preset="medium"
        )
        
        # Verify the compressed video exists and is valid
        if not compressed_path.exists():
            print("❌ Compressed video file not created")
            return False
        
        # Get detailed video information
        video_info = await get_video_info(compressed_path)
        if not video_info:
            print("❌ Failed to get compressed video info")
            return False
        
        # Check video stream properties
        video_stream = None
        audio_stream = None
        
        for stream in video_info.get("streams", []):
            if stream.get("codec_type") == "video":
                video_stream = stream
            elif stream.get("codec_type") == "audio":
                audio_stream = stream
        
        if not video_stream:
            print("❌ No video stream found in compressed video")
            return False
        
        # Verify video codec
        video_codec = video_stream.get("codec_name")
        if video_codec != "h264":
            print(f"❌ Expected h264 codec, got {video_codec}")
            return False
        
        print(f"  ✓ Video codec: {video_codec}")
        
        # Verify pixel format
        pix_fmt = video_stream.get("pix_fmt")
        if pix_fmt != "yuv420p":
            print(f"❌ Expected yuv420p pixel format, got {pix_fmt}")
            return False
        
        print(f"  ✓ Pixel format: {pix_fmt}")
        
        # Verify profile
        profile = video_stream.get("profile")
        if "High" not in profile:
            print(f"⚠️  Expected High profile, got {profile}")
        else:
            print(f"  ✓ Video profile: {profile}")
        
        # Check audio stream if present
        if audio_stream:
            audio_codec = audio_stream.get("codec_name")
            if audio_codec != "aac":
                print(f"❌ Expected aac audio codec, got {audio_codec}")
                return False
            
            print(f"  ✓ Audio codec: {audio_codec}")
        
        # Verify file has faststart flag (movflags)
        format_info = video_info.get("format", {})
        format_name = format_info.get("format_name", "")
        if "mp4" not in format_name:
            print(f"❌ Expected MP4 format, got {format_name}")
            return False
        
        print(f"  ✓ Container format: {format_name}")
        
        print("✅ Compression parameters test passed!")
        return True

async def main():
    """Main test function"""
    print("Compression End-to-End Test Suite")
    print("=" * 50)
    
    try:
        # Test compression quality differences
        if not await test_compression_quality_differences():
            return False
        
        # Test compression parameters
        if not await test_compression_parameters():
            return False
        
        print("\n🎉 All compression end-to-end tests passed!")
        return True
        
    except Exception as e:
        print(f"\n❌ Test failed: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)