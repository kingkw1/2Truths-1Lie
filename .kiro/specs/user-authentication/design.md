# User Authentication - MVP Design

## Architecture

- Backend exposes REST API endpoints for user signup and login only  
- Users stored with unique email and securely hashed password (using bcrypt)  
- Login returns a signed JWT token with basic claims (user ID, expiration)  
- JWT token expected on client requests to verify authentication status  
- Logout involves clearing stored JWT on client (no backend logout required for MVP)  

## Data Flow

1. User submits signup request with email and password → backend checks uniqueness and creates user → returns JWT token  
2. User submits login request with email and password → backend validates credentials → returns JWT token  
3. Client stores JWT securely (local storage or secure storage in mobile)  
4. Client attaches JWT in header for protected API calls  
5. Client logs out by deleting stored JWT  
