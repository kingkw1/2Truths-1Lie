"""
Tests for rate limiting functionality
"""
import pytest
import asyncio
import time
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch

from services.rate_limiter import RateLimiter, RateLimitExceeded
from config import settings

@pytest.fixture
async def rate_limiter():
    """Create a rate limiter with temporary storage"""
    # Create temporary directory for test data
    temp_dir = Path(tempfile.mkdtemp())
    
    with patch.object(settings, 'TEMP_DIR', temp_dir):
        limiter = RateLimiter()
        yield limiter
    
    # Cleanup
    shutil.rmtree(temp_dir)

@pytest.fixture
def mock_settings():
    """Mock settings with test values"""
    with patch.object(settings, 'UPLOAD_RATE_LIMIT', 3):  # 3 requests per hour for testing
        yield

class TestRateLimiter:
    """Test rate limiting functionality"""
    
    @pytest.mark.asyncio
    async def test_rate_limit_within_limit(self, rate_limiter, mock_settings):
        """Test that requests within rate limit are allowed"""
        user_id = "test_user_1"
        
        # Should allow first request
        result = await rate_limiter.check_rate_limit(user_id)
        assert result is True
        
        await rate_limiter.record_request(user_id)
        
        # Should allow second request
        result = await rate_limiter.check_rate_limit(user_id)
        assert result is True
        
        await rate_limiter.record_request(user_id)
        
        # Should allow third request
        result = await rate_limiter.check_rate_limit(user_id)
        assert result is True
        
        await rate_limiter.record_request(user_id)
    
    @pytest.mark.asyncio
    async def test_rate_limit_exceeded(self, rate_limiter, mock_settings):
        """Test that rate limit is enforced"""
        user_id = "test_user_2"
        
        # Make 3 requests (the limit)
        for i in range(3):
            await rate_limiter.check_rate_limit(user_id)
            await rate_limiter.record_request(user_id)
        
        # Fourth request should be rejected
        with pytest.raises(RateLimitExceeded) as exc_info:
            await rate_limiter.check_rate_limit(user_id)
        
        assert "Rate limit exceeded" in str(exc_info.value)
        assert "Maximum 3 requests per 1 hour" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_rate_limit_per_user(self, rate_limiter, mock_settings):
        """Test that rate limits are enforced per user"""
        user1 = "test_user_3"
        user2 = "test_user_4"
        
        # User 1 makes 3 requests
        for i in range(3):
            await rate_limiter.check_rate_limit(user1)
            await rate_limiter.record_request(user1)
        
        # User 1 should be rate limited
        with pytest.raises(RateLimitExceeded):
            await rate_limiter.check_rate_limit(user1)
        
        # User 2 should still be able to make requests
        result = await rate_limiter.check_rate_limit(user2)
        assert result is True
        
        await rate_limiter.record_request(user2)
    
    @pytest.mark.asyncio
    async def test_rate_limit_cleanup(self, rate_limiter, mock_settings):
        """Test that old requests are cleaned up"""
        user_id = "test_user_5"
        
        # Mock time to simulate old requests
        old_time = time.time() - 7200  # 2 hours ago
        
        # Manually add old requests
        rate_limiter.user_requests[user_id] = [old_time, old_time + 100, old_time + 200]
        
        # Check rate limit - should clean up old requests
        result = await rate_limiter.check_rate_limit(user_id)
        assert result is True
        
        # Old requests should be cleaned up
        assert len(rate_limiter.user_requests.get(user_id, [])) == 0
    
    @pytest.mark.asyncio
    async def test_rate_limit_status(self, rate_limiter, mock_settings):
        """Test rate limit status reporting"""
        user_id = "test_user_6"
        
        # Initial status
        status = await rate_limiter.get_rate_limit_status(user_id)
        assert status["limit"] == 3
        assert status["remaining"] == 3
        assert status["used"] == 0
        assert status["window_hours"] == 1
        
        # After one request
        await rate_limiter.record_request(user_id)
        status = await rate_limiter.get_rate_limit_status(user_id)
        assert status["remaining"] == 2
        assert status["used"] == 1
        
        # After two more requests
        await rate_limiter.record_request(user_id)
        await rate_limiter.record_request(user_id)
        status = await rate_limiter.get_rate_limit_status(user_id)
        assert status["remaining"] == 0
        assert status["used"] == 3
        assert status["reset_time"] is not None
    
    @pytest.mark.asyncio
    async def test_rate_limit_reset(self, rate_limiter, mock_settings):
        """Test resetting rate limit for a user"""
        user_id = "test_user_7"
        
        # Make maximum requests
        for i in range(3):
            await rate_limiter.record_request(user_id)
        
        # Should be rate limited
        with pytest.raises(RateLimitExceeded):
            await rate_limiter.check_rate_limit(user_id)
        
        # Reset rate limit
        await rate_limiter.reset_user_limit(user_id)
        
        # Should be able to make requests again
        result = await rate_limiter.check_rate_limit(user_id)
        assert result is True
    
    @pytest.mark.asyncio
    async def test_rate_limit_custom_parameters(self, rate_limiter):
        """Test rate limiting with custom parameters"""
        user_id = "test_user_8"
        
        # Test with custom limit and window
        custom_limit = 2
        custom_window = 2  # 2 hours
        
        # Make requests up to custom limit
        for i in range(custom_limit):
            result = await rate_limiter.check_rate_limit(user_id, limit=custom_limit, window_hours=custom_window)
            assert result is True
            await rate_limiter.record_request(user_id)
        
        # Should be rate limited with custom parameters
        with pytest.raises(RateLimitExceeded) as exc_info:
            await rate_limiter.check_rate_limit(user_id, limit=custom_limit, window_hours=custom_window)
        
        assert f"Maximum {custom_limit} requests per {custom_window} hour" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_rate_limit_persistence(self, rate_limiter, mock_settings):
        """Test that rate limit data persists across restarts"""
        user_id = "test_user_9"
        
        # Make some requests
        for i in range(2):
            await rate_limiter.record_request(user_id)
        
        # Create new rate limiter instance (simulating restart)
        temp_dir = rate_limiter.rate_limit_file.parent
        new_limiter = RateLimiter()
        new_limiter.rate_limit_file = temp_dir / "rate_limits.json"
        new_limiter._load_data()
        
        # Should remember previous requests
        status = await new_limiter.get_rate_limit_status(user_id)
        assert status["used"] == 2
        assert status["remaining"] == 1
    
    @pytest.mark.asyncio
    async def test_cleanup_expired_limits(self, rate_limiter, mock_settings):
        """Test cleanup of expired rate limit data"""
        # Add data for multiple users with old timestamps
        old_time = time.time() - 7200  # 2 hours ago
        current_time = time.time()
        
        rate_limiter.user_requests = {
            "old_user_1": [old_time, old_time + 100],
            "old_user_2": [old_time + 200],
            "current_user": [current_time - 1800],  # 30 minutes ago
            "mixed_user": [old_time, current_time - 900]  # Mix of old and recent
        }
        
        # Run cleanup
        cleaned_count = await rate_limiter.cleanup_expired_limits()
        
        # Should clean up users with only old requests
        assert cleaned_count == 2  # old_user_1 and old_user_2
        assert "old_user_1" not in rate_limiter.user_requests
        assert "old_user_2" not in rate_limiter.user_requests
        assert "current_user" in rate_limiter.user_requests
        assert "mixed_user" in rate_limiter.user_requests
        
        # Mixed user should only have recent request
        assert len(rate_limiter.user_requests["mixed_user"]) == 1
    
    @pytest.mark.asyncio
    async def test_concurrent_requests(self, rate_limiter, mock_settings):
        """Test rate limiting with concurrent requests"""
        user_id = "test_user_concurrent"
        
        async def make_request():
            try:
                await rate_limiter.check_rate_limit(user_id)
                await rate_limiter.record_request(user_id)
                return True
            except RateLimitExceeded:
                return False
        
        # Make 5 concurrent requests (limit is 3)
        tasks = [make_request() for _ in range(5)]
        results = await asyncio.gather(*tasks)
        
        # Should have exactly 3 successful requests
        successful_requests = sum(results)
        assert successful_requests == 3
        
        # Verify final state
        status = await rate_limiter.get_rate_limit_status(user_id)
        assert status["used"] == 3
        assert status["remaining"] == 0