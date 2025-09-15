# 🔧 Development Tools

This directory contains Python utilities and scripts for development, testing, debugging, and maintenance tasks.

## 📋 Quick Reference

| Tool | Purpose | When to Use |
|------|---------|-------------|
| `reset_rate_limits.py` | **Reset API rate limits** | When testing rate-limited endpoints |
| `auth/generate_test_token.py` | **Generate JWT tokens** | For API testing and authentication |
| `testing/validate.py` | **Validate backend services** | Before deployment or after changes |
| `migration/migrate_challenge_urls.py` | **Migrate legacy URLs** | During database schema updates |
| `monitoring/export_monitoring_metrics.py` | **Export system metrics** | For monitoring system setup |
| `debugging/memory_leak_diagnostic.py` | **Memory diagnostics & cleanup** | Production memory issues on Railway |
| `aws/list_aws_challenges.py` | **S3 challenge browser** | Analyze S3 storage and challenges |

## 🔐 Authentication & Auth (`auth/`)
Tools for authentication, JWT tokens, and user management.

- **`generate_test_token.py`** - Generate JWT tokens for API testing and development
  ```bash
  python tools/auth/generate_test_token.py
  ```
- **`debug_jwt.py`** - Debug and inspect JWT tokens from guest sessions
  ```bash
  python tools/auth/debug_jwt.py
  ```

## 🧪 Testing & Validation (`testing/`)
Tools for testing, validation, and quality assurance.

- **`validate.py`** - Comprehensive backend service validation and health checks
  ```bash
  python tools/testing/validate.py
  ```
- **`test_integration_runner.py`** - Run complete integration test suite with reporting
  ```bash
  python tools/testing/test_integration_runner.py
  ```
- **`test_challenge_persistence.py`** - Test challenge database persistence and CRUD operations
  ```bash
  python tools/testing/test_challenge_persistence.py
  ```
- **`clean_test_challenges.py`** - Remove test challenges from SQLite database
  ```bash
  python tools/testing/clean_test_challenges.py
  ```
- **`clean_test_data.py`** - Remove test challenges from JSON storage files
  ```bash
  python tools/testing/clean_test_data.py
  ```
- **`test_s3_curl.sh`** - Test S3 API endpoints using curl commands
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

- **`export_monitoring_metrics.py`** - Export monitoring metrics to external monitoring systems
  ```bash
  python tools/monitoring/export_monitoring_metrics.py
  ```
- **`security_validation_verification.py`** - Comprehensive security validation and compliance checks
  ```bash
  python tools/monitoring/security_validation_verification.py
  ```

### 📝 Examples & Documentation (`examples/`)
Example implementations and sample client code.

- **`example_client.py`** - Example client implementation for chunked upload API
  ```bash
  python tools/examples/example_client.py
  ```

## 🚀 Utility Scripts

### Root Level Tools
- **`reset_rate_limits.py`** - Reset API rate limiting counters for testing and development
  ```bash
  python tools/reset_rate_limits.py
  ```

## 💻 Usage Patterns

Run tools from the project root directory:

```bash
# Quick development tasks
python tools/reset_rate_limits.py              # Reset API limits
python tools/auth/generate_test_token.py       # Generate auth tokens

# Testing and validation
python tools/testing/validate.py               # Validate backend health
python tools/testing/test_integration_runner.py # Run integration tests

# Data management
python tools/migration/migrate_challenge_urls.py # Migrate URLs
python tools/testing/clean_test_data.py         # Clean test data

# Monitoring and ops
python tools/monitoring/export_monitoring_metrics.py    # Export metrics
python tools/monitoring/security_validation_verification.py # Security checks

# Example implementations
python tools/examples/example_client.py         # API client example
```

## 📋 Prerequisites

- **Python 3.12+** with backend dependencies installed
- **Backend server** running (for most tools)
- **Environment variables** properly configured
- **Database access** (for persistence and migration tools)

### Quick Setup
```bash
cd backend
pip install -r requirements.txt
```

## 🎯 Development Workflow

### Daily Development
1. **`reset_rate_limits.py`** - Clear rate limits before testing
2. **`generate_test_token.py`** - Create tokens for API testing
3. **`validate.py`** - Ensure backend health after changes

### Testing Cycle  
1. **`test_integration_runner.py`** - Run comprehensive tests
2. **`clean_test_data.py`** - Clean up after testing
3. **`test_challenge_persistence.py`** - Verify data integrity

### Deployment Preparation
1. **`security_validation_verification.py`** - Security compliance check
2. **`migrate_challenge_urls.py`** - Apply data migrations
3. **`export_monitoring_metrics.py`** - Set up monitoring

## 🐛 Debugging & AWS Tools (`debugging/`, `aws/`)
Production debugging and AWS management utilities.

### Debugging Tools
- **`debugging/memory_leak_diagnostic.py`** - Production memory analysis and cleanup
  ```bash
  python tools/debugging/memory_leak_diagnostic.py
  ```
  - Analyzes memory usage and cleans up temporary files
  - Identifies memory leaks and provides cleanup recommendations
  - Useful for Railway production environment monitoring

### AWS Tools  
- **`aws/list_aws_challenges.py`** - S3 bucket challenge browser
  ```bash
  python tools/aws/list_aws_challenges.py
  ```
  - Lists all challenges stored in the S3 bucket
  - Provides storage usage analysis and metadata
  - Helps with AWS cost management and data auditing

## 🏗️ Organization Benefits

- **🔍 Easy Discovery**: Tools organized by function and purpose
- **📖 Clear Documentation**: Each tool has usage examples and purpose
- **🚀 Quick Access**: Table of common tools for instant reference
- **📊 Scalable Structure**: Easy to add new tools and categories
