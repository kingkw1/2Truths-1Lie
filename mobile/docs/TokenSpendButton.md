# TokenSpendButton Component

## Overview

The `TokenSpendButton` is a smart React Native component that provides safe token spending functionality with built-in validation, user feedback, and error handling. It automatically checks the user's token balance before allowing spending and provides clear visual feedback when funds are insufficient.

## Key Features

- ✅ **Automatic Balance Validation**: Checks user's token balance before allowing spending
- ✅ **Visual Feedback**: Different button states based on token availability
- ✅ **Warning Messages**: Clear warnings when user has insufficient tokens
- ✅ **Loading States**: Shows progress during balance fetching and spending
- ✅ **Error Handling**: Comprehensive error handling with user-friendly messages
- ✅ **Customizable Appearance**: Multiple size variants and custom styling options
- ✅ **Accessibility Support**: Proper accessibility labels and states
- ✅ **Callback System**: Success and error callbacks for custom handling

## Props Interface

```typescript
interface TokenSpendButtonProps {
  tokensRequired: number;           // Required: Number of tokens to spend
  buttonText: string;               // Required: Text displayed on button
  actionDescription?: string;       // Optional: Description of the action
  onSpendSuccess?: (newBalance: number) => void;  // Success callback
  onSpendError?: (error: Error) => void;          // Error callback
  style?: any;                      // Custom button styling
  size?: 'small' | 'medium' | 'large';           // Button size variant
  showDetailedWarning?: boolean;    // Show warning message (default: true)
  customInsufficientMessage?: string;            // Custom warning text
  disabled?: boolean;               // Force disable button (default: false)
}
```

## Component States

### 1. **Loading State**
- Shown when token balance is being fetched
- Displays spinner and "Loading..." text
- Button is disabled during loading

### 2. **Sufficient Balance State**
- Green button indicating user can afford the action
- Shows token icon and required amount
- Button is enabled and functional

### 3. **Insufficient Balance State**  
- Red/orange button indicating insufficient funds
- Button is disabled to prevent invalid transactions
- Warning message displayed below button (optional)
- Shows "Get More Tokens" option in alert

### 4. **Processing State**
- Shown during token spending transaction
- Displays spinner and "Processing..." text
- Button temporarily disabled during transaction

### 5. **Disabled State**
- Gray button when manually disabled via props
- Button is non-functional regardless of balance

## Usage Examples

### Basic Usage
```tsx
import { TokenSpendButton } from '../components/TokenSpendButton';

// Simple token spend button
<TokenSpendButton
  tokensRequired={10}
  buttonText="Buy Item"
  actionDescription="purchase this item"
/>
```

### With Callbacks
```tsx
// Handle success and error events
<TokenSpendButton
  tokensRequired={25}
  buttonText="Unlock Feature"
  actionDescription="unlock premium feature"
  onSpendSuccess={(newBalance) => {
    console.log(`Success! New balance: ${newBalance}`);
    // Navigate to unlocked content
    navigation.navigate('PremiumFeature');
  }}
  onSpendError={(error) => {
    console.error('Failed to unlock:', error);
    // Show error tracking or support options
  }}
/>
```

### Custom Styling and Messaging
```tsx
// Customized appearance and messages
<TokenSpendButton
  tokensRequired={50}
  buttonText="Skip Level"
  actionDescription="skip to next level"
  customInsufficientMessage="Complete more challenges to earn tokens for skipping!"
  style={{
    backgroundColor: '#FF9800',
    borderRadius: 20,
  }}
  size="large"
/>
```

### Game Purchase Example
```tsx
// Real-world game purchase
const PurchasePowerUp = () => (
  <View style={styles.powerUpCard}>
    <Text style={styles.title}>Double XP Boost</Text>
    <Text style={styles.description}>2x experience for 1 hour</Text>
    
    <TokenSpendButton
      tokensRequired={15}
      buttonText="Activate Boost"
      actionDescription="activate XP boost"
      onSpendSuccess={(newBalance) => {
        // Start boost timer
        activateXPBoost();
        showSuccessMessage(`Boost activated! ${newBalance} tokens remaining`);
      }}
      onSpendError={(error) => {
        showErrorMessage('Failed to activate boost. Please try again.');
      }}
    />
  </View>
);
```

## Size Variants

### Small (`size="small"`)
- **Use Case**: Headers, compact lists, secondary actions
- **Padding**: 8px vertical, 16px horizontal  
- **Font Size**: 14px
- **Icon Size**: 12px

### Medium (`size="medium"`) - Default
- **Use Case**: Standard buttons, most common actions
- **Padding**: 12px vertical, 20px horizontal
- **Font Size**: 16px
- **Icon Size**: 14px

### Large (`size="large"`)
- **Use Case**: Primary actions, main purchase buttons
- **Padding**: 16px vertical, 24px horizontal
- **Font Size**: 18px
- **Icon Size**: 16px

## Visual Design

### Button Colors
- **Sufficient Funds**: Green (`#4CAF50`) - Action available
- **Insufficient Funds**: Red (`#FF6B6B`) - Action blocked  
- **Disabled**: Gray (`#CCCCCC`) - Action unavailable
- **Loading**: Light gray (`#F0F0F0`) - Processing

### Warning Message
- **Background**: Light yellow (`#FFF3CD`)
- **Border**: Yellow (`#FFEAA7`)
- **Text**: Dark yellow (`#856404`)
- **Icon**: Warning emoji (⚠️)

## Accessibility Features

