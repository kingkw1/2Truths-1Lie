# Authentication Guards and Navigation

This document explains the authentication guard system implemented for the mobile app.

## Overview

The auth guard system provides conditional rendering and navigation protection based on user authentication state. It supports both authenticated users and guest users, with seamless transitions between states.

## Components

### 1. useAuth Hook (`src/hooks/useAuth.ts`)

A custom React hook that provides authentication state and actions:

```typescript
const { 
  user, 
  isAuthenticated, 
  isGuest, 
  isLoading,
  login, 
  signup, 
  logout,
  refreshAuth 
} = useAuth();
```

**Features:**
- Automatic initialization and state management
- Loading states during auth operations
- Error handling for auth failures
- Seamless integration with authService

### 2. AuthGuard Components (`src/components/AuthGuard.tsx`)

#### AuthGuard
General purpose guard with flexible options:

```typescript
<AuthGuard 
  requireAuth={false}
  showGuestPrompt={true}
  onAuthPrompt={() => navigateToAuth()}
>
  <YourContent />
</AuthGuard>
```

#### RequireAuth
Strict authentication requirement:

```typescript
<RequireAuth onAuthRequired={() => navigateToAuth()}>
  <ProtectedContent />
</RequireAuth>
```

#### GuestOnly / AuthenticatedOnly
Show content only for specific user types:

```typescript
<GuestOnly>
  <SignUpPrompt />
</GuestOnly>

<AuthenticatedOnly>
  <UserProfile />
</AuthenticatedOnly>
```

#### ConditionalAuthContent
Render different content based on auth state:

```typescript
<ConditionalAuthContent
  guest={<GuestWelcome />}
  authenticated={<UserDashboard />}
  loading={<LoadingSpinner />}
/>
```

### 3. ProtectedScreen Components (`src/components/ProtectedScreen.tsx`)

#### ProtectedScreen
Wrapper for entire screens:

```typescript
<ProtectedScreen 
  requireAuth={true}
  showGuestWarning={true}
  guestWarningMessage="Sign in to save progress"
>
  <YourScreen />
</ProtectedScreen>
```

#### AuthStatusBanner
Status banner for guest prompts:

```typescript
<AuthStatusBanner
  showForGuests={true}
  guestMessage="Sign in to save your progress"
  onAuthAction={() => navigateToAuth()}
/>
```

## Navigation Integration

### RootNavigator (`src/navigation/RootNavigator.tsx`)

The root navigator automatically switches between auth and main flows:

- **Unauthenticated users**: Shows AuthNavigator (login/signup screens)
- **Authenticated users**: Shows MainNavigator (main app screens)
- **Loading state**: Shows loading spinner during initialization

### AuthNavigator (`src/navigation/AuthNavigator.tsx`)

Handles navigation between login and signup screens with automatic state updates.

### MainNavigator (`src/navigation/MainNavigator.tsx`)

Enhanced with conditional rendering for guest vs authenticated users:

- Guest users see "Sign in to save progress" prompts
- Authenticated users see their email and logout option
- Different messaging for guest mode limitations

## Screen Integration

### GameScreen
- Shows auth status banner for guests
- Prompts guests to sign in to save progress
- Maintains full functionality for both user types

### ChallengeCreationScreen
- Shows auth status banner for guests
- Warns guests that challenges won't be saved to their account
- Maintains full functionality for both user types

## Usage Patterns

### 1. Basic Auth Guard
```typescript
import { AuthGuard } from '../components/AuthGuard';

<AuthGuard showGuestPrompt={true} onAuthPrompt={handleAuthPrompt}>
  <GameContent />
</AuthGuard>
```

### 2. Require Authentication
```typescript
import { RequireAuth } from '../components/AuthGuard';

<RequireAuth onAuthRequired={handleAuthRequired}>
  <AdminPanel />
</RequireAuth>
```

### 3. Conditional Content
```typescript
import { ConditionalAuthContent } from '../components/AuthGuard';

<ConditionalAuthContent
  guest={<GuestFeatures />}
  authenticated={<PremiumFeatures />}
/>
```

### 4. Screen-Level Protection
```typescript
import { ProtectedScreen } from '../components/ProtectedScreen';

<ProtectedScreen showGuestWarning={true}>
  <YourScreenContent />
</ProtectedScreen>
```

### 5. Status Banners
```typescript
import { AuthStatusBanner } from '../components/ProtectedScreen';

<AuthStatusBanner
  showForGuests={true}
  guestMessage="Custom message for guests"
  onAuthAction={handleAuthAction}
/>
```

## Best Practices

1. **Use appropriate guards**: Choose the right guard component for your use case
2. **Provide clear messaging**: Always explain why authentication is needed
3. **Maintain functionality**: Keep core features available for guests when possible
4. **Handle loading states**: Show appropriate loading indicators during auth operations
5. **Test all states**: Test authenticated, guest, and loading states
6. **Graceful degradation**: Provide fallbacks for auth failures

## Testing

The auth guard system includes comprehensive tests:

- `src/hooks/__tests__/useAuth.test.ts`: Tests for the useAuth hook
- `src/navigation/__tests__/AuthGuards.test.tsx`: Tests for auth guard components

Run tests with:
```bash
npm test -- src/hooks/__tests__/useAuth.test.ts
```

## Integration with Existing Features

The auth guard system integrates seamlessly with:

- **Redux store**: Uses existing auth state management
- **Navigation**: Works with React Navigation stack
- **AuthService**: Leverages existing authentication service
- **Guest users**: Maintains existing guest user functionality
- **Token management**: Uses existing JWT token handling

## Migration Notes

When adding auth guards to existing screens:

1. Import the appropriate guard components
2. Wrap existing content with guards
3. Add auth status banners where appropriate
4. Test both authenticated and guest user flows
5. Update navigation patterns if needed

The system is designed to be non-breaking and can be gradually adopted across the app.