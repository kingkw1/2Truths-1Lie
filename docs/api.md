# API Documentation for 2Truths-1Lie

## Base URL
`https://api.2truths1lie.app/v1`

---

## Redux Store Structure

### Challenge Creation Slice

The `challengeCreationSlice` manages the state during the challenge creation workflow.

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
- `startRecording(type)` / `stopRecording()` - Control media recording
- `setMediaData(media)` - Add media capture data
- `setStatementMedia(index, media)` - Associate media with a statement
- `validateChallenge()` - Validate current challenge state
- `enterPreviewMode()` / `exitPreviewMode()` - Toggle preview mode
- `startSubmission()` / `completeSubmission(success)` - Handle submission flow

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
- Obtain tokens via `/auth/login` (not documented here for brevity)

---

## Error Codes
- 400: Bad Request – Invalid input data
- 401: Unauthorized – Missing or invalid token
- 404: Not Found – Non-existing resource accessed
- 500: Internal Server Error

---

---

## Recent Updates

### Challenge Creation State Initialization (Latest)
- **Change**: Modified initial state to pre-populate 3 empty statements
- **Impact**: Eliminates need for dynamic statement array initialization in components
- **Benefits**: 
  - Consistent UI state on component mount
  - Simplified form handling logic
  - Better UX with pre-structured statement inputs

---

## Contact for API Questions  
Kingkw - kingkw@example.com  
