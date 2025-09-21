# useTokenBalance Hook Documentation

## Overview

The `useTokenBalance` hook provides a React Native interface for managing virtual token currency using RevenueCat's customer attributes system. It allows you to track, add, and spend tokens while keeping the balance synchronized across devices through RevenueCat's infrastructure.

## Features

- ✅ **Real-time balance tracking** with loading and error states
- ✅ **Cross-device synchronization** via RevenueCat
- ✅ **Type-safe operations** with TypeScript support  
- ✅ **Automatic updates** when balance changes
- ✅ **Error handling** for insufficient tokens and API failures
- ✅ **Helper functions** for common operations (add/spend tokens)

## Installation & Setup

The hook is already integrated with your existing RevenueCat setup. No additional configuration required.

## API Reference

### `useTokenBalance()`

Main hook for token balance management.

**Returns:**
```typescript
interface TokenBalance {
  balance: number;        // Current token balance
  loading: boolean;       // Loading state during fetch
  error: Error | null;    // Any errors that occurred
}
```

**Example:**
```tsx
import { useTokenBalance } from '../hooks/useTokenBalance';

function TokenDisplay() {
  const { balance, loading, error } = useTokenBalance();

  if (loading) return <Text>Loading...</Text>;
  if (error) return <Text>Error: {error.message}</Text>;
  
  return <Text>Tokens: {balance}</Text>;
}
```

### `updateTokenBalance(newBalance: number)`

Sets the token balance to a specific value.

**Parameters:**
- `newBalance` (number): The new token balance to set

**Returns:** `Promise<void>`

**Example:**
```tsx
import { updateTokenBalance } from '../hooks/useTokenBalance';

// Set balance to exactly 100 tokens
await updateTokenBalance(100);
```

### `addTokens(tokensToAdd: number)`

Adds tokens to the current balance.

**Parameters:**
- `tokensToAdd` (number): Number of tokens to add

**Returns:** `Promise<number>` - The new balance after adding tokens

**Example:**
```tsx
import { addTokens } from '../hooks/useTokenBalance';

// Add 10 tokens to current balance
const newBalance = await addTokens(10);
console.log(`New balance: ${newBalance}`);
```

### `spendTokens(tokensToSpend: number)`

Spends tokens from the current balance with insufficient funds protection.

**Parameters:**
- `tokensToSpend` (number): Number of tokens to spend

**Returns:** `Promise<number>` - The new balance after spending tokens

**Throws:** `Error` if insufficient tokens available

**Example:**
```tsx
import { spendTokens } from '../hooks/useTokenBalance';

try {
  const newBalance = await spendTokens(5);
  console.log(`Purchase successful! Remaining: ${newBalance}`);
} catch (error) {
  console.log('Insufficient tokens for purchase');
}
```

## Integration Examples

### Basic Token Display

```tsx
import React from 'react';
import { View, Text } from 'react-native';
import { useTokenBalance } from '../hooks/useTokenBalance';

export const TokenHeader: React.FC = () => {
  const { balance, loading } = useTokenBalance();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text>🪙</Text>
      <Text>{loading ? '...' : balance}</Text>
    </View>
  );
};
```

### Token Purchase Flow

```tsx
import React from 'react';
import { TouchableOpacity, Text, Alert } from 'react-native';
import { useTokenBalance, spendTokens } from '../hooks/useTokenBalance';

interface TokenPurchaseProps {
  itemName: string;
  cost: number;
  onPurchase: () => void;
}

export const TokenPurchase: React.FC<TokenPurchaseProps> = ({ 
  itemName, 
  cost, 
  onPurchase 
}) => {
  const { balance } = useTokenBalance();
  const canAfford = balance >= cost;

  const handlePurchase = async () => {
    try {
      await spendTokens(cost);
      onPurchase();
      Alert.alert('Success!', `Purchased ${itemName}`);
    } catch (error) {
      Alert.alert('Error', 'Insufficient tokens');
    }
  };

  return (
    <TouchableOpacity 
      onPress={handlePurchase}
      disabled={!canAfford}
      style={{ 
        backgroundColor: canAfford ? '#4CAF50' : '#CCCCCC',
        padding: 10,
        borderRadius: 5 
      }}
    >
      <Text style={{ color: 'white' }}>
        Buy {itemName} ({cost} tokens)
      </Text>
    </TouchableOpacity>
  );
};
```

### Token Rewards

