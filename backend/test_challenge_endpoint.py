#!/usr/bin/env python3
"""
Test script for the challenge creation endpoint with merged video metadata
"""

import requests
import json

# Test data that matches what the mobile app sends
test_data = {
    "statements": [
        {
            "text": "Statement 1",
            "media_file_id": "d8f9531b-4724-4ed3-8607-1f0475d6c9be",
            "segment_start_time": 0.0,
            "segment_end_time": 1.475,
            "segment_duration": 1.475
        },
        {
            "text": "Statement 2", 
            "media_file_id": "d8f9531b-4724-4ed3-8607-1f0475d6c9be",
            "segment_start_time": 1.475,
            "segment_end_time": 2.6,
            "segment_duration": 1.125
        },
        {
            "text": "Statement 3",
            "media_file_id": "d8f9531b-4724-4ed3-8607-1f0475d6c9be", 
            "segment_start_time": 2.6,
            "segment_end_time": 4.0,
            "segment_duration": 1.4
        }
    ],
    "lie_statement_index": 1,
    "is_merged_video": True,
    "merged_video_metadata": {
        "total_duration_ms": 4000,
        "segments": [
            {
                "statement_index": 0,
                "start_time_ms": 0,
                "end_time_ms": 1475,
                "duration_ms": 1475
            },
            {
                "statement_index": 1,
                "start_time_ms": 1475,
                "end_time_ms": 2600,
                "duration_ms": 1125
            },
            {
                "statement_index": 2,
                "start_time_ms": 2600,
                "end_time_ms": 4000,
                "duration_ms": 1400
            }
        ],
        "compression_applied": False
    },
    "tags": ["test", "merged_video"]
}

def test_challenge_endpoint():
    """Test the challenge creation endpoint"""
    url = "http://localhost:8001/api/v1/test/challenge"
    headers = {"Content-Type": "application/json"}
    
    print("🧪 Testing challenge creation endpoint...")
    print(f"📍 URL: {url}")
    print(f"📦 Payload size: {len(json.dumps(test_data))} characters")
    print(f"🎬 Is merged video: {test_data['is_merged_video']}")
    print(f"📊 Segments count: {len(test_data['merged_video_metadata']['segments'])}")
    
    try:
        response = requests.post(url, json=test_data, headers=headers, timeout=10)
        
        print(f"\n📡 Response status: {response.status_code}")
        print(f"📡 Response headers: {dict(response.headers)}")
        
        if response.status_code == 200 or response.status_code == 201:
            result = response.json()
            print(f"✅ SUCCESS! Challenge created:")
            print(f"   Challenge ID: {result.get('id', 'N/A')}")
            print(f"   Message: {result.get('message', 'N/A')}")
            print(f"   Lie index: {result.get('lie_index', 'N/A')}")
            return True
        else:
            print(f"❌ ERROR! Status: {response.status_code}")
            try:
                error_data = response.json()
                print(f"Error details: {json.dumps(error_data, indent=2)}")
            except:
                print(f"Error text: {response.text}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("❌ ERROR: Could not connect to backend server")
        print("Make sure the backend is running on http://localhost:8001")
        return False
    except Exception as e:
        print(f"❌ ERROR: {str(e)}")
        return False

if __name__ == "__main__":
    success = test_challenge_endpoint()
    if success:
        print("\n🎉 Test completed successfully!")
    else:
        print("\n💥 Test failed!")
    exit(0 if success else 1)
