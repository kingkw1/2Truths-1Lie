# Media Upload – Requirements

## Requirement 1: Durable Persistent Storage

WHEN a user confirms a challenge submission  
THE SYSTEM SHALL upload the recorded video file to backend or cloud storage  
AND persist the file so it is accessible across sessions, restarts, and devices

## Requirement 2: URL-Based Reference & Playback

WHEN a video is uploaded successfully  
THE SYSTEM SHALL update the challenge record to reference the public or authenticated server URL  
AND use this URL for all subsequent playback and in-app interactions

## Requirement 3: Upload Progress & Feedback

WHEN uploading video  
THE SYSTEM SHALL display upload progress, handle user cancellation, and provide clear error messages  
AND prevent challenge publishing until upload completes successfully

## Requirement 4: Validation and Security

WHEN a user uploads media  
THE SYSTEM SHALL enforce format, duration, and size constraints  
AND authenticate the user and validate file type and ownership on the backend

## Requirement 5: Migration from Local Blob URLs

WHEN the upload subsystem is deployed in production  
THE SYSTEM SHALL provide a migration or upgrade path for existing local challenges/videos  
AND ensure a smooth transition with clear UI and developer documentation
