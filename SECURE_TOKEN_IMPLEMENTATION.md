# Secure Token Management System - Implementation Guide

This guide provides complete implementation code to refactor your token management from RevenueCat subscriber attributes to a secure backend system.

## Overview

The new architecture:
1. **Backend** manages token balances in a secure database
2. **RevenueCat webhook** automatically adds tokens after verified purchases
3. **Mobile app** fetches balance and spends tokens via authenticated API calls
4. **RevenueCat** still handles purchase validation and subscription management

## Backend Implementation

### 1. Environment Variables

Add these to your backend `.env` file:

```bash
# RevenueCat webhook secret for signature verification
REVENUECAT_WEBHOOK_SECRET=your_revenuecat_webhook_secret_here

# Database configuration (if using PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/your_database

# JWT Secret for token authentication
JWT_SECRET=your_jwt_secret_here
```

### 2. Database Migration

The database tables are automatically created when you run the backend. The new tables are:

- `token_balances` - Stores current balance for each user
- `token_transactions` - Audit trail of all token operations

### 3. Product Configuration

Update the `PRODUCT_TOKEN_MAP` in `backend/api/token_endpoints.py`:

```python
PRODUCT_TOKEN_MAP = {
    "pro_monthly": 500,           # $4.99 gets 500 tokens
    "pro_annual": 6000,           # $49.99 gets 6000 tokens (bonus)
    "token_pack_small": 100,      # Small token pack
    "token_pack_medium": 500,     # Medium token pack  
    "token_pack_large": 1200,     # Large token pack (bonus)
}
```

### 4. RevenueCat Webhook Setup

1. **In RevenueCat Dashboard:**
   - Go to your project settings
   - Add webhook URL: `https://your-backend.com/api/v1/tokens/webhook/revenuecat`
   - Set webhook secret in environment variable
   - Enable events: `INITIAL_PURCHASE`, `RENEWAL`, `NON_RENEWING_PURCHASE`

2. **Webhook Events Processed:**
   - Purchase events automatically add tokens to user balance
   - Signature verification ensures security
   - Failed purchases don't affect token balance

## Mobile Implementation

### 1. Replace Token Hook

**Option A: Gradual Migration**

1. Keep existing `useTokenBalance.ts` 
2. Use new `useTokenBalance_secure.ts` for new features
3. Gradually migrate components

**Option B: Complete Replacement**

```bash
# Backup current implementation
mv src/hooks/useTokenBalance.ts src/hooks/useTokenBalance_legacy.ts

# Replace with secure version
mv src/hooks/useTokenBalance_secure.ts src/hooks/useTokenBalance.ts
```

### 2. Update Components

No changes needed! The new hook maintains the same interface:

```typescript
// Existing component code works unchanged
const { balance, loading, error, refresh } = useTokenBalance();

// Spending tokens
const handleSpend = async () => {
  const response = await spendTokens({
    amount: 10,
    description: "Used hint in challenge",
    metadata: { challengeId: "challenge_123" }
  });
  
  if (response.success) {
    // Update UI with new balance
    refresh();
  }
};
```

### 3. Authentication Integration

The new system requires proper JWT authentication. Update your auth flow:

```typescript
// After successful login
await AsyncStorage.setItem('auth_token', jwtToken);

// The token API will automatically use this token
```

## API Endpoints

### Authentication Required

All token endpoints require `Authorization: Bearer <jwt_token>` header.

### Available Endpoints

1. **GET `/api/v1/tokens/balance`**
   - Returns current token balance
   - Response: `{ balance: number, last_updated: string }`

2. **POST `/api/v1/tokens/spend`**
   - Spend tokens with validation
   - Body: `{ amount: number, description: string, metadata?: object }`
   - Response: `{ success: boolean, new_balance: number, message: string }`

3. **GET `/api/v1/tokens/history?limit=50`**
   - Get transaction history
   - Response: Array of transaction objects

4. **POST `/api/v1/tokens/webhook/revenuecat`**
   - RevenueCat webhook endpoint (internal use)
   - Verifies signatures and processes purchases

## Security Features

### Backend Security

1. **Database Constraints**
   - Token balances cannot go negative
   - Transaction atomicity prevents race conditions
   - Audit trail for all operations

2. **API Authentication**
   - JWT token verification on all endpoints
   - Rate limiting on sensitive operations
   - Input validation and sanitization

3. **Webhook Security**
   - HMAC signature verification for RevenueCat webhooks
   - Only processes verified purchase events
   - Prevents replay attacks

### Client Security

1. **No Token Manipulation**
   - Tokens can only be modified via backend API
   - Client cannot directly set token values
   - All operations require backend validation

2. **Error Handling**
   - Graceful degradation on API failures
   - Automatic token refresh on authentication errors
   - User-friendly error messages

## Migration Process

### Phase 1: Backend Setup
1. ✅ Add database tables and API endpoints
2. ✅ Configure RevenueCat webhook
3. ✅ Test webhook with RevenueCat dashboard

### Phase 2: Client Migration
1. ✅ Deploy new token hook and API service
2. 🔄 Update components to use new hook (ongoing)
3. 🔄 Test purchase flow end-to-end

### Phase 3: Cleanup
1. ⏳ Remove RevenueCat subscriber attribute code
2. ⏳ Monitor and optimize performance
3. ⏳ Add advanced features (transaction history UI)

## Testing

### Backend Testing

```bash
# Test token balance endpoint
curl -H "Authorization: Bearer <token>" \
     http://localhost:8001/api/v1/tokens/balance

# Test token spending
curl -X POST \
     -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"amount":10,"description":"Test spend"}' \
     http://localhost:8001/api/v1/tokens/spend
```

### Webhook Testing

Use RevenueCat dashboard to trigger test purchase events, or use webhook testing tools.

### Mobile Testing

1. **Purchase Flow:**
   - Make RevenueCat purchase
   - Verify webhook adds tokens to backend
   - Verify mobile app shows updated balance

2. **Spending Flow:**
   - Use token spending feature
   - Verify backend validates and deducts tokens
   - Verify mobile app shows updated balance

## Troubleshooting

### Common Issues

1. **Webhook not receiving events:**
   - Check RevenueCat dashboard webhook configuration
   - Verify webhook URL is publicly accessible
   - Check webhook secret matches environment variable

2. **Authentication errors:**
   - Verify JWT token is properly stored and sent
   - Check token expiration and refresh logic
   - Verify backend JWT secret configuration

3. **Token balance not updating:**
   - Check backend logs for webhook processing
   - Verify product IDs match `PRODUCT_TOKEN_MAP`
   - Check database for transaction records

### Debug Logging

Backend logs will show:
```
INFO: User user123 spent 10 tokens. New balance: 490
INFO: Successfully processed token purchase: 500 tokens for user user123
```

Mobile logs will show:
```
🔐 Fetching token balance from secure backend...
🪙 Token balance fetched from backend: 500
✅ Successfully spent 10 tokens. New balance: 490
```

## Performance Considerations

- Token balance queries are cached and optimized
- Database indexes support fast lookups
- Webhook processing is asynchronous
- Client-side caching reduces API calls

## Monitoring

Add these metrics to track system health:
- Token purchase success rate
- API response times
- Webhook processing latency
- Failed transaction rates

This secure implementation provides enterprise-grade token management while maintaining the simplicity of the original RevenueCat integration.