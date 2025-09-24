#!/usr/bin/env python3
import hmac
import hashlib
import os
import sys

# Test signature verification
def test_signature():
    media_id = "f8f9a26a-e867-4b43-9932-d11302fedc31"
    user_id = "10"
    expires_at = "1758696880"
    received_signature = "4bdf9fde3ed07d3a8c5f1ce083d31d010937eba7356bd781693af1369c8c0546"
    
    # Try different possible SECRET_KEYs
    possible_keys = [
        os.getenv("SECRET_KEY"),  # From environment
        "9249b50df3004f57db25e9ffd6222e914c18c17362f3044b4e4678c9c044ae97",  # From Railway logs
        "your-secret-key-here"  # Default fallback
    ]
    
    message = f"{media_id}:{user_id}:{expires_at}"
    print(f"Message: {message}")
    print(f"Received signature: {received_signature}")
    print()
    
    for i, secret_key in enumerate(possible_keys):
        if secret_key:
            try:
                expected_signature = hmac.new(
                    secret_key.encode(),
                    message.encode(),
                    hashlib.sha256
                ).hexdigest()
                
                matches = hmac.compare_digest(received_signature, expected_signature)
                print(f"Key {i+1}: {secret_key[:20]}...")
                print(f"Expected signature: {expected_signature}")
                print(f"Matches: {matches}")
                print()
                
                if matches:
                    print("✅ SIGNATURE VERIFICATION SUCCESS!")
                    return
                    
            except Exception as e:
                print(f"Error with key {i+1}: {e}")
                print()
    
    print("❌ All signature verifications failed")

if __name__ == "__main__":
    test_signature()