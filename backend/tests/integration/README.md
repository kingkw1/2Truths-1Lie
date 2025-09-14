# 🔗 Integration Tests

This directory contains end-to-end integration tests that verify complete workflows across multiple system components.

## 📋 Test Categories

### Media Processing Pipeline
- `test_media_integration.py` - Complete media upload and processing flow
- `test_upload_*.py` - File upload integration with storage systems
- `test_compression_*.py` - Video compression and optimization pipeline
- `test_individual_video_cleanup.py` - Cleanup processes for failed uploads

### Video Merging & Processing
- `test_merge_integration.py` - Video merging service integration
- `test_multi_video_upload_merge_integration.py` - Multiple video handling
- `test_merged_video_challenge_integration.py` - Complete challenge creation with merged videos
- `test_challenge_creation_merged_video.py` - End-to-end challenge workflow

### Cloud Services Integration
- `test_s3_*.py` - AWS S3 storage integration and cleanup
- `test_cdn_*.py` - CDN distribution and caching tests
- `test_cloud_storage_integration.py` - Cloud storage provider tests

### Challenge Workflows
- `test_challenge_video_integration.py` - Challenge creation with video assets
- `test_challenge_url_migration.py` - URL migration and compatibility
- `test_validation_integration.py` - Input validation across services

### System Monitoring
- `test_monitoring_*.py` - System health and performance monitoring
- `test_moderation_edge_cases.py` - Content moderation system integration

### Complete Workflows
- `test_complete_*.py` - Full end-to-end user journey tests
- `test_end_to_end_integration.py` - Complete application workflow validation

## 🚀 Running Tests

```bash
# Run all integration tests
pytest backend/tests/integration/

# Run specific workflow tests
pytest backend/tests/integration/test_complete_e2e_workflow.py

# Run with detailed output
pytest backend/tests/integration/ -v -s

# Run integration tests with coverage
pytest backend/tests/integration/ --cov=backend --cov-report=html
```

## 🎯 Focus Areas

- **Cross-Service Communication**: Ensuring services work together correctly
- **Data Flow**: Verifying data integrity through complete pipelines
- **Error Recovery**: Testing failure scenarios and recovery mechanisms
- **Performance**: Integration-level performance and resource usage
- **External Dependencies**: Third-party service integration (AWS, CDN)

## ⚠️ Prerequisites

- AWS credentials configured for S3 testing
- Test database available
- All services running (backend, media processing)
- Network connectivity for external service tests