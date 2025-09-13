# Content Moderation - MVP Implementation Tasks

### Tasks Kiro Can Automate (Spec-to-Code, Testing, API Generation)

- [ ] Extend Video model with `reported` field or `reports` counter  
- [ ] Generate POST `/videos/{video_id}/report` API endpoint with validation  
- [ ] Create admin GET `/reports` endpoint returning all reported videos  
- [ ] Implement simple notification emit (e.g., email or log) triggered by report API call  
- [ ] Add frontend "Report" button component on video challenge screens  
- [ ] Generate API client function for "report video" call  
- [ ] Create basic confirmation modal/UI on report action  
- [ ] Generate automated backend tests for report API  
- [ ] Generate automated frontend tests for report button and flow  
- [ ] Generate admin interface tests (if admin UI generated)  

### Tasks To Perform Manually (Configuration, Deployment, Review)

- [ ] Configure admin notification channel—email or logging system integration  
- [ ] Implement manual content review workflow and decision processes  
- [ ] Deploy updated API and frontend to testing/staging  
- [ ] Monitor report volumes and false positives  
- [ ] Physically remove or disable video content based on admin decisions  
- [ ] Train support/staff or yourself on handling flagged content  
