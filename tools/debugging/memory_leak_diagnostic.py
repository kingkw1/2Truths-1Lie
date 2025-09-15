#!/usr/bin/env python3
"""
Memory Leak Diagnostic and Cleanup Script for Production
Run this on Railway to identify and fix memory leaks
"""
import os
import gc
import psutil
import shutil
from pathlib import Path
from datetime import datetime, timedelta
from config import settings
from services.upload_service import ChunkedUploadService
from services.video_merge_service import VideoMergeService

def get_memory_usage():
    """Get current memory usage"""
    process = psutil.Process()
    memory_info = process.memory_info()
    return {
        'rss_mb': memory_info.rss / 1024 / 1024,  # Resident Set Size
        'vms_mb': memory_info.vms / 1024 / 1024,  # Virtual Memory Size
        'percent': process.memory_percent()
    }

def cleanup_temp_files():
    """Clean up temporary files and directories"""
    cleanup_results = {
        'temp_dirs_removed': 0,
        'temp_files_removed': 0,
        'space_freed_mb': 0,
        'errors': []
    }
    
    try:
        # Clean up temp directory
        temp_dir = Path(settings.TEMP_DIR)
        
        # Remove old session directories (older than 1 hour)
        cutoff_time = datetime.now() - timedelta(hours=1)
        
        for item in temp_dir.iterdir():
            try:
                if item.is_dir() and item.name not in ['logs', 'video_merge']:
                    # Check if it's a session directory (UUID pattern)
                    if len(item.name) == 36 and '-' in item.name:
                        # Check age
                        mod_time = datetime.fromtimestamp(item.stat().st_mtime)
                        if mod_time < cutoff_time:
                            size_mb = sum(f.stat().st_size for f in item.rglob('*') if f.is_file()) / 1024 / 1024
                            shutil.rmtree(item)
                            cleanup_results['temp_dirs_removed'] += 1
                            cleanup_results['space_freed_mb'] += size_mb
                
                # Clean up video_merge subdirectories
                elif item.is_dir() and item.name == 'video_merge':
                    for merge_dir in item.iterdir():
                        if merge_dir.is_dir():
                            mod_time = datetime.fromtimestamp(merge_dir.stat().st_mtime)
                            if mod_time < cutoff_time:
                                size_mb = sum(f.stat().st_size for f in merge_dir.rglob('*') if f.is_file()) / 1024 / 1024
                                shutil.rmtree(merge_dir)
                                cleanup_results['temp_dirs_removed'] += 1
                                cleanup_results['space_freed_mb'] += size_mb
                                
            except Exception as e:
                cleanup_results['errors'].append(f"Error cleaning {item}: {e}")
                
    except Exception as e:
        cleanup_results['errors'].append(f"Error accessing temp directory: {e}")
    
    return cleanup_results

def cleanup_upload_sessions():
    """Clean up expired upload sessions from memory"""
    try:
        upload_service = ChunkedUploadService()
        initial_sessions = len(upload_service.sessions)
        
        # Run the cleanup method
        import asyncio
        asyncio.run(upload_service.cleanup_expired_sessions())
        
        final_sessions = len(upload_service.sessions)
        return {
            'initial_sessions': initial_sessions,
            'final_sessions': final_sessions,
            'sessions_cleaned': initial_sessions - final_sessions
        }
    except Exception as e:
        return {'error': str(e)}

def force_garbage_collection():
    """Force Python garbage collection"""
    collected = gc.collect()
    return {
        'objects_collected': collected,
        'garbage_count': len(gc.garbage)
    }

def main():
    print("🔍 Memory Leak Diagnostic & Cleanup Tool")
    print("=" * 50)
    
    # Initial memory check
    print("📊 INITIAL MEMORY USAGE:")
    initial_memory = get_memory_usage()
    print(f"   RSS: {initial_memory['rss_mb']:.2f} MB")
    print(f"   VMS: {initial_memory['vms_mb']:.2f} MB")
    print(f"   Percent: {initial_memory['percent']:.2f}%")
    print()
    
    # Check temp directory size
    print("📁 TEMP DIRECTORY ANALYSIS:")
    temp_path = Path(settings.TEMP_DIR)
    if temp_path.exists():
        temp_size = sum(f.stat().st_size for f in temp_path.rglob('*') if f.is_file()) / 1024 / 1024
        print(f"   Total temp size: {temp_size:.2f} MB")
        
        # Count session directories
        session_dirs = [d for d in temp_path.iterdir() if d.is_dir() and len(d.name) == 36]
        print(f"   Session directories: {len(session_dirs)}")
        
        # Check video_merge directory
        video_merge_path = temp_path / "video_merge"
        if video_merge_path.exists():
            merge_dirs = [d for d in video_merge_path.iterdir() if d.is_dir()]
            print(f"   Video merge directories: {len(merge_dirs)}")
    print()
    
    # Clean up temp files
    print("🧹 CLEANING TEMP FILES:")
    cleanup_results = cleanup_temp_files()
    print(f"   Directories removed: {cleanup_results['temp_dirs_removed']}")
    print(f"   Files removed: {cleanup_results['temp_files_removed']}")
    print(f"   Space freed: {cleanup_results['space_freed_mb']:.2f} MB")
    if cleanup_results['errors']:
        print(f"   Errors: {len(cleanup_results['errors'])}")
    print()
    
    # Clean up upload sessions
    print("💾 CLEANING UPLOAD SESSIONS:")
    session_results = cleanup_upload_sessions()
    if 'error' in session_results:
        print(f"   Error: {session_results['error']}")
    else:
        print(f"   Initial sessions: {session_results['initial_sessions']}")
        print(f"   Final sessions: {session_results['final_sessions']}")
        print(f"   Sessions cleaned: {session_results['sessions_cleaned']}")
    print()
    
    # Force garbage collection
    print("🗑️  GARBAGE COLLECTION:")
    gc_results = force_garbage_collection()
    print(f"   Objects collected: {gc_results['objects_collected']}")
    print(f"   Garbage items: {gc_results['garbage_count']}")
    print()
    
    # Final memory check
    print("📊 FINAL MEMORY USAGE:")
    final_memory = get_memory_usage()
    print(f"   RSS: {final_memory['rss_mb']:.2f} MB")
    print(f"   VMS: {final_memory['vms_mb']:.2f} MB")
    print(f"   Percent: {final_memory['percent']:.2f}%")
    
    # Calculate improvement
    memory_diff = initial_memory['rss_mb'] - final_memory['rss_mb']
    print(f"   Memory freed: {memory_diff:.2f} MB")
    print()
    
    print("✅ Cleanup completed!")
    
    if memory_diff < 5:
        print("⚠️  WARNING: Low memory recovery suggests ongoing leak")
        print("   Recommended actions:")
        print("   1. Monitor video upload cleanup")
        print("   2. Check for file handle leaks")
        print("   3. Review FFmpeg process cleanup")
        print("   4. Consider backend restart if memory continues growing")

if __name__ == "__main__":
    main()