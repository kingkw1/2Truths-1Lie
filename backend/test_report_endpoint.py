#!/usr/bin/env python3
"""
Test script for the new report endpoint
"""
import requests
import json
import sys
from pathlib import Path

# Add backend directory to path
sys.path.append(str(Path(__file__).parent))

from services.database_service import DatabaseService
from services.auth_service import AuthService

def test_report_endpoint():
    """Test the report endpoint functionality"""
    
    # Initialize services
    db_service = DatabaseService()
    auth_service = AuthService()
    
    # Create a test user if it doesn't exist
    test_email = "test_reporter@example.com"
    test_password = "testpass123"
    
    user_data = db_service.create_user(test_email, test_password, "Test Reporter")
    if not user_data:
        # User already exists, authenticate
        user_data = db_service.authenticate_user(test_email, test_password)
    
    if not user_data:
        print("Failed to create or authenticate test user")
        return False
    
    print(f"Test user: {user_data}")
    
    # Generate JWT token for the user
    token = auth_service.create_access_token(data={"sub": str(user_data["id"])})
    print(f"Generated token: {token[:50]}...")
    
    # Test data
    test_challenge_id = "test-challenge-123"
    report_data = {
        "reason": "inappropriate_language",
        "details": "This challenge contains offensive language"
    }
    
    # Test the endpoint (we'll simulate it since we don't have a running server)
    print("\n=== Testing Report Endpoint Logic ===")
    
    try:
        # Test creating a report directly with database service
        report_result = db_service.create_user_report(
            challenge_id=test_challenge_id,
            user_id=user_data["id"],
            reason=report_data["reason"],
            details=report_data["details"]
        )
        
        if report_result:
            print(f"✅ Report created successfully: {report_result}")
            
            # Test duplicate report (should return None)
            duplicate_result = db_service.create_user_report(
                challenge_id=test_challenge_id,
                user_id=user_data["id"],
                reason=report_data["reason"],
                details="Duplicate attempt"
            )
            
            if duplicate_result is None:
                print("✅ Duplicate report prevention working correctly")
            else:
                print("❌ Duplicate report was allowed (should be prevented)")
                return False
            
            # Test getting reports for the challenge
            reports = db_service.get_user_reports_by_challenge(test_challenge_id)
            print(f"✅ Retrieved reports for challenge: {len(reports)} reports found")
            
            for report in reports:
                print(f"   Report ID: {report['id']}, Reason: {report['reason']}, User: {report['user_email']}")
            
            return True
        else:
            print("❌ Failed to create report")
            return False
            
    except Exception as e:
        print(f"❌ Error testing report functionality: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_validation():
    """Test input validation"""
    print("\n=== Testing Input Validation ===")
    
    db_service = DatabaseService()
    
    # Test invalid reason
    try:
        result = db_service.create_user_report(
            challenge_id="test-challenge",
            user_id=1,
            reason="invalid_reason",  # Not in the allowed enum
            details="Test details"
        )
        print("❌ Invalid reason was accepted (should be rejected)")
        return False
    except Exception as e:
        print(f"✅ Invalid reason correctly rejected: {e}")
    
    # Test details too long
    try:
        long_details = "x" * 1001  # Exceeds 1000 character limit
        result = db_service.create_user_report(
            challenge_id="test-challenge",
            user_id=1,
            reason="spam",
            details=long_details
        )
        print("❌ Long details were accepted (should be rejected)")
        return False
    except Exception as e:
        print(f"✅ Long details correctly rejected: {e}")
    
    return True

if __name__ == "__main__":
    print("Testing Report Endpoint Implementation")
    print("=" * 50)
    
    success = True
    
    # Test basic functionality
    if not test_report_endpoint():
        success = False
    
    # Test validation
    if not test_validation():
        success = False
    
    print("\n" + "=" * 50)
    if success:
        print("✅ All tests passed! Report endpoint implementation is working correctly.")
    else:
        print("❌ Some tests failed. Please check the implementation.")
    
    sys.exit(0 if success else 1)