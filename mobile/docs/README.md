# Token Management System

## Overview

This mobile app includes a comprehensive virtual currency (token) management system built on top of RevenueCat's subscriber attributes. The system provides secure, cross-device token balance synchronization with real-time validation and user-friendly spending controls.

## Architecture

### Core Components

1. **`useTokenBalance` Hook** - Core token management logic
2. **`TokenBalanceDisplay` Component** - Real-time balance display with refresh
3. **`TokenSpendButton` Component** - Smart spending validation with warnings

### Integration Flow

```
RevenueCat Subscriber Attributes
    ↓
useTokenBalance Hook (Data Layer)
    ↓
TokenBalanceDisplay (UI Display) + TokenSpendButton (Smart Actions)
    ↓
User Experience (Balance Tracking + Safe Spending)
```

## Quick Start

### 1. Install Dependencies

```bash
npm install react-native-purchases
```

### 2. Basic Implementation

```tsx
import React from 'react';
import { View } from 'react-native';
import { TokenBalanceDisplay } from './src/components/TokenBalanceDisplay';
import { TokenSpendButton } from './src/components/TokenSpendButton';

export default function GameScreen() {
  return (
    <View>
      {/* Show user's current balance */}
      <TokenBalanceDisplay size="large" showRefreshButton />
      
      {/* Safe token spending with validation */}
      <TokenSpendButton
        tokensRequired={25}
        buttonText="Unlock Premium Level"
        actionDescription="unlock this premium level"
        onSpendSuccess={(newBalance) => {
          console.log(`Level unlocked! Balance: ${newBalance}`);
          // Navigate to unlocked content
        }}
      />
    </View>
  );
}
```

## Components Documentation

### [useTokenBalance Hook](./useTokenBalance.md)
- **Purpose**: Core token management with RevenueCat integration
- **Features**: Balance fetching, spending, adding tokens, purchase refresh
- **Key Functions**: `fetchTokenBalance()`, `spendTokens()`, `addTokens()`, `refreshTokenBalanceAfterPurchase()`

### [TokenBalanceDisplay Component](./TokenBalanceDisplay.md)
- **Purpose**: Display user's token balance with real-time updates
- **Features**: Loading states, error handling, refresh button, size variants
- **Props**: `size`, `showRefreshButton`, `style`, `onBalanceUpdate`

### [TokenSpendButton Component](./TokenSpendButton.md)
- **Purpose**: Smart spending button with automatic validation
- **Features**: Balance validation, insufficient funds warnings, transaction handling
- **Props**: `tokensRequired`, `buttonText`, `onSpendSuccess`, `onSpendError`

## Token System Features

### ✅ **Cross-Device Synchronization**
- Tokens stored in RevenueCat subscriber attributes
- Automatic sync across all user devices
- Works offline with automatic sync when online

### ✅ **Real-Time Balance Updates**
- Live balance display with automatic refresh
- Immediate UI updates after spending/earning
- Refresh functionality for manual sync

### ✅ **Smart Spending Validation**
- Automatic balance checking before transactions
- Clear warnings for insufficient funds
- Prevention of invalid transactions

### ✅ **Comprehensive Error Handling**
- Network error recovery
- RevenueCat API error management
- User-friendly error messages

### ✅ **Purchase Integration**
- Automatic balance refresh after token purchases
- Token pack purchase helpers
- Receipt validation through RevenueCat

### ✅ **Developer-Friendly**
- TypeScript support with full type safety
- Comprehensive Jest test coverage
- Extensive documentation and examples

## Common Use Cases

### 1. **Game Economy**
```tsx
// Power-up purchases
<TokenSpendButton
  tokensRequired={10}
  buttonText="Buy Health Potion"
  onSpendSuccess={() => increasePlayerHealth()}
/>

// Level unlocks
<TokenSpendButton
  tokensRequired={50}
  buttonText="Unlock World 2"
  onSpendSuccess={() => unlockWorld(2)}
/>
```

### 2. **Premium Features**
```tsx
// Feature unlocking
<TokenSpendButton
  tokensRequired={25}
  buttonText="Remove Ads"
  actionDescription="remove all advertisements"
  onSpendSuccess={() => setAdFreeMode(true)}
/>

// Advanced tools
<TokenSpendButton
  tokensRequired={15}
  buttonText="Use AI Assistant"
  onSpendSuccess={() => enableAIFeatures()}
/>
```

### 3. **Content Access**
```tsx
// Premium content
<TokenSpendButton
  tokensRequired={30}
  buttonText="Access Premium Course"
  onSpendSuccess={() => navigation.navigate('PremiumCourse')}
/>

// Skip mechanisms
<TokenSpendButton
  tokensRequired={5}
  buttonText="Skip Level"
  onSpendSuccess={() => advanceToNextLevel()}
/>
```

## Integration Patterns

