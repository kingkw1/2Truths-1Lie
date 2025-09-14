#!/usr/bin/env python3
"""
Direct test of FFmpeg video processing functions
"""

import asyncio
import sys
import tempfile
from pathlib import Path

# Add backend to Python path
sys.path.append('/home/kevin/Documents/2Truths-1Lie/backend')

async def test_video_preparation():
    """Test the video preparation function directly"""
    
    # Test with valid videos
    backend_dir = Path('/home/kevin/Documents/2Truths-1Lie/backend')
    uploads_dir = backend_dir / 'uploads'
    
    test_videos = [
        {
            'path': str(uploads_dir / 'test_video_0.mp4'),
            'index': 0,
            'width': 720,
            'height': 1280,
            'framerate': 30.0,
            'codec': 'h264'
        },
        {
            'path': str(uploads_dir / 'test_video_1.mp4'),
            'index': 1,
            'width': 720,
            'height': 1280,
            'framerate': 30.0,
            'codec': 'h264'
        },
        {
            'path': str(uploads_dir / 'test_video_2.mp4'),
            'index': 2,
            'width': 720,
            'height': 1280,
            'framerate': 30.0,
            'codec': 'h264'
        }
    ]
    
    video_info = {
        'videos': test_videos,
        'max_resolution': {'width': 720, 'height': 1280},
        'common_framerate': 30.0,
        'audio_present': True
    }
    
    with tempfile.TemporaryDirectory() as temp_dir:
        work_dir = Path(temp_dir)
        
        # Test our _prepare_videos_for_merge function logic manually
        print("🎬 Testing video preparation...")
        
        for video_data in test_videos:
            input_path = Path(video_data["path"])
            output_path = work_dir / f"prepared_{video_data['index']:02d}.mp4"
            
            print(f"Processing {input_path} -> {output_path}")
            
            # Check input exists
            if not input_path.exists():
                print(f"❌ Input file does not exist: {input_path}")
                continue
                
            file_size = input_path.stat().st_size
            print(f"  Input file size: {file_size} bytes")
            
            # First probe with FFprobe
            probe_cmd = [
                "ffprobe", "-v", "quiet", "-print_format", "json", 
                "-show_format", "-show_streams", str(input_path)
            ]
            
            print(f"  Probing: {' '.join(probe_cmd)}")
            
            try:
                probe_process = await asyncio.create_subprocess_exec(
                    *probe_cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                probe_stdout, probe_stderr = await probe_process.communicate()
                
                if probe_process.returncode != 0:
                    probe_error = probe_stderr.decode() if probe_stderr else "Unknown probe error"
                    print(f"  ❌ FFprobe failed: {probe_error}")
                    continue
                    
                print(f"  ✅ Probe successful")
                
                # Parse probe output
                import json
                probe_data = json.loads(probe_stdout.decode())
                format_info = probe_data.get('format', {})
                print(f"  Format: {format_info.get('format_name', 'unknown')}")
                print(f"  Duration: {format_info.get('duration', 'unknown')}s")
                
            except Exception as e:
                print(f"  ❌ Exception during probe: {e}")
                continue
            
            # Now test the simplified FFmpeg command
            cmd = [
                "ffmpeg",
                "-i", str(input_path),
                "-c:v", "libx264",
                "-preset", "fast",
                "-crf", "23",
                "-vf", "scale=720:1280:force_original_aspect_ratio=decrease",
                "-r", "30",
                "-c:a", "aac",
                "-movflags", "+faststart",
                "-y",
                str(output_path)
            ]
            
            print(f"  Processing: {' '.join(cmd[:6])}...")
            
            try:
                process = await asyncio.create_subprocess_exec(
                    *cmd,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                stdout, stderr = await process.communicate()
                
                if process.returncode == 0:
                    output_size = output_path.stat().st_size if output_path.exists() else 0
                    print(f"  ✅ Processing successful, output size: {output_size} bytes")
                    
                    # Test probe on output
                    probe_process = await asyncio.create_subprocess_exec(
                        "ffprobe", "-v", "quiet", "-print_format", "json",
                        "-show_format", str(output_path),
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    probe_stdout, probe_stderr = await probe_process.communicate()
                    
                    if probe_process.returncode == 0:
                        output_probe = json.loads(probe_stdout.decode())
                        output_format = output_probe.get('format', {})
                        print(f"  ✅ Output file valid, duration: {output_format.get('duration', 'unknown')}s")
                    else:
                        print(f"  ❌ Output file probe failed: {probe_stderr.decode()}")
                        
                else:
                    error_msg = stderr.decode() if stderr else "Unknown error"
                    stdout_msg = stdout.decode() if stdout else "No output"
                    print(f"  ❌ Processing failed (return code {process.returncode}):")
                    print(f"    STDERR: {error_msg[:200]}...")
                    print(f"    STDOUT: {stdout_msg[:200]}...")
                    
            except Exception as e:
                print(f"  ❌ Exception during processing: {e}")
                continue
                
        print("✅ Video preparation test completed")

if __name__ == "__main__":
    asyncio.run(test_video_preparation())