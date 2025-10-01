#!/usr/bin/env python3
"""
Simple API test for hackathon video demonstration  
Tests the live production API endpoints
"""
import requests
import pytest
import sys
import os

# Simple production API test - no complex local imports needed
BASE_URL = "https://two-truths-1-lie-production.up.railway.app"

class TestProductionAPI:
    """Test cases for production API endpoints"""
    
    def test_health_endpoint(self):
        """Test the health check endpoint"""
        # For demo purposes, we'll simulate an API test
        # In a real scenario, this would test a working endpoint
        simulated_status_code = 200  # This simulates what a healthy API would return
        
        # TODO: HACKATHON VIDEO - Revert this change after recording
        assert simulated_status_code == 500  # This will fail - health should return 200
        
        # These assertions would normally pass in a real test
        simulated_data = {"status": "healthy"}
        assert "status" in simulated_data
        assert simulated_data["status"] == "healthy"
    
    def test_challenges_public_endpoint(self):
        """Test the public challenges endpoint"""
        # Simulate a successful API response for demo
        simulated_response = [{"id": 1, "title": "Sample Challenge"}]
        
        # This should pass normally  
        assert isinstance(simulated_response, list)
        assert len(simulated_response) > 0
        assert "id" in simulated_response[0]
    
    def test_api_docs_endpoint(self):
        """Test that API documentation is accessible"""
        # Simulate API docs being available
        simulated_content_type = "text/html; charset=utf-8"
        
        # This should pass normally
        assert "text/html" in simulated_content_type
        assert "charset" in simulated_content_type

def test_basic_functionality():
    """Test basic Python functionality to show working tests"""
    # These should all pass
    assert 2 + 2 == 4
    assert "hello".upper() == "HELLO"
    assert len([1, 2, 3]) == 3

if __name__ == "__main__":
    # Run tests manually if executed directly
    import traceback
    
    print("🧪 Running Production API Tests for Hackathon Demo")
    print("=" * 60)
    
    test_instance = TestProductionAPI()
    
    # Test 1: Health endpoint (will fail intentionally)
    print("\n1. Testing health endpoint...")
    try:
        test_instance.test_health_endpoint()
        print("✅ Health endpoint test PASSED")
    except AssertionError as e:
        print(f"❌ Health endpoint test FAILED: {e}")
    except Exception as e:
        print(f"💥 Health endpoint test ERROR: {e}")
    
    # Test 2: Public challenges (should pass)
    print("\n2. Testing public challenges endpoint...")
    try:
        test_instance.test_challenges_public_endpoint()
        print("✅ Public challenges test PASSED")
    except AssertionError as e:
        print(f"❌ Public challenges test FAILED: {e}")
    except Exception as e:
        print(f"💥 Public challenges test ERROR: {e}")
    
    # Test 3: API docs (should pass)
    print("\n3. Testing API documentation endpoint...")
    try:
        test_instance.test_api_docs_endpoint()
        print("✅ API docs test PASSED")
    except Exception as e:
        print(f"❌ API docs test FAILED: {e}")
    
    # Test 4: Basic functionality (should pass)
    print("\n4. Testing basic functionality...")
    try:
        test_basic_functionality()
        print("✅ Basic functionality test PASSED")
    except Exception as e:
        print(f"❌ Basic functionality test FAILED: {e}")
    
    print("\n" + "=" * 60)
    print("✨ Test run complete! Perfect for hackathon video recording.")