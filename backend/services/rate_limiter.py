"""
Rate limiting service for preventing spam and abuse
"""
import json
import time
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime, timedelta
import logging

from config import settings

logger = logging.getLogger(__name__)

class RateLimitExceeded(Exception):
    """Exception raised when rate limit is exceeded"""
    pass

class RateLimiter:
    """Rate limiter for API endpoints"""
    
    def __init__(self):
        self.rate_limit_file = settings.TEMP_DIR / "rate_limits.json"
        self.user_requests: Dict[str, List[float]] = {}
        self._load_data()
    
    def _load_data(self):
        """Load rate limit data from disk"""
        try:
            if self.rate_limit_file.exists():
                with open(self.rate_limit_file, 'r') as f:
                    data = json.load(f)
                    # Convert timestamps back to floats
                    self.user_requests = {
                        user_id: [float(ts) for ts in timestamps]
                        for user_id, timestamps in data.items()
                    }
        except Exception as e:
            logger.error(f"Error loading rate limit data: {e}")
            self.user_requests = {}
    
    async def _save_data(self):
        """Save rate limit data to disk"""
        try:
            with open(self.rate_limit_file, 'w') as f:
                json.dump(self.user_requests, f, indent=2)
        except Exception as e:
            logger.error(f"Error saving rate limit data: {e}")
    
    def _cleanup_old_requests(self, user_id: str, window_hours: int = 1):
        """Remove requests older than the time window"""
        if user_id not in self.user_requests:
            return
        
        cutoff_time = time.time() - (window_hours * 3600)  # Convert hours to seconds
        self.user_requests[user_id] = [
            timestamp for timestamp in self.user_requests[user_id]
            if timestamp > cutoff_time
        ]
    
    async def check_rate_limit(
        self, 
        user_id: str, 
        limit: int = None, 
        window_hours: int = 1
    ) -> bool:
        """
        Check if user has exceeded rate limit
        
        Args:
            user_id: User identifier
            limit: Maximum requests allowed (defaults to settings.UPLOAD_RATE_LIMIT)
            window_hours: Time window in hours (default 1 hour)
            
        Returns:
            True if within rate limit, False if exceeded
            
        Raises:
            RateLimitExceeded: If rate limit is exceeded
        """
        if limit is None:
            limit = settings.UPLOAD_RATE_LIMIT
        
        # Clean up old requests
        self._cleanup_old_requests(user_id, window_hours)
        
        # Check current request count
        current_requests = len(self.user_requests.get(user_id, []))
        
        if current_requests >= limit:
            # Calculate time until next request is allowed
            if user_id in self.user_requests and self.user_requests[user_id]:
                oldest_request = min(self.user_requests[user_id])
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
        """Record a new request for the user"""
        current_time = time.time()
        
        if user_id not in self.user_requests:
            self.user_requests[user_id] = []
        
        self.user_requests[user_id].append(current_time)
        await self._save_data()
        
        logger.info(f"Recorded request for user {user_id} at {datetime.fromtimestamp(current_time)}")
    
    async def get_rate_limit_status(self, user_id: str, limit: int = None, window_hours: int = 1) -> Dict:
        """
        Get current rate limit status for a user
        
        Returns:
            Dictionary with rate limit information
        """
        if limit is None:
            limit = settings.UPLOAD_RATE_LIMIT
        
        # Clean up old requests
        self._cleanup_old_requests(user_id, window_hours)
        
        current_requests = len(self.user_requests.get(user_id, []))
        remaining_requests = max(0, limit - current_requests)
        
        # Calculate reset time
        reset_time = None
        if user_id in self.user_requests and self.user_requests[user_id]:
            oldest_request = min(self.user_requests[user_id])
            reset_time = datetime.fromtimestamp(oldest_request + (window_hours * 3600))
        
        return {
            "limit": limit,
            "remaining": remaining_requests,
            "used": current_requests,
            "window_hours": window_hours,
            "reset_time": reset_time.isoformat() if reset_time else None
        }
    
    async def reset_user_limit(self, user_id: str):
        """Reset rate limit for a specific user (admin function)"""
        if user_id in self.user_requests:
            del self.user_requests[user_id]
            await self._save_data()
            logger.info(f"Rate limit reset for user {user_id}")
    
    async def cleanup_expired_limits(self, window_hours: int = 1):
        """Clean up expired rate limit data for all users"""
        cutoff_time = time.time() - (window_hours * 3600)
        users_to_remove = []
        
        for user_id in self.user_requests:
            self._cleanup_old_requests(user_id, window_hours)
            if not self.user_requests[user_id]:  # No requests left after cleanup
                users_to_remove.append(user_id)
        
        # Remove users with no recent requests
        for user_id in users_to_remove:
            del self.user_requests[user_id]
        
        if users_to_remove:
            await self._save_data()
            logger.info(f"Cleaned up rate limit data for {len(users_to_remove)} users")
        
        return len(users_to_remove)