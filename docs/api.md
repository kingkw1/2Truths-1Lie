# API Documentation for 2Truths-1Lie Mobile App

## Base URL

`https://api.2truths1lie.app/v1`

---

## Mobile App Architecture

This API serves the **mobile-only** React Native/Expo application. All endpoints are optimized for mobile usage patterns including offline-first capabilities, efficient data transfer, and native mobile features.

## Redux Store Structure

### Challenge Creation Slice

The `challengeCreationSlice` manages the state during the challenge creation workflow on mobile devices.

**State Interface:**
```typescript
interface ChallengeCreationState {
  currentChallenge: Partial<ChallengeCreation>;
  isRecording: boolean;
  recordingType: 'video' | 'audio' | null;
  currentStatementIndex: number;
  validationErrors: string[];
  isSubmitting: boolean;
  submissionSuccess: boolean;
  previewMode: boolean;
}
```

**Initial State:**
- `currentChallenge` now includes 3 pre-initialized empty statements with IDs 'stmt_1', 'stmt_2', 'stmt_3'
- Each statement has default values: `text: ''`, `isLie: false`, `confidence: 0`
- `mediaData` array is initialized as empty
- `isPublic` defaults to `true`

**Available Actions:**
- `startNewChallenge()` - Reset to initial state
- `updateStatement(index, statement)` - Update a specific statement
- `setLieStatement(index)` - Mark a statement as the lie
- `startRecording(type)` / `stopRecording()` - Control native mobile media recording
- `setMediaData(media)` - Add media capture data from device camera/microphone
- `setStatementMedia(index, media)` - Associate media with a statement
- `validateChallenge()` - Validate current challenge state
- `enterPreviewMode()` / `exitPreviewMode()` - Toggle preview mode
- `startSubmission()` / `completeSubmission(success)` - Handle submission flow

## Mobile-Specific Considerations

### Media Upload
- **Native Recording**: All media captured using Expo Camera and Audio APIs
- **Compression**: Client-side video/audio compression before upload
- **Offline Support**: Media stored locally until network available
- **Format Support**: Optimized for mobile formats (MP4, AAC)

---

## Endpoints

### POST `/statements`
Submit a new “Two Truths and a Lie” record.

**Request Body:**
```
{
  "userId": "string",
  "statements": [
    {"text": "string", "isLie": false},
    {"text": "string", "isLie": false},
    {"text": "string", "isLie": true}
  ],
  "mediaUrl": "string (optional)",
  "mediaType": "video" | "audio" | "none"
}
```

**Response:**
- **201 Created**
```
{
  "gameId": "string",
  "status": "pending"
}
```
- **400 Bad Request**

---

### GET `/games/{gameId}`
Fetch details of a specific game session, including guesses and stats.

**Response:**
```
{
  "gameId": "string",
  "statements": [
    {"text": "string", "mediaUrl": "string", "emotionScores": {"happy": 0.8, "sad": 0.1}, "isLie": false}
  ],
  "guesses": [
    {"userId": "string", "guessIndex": 2, "correct": true}
  ],
  "scoreSummary": {
    "totalGuesses": 35,
    "correctGuesses": 27
  }
}
```

---

### POST `/games/{gameId}/guess`
Submit a guess for a game’s lie.

**Request Body:**
```
{
  "userId": "string",
  "chosenIndex": 0
}
```

**Response:**
- **200 OK**
```
{
  "correct": true,
  "updatedScore": 42
}
```
- **404 Not Found**
- **400 Bad Request**

---

## Authentication
- Requests require Bearer JWT token in header: `Authorization: Bearer {token}`
- Optimized for mobile: Token refresh handled automatically by mobile client
- Offline support: Cached authentication for temporary network loss

## Mobile App Integration Notes
- All endpoints support mobile-specific headers for device identification
- Rate limiting adjusted for mobile usage patterns
- Response payloads optimized for mobile data usage
- Support for background sync when app returns to foreground

---

## Recent Updates

### Server-Side Video Processing (Latest)
- **Change**: Added server-side video merging and processing pipeline
- **Impact**: Videos are now merged on the server using FFmpeg for optimal quality and storage efficiency
- **Benefits**: 
  - Single merged video file instead of three separate files
  - Consistent video quality and compression across all platforms
  - Segment-based playback with precise timing metadata
  - Reduced storage costs and improved CDN performance
- **New Endpoints**: 
  - `POST /api/v1/challenge-videos/upload-for-merge/initiate` - Multi-video upload initiation
  - `GET /api/v1/challenges/{id}/segments` - Segment metadata for playback
  - See [Server-Side Video Processing API](SERVER_SIDE_VIDEO_PROCESSING_API.md) for complete documentation

### Mobile-Only Migration
- **Change**: Removed web-specific endpoints and headers
- **Impact**: API now exclusively serves mobile React Native app
- **Benefits**: 
  - Simplified authentication flow for mobile
  - Optimized response formats for mobile consumption
  - Native mobile media handling integration

### Challenge Creation State Initialization
- **Change**: Modified initial state to pre-populate 3 empty statements
- **Impact**: Eliminates need for dynamic statement array initialization in mobile components
- **Benefits**: 
  - Consistent mobile UI state on component mount
  - Simplified form handling logic for touch interfaces
  - Better mobile UX with pre-structured statement inputs

---

## Contact for API Questions  
Kingkw - kingkw@example.com  
