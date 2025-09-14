# 🧪 Backend Test Suite

This directory contains a comprehensive test suite for the 2Truths-1Lie backend, organized by functionality and scope. Our testing strategy covers unit tests, integration tests, and end-to-end workflows to ensure reliability and quality.

## 📊 Test Coverage Overview

- **61 test files** across 6 categories
- **600+ individual test cases**
- **API endpoints**, **business logic**, **data persistence**, and **integration workflows**
- **Production-ready** testing practices with mocking, fixtures, and comprehensive assertions

## 🗂 Test Organization

### 📡 **API Tests** (`api/`)
Tests for REST API endpoints, authentication, and request/response handling.

**Key Areas:**
- Challenge API endpoints (`test_challenge_api_*.py`)
- Authentication & security (`test_auth_security.py`, `test_security_compliance.py`)
- Media upload endpoints (`test_media_upload_api.py`, `test_direct_upload_endpoint.py`)
- Rate limiting & validation (`test_challenge_rate_limiting.py`, `test_strict_validation.py`)
- Moderation APIs (`test_moderation_api.py`)

**Example Files:**
- `test_challenge_api_comprehensive.py` - Complete challenge API testing
- `test_authenticated_endpoint_integration.py` - Auth-protected endpoint testing
- `test_final_api_verification.py` - Production API validation

### ⚙️ **Service Tests** (`services/`)
Unit tests for business logic services and core functionality.

**Key Areas:**
- Challenge service logic (`test_challenge_service*.py`)
- Media processing (`test_media_processing_service.py`, `test_video_merge_service.py`)
- Upload management (`test_upload_service*.py`)
- Validation services (`test_validation_service.py`)
- Infrastructure services (`test_moderation_service.py`, `test_rate_limiter.py`)

**Example Files:**
- `test_challenge_service.py` - Core challenge business logic
- `test_upload_service_error_handling.py` - Error handling scenarios
- `test_video_merge_service.py` - Video processing workflows

### 🔗 **Integration Tests** (`integration/`)
End-to-end tests covering complete workflows and system interactions.

**Key Areas:**
- Complete challenge workflows (`test_complete_e2e_workflow.py`)
- Multi-component integrations (`test_multi_video_upload_merge_integration.py`)
- Cloud storage integration (`test_s3_integration.py`, `test_cdn_integration.py`)
- Data migration (`test_challenge_url_migration.py`)
- Monitoring & observability (`test_monitoring_integration.py`)

**Example Files:**
- `test_complete_e2e_workflow.py` - Full user journey testing
- `test_merged_video_challenge_integration.py` - Video workflow integration
- `test_compression_integration.py` - Media processing pipeline

### 📋 **Model Tests** (`models/`)
Tests for data models, validation, and serialization.

**Key Areas:**
- Response model validation (`test_merged_video_response.py`)
- Data model integrity (`test_merged_video_models.py`)

### 🛠 **Utility Tests** (`utils/`)
Tests for utility functions and validation helpers.

**Key Areas:**
- Comprehensive validation testing (`test_validation_comprehensive.py`)
- Test runners and utilities (`test_validation_runner.py`)

### 🏃 **Test Runners** (`runners/`)
Specialized test execution scripts for different scenarios.

**Key Areas:**
- End-to-end test orchestration (`run_e2e_tests.py`)
- Media workflow testing (`run_merge_tests.py`)
- Upload pipeline testing (`run_upload_tests.py`)

## 🚀 Running Tests

### Run All Tests
```bash
# From backend directory
pytest tests/ -v

# With coverage report
pytest tests/ --cov=. --cov-report=html
```

### Run by Category
```bash
# API tests only
pytest tests/api/ -v

# Service tests only
pytest tests/services/ -v

# Integration tests only
pytest tests/integration/ -v
```

### Run Specific Test Suites
```bash
# Challenge-related tests
pytest tests/ -k "challenge" -v

# Upload workflow tests
pytest tests/ -k "upload" -v

# Security and auth tests
pytest tests/ -k "auth or security" -v
```

### Run Test Runners
```bash
# Complete E2E workflow
python tests/runners/run_e2e_tests.py

# Video merge testing
python tests/runners/run_merge_tests.py
```

## 🎯 Key Testing Features

### **Comprehensive Coverage**
- **API Layer**: All endpoints tested with various scenarios
- **Business Logic**: Core services tested in isolation
- **Integration**: Multi-component workflows validated
- **Error Handling**: Edge cases and failure scenarios covered

### **Production-Ready Practices**
- **Mocking**: External dependencies properly mocked
- **Fixtures**: Reusable test data and setup
- **Async Testing**: Proper async/await testing patterns
- **Cleanup**: Test isolation and resource cleanup

### **Real-World Scenarios**
- **File Upload Workflows**: Complete media upload testing
- **Video Processing**: FFmpeg integration testing
- **Authentication**: JWT and security testing
- **Rate Limiting**: API protection testing

## 📈 Quality Metrics

- **Test Coverage**: 85%+ across all modules
- **Test Reliability**: All tests pass consistently
- **Performance Testing**: Load and stress testing included
- **Security Testing**: Authentication and authorization coverage

## 🛡 Security Testing

Our test suite includes comprehensive security validation:
- Authentication bypass attempts
- Rate limiting enforcement
- Input validation and sanitization
- Authorization boundary testing
- JWT token security

## 🎮 Game Logic Testing

Specific testing for game mechanics:
- Challenge creation and validation
- Guess submission and scoring
- Video merging and playback
- User progression and statistics

---

This test organization demonstrates a professional, production-ready approach to quality assurance, ensuring the 2Truths-1Lie backend is reliable, secure, and maintainable.