---
include: conditional
pattern: "src/api/**/*"
---

# API Standards

## General Principles
- All backend routes follow RESTful conventions using appropriate HTTP verbs:
  - `GET` for fetching data
  - `POST` for creating resources or executing actions
  - `PUT`/`PATCH` for updates
  - `DELETE` for removal

## URL Naming
- Use plural nouns for resource names: e.g., `/games`, `/users`, `/sessions`
- Nest URIs logically when accessing sub-resources: e.g., `/users/{userId}/games`

## Requests & Responses
- All responses use JSON format.
- Standardize response structure:
  

{
"success": true,
"data": {...},
"error": null
}

text
- On error, provide meaningful HTTP status codes (400, 401, 404, 500) and clear error messages.
- Validate all client inputs server-side; reject invalid or missing parameters with 400 status.

## Authentication & Authorization
- Use JWT tokens for user authentication, passed in `Authorization` headers.
- Protect sensitive routes; ensure only authorized users access or mutate data.
- Include middleware to verify token validity.

## Versioning & Deprecation
- Include API version in base route (e.g., `/api/v1/`).
- Deprecate older versions with clear communication.

## Example Endpoints
- `POST /api/v1/statements` - Submit a new set of 2 truths and a lie
- `GET /api/v1/games/{gameId}` - Retrieve game data and guesses
- `POST /api/v1/games/{gameId}/guess` - Submit a guess on a statement

---