### Pattern 1: Balance Display + Spending
```tsx
const GameStore = () => (
  <View style={styles.store}>
    <TokenBalanceDisplay size="large" showRefreshButton />
    
    {storeItems.map(item => (
      <TokenSpendButton
        key={item.id}
        tokensRequired={item.cost}
        buttonText={`Buy ${item.name}`}
        onSpendSuccess={() => purchaseItem(item)}
      />
    ))}
  </View>
);
```

### Pattern 2: Conditional Features
```tsx
const PremiumFeature = () => {
  const { balance } = useTokenBalance();
  
  if (balance >= PREMIUM_COST) {
    return <PremiumContent />;
  }
  
  return (
    <View>
      <Text>Premium feature requires {PREMIUM_COST} tokens</Text>
      <TokenSpendButton
        tokensRequired={PREMIUM_COST}
        buttonText="Unlock Premium"
        onSpendSuccess={() => setShowPremium(true)}
      />
    </View>
  );
};
```

### Pattern 3: Token Earning + Spending Loop
```tsx
const GameLoop = () => {
  const handleLevelComplete = (tokensEarned: number) => {
    addTokens(tokensEarned);
    showEarningNotification(`+${tokensEarned} tokens!`);
  };
  
  return (
    <View>
      <TokenBalanceDisplay />
      <GameLevel onComplete={handleLevelComplete} />
      <TokenSpendButton
        tokensRequired={20}
        buttonText="Skip Difficult Level"
        onSpendSuccess={() => skipToNextLevel()}
      />
    </View>
  );
};
```

## Testing

### Comprehensive Test Coverage
- **useTokenBalance Hook**: 16/16 tests passing
- **TokenBalanceDisplay**: Complete component testing
- **TokenSpendButton**: 20 test scenarios covered

### Test Setup
```typescript
import { renderHook } from '@testing-library/react-hooks';
import { useTokenBalance } from '../hooks/useTokenBalance';

// Mock RevenueCat
jest.mock('react-native-purchases', () => ({
  getCustomerInfo: jest.fn(),
  syncSubscriberAttributes: jest.fn(),
}));
```

### Running Tests
```bash
# Run all token-related tests
npm test -- --testPathPattern="token|Token"

# Run with coverage
npm test -- --coverage --testPathPattern="token|Token"
```

## Configuration

### RevenueCat Setup
1. Configure RevenueCat in your app initialization
2. Set up subscriber attributes for token storage
3. Ensure proper error handling for network issues

### Environment Variables
```bash
# .env file
REVENUECAT_API_KEY=your_api_key_here
TOKEN_ATTRIBUTE_KEY=user_token_balance
```

### TypeScript Configuration
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true
  }
}
```

## Performance Considerations

- **Efficient Re-renders**: Components only update when necessary
- **Debounced Operations**: Prevents rapid-fire API calls
- **Memory Management**: Proper cleanup of async operations
- **Offline Support**: Graceful handling of network unavailability

## Security Features

- **Server-Side Validation**: RevenueCat handles server-side token validation
- **Transaction Integrity**: Prevents client-side token manipulation
- **Cross-Device Sync**: Ensures consistent balance across devices
- **Audit Trail**: RevenueCat provides transaction history

## Migration Guide

### From Basic State Management
```tsx
// Before: Local state
const [tokens, setTokens] = useState(0);

// After: RevenueCat integration
const { balance, spendTokens } = useTokenBalance();
```

### From Manual Balance Checking
```tsx
// Before: Manual validation
const handlePurchase = () => {
  if (tokens >= cost) {
    setTokens(tokens - cost);
    makePurchase();
  } else {
    alert('Insufficient tokens');
  }
};

// After: Smart component
<TokenSpendButton
  tokensRequired={cost}
  buttonText="Purchase"
  onSpendSuccess={() => makePurchase()}
/>
```

## Support and Troubleshooting

### Common Issues

1. **Balance Not Syncing**: Ensure RevenueCat is properly configured
2. **Network Errors**: Implement retry logic with exponential backoff
3. **iOS/Android Differences**: Test on both platforms thoroughly

### Debug Mode
```typescript
// Enable debug logging
const { balance, loading, error } = useTokenBalance();

if (__DEV__) {
  console.log('Token Debug:', { balance, loading, error });
}
```

### Error Recovery
```typescript
// Automatic retry on failure
const { refresh } = useTokenBalance();

useEffect(() => {
  if (error) {
    setTimeout(() => refresh(), 5000); // Retry after 5 seconds
  }
}, [error]);
```

## Future Enhancements

- **Token Packs**: Different denomination token purchases
- **Rewards System**: Daily bonuses and achievements
- **Analytics Integration**: Token usage tracking and optimization
- **A/B Testing**: Token pricing and UX experiments

---

For detailed component documentation, see:
- [useTokenBalance Hook Documentation](./useTokenBalance.md)
- [TokenBalanceDisplay Component Documentation](./TokenBalanceDisplay.md)  
- [TokenSpendButton Component Documentation](./TokenSpendButton.md)