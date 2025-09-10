#!/usr/bin/env python3
"""
Debug JWT token from guest session
"""
import base64
import json
import requests

# Get guest token
response = requests.post("http://192.168.50.111:8001/api/v1/auth/guest")
if response.status_code == 200:
    data = response.json()
    token = data["access_token"]
    print(f"Token: {token[:50]}...")
    
    # Decode JWT (without verification for debugging)
    try:
        header, payload, signature = token.split('.')
        
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        
        # Decode payload
        decoded_payload = base64.urlsafe_b64decode(payload)
        payload_data = json.loads(decoded_payload)
        
        print("\nDecoded JWT Payload:")
        print(json.dumps(payload_data, indent=2))
        
        print(f"\nAudience (aud): {payload_data.get('aud')}")
        print(f"Issuer (iss): {payload_data.get('iss')}")
        print(f"Subject (sub): {payload_data.get('sub')}")
        print(f"Type: {payload_data.get('type')}")
        
    except Exception as e:
        print(f"Error decoding JWT: {e}")
else:
    print(f"Failed to get guest token: {response.status_code}")
    print(response.text)
