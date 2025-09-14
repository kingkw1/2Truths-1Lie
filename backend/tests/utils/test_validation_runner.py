#!/usr/bin/env python3
"""
Simple test runner for validation functionality
"""
import asyncio
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.validation_service import GameplayValidationService
from services.media_upload_service import MediaUploadService

async def test_validation():
    """Test validation functionality"""
    print("Testing strict validation implementation...")
    
    validation_service = GameplayValidationService()
    media_service = MediaUploadService()
    
    # Test 1: Valid file validation
    print("\n1. Testing valid file validation...")
    result = await validation_service.validate_file_before_upload(
        filename="test_video.mp4",
        file_size=5 * 1024 * 1024,  # 5MB
        mime_type="video/mp4",
        duration_seconds=15.0
    )
    print(f"   Valid file result: {result.is_valid} - {result.message}")
    assert result.is_valid, "Valid file should pass validation"
    
    # Test 2: Invalid file extension
    print("\n2. Testing invalid file extension...")
    result = await validation_service.validate_file_before_upload(
        filename="malware.exe",
        file_size=5 * 1024 * 1024,
        mime_type="application/octet-stream",
        duration_seconds=15.0
    )
    print(f"   Invalid extension result: {result.is_valid} - {result.message}")
    assert not result.is_valid, "Invalid extension should fail validation"
    
    # Test 3: File too large
    print("\n3. Testing file too large...")
    result = await validation_service.validate_file_before_upload(
        filename="huge_video.mp4",
        file_size=100 * 1024 * 1024,  # 100MB
        mime_type="video/mp4",
        duration_seconds=15.0
    )
    print(f"   Large file result: {result.is_valid} - {result.message}")
    assert not result.is_valid, "Large file should fail validation"
    
    # Test 4: Duration too short
    print("\n4. Testing duration too short...")
    result = await validation_service.validate_file_before_upload(
        filename="short_video.mp4",
        file_size=5 * 1024 * 1024,
        mime_type="video/mp4",
        duration_seconds=1.0  # Too short
    )
    print(f"   Short duration result: {result.is_valid} - {result.message}")
    assert not result.is_valid, "Short duration should fail validation"
    
    # Test 5: Filename security
    print("\n5. Testing filename security...")
    result = validation_service._validate_filename_security("../../../etc/passwd")
    print(f"   Path traversal result: {result.is_valid} - {result.message}")
    assert not result.is_valid, "Path traversal should fail validation"
    
    # Test 6: Media service validation
    print("\n6. Testing media service validation...")
    result = media_service.validate_video_file(
        filename="test.mp4",
        file_size=5 * 1024 * 1024,
        duration_seconds=15.0
    )
    print(f"   Media service result: {result['valid']} - {result.get('error', 'Success')}")
    assert result['valid'], "Valid file should pass media service validation"
    
    # Test 7: Media service invalid file
    print("\n7. Testing media service invalid file...")
    result = media_service.validate_video_file(
        filename="test.txt",
        file_size=5 * 1024 * 1024,
        duration_seconds=15.0
    )
    print(f"   Invalid file result: {result['valid']} - {result.get('error', 'Success')}")
    assert not result['valid'], "Invalid file should fail media service validation"
    
    print("\n✅ All validation tests passed!")
    return True

if __name__ == "__main__":
    try:
        success = asyncio.run(test_validation())
        if success:
            print("\n🎉 Validation implementation is working correctly!")
            sys.exit(0)
        else:
            print("\n❌ Validation tests failed!")
            sys.exit(1)
    except Exception as e:
        print(f"\n💥 Test execution failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)