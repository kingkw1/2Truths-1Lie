### 📱 Test Category 1: Test Upload Pipeline

**Infrastructure Status**: ✅ Automated test infrastructure now working with 90% pass rate  
**Manual Testing**: Complements automated Jest tests for device-specific validation

#### 1.1 Video Recording Performance
**Objective**: Validate recording quality and system reliability
**Test Environment**: Expo Go on Android device

**Test Cases**:
- [ ] **Recording Duration Accuracy**: Record videos of 5s, 10s, 30s - verify actual vs reported duration
- [ ] **Video Quality Consistency**: Test different lighting conditions (bright, dim, outdoor)
- [ ] **Audio Sync Validation**: Record with speech, verify audio-video synchronization
- [ ] **File Size Optimization**: Monitor file sizes vs duration, check for efficiency
- [ ] **Memory Usage During Recording**: Monitor app memory usage during extended recording
- [ ] **Battery Impact Assessment**: Test battery drain during multiple recordings
- [ ] **Camera Permission Handling**: Test grant/deny permission scenarios
- [ ] **Hardware Conflict Resolution**: Test with other apps using camera simultaneously

#### 1.2 Recording Reliability Testing
**Objective**: Stress test recording under various conditions

**Test Cases**:
- [ ] **Rapid Start/Stop Cycles**: Quick recording session transitions
- [ ] **Long Recording Sessions**: Test maximum duration handling (60s limit)
- [ ] **Interrupted Recording Scenarios**: Test phone calls, app backgrounds, notifications
- [ ] **Storage Space Handling**: Test recording when device storage is low
- [ ] **Device Orientation Changes**: Test portrait/landscape transitions during recording
- [ ] **Multiple Recording Sessions**: Create 5+ challenges in sequence
- [ ] **App State Recovery**: Test recording after app backgrounding/foregrounding

### 📋 Test Category 2: UI/UX Flow & Error Handling

#### 2.1 User Journey Validation
**Objective**: Validate complete user experience flows

**Test Cases**:
- [ ] **First-Time User Experience**: Fresh app install to first challenge creation
- [ ] **Navigation Flow Consistency**: Test all screen transitions and back navigation
- [ ] **Visual Feedback Systems**: Verify loading states, progress indicators, success/error messages
- [ ] **Touch Target Accessibility**: Ensure buttons are appropriately sized and responsive
- [ ] **Screen Orientation Support**: Test UI in portrait and landscape modes
- [ ] **Text Input Validation**: Test statement text input with various lengths and characters
- [ ] **Gesture Recognition**: Test swipe, tap, and long-press interactions

#### 2.2 Error Handling & Recovery
**Objective**: Test app behavior under error conditions

**Test Cases**:
- [ ] **Network Connectivity Issues**: Test challenge submission with poor/no connection
- [ ] **Backend API Errors**: Simulate 500, 404, 403 responses and verify user feedback
- [ ] **Camera Hardware Errors**: Test behavior when camera is unavailable
- [ ] **Permission Denied Scenarios**: Test graceful handling of denied permissions
- [ ] **App Crash Recovery**: Test app recovery after force-close during recording
- [ ] **Invalid Input Handling**: Test empty statements, special characters, emoji
- [ ] **Timeout Scenarios**: Test long API calls and user feedback

### ⏱️ Test Category 3: Segment Timing Accuracy

#### 3.1 Timing Precision Validation
**Objective**: Ensure accurate video segment metadata generation

**Test Cases**:
- [ ] **Short Segment Accuracy** (< 2s): Record brief statements, verify timing precision
- [ ] **Medium Segment Accuracy** (2-10s): Standard length statements timing validation
- [ ] **Long Segment Accuracy** (10s+): Extended statements timing validation
- [ ] **Sequential Timing Consistency**: Verify segments don't overlap or have gaps
- [ ] **Cross-Statement Timing**: Verify total duration equals sum of individual segments
- [ ] **Realistic Timing Distribution**: Test varied statement lengths in single challenge
- [ ] **Timing Edge Cases**: Test very short (0.5s) and maximum length (60s) recordings

#### 3.2 Backend Timing Integration
**Objective**: Validate timing data integration with backend

**Test Cases**:
- [ ] **Metadata Transmission Accuracy**: Verify timing data sent matches generated
- [ ] **Backend Validation Success**: Confirm backend accepts all valid timing data
- [ ] **Duration Mismatch Handling**: Test backend validation of inconsistent durations
- [ ] **Precision Consistency**: Verify millisecond precision maintained through API
- [ ] **Segment Boundary Accuracy**: Test start/end time precision for playback

### 🚀 Test Category 4: Challenge Creation Robustness

#### 4.1 Challenge Creation Workflow
**Objective**: Stress test complete challenge creation process

**Test Cases**:
- [ ] **Complete Happy Path**: Record 3 statements → Select lie → Submit → Verify storage
- [ ] **Partial Challenge Recovery**: Test app behavior with incomplete challenges
- [ ] **Multiple Challenge Creation**: Create 10+ challenges in single session
- [ ] **Challenge Data Persistence**: Verify challenge data survives app restarts
- [ ] **Concurrent Challenge Creation**: Test multiple users creating challenges simultaneously
- [ ] **Large Challenge Batches**: Test creating challenges with maximum content length
- [ ] **Challenge Uniqueness**: Verify each challenge gets unique ID and metadata

#### 4.2 Submission & Storage Validation
**Objective**: Validate challenge submission and retrieval

**Test Cases**:
- [ ] **Submission Success Confirmation**: Verify user receives clear success feedback
- [ ] **Challenge Retrieval Accuracy**: Verify submitted challenges appear in game list
- [ ] **Data Integrity Validation**: Confirm all challenge data (statements, lie index) preserved
- [ ] **Submission Retry Logic**: Test retry behavior for failed submissions
- [ ] **Offline Challenge Queuing**: Test behavior when submission fails due to connectivity
- [ ] **Backend Processing Time**: Monitor submission response times
- [ ] **Challenge Metadata Accuracy**: Verify lie index, statements, and timing data accuracy

---