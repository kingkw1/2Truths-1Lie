# User Authentication - MVP Design

## Current Implementation Status
**✅ FULLY IMPLEMENTED**: The project has complete user authentication infrastructure including backend services, mobile auth client, JWT token management, LoginScreen, SignupScreen, AuthNavigator, Redux integration, and comprehensive testing. This documentation now serves as a reference for the completed implementation.

## Architecture

The system uses a token-based authentication architecture with Railway backend deployment. The mobile client uses React Native with AsyncStorage for token storage and includes guest user support that seamlessly transitions to authenticated users.

## Data Models

### User (Backend - Implemented ✅)

- `id`: INTEGER (Primary Key, Auto-increment)
- `email`: TEXT (Unique, Indexed, NOT NULL) 
- `password_hash`: TEXT (Hashed using bcrypt, NOT NULL)
- `name`: TEXT (Optional display name)
- `created_at`: TIMESTAMP (Default: CURRENT_TIMESTAMP)
- `updated_at`: TIMESTAMP (Default: CURRENT_TIMESTAMP)
- `is_active`: BOOLEAN (Default: TRUE)
- `last_login`: TIMESTAMP (Optional)

### AuthUser (Mobile - Implemented ✅)

- `id`: string
- `name`: string
- `email`: string (optional)
- `avatar`: string (optional)
- `createdAt`: string

## API Endpoints (Implemented ✅)

### 1. User Registration

- **Endpoint**: `POST /api/v1/auth/register` (✅ Implemented)
- **Request Body**: `{ "email": "user@example.com", "password": "securepassword123", "name": "User Name" }`
- **Success Response (200 OK)**: `{ "access_token": "your.jwt.token", "refresh_token": "refresh.token", "token_type": "bearer", "expires_in": 1800, "permissions": [...], "user": {...} }`
- **Error Response (409 Conflict)**: `{ "detail": "Email already registered" }`

### 2. User Login

- **Endpoint**: `POST /api/v1/auth/login` (✅ Implemented)
- **Request Body**: `{ "email": "user@example.com", "password": "securepassword123" }`
- **Success Response (200 OK)**: `{ "access_token": "your.jwt.token", "refresh_token": "refresh.token", "token_type": "bearer", "expires_in": 1800, "permissions": [...], "user": {...} }`
- **Error Response (401 Unauthorized)**: `{ "detail": "Invalid email or password" }`

### 3. Guest User Creation

- **Endpoint**: `POST /api/v1/auth/guest` (✅ Implemented)
- **Success Response (200 OK)**: `{ "access_token": "guest.jwt.token", "refresh_token": "refresh.token", "token_type": "bearer", "expires_in": 1800 }`

## UI Components (Implemented ✅)

### 1. LoginScreen.tsx ✅
- Email/password input fields with validation
- "Sign In" button with loading states
- "Don't have an account? Sign up" navigation link
- Error message display with toast notifications
- Form validation with useFormValidation hook

### 2. SignupScreen.tsx ✅
- Email/password/name input fields with validation
- Password confirmation field
- "Create Account" button with loading states
- "Already have an account? Sign in" navigation link
- Comprehensive client-side validation

### 3. AuthNavigator.tsx ✅
- Stack navigator with LoginScreen and SignupScreen
- Integrated with RootNavigator for conditional rendering
- Proper navigation state management

### 4. Redux Integration ✅
- authSlice with comprehensive state management
- authMiddleware for token management
- useAuthRedux hook for components

### 2. SignupScreen.tsx  
- Email/password input fields with client-side validation
- Password confirmation field
- "Create Account" button with loading states
- "Already have an account? Sign in" navigation link
- Terms of service acceptance (optional)

### 3. Auth Navigation Integration
- Update existing navigation to include auth screens
- Conditional rendering: show auth screens for unauthenticated users
- Preserve deep links and navigation state across auth transitions

## Data Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    participant Client
    participant Backend

    Client->>Backend: POST /api/auth/signup (email, password)
    Backend->>Backend: Check if email is unique
    Backend->>Backend: Hash password with bcrypt
    Backend->>Backend: Create User in DB
    Backend->>Backend: Generate JWT
    Backend-->>Client: 201 Created (JWT)

    Client->>Client: Store JWT securely

    Client->>Backend: POST /api/auth/login (email, password)
    Backend->>Backend: Find user by email
    Backend->>Backend: Compare hashed password
    Backend->>Backend: Generate JWT
    Backend-->>Client: 200 OK (JWT)

    Client->>Client: Store JWT securely

    Client->>Backend: GET /api/protected-resource (Authorization: Bearer JWT)
    Backend->>Backend: Validate JWT
    Backend-->>Client: 200 OK (Protected Data)

    Client->>Client: User clicks logout
    Client->>Client: Delete stored JWT
````

## Security Considerations (Already Implemented)

- ✅ Passwords are hashed using bcrypt with proper salting
- ✅ JWTs are signed with secure server-side secret keys  
- ✅ Mobile client uses AsyncStorage for secure token storage
- ✅ Guest user support allows seamless transition to authenticated accounts
- ✅ Comprehensive error handling and rate limiting implemented
- ✅ Backend includes advanced JWT validation and refresh token support

## Integration Points

### AuthService Integration (Existing)
- Extend existing `AuthService.getInstance()` methods
- Integrate with existing guest user creation workflow
- Maintain compatibility with current token storage patterns

### Navigation Integration  
- Add auth screens to existing React Navigation structure
- Implement auth guards for protected screens
- Preserve current guest user experience as fallback

