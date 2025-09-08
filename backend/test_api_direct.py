#!/usr/bin/env python3
"""
Direct API test for the authenticated challenge listing endpoint
"""
import sys
from pathlib import Path
import json

# Add backend directory to path
sys.path.insert(0, str(Path(__file__).parent))

from services.auth_service import AuthService

def test_endpoint_structure():
    """Test that the endpoint is properly defined"""
    
    print("Testing endpoint structure...")
    
    try:
        # Import the app and check if our endpoint exists
        from main import app
        from fastapi.routing import APIRoute
        
        # Find our endpoint
        authenticated_endpoint = None
        public_endpoint = None
        
        for route in app.routes:
            if hasattr(route, 'path') and hasattr(route, 'methods'):
                print(f"Found route: {route.path} - {getattr(route, 'methods', 'no methods')} - {getattr(route.endpoint, '__name__', 'no name') if hasattr(route, 'endpoint') else 'no endpoint'}")
                if route.path == "/api/v1/challenges/" and "GET" in route.methods:
                    # Check the endpoint function name to distinguish
                    if hasattr(route, 'endpoint'):
                        if route.endpoint.__name__ == "list_challenges_authenticated":
                            authenticated_endpoint = route
                elif route.path == "/api/v1/challenges/public" and "GET" in route.methods:
                    if hasattr(route, 'endpoint'):
                        if route.endpoint.__name__ == "list_challenges_public":
                            public_endpoint = route
        
        if not authenticated_endpoint:
            print("❌ Authenticated endpoint not found")
            return False
        
        if not public_endpoint:
            print("❌ Public endpoint not found")
            return False
        
        print("✓ Both authenticated and public endpoints found")
        
        # Check that authenticated endpoint requires authentication
        from inspect import signature
        auth_sig = signature(authenticated_endpoint.endpoint)
        auth_params = list(auth_sig.parameters.keys())
        
        if 'user_id' not in auth_params:
            print("❌ Authenticated endpoint should have user_id parameter")
            return False
        
        print("✓ Authenticated endpoint has user_id parameter")
        
        # Check that public endpoint has optional authentication
        public_sig = signature(public_endpoint.endpoint)
        public_params = list(public_sig.parameters.keys())
        
        if 'user_id' not in public_params:
            print("❌ Public endpoint should have user_id parameter (optional)")
            return False
        
        print("✓ Public endpoint has user_id parameter")
        
        return True
        
    except Exception as e:
        print(f"❌ Structure test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_auth_service():
    """Test that we can create tokens for testing"""
    
    print("Testing auth service...")
    
    try:
        auth_service = AuthService()
        test_user_id = "test_user_direct"
        
        # Create a token
        token = auth_service.create_access_token({"sub": test_user_id, "username": "testuser"})
        
        if not token:
            print("❌ Failed to create token")
            return False
        
        print("✓ Token created successfully")
        
        # Verify the token
        payload = auth_service.verify_token(token)
        
        if not payload:
            print("❌ Failed to verify token")
            return False
        
        if payload.get("sub") != test_user_id:
            print(f"❌ Token payload incorrect: expected {test_user_id}, got {payload.get('sub')}")
            return False
        
        print("✓ Token verification successful")
        
        return True
        
    except Exception as e:
        print(f"❌ Auth service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_challenge_service_listing():
    """Test the challenge service listing functionality"""
    
    print("Testing challenge service listing...")
    
    try:
        from services.challenge_service import challenge_service
        from models import ChallengeStatus
        import asyncio
        
        async def run_test():
            # Test basic listing
            challenges, total_count = await challenge_service.list_challenges(
                page=1,
                page_size=5,
                status=ChallengeStatus.PUBLISHED
            )
            
            print(f"✓ Found {total_count} published challenges")
            print(f"✓ Retrieved {len(challenges)} challenges in page")
            
            # Check structure of returned challenges
            for challenge in challenges[:1]:  # Check first challenge
                if not hasattr(challenge, 'challenge_id'):
                    print("❌ Challenge missing challenge_id")
                    return False
                
                if not hasattr(challenge, 'is_merged_video'):
                    print("❌ Challenge missing is_merged_video flag")
                    return False
                
                if challenge.is_merged_video:
                    if not hasattr(challenge, 'merged_video_url'):
                        print("❌ Merged video challenge missing merged_video_url")
                        return False
                    
                    if not hasattr(challenge, 'merged_video_metadata'):
                        print("❌ Merged video challenge missing merged_video_metadata")
                        return False
                    
                    print("✓ Merged video challenge has required fields")
                
                print(f"✓ Challenge structure valid: {challenge.challenge_id}")
            
            return True
        
        return asyncio.run(run_test())
        
    except Exception as e:
        print(f"❌ Challenge service test failed: {e}")
        import traceback
        traceback.print_exc()
        return False

def main():
    """Run all tests"""
    print("Running direct API tests...")
    
    tests = [
        test_auth_service,
        test_endpoint_structure,
        test_challenge_service_listing
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        try:
            if test():
                passed += 1
                print(f"✓ {test.__name__} passed\n")
            else:
                print(f"❌ {test.__name__} failed\n")
        except Exception as e:
            print(f"❌ {test.__name__} failed with exception: {e}\n")
    
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All direct API tests passed!")
        return True
    else:
        print("❌ Some direct API tests failed")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)