```tsx
import React from 'react';
import { TouchableOpacity, Text } from 'react-native';
import { addTokens } from '../hooks/useTokenBalance';

export const RewardButton: React.FC = () => {
  const handleClaimReward = async () => {
    try {
      const newBalance = await addTokens(25);
      console.log(`Reward claimed! New balance: ${newBalance}`);
    } catch (error) {
      console.error('Failed to claim reward:', error);
    }
  };

  return (
    <TouchableOpacity onPress={handleClaimReward}>
      <Text>Claim 25 Token Reward</Text>
    </TouchableOpacity>
  );
};
```

## Integration with Existing Types

The hook is integrated with your existing game type system. The `CurrencyType` has been updated to include `'tokens'`:

```typescript
export type CurrencyType = 'coins' | 'gems' | 'experience' | 'tokens';
```

You can now use tokens in your `VirtualCurrency` interfaces:

```typescript
const tokenCurrency: VirtualCurrency = {
  type: 'tokens',
  amount: 100,
  lastEarned: new Date(),
  totalEarned: 500,
  totalSpent: 400
};
```

## Technical Implementation

### Data Storage
- Tokens are stored as RevenueCat subscriber attributes
- Key: `tokens` 
- Value: String representation of the balance (e.g., "150")
- Syncs automatically across devices via RevenueCat

### Error Handling
The hook handles several error scenarios:
- **Network failures:** Returns error state, retains last known balance
- **Invalid data:** Defaults to 0 balance, logs warning
- **Insufficient tokens:** Prevents spending, throws descriptive error
- **RevenueCat API errors:** Propagates error to UI for handling

### Performance
- **Automatic caching:** RevenueCat handles caching and synchronization
- **Real-time updates:** Listens for customer info changes
- **Minimal re-renders:** Only updates when balance actually changes

## Testing

Comprehensive test suite included at `src/hooks/__tests__/useTokenBalance.test.tsx`:

```bash
# Run token balance tests
npm test -- useTokenBalance.test.tsx

# Run all tests including types
npm test -- --testPathPattern="useTokenBalance|types"
```

Test coverage includes:
- ✅ Hook state management (loading, error, balance)
- ✅ Token balance fetching from RevenueCat
- ✅ Adding and spending token operations  
- ✅ Error handling for insufficient funds
- ✅ Customer info listener setup/cleanup
- ✅ Edge cases (missing data, invalid values)

## Demo Component

A complete demo component is available at `src/components/TokenBalanceDemo.tsx` showing all hook features in action.

## Migration Guide

If migrating from a different token system:

1. **Import the hook:**
   ```tsx
   import { useTokenBalance, addTokens, spendTokens } from '../hooks/useTokenBalance';
   ```

2. **Replace existing balance state:**
   ```tsx
   // Old
   const [tokens, setTokens] = useState(0);
   
   // New  
   const { balance: tokens, loading, error } = useTokenBalance();
   ```

3. **Update token operations:**
   ```tsx
   // Old
   setTokens(prev => prev + amount);
   
   // New
   await addTokens(amount);
   ```

4. **Add error handling:**
   ```tsx
   try {
     await spendTokens(cost);
     // Purchase successful
   } catch (error) {
     // Handle insufficient tokens
   }
   ```

## Troubleshooting

### Common Issues

**Balance not updating after purchase:**
- Ensure RevenueCat is properly configured
- Check that `Purchases.setAttributes()` is working
- Verify customer info listener is active

**"subscriberAttributes is undefined" error:**
- This is expected in some RevenueCat versions
- The hook handles this gracefully with fallbacks
- Balance will default to 0 and can be set via `updateTokenBalance()`

**Tokens not syncing across devices:**
- Check RevenueCat API key configuration
- Ensure user is logged into the same RevenueCat customer ID
- Verify network connectivity

### Debug Logging

The hook includes verbose logging for debugging:

```typescript
// Enable in development
console.log('🪙 Token balance fetched: X');
console.log('🪙 Token balance updated to: X');
console.log('🪙 Added X tokens. New balance: Y');
console.log('🪙 Spent X tokens. New balance: Y');
```

## Next Steps

- **Purchase Integration:** Connect token spending to your in-app purchase flow
- **Analytics:** Track token earning/spending for monetization insights  
- **UI Polish:** Add animations and visual feedback for token operations
- **Rewards System:** Implement token rewards for game achievements
- **Balance Limits:** Add maximum token balance restrictions if needed