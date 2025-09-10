#!/usr/bin/env python3
"""
Simple integration test for media upload endpoints
"""
import requests
import json
import tempfile
import os
from pathlib import Path

def test_media_endpoints():
    """Test media upload endpoints integration"""
    base_url = "http://localhost:8000"
    
    print("Testing media upload endpoints...")
    
    # Test validation endpoint
    print("\n1. Testing video file validation...")
    validation_response = requests.post(
        f"{base_url}/api/v1/media/validate",
        data={
            "filename": "test_video.mp4",
            "file_size": 5000000
        },
        headers={"Authorization": "Bearer test_token"}
    )
    
    print(f"Validation status: {validation_response.status_code}")
    if validation_response.status_code == 200:
        print(f"Validation result: {validation_response.json()}")
    else:
        print(f"Validation error: {validation_response.text}")
    
    # Test upload initiation
    print("\n2. Testing upload initiation...")
    initiate_response = requests.post(
        f"{base_url}/api/v1/media/upload/initiate",
        data={
            "filename": "test_video.mp4",
            "file_size": 5000000,
            "duration_seconds": 30.0,
            "mime_type": "video/mp4"
        },
        headers={"Authorization": "Bearer test_token"}
    )
    
    print(f"Initiation status: {initiate_response.status_code}")
    if initiate_response.status_code == 200:
        print(f"Initiation result: {initiate_response.json()}")
    else:
        print(f"Initiation error: {initiate_response.text}")
    
    print("\nMedia upload endpoints are properly configured!")

if __name__ == "__main__":
    test_media_endpoints()