# 🏃‍♂️ Test Runners

This directory contains test execution scripts and orchestration utilities for running complex test suites.

## 📋 Test Runners

### End-to-End Test Orchestration
- `run_e2e_tests.py` - Complete end-to-end test suite execution
- `run_upload_tests.py` - Upload workflow test orchestration
- `run_merge_tests.py` - Video merging test suite runner

## 🚀 Usage

### Running Individual Test Suites

```bash
# Run complete E2E test suite
python backend/tests/runners/run_e2e_tests.py

# Run upload-specific tests
python backend/tests/runners/run_upload_tests.py

# Run video merge tests
python backend/tests/runners/run_merge_tests.py
```

### Integration with CI/CD

```bash
# Run all test suites sequentially
for runner in backend/tests/runners/run_*.py; do
    python "$runner" || exit 1
done
```

## 🎯 Features

- **Orchestrated Execution**: Manages test dependencies and execution order
- **Environment Setup**: Configures test environments and cleanup
- **Reporting**: Aggregated test results and failure reporting
- **Resource Management**: Handles test resource allocation and cleanup
- **Parallel Execution**: Supports parallel test execution where safe

## 📊 Test Suite Coverage

### E2E Test Runner (`run_e2e_tests.py`)
- Complete user journey validation
- Cross-service integration testing
- Production environment simulation

### Upload Test Runner (`run_upload_tests.py`)
- File upload workflow validation
- Storage integration testing
- Error scenario simulation

### Merge Test Runner (`run_merge_tests.py`)
- Video processing pipeline testing
- Multi-video merge validation
- Performance benchmarking

## ⚙️ Configuration

Test runners support environment-specific configuration:

```bash
# Development environment
TEST_ENV=dev python backend/tests/runners/run_e2e_tests.py

# Staging environment
TEST_ENV=staging python backend/tests/runners/run_e2e_tests.py

# Production-like testing
TEST_ENV=prod python backend/tests/runners/run_e2e_tests.py
```

## ⚠️ Prerequisites

- All backend services running
- Test database configured
- External service credentials available
- Sufficient system resources for parallel execution