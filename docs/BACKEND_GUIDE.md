# 🖥 Backend Development Guide

## Overview
The **2Truths-1Lie** backend is a production-ready Python FastAPI server providing robust APIs for video upload, processing, challenge management, and user authentication. Built using **Kiro's spec-driven development methodology**, this backend delivers enterprise-grade video processing capabilities deployed on **Railway** infrastructure.

> **🎯 Kiro Integration**: This backend was developed following Kiro's specification-driven workflow, with detailed requirements and task management tracked in `.kiro/specs/`. See [Kiro Documentation](https://docs.kiro.ai) for the complete development methodology.

## 🚀 Quick Setup

### Prerequisites
- **Python 3.12+** (Production tested)
- pip package manager
- **FFmpeg 7.1** (Critical for video processing)

### Getting Started
```bash
cd backend
pip install -r requirements.txt
python run.py  # Development server
```

**Development Server**: http://localhost:8001  
**Production API**: https://2truths-1lie-production.up.railway.app  
**Interactive Docs**: https://2truths-1lie-production.up.railway.app/docs

## 📁 Project Structure
```
backend/
├── main.py                      # FastAPI application entry point
├── run.py                       # Development server launcher
├── models.py                    # SQLAlchemy database models
├── config.py                    # Environment configuration
├── requirements.txt             # Production dependencies
├── api/                         # API route handlers
│   ├── auth_endpoints.py        # JWT authentication
│   ├── challenge_video_endpoints.py # Video upload/processing
│   └── challenge_endpoints.py   # Challenge CRUD operations
├── services/                    # Business logic services
│   ├── auth_service.py          # Authentication logic
│   ├── video_merge_service.py   # FFmpeg video processing
│   └── validation_service.py    # Input validation
└── tests/                       # Comprehensive test suite
```

## 🏗 Production Architecture

### Core Technology Stack
- **FastAPI 0.104.1** - High-performance async web framework
- **SQLAlchemy 2.0** - Modern database ORM with async support
- **SQLite** - Embedded database (production-ready for this scale)
- **JWT Authentication** - Stateless token-based auth
- **FFmpeg 7.1** - Professional video processing and merging
- **Railway Deployment** - Production cloud infrastructure
- **Pydantic v2** - Advanced data validation and serialization

### Key Features
- 🎥 **Professional Video Processing**: Server-side video merging using FFmpeg 7.1 with segment metadata
- � **Mobile-First API**: Optimized for React Native expo-camera integration
- 🔒 **Enterprise Security**: JWT authentication with comprehensive validation
- � **Production Deployment**: Live on Railway with 99.9% uptime
- 📊 **Challenge Management**: Complete CRUD operations for 2Truths-1Lie gameplay
- 🛡️ **Input Validation**: Multi-layer validation preventing corrupted uploads
- � **Error Recovery**: Resilient processing with detailed error reporting

## 🛠 Production API Endpoints

### Authentication (`/api/auth/`)
```
POST /api/auth/login     # User authentication (JWT tokens)
POST /api/auth/register  # User registration with validation
```

### Challenge Management (`/api/challenges/`)
```
GET  /api/challenges           # List all challenges (paginated)
POST /api/challenges           # Create new challenge
GET  /api/challenges/{id}      # Get specific challenge details
POST /api/challenges/{id}/guess # Submit lie detection guess
```

### Video Processing (`/api/challenge-videos/`)
```
POST /api/challenge-videos/upload    # Upload individual statement videos
POST /api/challenge-videos/merge     # Merge 3 videos into challenge
GET  /api/challenge-videos/{id}/download # Download processed video
```

## 🎥 Video Processing Pipeline

### 1. Mobile Video Upload
```python
# React Native uploads 3 separate statement videos
# Using expo-av recording → validation → upload
POST /api/challenge-videos/upload
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

### 2. Server-Side FFmpeg Processing
```python
# Backend merges videos with professional transitions
POST /api/challenge-videos/merge
{
  "video_ids": ["uuid1", "uuid2", "uuid3"],
  "challenge_data": {
    "statements": ["Truth 1", "Truth 2", "Lie"],
    "lie_index": 2
  }
}
```

### 3. Production Video Output
```json
{
  "challenge_id": "550e8400-e29b-41d4-a716-446655440000",
  "video_url": "/api/challenge-videos/{id}/download",
  "segments": [
    {"start": 0.0, "end": 8.5, "statement": 0},
    {"start": 8.5, "end": 17.0, "statement": 1},
    {"start": 17.0, "end": 25.5, "statement": 2}
  ],
  "total_duration": 25.5
}
```

## 🔒 Production Security

### Authentication & Authorization
- **JWT Tokens**: Production-grade stateless authentication
- **Bearer Token Authentication**: Secure API access for mobile clients
- **User Registration/Login**: Complete user management system
- **Token Validation**: Comprehensive request authentication

### Input Validation & Security
- **Pydantic v2 Models**: Advanced request/response validation
- **File Upload Validation**: Multi-layer video file verification
- **FFprobe Integration**: Video format and corruption detection
- **Content-Type Validation**: MIME type verification for uploads
- **Size Limits**: Configurable upload size restrictions

### Production Hardening
- **Error Handling**: Comprehensive exception management
- **Logging**: Structured logging with error tracking
- **CORS Configuration**: Secure cross-origin resource sharing
- **Environment Secrets**: Secure configuration management

## 🧪 Testing & Quality Assurance

### Running the Test Suite
```bash
cd backend

