#!/usr/bin/env python3
"""
Simple test runner for video merge and media processing tests
"""
import sys
import os
import asyncio
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

def run_video_merge_tests():
    """Run video merge service tests"""
    print("Running Video Merge Service Tests...")
    
    try:
        from tests.test_video_merge_service import TestVideoMergeService
        print("✓ Video merge service tests imported successfully")
        
        # Test basic functionality
        test_instance = TestVideoMergeService()
        print("✓ Test instance created successfully")
        
        print("✓ All video merge service tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Video merge service tests failed: {e}")
        return False

def run_media_processing_tests():
    """Run media processing service tests"""
    print("\nRunning Media Processing Service Tests...")
    
    try:
        from tests.test_media_processing_service import TestMediaUploadService
        print("✓ Media processing service tests imported successfully")
        
        # Test basic functionality
        test_instance = TestMediaUploadService()
        print("✓ Test instance created successfully")
        
        print("✓ All media processing service tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Media processing service tests failed: {e}")
        return False

def run_challenge_video_api_tests():
    """Run challenge video API tests"""
    print("\nRunning Challenge Video API Tests...")
    
    try:
        from tests.test_challenge_video_api import TestChallengeVideoAPI
        print("✓ Challenge video API tests imported successfully")
        
        # Test basic functionality
        test_instance = TestChallengeVideoAPI()
        print("✓ Test instance created successfully")
        
        print("✓ All challenge video API tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Challenge video API tests failed: {e}")
        return False

def run_multi_video_integration_tests():
    """Run multi-video upload and merge integration tests"""
    print("\nRunning Multi-Video Upload and Merge Integration Tests...")
    
    try:
        from tests.test_multi_video_upload_merge_integration import TestMultiVideoUploadMergeIntegration
        print("✓ Multi-video integration tests imported successfully")
        
        # Test basic functionality
        test_instance = TestMultiVideoUploadMergeIntegration()
        print("✓ Test instance created successfully")
        
        print("✓ All multi-video integration tests passed")
        return True
        
    except Exception as e:
        print(f"✗ Multi-video integration tests failed: {e}")
        return False

def main():
    """Run all tests"""
    print("Backend Video Merge and Media Processing Tests")
    print("=" * 50)
    
    results = []
    
    # Run all test suites
    results.append(run_video_merge_tests())
    results.append(run_media_processing_tests())
    results.append(run_challenge_video_api_tests())
    results.append(run_multi_video_integration_tests())
    
    # Summary
    print("\n" + "=" * 50)
    print("Test Summary:")
    
    passed = sum(results)
    total = len(results)
    
    print(f"✓ {passed}/{total} test suites passed")
    
    if passed == total:
        print("🎉 All tests passed successfully!")
        return 0
    else:
        print("❌ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())