# Auth Redux Integration

This document explains how the authentication system integrates with Redux for centralized state management.

## Overview

The auth system now uses Redux for centralized state management while maintaining backward compatibility with existing components. The integration provides:

- Centralized auth state management
- Automatic game session synchronization
- Middleware for handling auth side effects
- Type-safe hooks and selectors

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Components    │───▶│   useAuth Hook   │───▶│  AuthService    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Redux Store     │◀───│ useAuthRedux     │◀───│ Auth Slice      │
│ (Auth State)    │    │ Hook             │    │ (Actions)       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                                               │
         ▼                                               ▼
┌─────────────────┐                            ┌─────────────────┐
│ Auth Middleware │                            │ Async Thunks    │
│ (Side Effects)  │                            │ (API Calls)     │
└─────────────────┘                            └─────────────────┘
```

## Key Components

### 1. Auth Slice (`authSlice.ts`)

Manages authentication state with the following structure:

```typescript
interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  lastAuthAction: 'login' | 'signup' | 'logout' | 'init' | null;
  tokenValidated: boolean;
  permissions: string[];
}
```

**Async Actions:**
- `initializeAuth()` - Initialize auth state on app start
- `loginUser({ email, password })` - Login with credentials
- `signupUser({ email, password })` - Create new account
- `logoutUser()` - Logout current user
- `validateToken()` - Validate current auth token
- `refreshAuthToken()` - Refresh expired token
- `updateUserProfile(updates)` - Update user profile

### 2. Auth Middleware (`authMiddleware.ts`)

Handles authentication side effects:

- **Session Management**: Automatically starts/ends game sessions based on auth state
- **State Synchronization**: Keeps auth state in sync with game state
- **Cleanup**: Handles logout cleanup and token failures

**Triggered Actions:**
- `auth/login/fulfilled` → Start game session
- `auth/signup/fulfilled` → Start game session  
- `auth/logout/fulfilled` → End game session
- `auth/initialize/fulfilled` → Start session for authenticated users

### 3. useAuthRedux Hook (`useAuthRedux.ts`)

Provides Redux-integrated auth functionality:

```typescript
const {
  // State
  user, isAuthenticated, isGuest, isLoading, error, permissions,
  
  // Actions
  login, signup, logout, initialize, updateProfile,
  
  // Utilities
  hasPermission, isEmailValid, isPasswordValid
} = useAuthRedux();
```

### 4. useAuth Hook (Updated)

Maintains backward compatibility while using Redux internally:

```typescript
const {
  user, isAuthenticated, isGuest, isLoading, hasValidToken,
  login, signup, logout, refreshAuth, checkAuthStatus
} = useAuth();
```

### 5. AuthProvider Component (`AuthProvider.tsx`)

Initializes auth state when the app starts:

```tsx
<AuthProvider>
  <App />
</AuthProvider>
```

## Usage Examples

### Basic Authentication

```typescript
import { useAuth } from '../hooks/useAuth';

function LoginScreen() {
  const { login, isLoading, error } = useAuth();
  
  const handleLogin = async (email: string, password: string) => {
    try {
      await login(email, password);
      // User is now authenticated, game session started automatically
    } catch (err) {
      // Handle error
    }
  };
}
```

### Redux Integration

```typescript
import { useAuthRedux } from '../hooks/useAuthRedux';

function ProfileScreen() {
  const { user, updateProfile, hasPermission } = useAuthRedux();
  
  const canEdit = hasPermission('profile:edit');
  
  const handleUpdate = async (updates: Partial<AuthUser>) => {
    await updateProfile(updates);
  };
}
```

### Direct Redux Access

```typescript
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { loginUser, selectAuth } from '../store/slices/authSlice';

function CustomAuthComponent() {
  const dispatch = useAppDispatch();
  const authState = useAppSelector(selectAuth);
  
  const handleLogin = () => {
    dispatch(loginUser({ email, password }));
  };
}
```

## State Flow

### Login Flow
1. User calls `login(email, password)`
2. `loginUser` thunk dispatches `auth/login/pending`
3. AuthService.login() called with credentials
4. On success: `auth/login/fulfilled` dispatched
5. Auth middleware detects fulfilled action
6. Middleware starts game session with user ID
7. Components re-render with new auth state

### Logout Flow
1. User calls `logout()`
2. `logoutUser` thunk dispatches `auth/logout/pending`
3. AuthService.logout() clears tokens and creates guest user
4. On success: `auth/logout/fulfilled` dispatched
5. Auth middleware detects fulfilled action
6. Middleware ends current game session
7. Components re-render with guest state

## Migration Guide

### For Existing Components

No changes required! The existing `useAuth` hook continues to work exactly the same way.

### For New Components

You can choose between:

1. **useAuth** - Backward compatible, simpler API
2. **useAuthRedux** - Full Redux integration, more features
3. **Direct Redux** - Maximum control, requires more boilerplate

### Adding New Auth Features

1. Add async thunk to `authSlice.ts`
2. Add reducer case for the new action
3. Update middleware if side effects needed
4. Add to `useAuthRedux` hook if needed
5. Update tests

## Testing

### Unit Tests

```typescript
import { renderHook } from '@testing-library/react-native';
import { Provider } from 'react-redux';
import { useAuthRedux } from '../useAuthRedux';

// Test with Redux provider
const wrapper = ({ children }) => (
  <Provider store={testStore}>{children}</Provider>
);

const { result } = renderHook(() => useAuthRedux(), { wrapper });
```

### Integration Tests

```typescript
import { configureStore } from '@reduxjs/toolkit';
import authReducer, { loginUser } from '../authSlice';

const store = configureStore({
  reducer: { auth: authReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(authMiddleware),
});

await store.dispatch(loginUser({ email, password }));
```

## Best Practices

1. **Use useAuth for simple cases** - Maintains compatibility
2. **Use useAuthRedux for advanced features** - Access to full Redux state
3. **Handle loading states** - Always show loading indicators
4. **Handle errors gracefully** - Display user-friendly error messages
5. **Clear errors** - Call `clearError()` when appropriate
6. **Validate inputs** - Use built-in validation functions
7. **Check permissions** - Use `hasPermission()` for feature gating

## Troubleshooting

### Common Issues

1. **Auth state not updating**: Ensure AuthProvider wraps your app
2. **Middleware not working**: Check middleware is added to store
3. **TypeScript errors**: Ensure proper typing with RootState
4. **Tests failing**: Mock authService and use proper Redux setup

### Debug Tools

- Redux DevTools for state inspection
- Console logs in middleware (development only)
- Auth status logging in useAuth hook