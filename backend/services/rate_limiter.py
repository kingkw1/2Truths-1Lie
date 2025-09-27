"""
Rate limiting service for preventing spam and abuse, backed by a persistent database.
"""
import time
from datetime import datetime
import logging

from config import settings
from services.database_service import get_db_service

logger = logging.getLogger(__name__)

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    pass

class RateLimiter:
    """Rate limiter for API endpoints, backed by the database."""

    def __init__(self):
        self.db_service = get_db_service()

    async def _cleanup_old_requests(self, user_id: str, window_hours: int = 1):
        """Remove requests older than the time window from the database."""
        cutoff_time = time.time() - (window_hours * 3600)
        query = "DELETE FROM rate_limit_records WHERE user_id = ? AND timestamp < ?"
        try:
            self.db_service._execute_query(query, (user_id, cutoff_time))
        except Exception as e:
            logger.error(f"Error cleaning up old rate limit requests for user {user_id}: {e}")

    async def check_rate_limit(
        self,
        user_id: str,
        limit: int = None,
        window_hours: int = 1
    ) -> bool:
        """
        Check if user has exceeded rate limit using the database.
        
        Args:
            user_id: User identifier
            limit: Maximum requests allowed (defaults to settings.UPLOAD_RATE_LIMIT)
            window_hours: Time window in hours (default 1 hour)
            
        Returns:
            True if within rate limit
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        if limit is None:
            limit = settings.UPLOAD_RATE_LIMIT

        await self._cleanup_old_requests(user_id, window_hours)

        query = "SELECT timestamp FROM rate_limit_records WHERE user_id = ?"
        try:
            results = self.db_service._execute_select(query, (user_id,))
            request_timestamps = [row['timestamp'] for row in results] if results else []
        except Exception as e:
            logger.error(f"Error checking rate limit for user {user_id}: {e}")
            # Fail open - don't block user if rate limiter fails
            return True

        current_requests = len(request_timestamps)

        if current_requests >= limit:
            if request_timestamps:
                oldest_request = min(request_timestamps)
                reset_time = oldest_request + (window_hours * 3600)
                wait_seconds = max(0, reset_time - time.time())

                raise RateLimitExceeded(
                    f"Rate limit exceeded. Maximum {limit} requests per {window_hours} hour(s). "
                    f"Try again in {int(wait_seconds // 60)} minutes and {int(wait_seconds % 60)} seconds."
                )
            else:
                raise RateLimitExceeded(
                    f"Rate limit exceeded. Maximum {limit} requests per {window_hours} hour(s)."
                )

        return True

    async def record_request(self, user_id: str):
        """Record a new request for the user in the database."""
        current_time = time.time()
        try:
            self.db_service._execute_insert(
                "rate_limit_records",
                {"user_id": user_id, "timestamp": current_time}
            )
            logger.info(f"Recorded request for user {user_id} at {datetime.fromtimestamp(current_time)}")
        except Exception as e:
            logger.error(f"Error recording request for user {user_id}: {e}")

    async def get_rate_limit_status(self, user_id: str, limit: int = None, window_hours: int = 1) -> dict:
        """
        Get current rate limit status for a user from the database.
        
        Returns:
            Dictionary with rate limit information
        """
        if limit is None:
            limit = settings.UPLOAD_RATE_LIMIT

        await self._cleanup_old_requests(user_id, window_hours)
        
        query = "SELECT timestamp FROM rate_limit_records WHERE user_id = ?"
        try:
            results = self.db_service._execute_select(query, (user_id,))
            request_timestamps = [row['timestamp'] for row in results] if results else []
        except Exception as e:
            logger.error(f"Error getting rate limit status for user {user_id}: {e}")
            request_timestamps = []


        current_requests = len(request_timestamps)
        remaining_requests = max(0, limit - current_requests)

        reset_time = None
        if request_timestamps:
            oldest_request = min(request_timestamps)
            reset_time = datetime.fromtimestamp(oldest_request + (window_hours * 3600))

        return {
            "limit": limit,
            "remaining": remaining_requests,
            "used": current_requests,
            "window_hours": window_hours,
            "reset_time": reset_time.isoformat() if reset_time else None
        }

    async def reset_user_limit(self, user_id: str):
        """Reset rate limit for a specific user (admin function)."""
        query = "DELETE FROM rate_limit_records WHERE user_id = ?"
        try:
            self.db_service._execute_query(query, (user_id,))
            logger.info(f"Rate limit reset for user {user_id}")
        except Exception as e:
            logger.error(f"Error resetting rate limit for user {user_id}: {e}")

    async def cleanup_expired_limits(self, window_hours: int = 1):
        """Clean up expired rate limit data for all users from the database."""
        cutoff_time = time.time() - (window_hours * 3600)
        query = "DELETE FROM rate_limit_records WHERE timestamp < ?"
        try:
            rows_affected = self.db_service._execute_query(query, (cutoff_time,))
            if rows_affected > 0:
                logger.info(f"Cleaned up {rows_affected} expired rate limit records.")
            return rows_affected
        except Exception as e:
            logger.error(f"Error cleaning up expired rate limits: {e}")
            return 0