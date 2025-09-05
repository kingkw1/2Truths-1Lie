#!/usr/bin/env python3
"""
Integration test for challenge API endpoints
"""
import asyncio
import sys
import subprocess
import time
import signal
import os
import requests
import json
from threading import Thread

sys.path.append('.')
from services.auth_service import create_test_token

class ServerManager:
    """Manage FastAPI server for testing"""
    
    def __init__(self):
        self.process = None
        self.base_url = "http://localhost:8000"
    
    def start_server(self):
        """Start the FastAPI server"""
        print("Starting FastAPI server...")
        self.process = subprocess.Popen(
            ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"],
            cwd=".",
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        
        # Wait for server to start
        max_attempts = 30
        for attempt in range(max_attempts):
            try:
                response = requests.get(f"{self.base_url}/health", timeout=1)
                if response.status_code == 200:
                    print("✓ Server started successfully")
                    return True
            except requests.exceptions.RequestException:
                pass
            time.sleep(1)
        
        print("✗ Failed to start server")
        return False
    
    def stop_server(self):
        """Stop the FastAPI server"""
        if self.process:
            print("Stopping server...")
            self.process.terminate()
            self.process.wait()
            print("✓ Server stopped")

def test_challenge_endpoints(base_url):
    """Test challenge API endpoints"""
    print("\nTesting Challenge API Endpoints")
    print("=" * 50)
    
    # Create test token
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    # Test 1: Health check
    print("\n1. Testing health check...")
    try:
        response = requests.get(f"{base_url}/health")
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Health check passed: {data.get('status')}")
        else:
            print(f"   ✗ Health check failed: {response.text}")
    except Exception as e:
        print(f"   ✗ Health check error: {e}")
    
    # Test 2: List challenges (authenticated)
    print("\n2. Testing authenticated challenge listing...")
    try:
        response = requests.get(f"{base_url}/api/v1/challenges", headers=headers)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Found {len(data.get('challenges', []))} challenges")
            print(f"   Total count: {data.get('total_count', 0)}")
            
            if data.get('challenges'):
                first_challenge = data['challenges'][0]
                challenge_id = first_challenge.get('challenge_id')
                print(f"   First challenge ID: {challenge_id}")
                return challenge_id
        else:
            print(f"   ✗ Error: {response.text}")
    except Exception as e:
        print(f"   ✗ Request error: {e}")
    
    return None

def test_challenge_detail(base_url, challenge_id):
    """Test getting specific challenge"""
    if not challenge_id:
        print("\n3. Skipping challenge detail test (no challenge ID)")
        return
    
    print(f"\n3. Testing challenge detail for ID: {challenge_id}")
    
    # Create test token
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    try:
        response = requests.get(f"{base_url}/api/v1/challenges/{challenge_id}", headers=headers)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Challenge ID: {data.get('challenge_id')}")
            print(f"   Status: {data.get('status')}")
            print(f"   Creator: {data.get('creator_id')}")
            print(f"   Statements: {len(data.get('statements', []))}")
            print(f"   View count: {data.get('view_count', 0)}")
        else:
            print(f"   ✗ Error: {response.text}")
    except Exception as e:
        print(f"   ✗ Request error: {e}")

def test_unauthenticated_access(base_url):
    """Test endpoints without authentication"""
    print("\n4. Testing unauthenticated access...")
    
    try:
        # Test listing challenges without auth
        response = requests.get(f"{base_url}/api/v1/challenges")
        print(f"   List challenges without auth - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Found {len(data.get('challenges', []))} public challenges")
        elif response.status_code == 401:
            print("   ✓ Correctly requires authentication")
        else:
            print(f"   ? Unexpected status: {response.status_code}")
        
        # Test getting specific challenge without auth
        response = requests.get(f"{base_url}/api/v1/challenges/integration-test-challenge")
        print(f"   Get challenge without auth - Status: {response.status_code}")
        if response.status_code == 200:
            print("   ✓ Public challenge access works")
        elif response.status_code == 401:
            print("   ✓ Correctly requires authentication")
        
    except Exception as e:
        print(f"   ✗ Request error: {e}")

def test_error_cases(base_url):
    """Test error handling"""
    print("\n5. Testing error cases...")
    
    # Create test token
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    try:
        # Test non-existent challenge
        response = requests.get(f"{base_url}/api/v1/challenges/non-existent-id", headers=headers)
        print(f"   Non-existent challenge - Status: {response.status_code}")
        if response.status_code == 404:
            print("   ✓ Correctly returns 404 for non-existent challenge")
        else:
            print(f"   ? Expected 404, got {response.status_code}")
        
        # Test invalid authentication
        bad_headers = {"Authorization": "Bearer invalid-token"}
        response = requests.get(f"{base_url}/api/v1/challenges", headers=bad_headers)
        print(f"   Invalid token - Status: {response.status_code}")
        if response.status_code == 401:
            print("   ✓ Correctly rejects invalid token")
        else:
            print(f"   ? Expected 401, got {response.status_code}")
            
    except Exception as e:
        print(f"   ✗ Request error: {e}")

def test_pagination_and_filtering(base_url):
    """Test pagination and filtering"""
    print("\n6. Testing pagination and filtering...")
    
    # Create test token
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    try:
        # Test pagination
        response = requests.get(f"{base_url}/api/v1/challenges?page=1&page_size=1", headers=headers)
        print(f"   Pagination (page 1, size 1) - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Page 1: {len(data.get('challenges', []))} challenges")
            print(f"   Has next: {data.get('has_next', False)}")
        
        # Test filtering by status
        response = requests.get(f"{base_url}/api/v1/challenges?status=published", headers=headers)
        print(f"   Filter by status - Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✓ Published challenges: {len(data.get('challenges', []))}")
            
    except Exception as e:
        print(f"   ✗ Request error: {e}")

def main():
    """Run integration tests"""
    server_manager = ServerManager()
    
    try:
        # Start server
        if not server_manager.start_server():
            print("Failed to start server, exiting")
            return
        
        # Run tests
        base_url = server_manager.base_url
        
        # Test basic endpoints
        challenge_id = test_challenge_endpoints(base_url)
        
        # Test challenge detail
        test_challenge_detail(base_url, challenge_id)
        
        # Test unauthenticated access
        test_unauthenticated_access(base_url)
        
        # Test error cases
        test_error_cases(base_url)
        
        # Test pagination and filtering
        test_pagination_and_filtering(base_url)
        
        print("\n" + "=" * 50)
        print("Challenge API integration tests completed!")
        
    except KeyboardInterrupt:
        print("\nTests interrupted by user")
    except Exception as e:
        print(f"Error running tests: {e}")
        import traceback
        traceback.print_exc()
    finally:
        # Stop server
        server_manager.stop_server()

if __name__ == "__main__":
    main()