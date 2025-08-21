#!/usr/bin/env python3
"""
Example client demonstrating how to use the chunked upload API
"""
import asyncio
import aiohttp
import hashlib
import io
from pathlib import Path

class ChunkedUploadClient:
    """Client for chunked upload API"""
    
    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url.rstrip('/')
        self.auth_token = auth_token
        self.headers = {"Authorization": f"Bearer {auth_token}"}
    
    async def upload_file(self, file_path: Path, chunk_size: int = 1024*1024):
        """Upload a file using chunked upload"""
        
        # Read file and calculate hash
        with open(file_path, 'rb') as f:
            file_data = f.read()
        
        file_hash = hashlib.sha256(file_data).hexdigest()
        file_size = len(file_data)
        
        print(f"📁 Uploading: {file_path.name}")
        print(f"📊 Size: {file_size} bytes")
        print(f"🔢 Chunk size: {chunk_size} bytes")
        print(f"🔐 Hash: {file_hash[:16]}...")
        
        async with aiohttp.ClientSession() as session:
            # 1. Initiate upload
            print("\n1️⃣ Initiating upload...")
            
            initiate_payload = {
                "filename": file_path.name,
                "file_size": file_size,
                "mime_type": self._get_mime_type(file_path),
                "chunk_size": chunk_size,
                "file_hash": file_hash
            }
            
            async with session.post(
                f"{self.base_url}/api/v1/upload/initiate",
                json=initiate_payload,
                headers=self.headers
            ) as resp:
                if resp.status != 200:
                    raise Exception(f"Failed to initiate upload: {await resp.text()}")
                
                data = await resp.json()
                session_id = data["session_id"]
                total_chunks = data["total_chunks"]
                
                print(f"✅ Session: {session_id}")
                print(f"📦 Total chunks: {total_chunks}")
            
            # 2. Upload chunks
            print("\n2️⃣ Uploading chunks...")
            
            for chunk_num in range(total_chunks):
                start = chunk_num * chunk_size
                end = min(start + chunk_size, file_size)
                chunk_data = file_data[start:end]
                chunk_hash = hashlib.sha256(chunk_data).hexdigest()
                
                # Create form data
                form_data = aiohttp.FormData()
                form_data.add_field('file', io.BytesIO(chunk_data), 
                                  filename=f'chunk_{chunk_num}',
                                  content_type='application/octet-stream')
                form_data.add_field('chunk_hash', chunk_hash)
                
                async with session.post(
                    f"{self.base_url}/api/v1/upload/{session_id}/chunk/{chunk_num}",
                    data=form_data,
                    headers=self.headers
                ) as resp:
                    if resp.status != 200:
                        raise Exception(f"Failed to upload chunk {chunk_num}: {await resp.text()}")
                    
                    result = await resp.json()
                    progress = result["progress_percent"]
                    print(f"  📦 Chunk {chunk_num}: {len(chunk_data)} bytes, Progress: {progress:.1f}%")
            
            # 3. Complete upload
            print("\n3️⃣ Completing upload...")
            
            complete_payload = {
                "session_id": session_id,
                "file_hash": file_hash
            }
            
            async with session.post(
                f"{self.base_url}/api/v1/upload/{session_id}/complete",
                json=complete_payload,
                headers=self.headers
            ) as resp:
                if resp.status != 200:
                    raise Exception(f"Failed to complete upload: {await resp.text()}")
                
                result = await resp.json()
                file_url = result["file_url"]
                
                print(f"✅ Upload completed!")
                print(f"🔗 File URL: {file_url}")
                
                return session_id, file_url
    
    def _get_mime_type(self, file_path: Path) -> str:
        """Get MIME type based on file extension"""
        ext = file_path.suffix.lower()
        
        mime_types = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.avi': 'video/avi',
            '.mov': 'video/mov',
            '.mp3': 'audio/mp3',
            '.wav': 'audio/wav',
            '.aac': 'audio/aac',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.txt': 'text/plain'
        }
        
        return mime_types.get(ext, 'application/octet-stream')

async def main():
    """Example usage"""
    
    # Create a test file
    test_file = Path("test_upload.txt")
    test_content = b"This is a test file for chunked upload demonstration. " * 200
    
    with open(test_file, 'wb') as f:
        f.write(test_content)
    
    print("📝 Created test file for demonstration")
    
    # You would get this token from your authentication system
    from services.auth_service import create_test_token
    token = create_test_token("demo_user")
    
    # Create client
    client = ChunkedUploadClient("http://localhost:8000", token)
    
    try:
        # Upload file
        session_id, file_url = await client.upload_file(test_file, chunk_size=1024)
        
        print(f"\n🎉 Upload successful!")
        print(f"Session ID: {session_id}")
        print(f"File URL: {file_url}")
        
    except Exception as e:
        print(f"❌ Upload failed: {e}")
    
    finally:
        # Cleanup test file
        test_file.unlink(missing_ok=True)

if __name__ == "__main__":
    print("🚀 Chunked Upload Client Example")
    print("=" * 50)
    print("This example demonstrates how to use the chunked upload API")
    print("Make sure the backend server is running on http://localhost:8000")
    print("=" * 50)
    
    asyncio.run(main())