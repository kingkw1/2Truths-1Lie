# Rate Limiting Implementation

## Overview

This document describes the rate limiting implementation for the 2Truths-1Lie game backend to prevent spam and flooding of challenge creation.

## Features

- **Per-user rate limiting**: Each user has their own rate limit counter
- **Configurable limits**: Maximum 5 challenges per hour (configurable via settings)
- **Automatic cleanup**: Old rate limit data is automatically cleaned up
- **Persistent storage**: Rate limit data persists across server restarts
- **Admin controls**: Administrators can reset rate limits and view statistics
- **HTTP headers**: Rate limit information included in API responses

## Configuration

Rate limiting is configured in `config.py`:

```python
# Rate limiting
UPLOAD_RATE_LIMIT: int = 5  # challenges per hour per user
```

## API Endpoints

### Challenge Creation (Rate Limited)

```http
POST /api/v1/challenges
```

**Rate Limit Headers in Response:**
- `X-RateLimit-Limit`: Maximum requests allowed per hour
- `X-RateLimit-Remaining`: Remaining requests in current window
- `X-RateLimit-Reset`: ISO timestamp when rate limit resets

**Rate Limit Exceeded Response:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json

{
  "detail": "Rate limit exceeded. Maximum 5 requests per 1 hour(s). Try again in 45 minutes and 30 seconds."
}
```

### Rate Limit Status

```http
GET /api/v1/users/me/rate-limit
Authorization: Bearer <token>
```

**Response:**
```json
{
  "rate_limit": {
    "limit": 5,
    "remaining": 3,
    "used": 2,
    "window_hours": 1,
    "reset_time": "2025-08-22T02:30:00.000Z"
  }
}
```

### Admin: Reset User Rate Limit

```http
POST /api/v1/admin/rate-limit/{user_id}/reset
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "message": "Rate limit reset for user {user_id}"
}
```

### Admin: Cleanup Expired Rate Limits

```http
POST /api/v1/admin/cleanup/rate-limits
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "message": "Cleaned up rate limit data for 5 users"
}
```

## Implementation Details

### RateLimiter Class

The `RateLimiter` class in `services/rate_limiter.py` provides:

- **check_rate_limit()**: Validates if user can make a request
- **record_request()**: Records a new request for rate limiting
- **get_rate_limit_status()**: Returns current rate limit status
- **reset_user_limit()**: Resets rate limit for a specific user
- **cleanup_expired_limits()**: Removes old rate limit data

### Integration with Challenge Service

The `ChallengeService` integrates rate limiting in the `create_challenge()` method:

1. Check rate limit before processing request
2. Create challenge if within limit
3. Record the request for future rate limiting
4. Return appropriate error if rate limit exceeded

### Data Storage

Rate limit data is stored in JSON format at `temp/rate_limits.json`:

```json
{
  "user_123": [1692668400.123, 1692668500.456],
  "user_456": [1692668600.789]
}
```

Each user has an array of timestamps representing their requests within the time window.

### Error Handling

Rate limit errors are handled gracefully:

- **RateLimitExceeded**: Custom exception with user-friendly message
- **HTTP 429**: Proper status code for rate limit exceeded
- **Helpful messages**: Include time until next request is allowed

## Testing

### Unit Tests

Run the rate limiter tests:

```bash
python test_rate_limiter_manual.py
```

### Integration Tests

Test challenge creation rate limiting:

```bash
python test_challenge_rate_limit_manual.py
```

### Manual API Testing

1. Start the server:
```bash
python -m uvicorn main:app --reload
```

2. Test with curl:
```bash
# Check rate limit status
curl -H "Authorization: Bearer test_user" \
     http://localhost:8000/api/v1/users/me/rate-limit

# Create challenge (repeat to test rate limiting)
curl -X POST \
     -H "Authorization: Bearer test_user" \
     -H "Content-Type: application/json" \
     -d '{
       "title": "Test Challenge",
       "statements": [
         {"media_file_id": "session_1", "duration_seconds": 10.0},
         {"media_file_id": "session_2", "duration_seconds": 12.0},
         {"media_file_id": "session_3", "duration_seconds": 8.0}
       ],
       "lie_statement_index": 1,
       "tags": ["test"]
     }' \
     http://localhost:8000/api/v1/challenges
```

## Security Considerations

- **Per-user isolation**: Rate limits are enforced per authenticated user
- **Persistent storage**: Rate limit data survives server restarts
- **Admin controls**: Only administrators can reset rate limits
- **Configurable limits**: Easy to adjust rate limits based on usage patterns

## Performance

- **Efficient cleanup**: Automatic removal of expired rate limit data
- **Minimal overhead**: Rate limiting adds minimal latency to requests
- **Memory efficient**: Only stores timestamps for active users
- **Scalable**: Can be extended to use Redis for distributed systems

## Future Enhancements

- **Different rate limits**: Separate limits for different endpoints
- **Burst allowance**: Allow short bursts above the base rate
- **IP-based limiting**: Additional rate limiting by IP address
- **Redis backend**: Distributed rate limiting for multiple servers
- **Metrics**: Detailed rate limiting metrics and monitoring