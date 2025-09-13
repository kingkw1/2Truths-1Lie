# User Authentication - MVP Design

## Current Implementation Status
**Existing Infrastructure**: The project has comprehensive backend authentication services, mobile auth client, and JWT token management already implemented. This design focuses on completing the missing UI screens and integration points.

## Architecture

The system uses a token-based authentication architecture with existing Railway backend integration. The mobile client uses React Native with Expo SecureStore for token storage and includes guest user support that seamlessly transitions to authenticated users.

## Data Models

### User (Backend - Already Implemented)

- `id`: UUID (Primary Key)
- `email`: String (Unique, Indexed) 
- `password`: String (Hashed using bcrypt)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

### AuthUser (Mobile - Already Implemented)

- `id`: string
- `name`: string
- `email`: string (optional)
- `avatar`: string (optional)
- `createdAt`: Date

## API Endpoints (Existing - Backend Complete)

### 1. User Signup

- **Endpoint**: `POST /api/v1/auth/signup` (✅ Implemented)
- **Request Body**: `{ "email": "user@example.com", "password": "securepassword123" }`
- **Success Response (201 Created)**: `{ "access_token": "your.jwt.token", "refresh_token": "refresh.token", "token_type": "bearer", "expires_in": 3600 }`
- **Error Response (409 Conflict)**: `{ "error": "Email already exists" }`

### 2. User Login

- **Endpoint**: `POST /api/v1/auth/login` (✅ Implemented)
- **Request Body**: `{ "email": "user@example.com", "password": "securepassword123" }`
- **Success Response (200 OK)**: `{ "access_token": "your.jwt.token", "refresh_token": "refresh.token", "token_type": "bearer", "expires_in": 3600 }`
- **Error Response (401 Unauthorized)**: `{ "error": "Invalid credentials" }`

## Missing UI Components (To Be Implemented)

### 1. LoginScreen.tsx
- Email/password input fields with validation
- "Sign In" button with loading states
- "Don't have an account? Sign up" navigation link
- Error message display for failed authentication

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

