#!/usr/bin/env python3
"""
Generate test authentication tokens for S3 Media API testing
"""
import sys
import os
from pathlib import Path
from datetime import datetime, timedelta

# Add backend to path
sys.path.append(str(Path(__file__).parent.parent.parent / 'backend'))

# Load environment variables
def load_env_file():
    env_path = Path(__file__).parent.parent.parent / 'backend' / '.env'
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    os.environ[key] = value

load_env_file()

try:
    from services.auth_service import create_access_token
    
    def generate_test_token():
        """Generate a test token with full media permissions"""
        
        # Create token with 24-hour expiry and all media permissions
        token_data = {
            "sub": "test-user-12345",  # User ID
            "permissions": [
                "media:upload",
                "media:read", 
                "media:delete"
            ],
            "iat": datetime.utcnow(),
            "type": "access"
        }
        
        token = create_access_token(
            data=token_data,
            expires_delta=timedelta(hours=24)
        )
        
        return token
    
    def main():
        print("🔑 Generating Test Authentication Token...")
        print("=" * 50)
        
        try:
            token = generate_test_token()
            
            print("✅ Test token generated successfully!")
            print(f"\n📋 Token (valid for 24 hours):")
            print(f"{token}")
            
            print(f"\n🧪 Use this token for testing:")
            print(f"Authorization: Bearer {token}")
            
            print(f"\n📝 Example curl command:")
            print(f'curl -H "Authorization: Bearer {token}" \\')
            print(f'     "http://127.0.0.1:8001/api/v1/s3-media/health/s3"')
            
            # Save to file for easy access
            with open('test_token.txt', 'w') as f:
                f.write(token)
            print(f"\n💾 Token also saved to 'test_token.txt'")
            
        except Exception as e:
            print(f"❌ Error generating token: {e}")
            print("Make sure the backend server can load properly.")
            
    if __name__ == "__main__":
        main()
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    print("Make sure you're running this from the project root directory.")
    print("The backend modules need to be accessible.")
