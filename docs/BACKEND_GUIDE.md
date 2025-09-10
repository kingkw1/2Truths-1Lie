# 🖥 Backend Development Guide

## Overview
The 2Truths-1Lie backend is a Python FastAPI server providing secure APIs for video upload, processing, challenge management, and AI services.

## 🚀 Quick Setup

### Prerequisites
- Python 3.12+
- pip package manager
- FFmpeg (for video processing)

### Getting Started
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

**Server runs at**: http://localhost:8001  
**API Docs**: http://localhost:8001/docs

## 📁 Project Structure
```
backend/
├── main.py              # FastAPI application entry point
├── models.py            # SQLAlchemy database models
├── config.py            # Configuration management
├── requirements.txt     # Python dependencies
├── services/            # Business logic services
│   ├── auth_service.py  # JWT authentication
│   ├── media_service.py # Video upload/processing
│   └── challenge_service.py # Challenge management
├── routes/              # API route handlers
│   ├── auth.py         # Authentication endpoints
│   ├── media.py        # Media upload endpoints
│   └── challenges.py   # Challenge CRUD endpoints
└── tests/              # Test suite
```

## 🏗 Architecture

### Tech Stack
- **FastAPI** - High-performance async web framework
- **SQLAlchemy** - Database ORM with migrations
- **SQLite/PostgreSQL** - Database (SQLite for dev, PostgreSQL for prod)
- **JWT** - Stateless authentication
- **AWS S3** - Media storage with CDN
- **FFmpeg** - Video processing and merging
- **Pydantic** - Data validation and serialization

### Key Features
- 🎥 **Video Processing**: Server-side video merging with segment metadata
- 📁 **Chunked Uploads**: Resumable uploads for large video files
- 🔒 **Security**: JWT auth, rate limiting, input validation
- 📊 **Analytics**: Challenge statistics and user engagement
- 🌐 **CDN Integration**: Global content delivery with signed URLs
- 🔍 **Content Moderation**: Automated content filtering

## 🛠 API Endpoints

### Authentication
```
POST /api/v1/auth/login    # User login
POST /api/v1/auth/register # User registration
POST /api/v1/auth/refresh  # Token refresh
```

### Media Upload
```
POST /api/v1/media/upload/start    # Start chunked upload
POST /api/v1/media/upload/chunk    # Upload file chunk
POST /api/v1/media/upload/complete # Complete upload
GET  /api/v1/media/{file_id}       # Get media info
```

### Challenge Management
```
POST /api/v1/challenges           # Create challenge
GET  /api/v1/challenges          # List challenges
GET  /api/v1/challenges/{id}     # Get challenge details
POST /api/v1/challenges/{id}/guess # Submit guess
```

### Video Processing
```
POST /api/v1/merged-video/create  # Create merged video
GET  /api/v1/merged-video/{id}    # Get merged video info
```

## 🎥 Video Processing Pipeline

### 1. Individual Video Upload
```python
# Client uploads 3 separate statement videos
POST /api/v1/media/upload/start
POST /api/v1/media/upload/chunk (multiple)
POST /api/v1/media/upload/complete
```

### 2. Server-Side Video Merging
```python
# Backend merges videos with segment metadata
POST /api/v1/merged-video/create
{
  "video_files": ["file1.mp4", "file2.mp4", "file3.mp4"],
  "merge_config": {"transition_duration": 0.5}
}
```

### 3. Segment Metadata Generation
```json
{
  "merged_video_url": "https://cdn.example.com/merged.mp4",
  "segments": [
    {"start_time": 0.0, "end_time": 10.5, "statement_index": 0},
    {"start_time": 11.0, "end_time": 23.0, "statement_index": 1},
    {"start_time": 23.5, "end_time": 32.0, "statement_index": 2}
  ]
}
```

## 🔒 Security

### Authentication
- **JWT Tokens**: Stateless authentication with configurable expiry
- **Role-based Access**: User permissions and admin controls
- **Token Refresh**: Secure token renewal mechanism

### Input Validation
- **Pydantic Models**: Automatic request/response validation
- **File Type Checking**: MIME type validation for uploads
- **Content-Length Limits**: Prevent oversized uploads
- **SQL Injection Protection**: Parameterized queries only

### Rate Limiting
- **Upload Limits**: Prevent abuse of upload endpoints
- **API Rate Limits**: Per-user request throttling
- **Challenge Creation**: Limits on challenge creation frequency

## 🧪 Testing

### Running Tests
```bash
# Run all tests
python -m pytest

# Run with coverage
python -m pytest --cov=. --cov-report=html

# Run specific test category
python -m pytest tests/test_media.py
```

### Test Categories
1. **Unit Tests**: Service and model testing
2. **Integration Tests**: API endpoint testing
3. **E2E Tests**: Complete workflow testing
4. **Performance Tests**: Load and stress testing

## 🚀 Deployment

### Development
```bash
python run.py  # Development server with auto-reload
```

### Production
```bash
# Using Gunicorn
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker

# Using Docker
docker build -t 2truths-backend .
docker run -p 8001:8001 2truths-backend
```

### Environment Variables
```bash
DATABASE_URL=postgresql://user:pass@host:port/db
S3_BUCKET_NAME=your-bucket
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
JWT_SECRET_KEY=your-jwt-secret
```

## 📊 Monitoring

### Health Checks
```
GET /api/v1/health           # Basic health check
GET /api/v1/health/database  # Database connectivity
GET /api/v1/health/s3        # S3 connectivity
```

### Logging
- **Structured Logging**: JSON format with correlation IDs
- **Error Tracking**: Comprehensive error reporting
- **Performance Metrics**: Request timing and throughput

### Analytics
- **Challenge Statistics**: Creation, completion rates
- **User Engagement**: Active users, session duration
- **Performance Metrics**: API response times, error rates

## 🔧 Development Guidelines

### Code Style
- Follow PEP 8 style guidelines
- Use type hints for all functions
- Implement proper error handling
- Write comprehensive docstrings

### Database Management
```bash
# Create migration
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

### Adding New Endpoints
1. Define Pydantic models for request/response
2. Implement service layer logic
3. Create route handler with proper validation
4. Add comprehensive tests
5. Update API documentation

## 🐛 Troubleshooting

### Common Issues
1. **Database Connection**: Check DATABASE_URL environment variable
2. **S3 Upload Errors**: Verify AWS credentials and bucket permissions
3. **Video Processing**: Ensure FFmpeg is installed and accessible
4. **Authentication**: Check JWT_SECRET_KEY configuration

### Debug Mode
```bash
# Enable debug logging
export LOG_LEVEL=DEBUG
python run.py
```

## 🔗 Related Documentation
- [API Reference](api.md)
- [Mobile Integration](MOBILE_GUIDE.md)
- [Testing Guide](TESTING_GUIDE.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)
