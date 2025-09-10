# 🔧 Development Tools

This folder contains Python utilities and tools for development, testing, and debugging.

## Available Tools

### Authentication & Testing
- **`generate_test_token.py`** - Generate JWT tokens for API testing
  ```bash
  python tools/generate_test_token.py
  ```

### Database & Persistence Testing
- **`test_challenge_persistence.py`** - Test challenge database persistence
  ```bash
  python tools/test_challenge_persistence.py
  ```

### Integration Testing
- **`test_integration_runner.py`** - Comprehensive integration test runner
  ```bash
  python tools/test_integration_runner.py
  ```

## Usage

Run tools from the project root directory:

```bash
# From project root
python tools/tool-name.py
```

## Requirements

- **Python 3.12+** with backend dependencies installed
- **Backend server** running (for most tools)
- **Proper environment** variables configured

## Tool Dependencies

Most tools require the backend environment:

```bash
cd backend
pip install -r requirements.txt
```

Some tools may need additional setup - check individual tool headers for specific requirements.

## Development Workflow

These tools are designed to support the development workflow:

1. **`generate_test_token.py`** - Create auth tokens for API testing
2. **`test_challenge_persistence.py`** - Verify database operations
3. **`test_integration_runner.py`** - Run comprehensive integration tests

Use these tools for debugging, testing, and validating backend functionality during development.
