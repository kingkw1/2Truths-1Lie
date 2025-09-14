# 📊 Model Tests

This directory contains unit tests for data models, database schemas, and ORM functionality.

## 📋 Test Categories

### Data Models
- `test_merged_video_models.py` - Video merging data models and validation
- `test_merged_video_response.py` - API response models for merged video data

## 🚀 Running Tests

```bash
# Run all model tests
pytest backend/tests/models/

# Run specific model tests
pytest backend/tests/models/test_merged_video_models.py

# Run with coverage
pytest backend/tests/models/ --cov=backend/models
```

## 🎯 Focus Areas

- **Data Validation**: Model field validation and constraints
- **Serialization**: JSON serialization and deserialization
- **Database Operations**: ORM functionality and database interactions
- **Model Relationships**: Foreign key relationships and joins
- **Business Logic**: Model-level business rule enforcement

## 📝 Model Coverage

Currently covers:
- ✅ Merged video data structures
- ✅ Video response formatting
- 🔄 **Future**: User models, Challenge models, Authentication models

## ⚠️ Prerequisites

- Test database configured
- SQLAlchemy models imported correctly
- Database migrations applied