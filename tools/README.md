# 🔧 Development Tools

This folder contains Python utilities and tools for development, testing, debugging, and maintenance, organized by category for better maintainability.

## Tool Categories

### 🔐 Authentication & Auth (`auth/`)
Tools for authentication, JWT tokens, and user management.

- **`generate_test_token.py`** - Generate JWT tokens for API testing
  ```bash
  python tools/auth/generate_test_token.py
  ```
- **`debug_jwt.py`** - Debug JWT tokens from guest sessions
  ```bash
  python tools/auth/debug_jwt.py
  ```

### 🧪 Testing & Validation (`testing/`)
Tools for testing, validation, and quality assurance.

- **`test_challenge_persistence.py`** - Test challenge database persistence
  ```bash
  python tools/testing/test_challenge_persistence.py
  ```
- **`test_integration_runner.py`** - Comprehensive integration test runner
  ```bash
  python tools/testing/test_integration_runner.py
  ```
- **`validate.py`** - Validation script for backend services
  ```bash
  python tools/testing/validate.py
  ```
- **`clean_test_challenges.py`** - Remove test challenges from SQLite database
  ```bash
  python tools/testing/clean_test_challenges.py
  ```
- **`clean_test_data.py`** - Remove test challenges from JSON storage
  ```bash
  python tools/testing/clean_test_data.py
  ```
- **`test_s3_curl.sh`** - Test S3 API endpoints using curl
  ```bash
  bash tools/testing/test_s3_curl.sh
  ```

### 🔄 Migration & Data Management (`migration/`)
Tools for data migration and database maintenance.

- **`migrate_challenge_urls.py`** - Migrate challenge URLs from legacy to persistent format
  ```bash
  python tools/migration/migrate_challenge_urls.py --dry-run
  ```

### 📊 Monitoring & Operations (`monitoring/`)
Tools for system monitoring, metrics, and security validation.

- **`export_monitoring_metrics.py`** - Export monitoring metrics to external systems
  ```bash
  python tools/monitoring/export_monitoring_metrics.py
  ```
- **`security_validation_verification.py`** - Comprehensive security validation checks
  ```bash
  python tools/monitoring/security_validation_verification.py
  ```

### 📝 Examples & Documentation (`examples/`)
Example implementations and sample client code.

- **`example_client.py`** - Example client for chunked upload API
  ```bash
  python tools/examples/example_client.py
  ```

## Usage

Run tools from the project root directory using the organized structure:

```bash
# Authentication tools
python tools/auth/generate_test_token.py
python tools/auth/debug_jwt.py

# Testing tools
python tools/testing/validate.py
python tools/testing/test_integration_runner.py

# Migration tools
python tools/migration/migrate_challenge_urls.py

# Monitoring tools
python tools/monitoring/export_monitoring_metrics.py

# Example code
python tools/examples/example_client.py
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

## Organization Benefits

This organized structure provides:
- **Clear categorization** by functionality
- **Easy navigation** for developers
- **Scalable organization** as tools are added
- **Industry standard** structure following major projects

## Development Workflow

These tools are designed to support the development workflow:

1. **`generate_test_token.py`** - Create auth tokens for API testing
2. **`test_challenge_persistence.py`** - Verify database operations
3. **`test_integration_runner.py`** - Run comprehensive integration tests

Use these tools for debugging, testing, and validating backend functionality during development.
