# Navigation Integration

This directory contains the React Navigation setup for the mobile app, integrating authentication screens with the existing app structure.

## Structure

### RootNavigator
- Main navigation controller that manages authenticated vs unauthenticated states
- Automatically shows auth screens for guest users
- Shows main app screens for authenticated users with email

### AuthNavigator
- Handles navigation between Login and Signup screens
- Provides seamless transitions between authentication flows
- Integrates with existing LoginScreen and SignupScreen components

### MainNavigator
- Manages navigation within the main app (Home, Game, Create)
- Includes user info display and logout functionality
- Preserves existing game and challenge creation flows

## Key Features

1. **Automatic State Management**: The app automatically detects authentication state and shows appropriate screens
2. **Guest User Support**: Maintains existing guest user functionality while prompting for authentication
3. **Seamless Integration**: Preserves all existing screen functionality and user flows
4. **TypeScript Support**: Full type safety with proper navigation parameter lists

## Usage

The navigation is automatically initialized in `App.tsx`. No additional setup is required.

### Authentication Flow
1. App starts and initializes auth service
2. If user has email (authenticated), shows MainNavigator
3. If user is guest (no email), shows AuthNavigator
4. After successful login/signup, automatically transitions to MainNavigator

### Navigation Between Screens
- Login ↔ Signup: Handled by AuthNavigator
- Home → Game/Create: Handled by MainNavigator
- Back navigation: Proper stack navigation with back buttons

## Integration Points

- **AuthService**: Uses existing authentication service for state management
- **Existing Screens**: Integrates LoginScreen, SignupScreen, GameScreen, ChallengeCreationScreen
- **Guest Users**: Maintains guest user functionality as fallback
- **Error Handling**: Preserves existing error boundaries and error handling