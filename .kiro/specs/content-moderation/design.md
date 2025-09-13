# Content Moderation - MVP Design

## Architecture

- Extend existing Video entity/model with a `reported` boolean flag or a `reports` counter  
- Implement a new endpoint: POST `/videos/{video_id}/report` to set the flag or increment counter  
- Optional: Trigger email notification to admin or log entry for manual review  
- Provide a simple admin API: GET `/reports` returning videos flagged for review  
- Admin action to delete or disable videos is manual/out-of-band for MVP  
- Frontend: Display a "Report" button on video playback screen or challenge card  
- On tapping report, confirm with user, then invoke report API  
- Provide immediate user feedback ("Thank you for reporting")  

## Data Flow

1. User taps "Report" on a video  
2. Client calls the POST `/videos/{video_id}/report` API  
3. Server marks video as reported or increments reports counter  
4. System triggers alert for admin (email or dashboard entry)  
5. Admin reviews reported items and acts accordingly  
