# User Authentication - Design

## Architecture

- Use JWT tokens for stateless authentication  
- Backend APIs for login, password reset, profile fetch/update  
- Encrypted storage of user credentials  
- Middleware for authorization on protected endpoints

## Data Flow

1. Users submit login credentials → backend validates and returns token  
2. Clients store JWT locally and attach to API requests  
3. Server middleware verifies tokens on each request  
4. Profile APIs serve user-related data securely
