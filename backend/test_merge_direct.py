#!/usr/bin/env python3
"""
Test the video merge service directly with valid test videos
"""

import asyncio
import sys
from pathlib import Path

# Add backend to Python path
sys.path.append('/home/kevin/Documents/2Truths-1Lie/backend')

from services.video_merge_service import VideoMergeService, VideoMergeRequest, VideoMetadata

async def test_video_merge():
    """Test video merge with valid test videos"""
    
    # Create video metadata for our test videos
    videos = [
        VideoMetadata(
            filename="test_video_0.mp4",
            index=0,
            duration=5.0
        ),
        VideoMetadata(
            filename="test_video_1.mp4",
            index=1,
            duration=5.0
        ),
        VideoMetadata(
            filename="test_video_2.mp4",
            index=2,
            duration=5.0
        )
    ]
    
    # Create merge request
    merge_request = VideoMergeRequest(
        user_id="test_user",
        videos=videos,
        output_filename="merged_test.mp4"
    )
    
    # Initialize merge service
    merge_service = VideoMergeService()
    
    # Test with test_videos directory
    test_videos_dir = Path('/home/kevin/Documents/2Truths-1Lie/backend/test_videos')
    
    try:
        print("🎬 Testing video merge with valid test videos...")
        print(f"Using video directory: {test_videos_dir}")
        
        # List available videos
        video_files = list(test_videos_dir.glob('*.mp4'))
        print(f"Found {len(video_files)} test videos:")
        for vf in video_files:
            size = vf.stat().st_size
            print(f"  {vf.name}: {size} bytes")
        
        if len(video_files) < 3:
            print("❌ Not enough test videos found!")
            return
        
        # Test the merge
        result = await merge_service.merge_videos_direct(
            merge_request, 
            upload_dir=test_videos_dir
        )
        
        print(f"✅ Video merge successful!")
        print(f"Output file: {result.output_path}")
        print(f"Duration: {result.total_duration}s")
        print(f"File size: {result.file_size} bytes")
        
        # Verify the output file exists and is valid
        if result.output_path.exists():
            print(f"✅ Output file exists: {result.output_path}")
            
            # Test with ffprobe
            import subprocess
            probe_result = subprocess.run([
                'ffprobe', '-v', 'quiet', '-print_format', 'json',
                '-show_format', str(result.output_path)
            ], capture_output=True, text=True)
            
            if probe_result.returncode == 0:
                print("✅ Output file is valid and readable by FFmpeg")
                import json
                format_info = json.loads(probe_result.stdout)
                duration = format_info.get('format', {}).get('duration', 'unknown')
                print(f"✅ Merged video duration: {duration}s")
            else:
                print(f"❌ Output file probe failed: {probe_result.stderr}")
        else:
            print(f"❌ Output file does not exist: {result.output_path}")
            
    except Exception as e:
        print(f"❌ Video merge failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_video_merge())