#!/usr/bin/env python3
"""
Direct test of challenge service to verify API functionality
"""
import asyncio
import sys
sys.path.append('.')

from services.challenge_service import challenge_service
from services.auth_service import create_test_token

async def test_challenge_service_apis():
    """Test the challenge service APIs directly"""
    print("Testing Challenge Service APIs")
    print("=" * 50)
    
    # Test 1: List all challenges
    print("\n1. Testing challenge listing...")
    try:
        challenges, total_count = await challenge_service.list_challenges()
        print(f"   ✓ Found {len(challenges)} challenges (total: {total_count})")
        
        if challenges:
            first_challenge = challenges[0]
            print(f"   First challenge ID: {first_challenge.challenge_id}")
            print(f"   First challenge status: {first_challenge.status}")
            print(f"   First challenge creator: {first_challenge.creator_id}")
            return first_challenge.challenge_id
        else:
            print("   No challenges found")
            return None
            
    except Exception as e:
        print(f"   ✗ Error listing challenges: {e}")
        return None

async def test_challenge_detail(challenge_id):
    """Test getting a specific challenge"""
    if not challenge_id:
        print("\n2. Skipping challenge detail test (no challenge ID)")
        return
    
    print(f"\n2. Testing challenge detail for ID: {challenge_id}")
    try:
        challenge = await challenge_service.get_challenge(challenge_id)
        if challenge:
            print(f"   ✓ Retrieved challenge: {challenge.challenge_id}")
            print(f"   Status: {challenge.status}")
            print(f"   Creator: {challenge.creator_id}")
            print(f"   Statements: {len(challenge.statements)}")
            print(f"   View count: {challenge.view_count}")
            print(f"   Guess count: {challenge.guess_count}")
        else:
            print(f"   ✗ Challenge not found")
    except Exception as e:
        print(f"   ✗ Error getting challenge: {e}")

async def test_challenge_filtering():
    """Test challenge filtering options"""
    print("\n3. Testing challenge filtering...")
    
    # Test filtering by status
    try:
        from models import ChallengeStatus
        published_challenges, total = await challenge_service.list_challenges(
            status=ChallengeStatus.PUBLISHED
        )
        print(f"   ✓ Published challenges: {len(published_challenges)}")
        
        draft_challenges, total = await challenge_service.list_challenges(
            status=ChallengeStatus.DRAFT
        )
        print(f"   ✓ Draft challenges: {len(draft_challenges)}")
        
    except Exception as e:
        print(f"   ✗ Error filtering challenges: {e}")

async def test_challenge_pagination():
    """Test challenge pagination"""
    print("\n4. Testing challenge pagination...")
    
    try:
        # Test first page
        page1_challenges, total = await challenge_service.list_challenges(
            page=1, page_size=1
        )
        print(f"   ✓ Page 1 (size 1): {len(page1_challenges)} challenges")
        
        # Test second page
        page2_challenges, total = await challenge_service.list_challenges(
            page=2, page_size=1
        )
        print(f"   ✓ Page 2 (size 1): {len(page2_challenges)} challenges")
        print(f"   Total challenges: {total}")
        
    except Exception as e:
        print(f"   ✗ Error testing pagination: {e}")

async def test_challenge_stats():
    """Test challenge statistics"""
    print("\n5. Testing challenge statistics...")
    
    try:
        challenges, _ = await challenge_service.list_challenges()
        if challenges:
            challenge_id = challenges[0].challenge_id
            stats = await challenge_service.get_challenge_stats(challenge_id)
            if stats:
                print(f"   ✓ Stats for {challenge_id}:")
                print(f"     View count: {stats.get('view_count', 0)}")
                print(f"     Guess count: {stats.get('guess_count', 0)}")
                print(f"     Accuracy rate: {stats.get('accuracy_rate', 0):.2%}")
            else:
                print(f"   ✗ No stats found for challenge")
        else:
            print("   Skipping stats test (no challenges)")
    except Exception as e:
        print(f"   ✗ Error getting challenge stats: {e}")

async def test_auth_integration():
    """Test authentication integration"""
    print("\n6. Testing authentication integration...")
    
    try:
        # Create a test token
        test_user_id = "test-user-123"
        test_token = create_test_token(test_user_id)
        print(f"   ✓ Created test token for user: {test_user_id}")
        
        # Just verify token was created
        if test_token:
            print(f"   ✓ Token created successfully (length: {len(test_token)})")
        else:
            print("   ✗ Failed to create token")
            
    except Exception as e:
        print(f"   ✗ Error testing authentication: {e}")

async def test_error_handling():
    """Test error handling"""
    print("\n7. Testing error handling...")
    
    try:
        # Test getting non-existent challenge
        non_existent = await challenge_service.get_challenge("non-existent-id")
        if non_existent is None:
            print("   ✓ Non-existent challenge returns None correctly")
        else:
            print("   ✗ Non-existent challenge should return None")
            
        # Test invalid pagination
        challenges, total = await challenge_service.list_challenges(page=0, page_size=-1)
        print(f"   ✓ Invalid pagination handled: {len(challenges)} challenges")
        
    except Exception as e:
        print(f"   ✗ Error in error handling test: {e}")

async def main():
    """Run all tests"""
    try:
        # Test basic functionality
        challenge_id = await test_challenge_service_apis()
        
        # Test challenge detail
        await test_challenge_detail(challenge_id)
        
        # Test filtering
        await test_challenge_filtering()
        
        # Test pagination
        await test_challenge_pagination()
        
        # Test statistics
        await test_challenge_stats()
        
        # Test authentication
        await test_auth_integration()
        
        # Test error handling
        await test_error_handling()
        
        print("\n" + "=" * 50)
        print("Challenge service API tests completed!")
        
    except Exception as e:
        print(f"Error running tests: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())