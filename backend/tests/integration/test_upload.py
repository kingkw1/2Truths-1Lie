#!/usr/bin/env python3
import requests
import json

# Get guest token first
response = requests.post("http://192.168.50.111:8001/api/v1/auth/guest")
if response.status_code == 200:
    data = response.json()
    token = data["access_token"]
    print(f"Got token: {token[:50]}...")
    
    # Test upload endpoint with the token
    headers = {
        "Authorization": f"Bearer {token}",
        "User-Agent": "TwoTruthsLie-Mobile/android"
    }
    
    # Create a dummy file for upload test
    files = {
        'file': ('test.mp4', b'fake video data', 'video/mp4')
    }
    
    print("Testing upload endpoint...")
    upload_response = requests.post(
        "http://192.168.50.111:8001/api/v1/s3-media/upload",
        headers=headers,
        files=files
    )
    
    print(f"Upload response status: {upload_response.status_code}")
    print(f"Upload response: {upload_response.text}")
    
else:
    print(f"Failed to get guest token: {response.status_code}")
    print(response.text)