### Screen Reader Support
```typescript
// Sufficient balance
accessibilityLabel="Spend 10 tokens to purchase this item"

// Insufficient balance  
accessibilityLabel="Insufficient tokens. Need 10, have 5"

// Loading state
accessibilityLabel="Loading token balance"
```

### Accessibility States
- `accessibilityRole="button"`
- `accessibilityState={{ disabled: isButtonDisabled }}`
- Proper focus management
- High contrast support

## Error Handling

### Insufficient Funds Flow
1. **Check Balance**: Validates `balance >= tokensRequired`
2. **Show Alert**: "Insufficient Tokens" with details
3. **Offer Solutions**: "Get More Tokens" button in alert
4. **Prevent Action**: Button disabled, no `spendTokens()` call

### Transaction Errors
1. **Network Errors**: "Transaction Failed" alert with retry option
2. **RevenueCat Errors**: User-friendly error messages
3. **Callback Notification**: `onSpendError()` called with error details
4. **State Recovery**: Button returns to normal state after error

### Error Alert Examples
```typescript
// Insufficient funds
Alert.alert(
  'Insufficient Tokens',
  'You need 25 tokens but only have 10. This is required to unlock premium feature.',
  [
    { text: 'OK', style: 'default' },
    { text: 'Get More Tokens', onPress: navigateToTokenStore }
  ]
);

// Transaction failure
Alert.alert(
  'Transaction Failed', 
  'Network error occurred. Please try again.'
);
```

## Integration with Token System

### Hook Integration
```typescript
const { balance, loading } = useTokenBalance();

// Automatic integration:
// - balance: Used for validation
// - loading: Shows loading state
// - spendTokens(): Called on successful validation
```

### Transaction Flow
1. **Button Press** → Validate balance
2. **Validation Pass** → Call `spendTokens(tokensRequired)`
3. **Success** → Update UI, call `onSpendSuccess(newBalance)`
4. **Error** → Show error, call `onSpendError(error)`

## Best Practices

### 1. **Clear Action Descriptions**
```tsx
// Good: Specific and clear
actionDescription="unlock this premium skin"

// Avoid: Vague or unclear
actionDescription="do something"
```

### 2. **Appropriate Token Amounts**
```tsx
// Small actions: 1-10 tokens
<TokenSpendButton tokensRequired={5} buttonText="Skip Ad" />

// Medium actions: 10-50 tokens  
<TokenSpendButton tokensRequired={25} buttonText="Unlock Level" />

// Large actions: 50+ tokens
<TokenSpendButton tokensRequired={100} buttonText="Premium Upgrade" />
```

### 3. **Meaningful Callbacks**
```tsx
<TokenSpendButton
  tokensRequired={20}
  buttonText="Buy Power-Up"
  onSpendSuccess={(newBalance) => {
    // Activate the purchased item
    activatePowerUp();
    
    // Update UI
    showSuccessAnimation();
    
    // Track analytics
    trackPurchase('power_up', 20);
  }}
  onSpendError={(error) => {
    // Log error for debugging
    console.error('Power-up purchase failed:', error);
    
    // Track failed purchases
    trackFailedPurchase('power_up', error.message);
  }}
/>
```

### 4. **Custom Messages for Context**
```tsx
// Game-specific messaging
<TokenSpendButton
  tokensRequired={30}
  buttonText="Revive Character"
  customInsufficientMessage="Not enough coins to revive! Defeat enemies to earn more coins."
/>

// App-specific messaging  
<TokenSpendButton
  tokensRequired={15}
  buttonText="Remove Watermark"
  customInsufficientMessage="Premium tokens required. Upgrade to Pro or complete daily challenges!"
/>
```

## Common Use Cases

### 1. **In-Game Purchases**
- Power-ups and boosts
- Character unlocks
- Level skips
- Extra lives/continues

### 2. **Content Unlocking**
- Premium features
- Exclusive content
- Advanced tools
- Ad removal

### 3. **Service Purchases**
- API calls (AI features)
- Cloud storage
- Priority support
- Enhanced limits

### 4. **Cosmetic Items**
- Themes and skins
- Avatar customization
- Special effects
- Collectibles

## Testing Considerations

### Test Scenarios
1. **Sufficient Balance**: Button enabled, transaction succeeds
2. **Insufficient Balance**: Button disabled, warning shown
3. **Loading State**: Spinner shown, button disabled
4. **Transaction Errors**: Error handling, callbacks triggered
5. **Custom Props**: Size variants, styling, messages
6. **Accessibility**: Screen reader labels, focus management

### Mock Data Examples
```typescript
// Test with sufficient balance
mockUseTokenBalance.mockReturnValue({
  balance: 100,
  loading: false,
  error: null,
  refresh: jest.fn(),
});

// Test with insufficient balance
mockUseTokenBalance.mockReturnValue({
  balance: 5,
  loading: false, 
  error: null,
  refresh: jest.fn(),
});
```

## Performance Notes

- **Efficient Re-rendering**: Only re-renders when balance or loading state changes
- **Optimized Validation**: Balance check happens in render, no extra API calls
- **Memory Management**: Proper cleanup of async operations
- **Debounced Actions**: Prevents double-tapping during transactions

## Dependencies

- `react-native`: Core components (TouchableOpacity, Text, View, Alert)
- `useTokenBalance`: Token balance management hook
- `spendTokens`: Token spending functionality

The `TokenSpendButton` provides a complete, production-ready solution for safe token spending with excellent user experience and comprehensive error handling.