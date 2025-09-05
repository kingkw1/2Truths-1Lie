#!/usr/bin/env python3
"""
Comprehensive test for challenge API endpoints
"""
import asyncio
import sys
import subprocess
import time
import requests
import json

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

def test_comprehensive_challenge_apis(base_url):
    """Comprehensive test of challenge APIs"""
    print("\nComprehensive Challenge API Tests")
    print("=" * 50)
    
    # Create test token
    test_user_id = "test-user-123"
    test_token = create_test_token(test_user_id)
    headers = {"Authorization": f"Bearer {test_token}"}
    
    results = {
        "passed": 0,
        "failed": 0,
        "tests": []
    }
    
    def test_case(name, test_func):
        """Helper to run a test case"""
        try:
            result = test_func()
            if result:
                print(f"   ✓ {name}")
                results["passed"] += 1
                results["tests"].append({"name": name, "status": "PASS"})
            else:
                print(f"   ✗ {name}")
                results["failed"] += 1
                results["tests"].append({"name": name, "status": "FAIL"})
        except Exception as e:
            print(f"   ✗ {name} - Error: {e}")
            results["failed"] += 1
            results["tests"].append({"name": name, "status": "ERROR", "error": str(e)})
    
    # Test 1: Public challenge listing
    def test_public_listing():
        response = requests.get(f"{base_url}/api/v1/challenges")
        if response.status_code == 200:
            data = response.json()
            return "challenges" in data and "total_count" in data
        return False
    
    test_case("Public challenge listing", test_public_listing)
    
    # Test 2: Authenticated challenge listing
    def test_authenticated_listing():
        response = requests.get(f"{base_url}/api/v1/challenges", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return len(data.get("challenges", [])) > 0
        return False
    
    test_case("Authenticated challenge listing", test_authenticated_listing)
    
    # Test 3: Challenge detail retrieval
    def test_challenge_detail():
        response = requests.get(f"{base_url}/api/v1/challenges/integration-test-challenge", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return data.get("challenge_id") == "integration-test-challenge"
        return False
    
    test_case("Challenge detail retrieval", test_challenge_detail)
    
    # Test 4: Public challenge detail
    def test_public_challenge_detail():
        response = requests.get(f"{base_url}/api/v1/challenges/integration-test-challenge")
        return response.status_code == 200
    
    test_case("Public challenge detail access", test_public_challenge_detail)
    
    # Test 5: Pagination
    def test_pagination():
        response = requests.get(f"{base_url}/api/v1/challenges?page=1&page_size=1", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return data.get("page") == 1 and data.get("page_size") == 1
        return False
    
    test_case("Pagination parameters", test_pagination)
    
    # Test 6: Status filtering
    def test_status_filtering():
        response = requests.get(f"{base_url}/api/v1/challenges?public_only=true", headers=headers)
        if response.status_code == 200:
            data = response.json()
            # Should only return published challenges
            challenges = data.get("challenges", [])
            return all(c.get("status") == "published" for c in challenges)
        return False
    
    test_case("Status filtering", test_status_filtering)
    
    # Test 7: Error handling - non-existent challenge
    def test_nonexistent_challenge():
        response = requests.get(f"{base_url}/api/v1/challenges/non-existent-id", headers=headers)
        return response.status_code == 404
    
    test_case("Non-existent challenge returns 404", test_nonexistent_challenge)
    
    # Test 8: User challenges endpoint
    def test_user_challenges():
        response = requests.get(f"{base_url}/api/v1/users/me/challenges", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "challenges" in data and "total_count" in data
        return False
    
    test_case("User challenges endpoint", test_user_challenges)
    
    # Test 9: User guesses endpoint
    def test_user_guesses():
        response = requests.get(f"{base_url}/api/v1/users/me/guesses", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "guesses" in data
        return False
    
    test_case("User guesses endpoint", test_user_guesses)
    
    # Test 10: Challenge stats
    def test_challenge_stats():
        response = requests.get(f"{base_url}/api/v1/challenges/integration-test-challenge/stats", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "view_count" in data and "guess_count" in data
        return False
    
    test_case("Challenge statistics", test_challenge_stats)
    
    # Test 11: Challenge segments metadata
    def test_challenge_segments():
        response = requests.get(f"{base_url}/api/v1/challenges/integration-test-challenge/segments", headers=headers)
        # This might return 404 if the challenge doesn't have segment metadata, which is OK
        return response.status_code in [200, 404]
    
    test_case("Challenge segments metadata", test_challenge_segments)
    
    # Test 12: Rate limit status
    def test_rate_limit_status():
        response = requests.get(f"{base_url}/api/v1/users/me/rate-limit", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "rate_limit" in data
        return False
    
    test_case("Rate limit status", test_rate_limit_status)
    
    # Test 13: Admin moderation endpoints
    def test_admin_moderation():
        response = requests.get(f"{base_url}/api/v1/admin/moderation/challenges", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "challenges" in data
        return False
    
    test_case("Admin moderation challenges", test_admin_moderation)
    
    # Test 14: Admin moderation stats
    def test_admin_moderation_stats():
        response = requests.get(f"{base_url}/api/v1/admin/moderation/stats", headers=headers)
        if response.status_code == 200:
            data = response.json()
            return "stats" in data
        return False
    
    test_case("Admin moderation stats", test_admin_moderation_stats)
    
    # Print summary
    print(f"\nTest Summary:")
    print(f"  Passed: {results['passed']}")
    print(f"  Failed: {results['failed']}")
    print(f"  Total:  {results['passed'] + results['failed']}")
    
    if results["failed"] > 0:
        print(f"\nFailed tests:")
        for test in results["tests"]:
            if test["status"] != "PASS":
                print(f"  - {test['name']}: {test['status']}")
                if "error" in test:
                    print(f"    Error: {test['error']}")
    
    return results["failed"] == 0

def main():
    """Run comprehensive tests"""
    server_manager = ServerManager()
    
    try:
        # Start server
        if not server_manager.start_server():
            print("Failed to start server, exiting")
            return
        
        # Run comprehensive tests
        success = test_comprehensive_challenge_apis(server_manager.base_url)
        
        print("\n" + "=" * 50)
        if success:
            print("✓ All challenge API tests passed!")
        else:
            print("✗ Some challenge API tests failed!")
        
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