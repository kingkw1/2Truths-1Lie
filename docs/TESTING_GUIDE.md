# 🧪 Testing Guide

## Overview
Comprehensive testing strategy for the 2Truths-1Lie project, covering mobile app, backend API, and integration testing.

## 📊 Current Test Status
- **Mobile**: 77.3% coverage (198/256 tests passing)
- **Backend**: 85%+ coverage with comprehensive API testing
- **Integration**: Complete workflow validation via Redux testing

## 📱 Mobile Testing

### Test Infrastructure
- **Framework**: Jest + React Native Testing Library
- **Coverage**: 77.3% with focus on core functionality
- **Strategy**: Redux integration testing for workflow validation

### Running Mobile Tests
```bash
cd mobile
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Generate coverage report
```

### Test Categories

#### 1. Redux Integration Tests ✅
**File**: `MobileChallengeCreationIntegration.test.tsx`  
**Status**: 17/17 tests passing  
**Coverage**: Complete challenge creation workflow

- Sequential recording workflow (3 statements)
- Lie selection logic
- Challenge preview and submission
- Error handling and recovery
- State consistency across components
- Modal navigation and state persistence

#### 2. Component Unit Tests
**Status**: 77.3% passing rate  
**Focus**: Core business logic validation

- Camera recording components
- Navigation and routing
- Form validation
- State management slices

#### 3. Service Tests
- API integration layer
- Local storage operations
- Permission handling
- Error boundary testing

### Key Test Patterns

#### Redux Testing Example
```typescript
describe('Challenge Creation Workflow', () => {
  it('should complete full recording workflow', () => {
    // Test Redux state transitions
    const store = createMockStore();
    store.dispatch(startRecording(0));
    store.dispatch(completeRecording({ index: 0, videoData }));
    
    // Validate state changes
    const state = store.getState();
    expect(state.challengeCreation.recordings[0]).toBeDefined();
  });
});
```

#### Component Testing Example
```typescript
describe('CameraRecordingScreen', () => {
  it('should handle recording lifecycle', async () => {
    render(<CameraRecordingScreen />);
    
    const recordButton = screen.getByTestId('record-button');
    fireEvent.press(recordButton);
    
    await waitFor(() => {
      expect(screen.getByTestId('recording-indicator')).toBeVisible();
    });
  });
});
```

## 🖥 Backend Testing

### Test Infrastructure
- **Framework**: pytest + FastAPI TestClient
- **Coverage**: 85%+ with comprehensive API testing
- **Database**: In-memory SQLite for test isolation

### Running Backend Tests
```bash
cd backend
python -m pytest                    # Run all tests
python -m pytest --cov=.           # With coverage
python -m pytest tests/test_media.py # Specific module
```

### Test Categories

#### 1. API Endpoint Tests
- Authentication flows
- Media upload/download
- Challenge CRUD operations
- Error response validation

#### 2. Service Layer Tests
- Business logic validation
- Database operations
- External API integrations
- Video processing pipeline

#### 3. Integration Tests
- Complete workflow testing
- Database transaction handling
- S3 integration validation
- JWT authentication flows

### Backend Test Examples

#### API Testing
```python
def test_create_challenge(client, auth_headers):
    challenge_data = {
        "title": "Test Challenge",
        "statements": [...],
        "lie_statement_index": 1
    }
    
    response = client.post(
        "/api/v1/challenges",
        json=challenge_data,
        headers=auth_headers
    )
    
    assert response.status_code == 201
    assert "challenge_id" in response.json()
```

#### Service Testing
```python
def test_video_merge_service():
    service = VideoMergeService()
    result = service.merge_videos([
        "video1.mp4", "video2.mp4", "video3.mp4"
    ])
    
    assert result.success
    assert result.merged_video_url
    assert len(result.segments) == 3
```

## 🔄 Integration Testing

### End-to-End Workflows
Complete user journey testing from mobile app through backend processing.

#### Test Scenarios
1. **User Registration & Login**
   - Mobile app authentication
   - JWT token handling
   - Session management

2. **Challenge Creation Flow**
   - Video recording on mobile
   - Upload to backend
   - Server-side processing
   - Challenge publishing

3. **Challenge Playing Flow**
   - Challenge browsing
   - Video playback
   - Guess submission
   - Result feedback

### Integration Test Tools
- **Mobile**: Detox for E2E testing
- **Backend**: pytest with live database
- **API**: Postman collections for manual testing

### Running Integration Tests
```bash
# Backend integration tests
cd backend
python run_e2e_tests.py

# Mobile E2E tests (when implemented)
cd mobile
npx detox test
```

## 🎯 Testing Strategy

### Test Pyramid
```
     🔺 E2E Tests (10%)
    🔺🔺 Integration Tests (20%)
   🔺🔺🔺 Unit Tests (70%)
```

### Coverage Goals
- **Unit Tests**: 80%+ coverage
- **Integration Tests**: Critical user paths covered
- **E2E Tests**: Happy path scenarios

### Testing Priorities
1. **Critical Business Logic**: Challenge creation, video processing
2. **Security**: Authentication, authorization, data validation
3. **Performance**: Upload handling, video processing
4. **User Experience**: Error handling, offline scenarios

## 🔧 Test Utilities

### Mock Services
- **Camera API**: Simulated recording functionality
- **S3 Storage**: Local file system for testing
- **Authentication**: Mock JWT tokens
- **Video Processing**: Fast mock implementations

### Test Data
- **Sample Videos**: Pre-recorded test media
- **User Fixtures**: Test user accounts
- **Challenge Data**: Sample challenge structures

### CI/CD Integration
- **GitHub Actions**: Automated test runs
- **Coverage Reporting**: Codecov integration
- **Test Results**: Detailed reporting and notifications

## 🐛 Debugging Tests

### Common Issues
1. **Component Rendering**: React Native Testing Library setup
2. **Async Operations**: Proper waiting for async operations
3. **Mock Conflicts**: Ensuring clean mock state
4. **Database State**: Test isolation and cleanup

### Debug Commands
```bash
# Run specific test with verbose output
npm test -- --verbose ComponentName.test.tsx

# Debug mode with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Coverage with detailed reporting
npm run test:coverage -- --verbose
```

## 📋 Test Maintenance

### Regular Tasks
- Update test snapshots when UI changes
- Maintain mock data freshness
- Review and update test coverage goals
- Refactor tests when code changes

### Code Quality
- Follow testing best practices
- Use descriptive test names
- Maintain test readability
- Avoid test interdependencies

## 🔗 Related Documentation
- [Mobile Development Guide](MOBILE_GUIDE.md)
- [Backend Development Guide](BACKEND_GUIDE.md)
- [API Documentation](api.md)
