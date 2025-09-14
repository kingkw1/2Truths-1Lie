# SignupScreen Component

## Overview

The `SignupScreen` component provides a complete user registration interface with email/password authentication, client-side validation, and error handling. It follows the same design patterns as the existing `LoginScreen` for consistency.

## Features

- **Email/Password Registration**: Standard email and password signup form
- **Client-Side Validation**: Real-time validation with helpful error messages
- **Password Confirmation**: Ensures users enter their password correctly
- **Strong Password Requirements**: Enforces secure password policies
- **Loading States**: Visual feedback during signup process
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Responsive Design**: Works on both iOS and Android with proper keyboard handling
- **Accessibility**: Proper labeling and keyboard navigation support

## Props

```typescript
interface SignupScreenProps {
  onSignupSuccess: () => void;      // Called when signup is successful
  onNavigateToLogin: () => void;    // Called when user wants to switch to login
  onBack?: () => void;              // Optional back navigation handler
}
```

## Validation Rules

### Email Validation
- Required field
- Must be a valid email format (contains @ and domain)

### Password Validation
- Required field
- Minimum 8 characters
- Must contain at least one letter and one number
- Uses regex: `/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/`

### Password Confirmation
- Required field
- Must match the password field exactly

## Usage Examples

### Basic Usage

```tsx
import { SignupScreen } from '../screens/SignupScreen';

const MyComponent = () => {
  const handleSignupSuccess = () => {
    // Navigate to main app or show success message
    navigation.navigate('MainApp');
  };

  const handleNavigateToLogin = () => {
    // Navigate to login screen
    navigation.navigate('Login');
  };

  return (
    <SignupScreen
      onSignupSuccess={handleSignupSuccess}
      onNavigateToLogin={handleNavigateToLogin}
    />
  );
};
```

### With Back Navigation

```tsx
<SignupScreen
  onSignupSuccess={handleSignupSuccess}
  onNavigateToLogin={handleNavigateToLogin}
  onBack={() => navigation.goBack()}
/>
```

### In a Modal

```tsx
const [showSignup, setShowSignup] = useState(false);

return (
  <Modal visible={showSignup} animationType="slide">
    <SignupScreen
      onSignupSuccess={() => {
        setShowSignup(false);
        // Handle success
      }}
      onNavigateToLogin={() => {
        // Switch to login modal or screen
      }}
      onBack={() => setShowSignup(false)}
    />
  </Modal>
);
```

## Error Handling

The component handles various error scenarios:

### Validation Errors
- **Empty fields**: Shows "Field is required" messages
- **Invalid email**: Shows "Please enter a valid email address"
- **Weak password**: Shows specific password requirements
- **Password mismatch**: Shows "Passwords do not match"

### API Errors
- **Email already exists**: Shows "An account with this email already exists"
- **Network errors**: Shows "Network error. Please check your connection"
- **Generic errors**: Shows "Signup failed. Please try again"

## Styling

The component uses a consistent design system with:
- **Colors**: Primary blue (#007AFF), error red (#ff4444), neutral grays
- **Typography**: Clear hierarchy with proper font weights and sizes
- **Spacing**: Consistent margins and padding throughout
- **Interactive States**: Proper disabled states and loading indicators

## Integration with AuthService

The component integrates with the `AuthService` singleton:

```typescript
// Calls the signup method with email and password
await authService.signup(email.trim(), password);
```

The AuthService handles:
- API communication with the backend
- Token storage and management
- User session management
- Error handling and retry logic

## Accessibility

The component includes proper accessibility features:
- **Screen Reader Support**: All inputs have proper labels
- **Keyboard Navigation**: Proper tab order and keyboard handling
- **Focus Management**: Clear focus indicators and logical flow
- **Error Announcements**: Error messages are properly associated with inputs

## Testing

The component includes comprehensive tests covering:
- Rendering and UI elements
- Form validation scenarios
- API integration and error handling
- User interactions and navigation
- Accessibility features

Run tests with:
```bash
npm test SignupScreen.test.tsx
```

## Related Components

- **LoginScreen**: Companion login component with similar interface
- **AuthService**: Handles authentication logic and API calls
- **Navigation**: Integrates with React Navigation for screen transitions

## Backend Integration

The component expects the backend to provide:
- `POST /api/v1/auth/signup` endpoint
- Proper error responses (409 for existing email, etc.)
- JWT token response on successful signup

See the authentication design document for full API specification.