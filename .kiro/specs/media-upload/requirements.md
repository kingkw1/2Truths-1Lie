# Mobile Media Upload – Requirements

## Requirement 1: Native Mobile Storage with Cloud Backup

WHEN a mobile user confirms a challenge submission using device camera  
THE SYSTEM SHALL upload the recorded mobile video file to secure, mobile-optimized cloud storage  
AND persist the file with complete mobile metadata (device type, orientation, recording quality, user ID), retrievable across devices and app reinstalls

## Requirement 2: Mobile-Optimized URL Reference & Playback

WHEN a video is uploaded and stored in cloud  
THE SYSTEM SHALL update the challenge record with a mobile-optimized streaming URL (CDN if available)  
AND ensure native video player compatibility for adaptive playback based on device capability and network quality

## Requirement 3: Upload Progress, Error Handling, & Network Resilience

WHEN a user initiates video upload  
THE SYSTEM SHALL display native progress indicator with support for background upload  
AND provide reliable error states, retry/cancel options, and mobile-friendly recovery for network/interruption cases

## Requirement 4: Security, Validation, & Compliance

WHEN receiving mobile media for upload  
THE SYSTEM SHALL authenticate the upload, enforce file type, duration, and size requirements specific to device/OS  
AND scan uploads for compliance (content moderation, safe formats), using secure server-side validation

## Requirement 5: Migration & Legacy Support

WHEN updating the mobile app’s upload subsystem  
THE SYSTEM SHALL provide migration utilities for converting local/legacy blob URLs to persistent server URLs  
AND ensure all previously uploaded videos are accessible, restored, and correctly referenced during updates or reinstallation

## Requirement 6: Composite Challenge Video with Segmented Metadata

WHEN a user records the three challenge statement videos  
THE SYSTEM SHALL merge all three video segments into a single video file,  
AND record metadata indicating the start and end time (in seconds) of each statement segment within the merged file.

WHEN uploading the composite challenge video  
THE SYSTEM SHALL upload only the single combined file,  
AND persist the segment metadata as part of the challenge record in the backend (e.g., as a JSON array with {start, end} fields for each statement).

WHEN a user plays back a challenge  
THE SYSTEM SHALL enable playback of each individual statement by seeking to and playing only the corresponding segment as defined in the metadata,  
AND allow replay or out-of-order viewing of each segment.

### Requirement 7: Mandatory Compression of Mobile Videos

WHEN a user completes recording each video statement on a mobile device (Android/iOS)  
THE app SHALL automatically compress the video to reduce file size without compromising basic visual fidelity  
AND ensure the compressed video meets upload size and duration limits, optimized for mobile playback and storage

WHEN multiple video statements are merged into a single file  
THE app SHALL apply compression to the merged video prior to initiating upload to the backend

### Notes:
- Compression should balance quality and file size, targeting ~1-3 Mbps bitrate or similar appropriate for mobile screens.
- Compression occurs transparently to users; manual quality selection is deferred to future phases.
- Post-compression, video metadata timestamps must be recalculated to reflect any length changes.
- Compression must complete prior to upload; upload process should be atomic after compression finalization.
