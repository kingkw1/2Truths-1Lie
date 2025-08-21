#!/usr/bin/env python3
"""
Simple validation script for the chunked upload backend
"""
import sys
import os
import asyncio
import tempfile
import hashlib
from pathlib import Path

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from services.upload_service import ChunkedUploadService
from models import UploadStatus
from config import Settings

async def test_upload_service():
    """Test the upload service functionality"""
    print("🧪 Testing Chunked Upload Service...")
    
    # Create temporary directories
    temp_dir = Path(tempfile.mkdtemp())
    
    # Override settings for testing
    settings = Settings()
    settings.UPLOAD_DIR = temp_dir / "uploads"
    settings.TEMP_DIR = temp_dir / "temp"
    settings.UPLOAD_DIR.mkdir(exist_ok=True)
    settings.TEMP_DIR.mkdir(exist_ok=True)
    
    # Patch settings
    import config
    config.settings = settings
    
    # Create service
    service = ChunkedUploadService()
    
    # Test data
    test_data = b"Hello, World! This is a test file for chunked upload. " * 100
    file_hash = hashlib.sha256(test_data).hexdigest()
    chunk_size = 1024
    
    try:
        print(f"📁 Test file size: {len(test_data)} bytes")
        print(f"🔢 Chunk size: {chunk_size} bytes")
        
        # 1. Initiate upload
        print("\n1️⃣ Initiating upload...")
        session = await service.initiate_upload(
            user_id="test_user",
            filename="test.txt",
            file_size=len(test_data),
            mime_type="text/plain",
            chunk_size=chunk_size,
            file_hash=file_hash
        )
        
        print(f"✅ Session created: {session.session_id}")
        print(f"📊 Total chunks: {session.total_chunks}")
        
        # 2. Upload chunks
        print("\n2️⃣ Uploading chunks...")
        for i in range(session.total_chunks):
            start = i * chunk_size
            end = min(start + chunk_size, len(test_data))
            chunk_data = test_data[start:end]
            chunk_hash = hashlib.sha256(chunk_data).hexdigest()
            
            updated_session, was_uploaded = await service.upload_chunk(
                session_id=session.session_id,
                chunk_number=i,
                chunk_data=chunk_data,
                chunk_hash=chunk_hash
            )
            
            progress = service.get_progress_percent(session.session_id)
            print(f"  📦 Chunk {i}: {len(chunk_data)} bytes, Progress: {progress:.1f}%")
        
        # 3. Complete upload
        print("\n3️⃣ Completing upload...")
        final_path = await service.complete_upload(
            session_id=session.session_id,
            final_file_hash=file_hash
        )
        
        print(f"✅ Upload completed: {final_path}")
        
        # 4. Verify file
        print("\n4️⃣ Verifying file integrity...")
        with open(final_path, 'rb') as f:
            uploaded_data = f.read()
        
        if uploaded_data == test_data:
            print("✅ File integrity verified!")
        else:
            print("❌ File integrity check failed!")
            return False
        
        # 5. Check final status
        final_session = await service.get_upload_status(session.session_id)
        if final_session.status == UploadStatus.COMPLETED:
            print("✅ Session status: COMPLETED")
        else:
            print(f"❌ Unexpected session status: {final_session.status}")
            return False
        
        print("\n🎉 All tests passed!")
        return True
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    
    finally:
        # Cleanup
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)

def test_models():
    """Test model validation"""
    print("🧪 Testing Models...")
    
    try:
        from models import InitiateUploadRequest, UploadSession, UploadStatus
        
        # Test request validation
        request = InitiateUploadRequest(
            filename="test.mp4",
            file_size=1000000,
            mime_type="video/mp4",
            chunk_size=1024
        )
        print(f"✅ Request model: {request.filename}")
        
        # Test session model
        session = UploadSession(
            session_id="test-123",
            user_id="user-456",
            filename="test.mp4",
            file_size=1000000,
            chunk_size=1024,
            total_chunks=977,
            mime_type="video/mp4"
        )
        print(f"✅ Session model: {session.session_id}")
        
        print("✅ Model validation passed!")
        return True
        
    except Exception as e:
        print(f"❌ Model test failed: {e}")
        return False

def test_config():
    """Test configuration"""
    print("🧪 Testing Configuration...")
    
    try:
        from config import Settings
        
        settings = Settings()
        print(f"✅ Upload dir: {settings.UPLOAD_DIR}")
        print(f"✅ Max file size: {settings.MAX_FILE_SIZE}")
        print(f"✅ Allowed video types: {len(settings.ALLOWED_VIDEO_TYPES)}")
        print(f"✅ Allowed audio types: {len(settings.ALLOWED_AUDIO_TYPES)}")
        
        return True
        
    except Exception as e:
        print(f"❌ Config test failed: {e}")
        return False

async def main():
    """Run all validation tests"""
    print("🚀 Starting Backend Validation Tests\n")
    
    tests = [
        ("Configuration", test_config),
        ("Models", test_models),
        ("Upload Service", test_upload_service),
    ]
    
    results = []
    
    for test_name, test_func in tests:
        print(f"\n{'='*50}")
        print(f"Testing: {test_name}")
        print('='*50)
        
        if asyncio.iscoroutinefunction(test_func):
            result = await test_func()
        else:
            result = test_func()
        
        results.append((test_name, result))
    
    print(f"\n{'='*50}")
    print("VALIDATION SUMMARY")
    print('='*50)
    
    all_passed = True
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{test_name}: {status}")
        if not result:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All validation tests passed!")
        print("✅ Backend is ready for integration!")
    else:
        print("\n❌ Some tests failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())