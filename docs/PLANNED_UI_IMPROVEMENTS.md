## Home Screen Navigation
- [x] Refactor home screen navigation: replace existing layout with a choice menu allowing users to either create challenges or guess challenges. Remove any test backend connection button or code from the home screen component.

## Pop Ups
- [x] Disable "recording saved" and "recording complete" pop-up notifications globally.
- [x] Remove duplicate "challenge created" pop-ups; keep only the pop-up that provides relevant user information and remove the other debugging pop-up.

## Loading Indicator
- [x] Add a visible loading indicator (such as a loading bar or spinner) that activates and displays while a challenge is being created, appearing at the end of the creation process until completion.
- [x] Automatically navigate back to the home screen when after a challenge is created and the loading bar completes.

## Guess challenge navigation
- [x] Configure video player to automatically open when a player selects a guess to judge the statement.

## Large Scale Video Player UI Improvements
- [x] Remove any debugging information displayed above the merged video player on the challenge guessing screen.
- [ ] Remove text labels or captions directly on or around the merged video player interface.
- [ ] Remove the "hide video" button from the video player controls.
- [ ] Set the video player to display the video in full-screen mode by default.
- [ ] Position the statement playback and selection buttons at the bottom of the screen in a user-friendly layout.
- [ ] Rework the playback controls for statements to improve play and pause functionality, ensuring intuitive interaction.

## Statement Replay During Challenge Creation
- [ ] Enable functionality for users to replay their recorded statement videos during the prewview challenge prtion of the challenge creation process for review before submission.

## Baloney Statement Feature
- [ ] Add the ability for users to record a brief explanatory statement specifically about the lie within their challenge.

## Move the back button 
- [ ] Move the back button on the guess challenge and create challenge to be less visually obstructive. Maybe bottom left

## Challenge Naming
- [ ] Provide a text input field allowing users to name their challenge during creation, ensuring the name is saved and displayed appropriately.

## Swipe navigation
- [ ] Implement intuitive swipe navgiation to go between the main screens

These prompts can be used directly as commit messages, feature branch intents, or as descriptive comments/commit prompts for Copilot-assisted code development.