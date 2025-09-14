#!/usr/bin/env python3
"""
Test script to validate video processing improvements
"""

import asyncio
import json
import subprocess
import tempfile
from pathlib import Path

async def test_ffmpeg_availability():
    """Test if FFmpeg and FFprobe are available"""
    print("Testing FFmpeg availability...")
    
    try:
        # Test FFmpeg
        process = await asyncio.create_subprocess_exec(
            "ffmpeg", "-version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            version_line = stdout.decode().split('\n')[0]
            print(f"✅ FFmpeg found: {version_line}")
        else:
            print(f"❌ FFmpeg test failed: {stderr.decode()}")
            return False
            
        # Test FFprobe
        process = await asyncio.create_subprocess_exec(
            "ffprobe", "-version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            version_line = stdout.decode().split('\n')[0]
            print(f"✅ FFprobe found: {version_line}")
        else:
            print(f"❌ FFprobe test failed: {stderr.decode()}")
            return False
            
        return True
        
    except Exception as e:
        print(f"❌ Exception testing FFmpeg: {e}")
        return False

async def create_test_video(output_path: Path, duration: int = 5):
    """Create a test video file using FFmpeg"""
    print(f"Creating test video: {output_path}")
    
    cmd = [
        "ffmpeg", "-f", "lavfi", "-i", f"testsrc=duration={duration}:size=720x1280:rate=30",
        "-f", "lavfi", "-i", "sine=frequency=1000:duration=5",
        "-c:v", "libx264", "-c:a", "aac", "-y", str(output_path)
    ]
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            print(f"✅ Test video created: {output_path}")
            return True
        else:
            print(f"❌ Failed to create test video: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"❌ Exception creating test video: {e}")
        return False

async def test_video_probe(video_path: Path):
    """Test FFprobe on a video file"""
    print(f"Testing probe on: {video_path}")
    
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(video_path)
    ]
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            probe_data = json.loads(stdout.decode())
            print(f"✅ Probe successful")
            
            # Extract key info
            format_info = probe_data.get('format', {})
            streams = probe_data.get('streams', [])
            video_stream = next((s for s in streams if s['codec_type'] == 'video'), None)
            
            print(f"   Format: {format_info.get('format_name', 'unknown')}")
            print(f"   Duration: {format_info.get('duration', 'unknown')} seconds")
            
            if video_stream:
                print(f"   Video: {video_stream.get('codec_name')} {video_stream.get('width')}x{video_stream.get('height')}")
                print(f"   FPS: {video_stream.get('r_frame_rate', 'unknown')}")
            
            return True
        else:
            print(f"❌ Probe failed: {stderr.decode()}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during probe: {e}")
        return False

async def test_video_processing(input_path: Path, output_path: Path):
    """Test our simplified video processing command"""
    print(f"Testing video processing: {input_path} -> {output_path}")
    
    # This mirrors our simplified FFmpeg command
    cmd = [
        "ffmpeg",
        "-i", str(input_path),
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-vf", "scale=720:1280:force_original_aspect_ratio=decrease",
        "-c:a", "aac",
        "-movflags", "+faststart",
        "-y",
        str(output_path)
    ]
    
    try:
        print(f"   Command: {' '.join(cmd)}")
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await process.communicate()
        
        if process.returncode == 0:
            print(f"✅ Video processing successful")
            
            # Check output file
            if output_path.exists():
                size = output_path.stat().st_size
                print(f"   Output file size: {size} bytes")
                return True
            else:
                print(f"❌ Output file not created")
                return False
        else:
            error_msg = stderr.decode() if stderr else "Unknown error"
            print(f"❌ Video processing failed: {error_msg}")
            return False
            
    except Exception as e:
        print(f"❌ Exception during processing: {e}")
        return False

async def main():
    print("🧪 Video Processing Test Suite")
    print("=" * 50)
    
    # Test FFmpeg availability
    if not await test_ffmpeg_availability():
        print("❌ FFmpeg not available, cannot continue")
        return
    
    print()
    
    # Create temporary directory for tests
    with tempfile.TemporaryDirectory() as temp_dir:
        temp_path = Path(temp_dir)
        test_video = temp_path / "test_input.mp4"
        processed_video = temp_path / "test_output.mp4"
        
        # Create test video
        if not await create_test_video(test_video):
            print("❌ Cannot create test video, skipping processing tests")
            return
        
        print()
        
        # Test probe
        if not await test_video_probe(test_video):
            print("❌ Probe test failed")
            return
        
        print()
        
        # Test processing
        if not await test_video_processing(test_video, processed_video):
            print("❌ Processing test failed")
            return
        
        print()
        
        # Final probe on processed video
        print("Testing probe on processed video:")
        await test_video_probe(processed_video)
    
    print()
    print("✅ All tests completed successfully!")

if __name__ == "__main__":
    asyncio.run(main())