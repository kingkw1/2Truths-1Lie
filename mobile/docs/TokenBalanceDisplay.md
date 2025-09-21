# TokenBalanceDisplay Component

## Overview

The `TokenBalanceDisplay` component is a React Native component that displays the user's current token balance using the `useTokenBalance` hook. It provides a comprehensive UI for showing token information with proper loading states, error handling, and customization options.

## Features

- ✅ **Real-time Balance Display**: Shows current token balance from RevenueCat
- ✅ **Loading Spinner**: Activity indicator while fetching balance
- ✅ **Error Handling**: User-friendly error messages with retry functionality
- ✅ **Customizable Styling**: Size variants, custom colors, and container styles
- ✅ **Refresh Functionality**: Optional refresh button for manual updates
- ✅ **Accessibility**: Proper accessibility labels for screen readers
- ✅ **Number Formatting**: Comma-separated formatting for large numbers
- ✅ **Responsive Design**: Different size variants for various use cases

## Props

```typescript
interface TokenBalanceDisplayProps {
  style?: any;                    // Custom styling for container
  showRefreshButton?: boolean;    // Show refresh button (default: false)
  textColor?: string;             // Custom text color
  size?: 'small' | 'medium' | 'large'; // Size variant (default: 'medium')
  onRefresh?: () => void;         // Callback when refresh is tapped
}
```

## Usage Examples

### Basic Usage
```tsx
import { TokenBalanceDisplay } from '../components/TokenBalanceDisplay';

export const GameHeader = () => {
  return (
    <View style={styles.header}>
      <Text>My Game</Text>
      <TokenBalanceDisplay />
    </View>
  );
};
```

### With Refresh Button
```tsx
export const WalletScreen = () => {
  const handleRefresh = () => {
    console.log('Token balance refreshed!');
    // Optional: Show success message or trigger other actions
  };

  return (
    <TokenBalanceDisplay 
      showRefreshButton 
      onRefresh={handleRefresh}
    />
  );
};
```

### Size Variants
```tsx
// Small size for headers/navigation
<TokenBalanceDisplay size="small" />

// Medium size for regular display (default)
<TokenBalanceDisplay size="medium" />

// Large size for main balance screens
<TokenBalanceDisplay size="large" />
```

### Custom Styling
```tsx
<TokenBalanceDisplay 
  style={{ backgroundColor: '#f0f0f0', borderRadius: 20 }}
  textColor="#FF6B6B"
  size="large"
/>
```

## Component States

### Loading State
- Shows `ActivityIndicator` spinner
- Displays "Loading..." text
- Respects size prop for spinner size

### Error State
- Shows warning icon (⚠️)
- Displays "Error loading balance" message
- Provides "Retry" button that calls the refresh function
- Allows custom styling for error state

### Success State
- Shows token icon (🪙)
- Displays formatted balance number
- Shows "token" (singular) or "tokens" (plural) label
- Optional refresh button (🔄)

## Styling

The component uses a clean, modern design with:

- **Container**: Rounded corners with subtle shadow/elevation
- **Background**: Semi-transparent white background
- **Typography**: Clear, readable fonts with appropriate sizing
- **Colors**: Customizable text colors with sensible defaults
- **Spacing**: Proper padding and margins for different sizes

### Size Specifications

| Size   | Font Size | Icon Size | Padding |
|--------|-----------|-----------|---------|
| Small  | 14px      | 12px      | 8px     |
| Medium | 16px      | 16px      | 12px    |
| Large  | 20px      | 20px      | 16px    |

## Accessibility

The component includes proper accessibility features:

- **Balance Text**: `accessibilityLabel="Current token balance: {balance}"`
- **Token Icon**: `accessibilityLabel="Token icon"`
- **Refresh Button**: `accessibilityLabel="Refresh token balance"`
- **Retry Button**: `accessibilityLabel="Retry loading token balance"`

## Integration with useTokenBalance Hook

The component automatically handles all the complexity of the `useTokenBalance` hook:

```typescript
const { balance, loading, error, refresh } = useTokenBalance();
```

- **balance**: Displayed with number formatting
- **loading**: Shows loading spinner
- **error**: Shows error state with retry option
- **refresh**: Used for manual refresh functionality

## Real-world Usage Scenarios

### 1. Navigation Header
```tsx
// Small, compact display in app header
<TokenBalanceDisplay size="small" />
```

### 2. Wallet/Account Screen
```tsx
// Large display with refresh button for main balance view
<TokenBalanceDisplay 
  size="large" 
  showRefreshButton 
  onRefresh={handleRefresh}
/>
```

### 3. Purchase Confirmation
```tsx
// Medium display to show updated balance after purchase
<TokenBalanceDisplay 
  size="medium"
  textColor="#4CAF50"
/>
```

### 4. Game Overlay
```tsx
// Custom styled for in-game display
<TokenBalanceDisplay 
  size="small"
  style={{
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderColor: '#FFD700',
    borderWidth: 1
  }}
  textColor="#FFD700"
/>
```

## Error Handling

The component gracefully handles various error scenarios:

- **Network Errors**: Shows retry button
- **RevenueCat API Errors**: Displays user-friendly message
- **Parsing Errors**: Handles invalid token values
- **Refresh Failures**: Logs errors and continues operation

## Performance Notes

- **Automatic Updates**: Component updates automatically when token balance changes
- **Efficient Rendering**: Only re-renders when necessary
- **Memory Management**: Properly cleans up listeners and async operations
- **Error Boundaries**: Handles component-level errors gracefully

## Dependencies

- `react-native`: Core React Native components (View, Text, TouchableOpacity, ActivityIndicator)
- `useTokenBalance`: Custom hook for token balance management
- `StyleSheet`: React Native styling system

## TypeScript Support

The component is fully typed with TypeScript, providing:
- Type-safe props interface
- IntelliSense support
- Compile-time error checking
- Better development experience