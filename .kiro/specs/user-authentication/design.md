# User Authentication - MVP Design

## Architecture

The system will use a token-based authentication architecture. The backend, built as a REST API, will handle user management and JWT issuance. The mobile client will be responsible for storing the JWT securely and including it in requests to protected endpoints.

## Data Models

### User

- `id`: UUID (Primary Key)
- `email`: String (Unique, Indexed)
- `password`: String (Hashed using bcrypt)
- `createdAt`: Timestamp
- `updatedAt`: Timestamp

## API Endpoints

### 1. User Signup

- **Endpoint**: `POST /api/auth/signup`
- **Request Body**: `{ "email": "user@example.com", "password": "securepassword123" }`
- **Success Response (201 Created)**: `{ "token": "your.jwt.token" }`
- **Error Response (409 Conflict)**: `{ "error": "Email already exists" }`

### 2. User Login

- **Endpoint**: `POST /api/auth/login`
- **Request Body**: `{ "email": "user@example.com", "password": "securepassword123" }`
- **Success Response (200 OK)**: `{ "token": "your.jwt.token" }`
- **Error Response (401 Unauthorized)**: `{ "error": "Invalid credentials" }`

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

## Security Considerations

  - Passwords must be hashed using a strong, salted algorithm like **bcrypt**. Plain text passwords will never be stored.
  - JWTs will be signed with a secure, server-side-only secret key.
  - The client must use the platform's secure storage mechanism for the JWT to prevent cross-site scripting (XSS) or other local attacks.