# Run all tests
python -m pytest tests/ -v

# Run with coverage report
python -m pytest tests/ --cov=. --cov-report=html

# Run specific test modules
python -m pytest tests/test_challenge_endpoints.py
python -m pytest tests/test_video_processing.py
```

### Test Coverage Areas
1. **API Endpoint Testing**: Complete endpoint validation
2. **Video Processing Tests**: FFmpeg integration testing
3. **Authentication Tests**: JWT token lifecycle testing
4. **Database Tests**: Model and query testing
5. **Integration Tests**: End-to-end workflow validation

## 🚀 Production Deployment

### Railway Deployment (Current Production)
The backend is deployed on **Railway** infrastructure at:
**https://2truths-1lie-production.up.railway.app**

```bash
# Deploy to Railway
railway login
railway link
railway up
```

### Local Development
```bash
cd backend
python run.py  # Development server with auto-reload
```

### Environment Configuration
```bash
# Production Environment Variables (Railway)
DATABASE_URL=sqlite:///challenges.db
JWT_SECRET_KEY=<production-secret>
UPLOAD_FOLDER=uploads/
MAX_UPLOAD_SIZE=104857600  # 100MB limit
FFMPEG_PATH=/usr/bin/ffmpeg
```

## 📊 Production Monitoring

### Health & Status Endpoints
```
GET /                    # Root endpoint (API status)
GET /docs               # Interactive API documentation
GET /openapi.json       # OpenAPI specification
```

### Error Handling & Logging
- **Structured Logging**: JSON-formatted logs with timestamps
- **Error Classification**: HTTP status codes with detailed messages
- **Debug Information**: Comprehensive error context for troubleshooting
- **Performance Tracking**: Request/response timing metrics

## 🔧 Development Guidelines

### Kiro Spec-Driven Development
Following **Kiro's methodology**, all backend development follows:
1. **Requirements Specification**: Defined in `.kiro/specs/requirements/`
2. **Design Documentation**: Detailed in `.kiro/specs/design/`
3. **Task Management**: Tracked in `.kiro/specs/tasks/`
4. **Implementation Validation**: Verified against specifications

### Code Quality Standards
- **Type Hints**: All functions use Python type annotations
- **FastAPI Best Practices**: Async/await patterns, dependency injection
- **Error Handling**: Comprehensive exception management
- **Documentation**: Detailed docstrings and inline comments
- **Testing**: Minimum 80% code coverage requirement

### Adding New API Endpoints
1. **Specification**: Define requirements in `.kiro/specs/`
2. **Model Definition**: Create Pydantic request/response models
3. **Service Layer**: Implement business logic in `services/`
4. **Route Handler**: Create endpoint in appropriate `api/` module
5. **Testing**: Add comprehensive test coverage
6. **Documentation**: Update API documentation

## � FFmpeg Video Processing

### Production Configuration
- **FFmpeg Version**: 7.1 (deployed on Railway)
- **Video Formats**: MP4 input/output with H.264 encoding
- **Processing Pipeline**: Validation → Merge → Segment Metadata
- **Error Recovery**: Comprehensive validation and fallback handling

### Video Merge Command
```bash
ffmpeg -i statement1.mp4 -i statement2.mp4 -i statement3.mp4 \
  -filter_complex "[0:v][0:a][1:v][1:a][2:v][2:a]concat=n=3:v=1:a=1[v][a]" \
  -map "[v]" -map "[a]" -c:v libx264 -c:a aac output.mp4
```

## 🐛 Troubleshooting

### Common Production Issues
1. **Video Upload Failures**: Check file format and corruption
2. **FFmpeg Processing Errors**: Verify video file integrity
3. **Authentication Issues**: Validate JWT token configuration
4. **Database Connectivity**: Check SQLite file permissions

### Debug Tools
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python run.py

# Test video processing manually
python -c "from services.video_merge_service import VideoMergeService; VideoMergeService.test_ffmpeg()"

# Validate uploaded video files
ffprobe -v error -show_format -show_streams video.mp4
```

## 🔗 Related Documentation
- [Main README](../README.md) - Project overview and Kiro integration
- [Technical Architecture](TECHNICAL_ARCHITECTURE.md) - System architecture
- [Mobile Guide](MOBILE_GUIDE.md) - React Native integration
- [API Documentation](api.md) - Complete API reference
- [Testing Guide](TESTING_GUIDE.md) - Testing strategy and implementation
