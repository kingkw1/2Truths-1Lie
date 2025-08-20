# User Authentication - Design

## Architecture

- Backend exposes secure REST API endpoints for login, logout, registration, password reset, and profile management  
- Use JWT tokens for authentication with refresh tokens for session continuation  
- Passwords stored hashed with a secure algorithm (e.g., bcrypt)  
- Email-based verification and password reset flows integrated with transactional email service (e.g., SendGrid)  
- Middleware verifies JWT on protected endpoints  
- Rate limiting and monitoring for authentication attempts to prevent brute force attacks

## Data Flow

1. User submits credentials or registration info → backend validates and returns JWT token  
2. Client attaches token on API requests → backend middleware authorizes access  
3. User requests password reset → system sends secure reset link via email  
4. User updates profile data → system validates and stores updates securely
