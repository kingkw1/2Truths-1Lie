## Home Screen Navigation
- [x] Refactor home screen navigation: replace existing layout with a choice menu allowing users to either create challenges or guess challenges. Remove any test backend connection button or code from the home screen component.

## Move the back button 
- [x] Remove the "back to menu" pop up button on the guess challenge and create challenge to be less visually obstructive
- [x] Make the "Guess Challenges" page top bar that has "Two truths and a lie" and back button more closely match the style of the "Create challenge" page. Make it say "Guess challenge" in the center and have a cancel button on the left, rather than a back button on the right. 

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
- [x] Remove text labels or captions directly on or around the merged video player interface.
- [x] Remove the "hide video" button from the video player controls.
- [x] Set the video player to display the video in full-screen mode by default.
- [x] Position the statement playback and selection buttons at the bottom of the screen in a user-friendly layout.
- [x] Rework the playback controls for statements to improve play and pause functionality, ensuring intuitive interaction.

## Modern Fullscreen Interface
- [x] Create immersive, fullscreen video display with no borders, padding, or cards
- [x] Implement three circular statement selector buttons at bottom of screen
- [x] Add tap-to-play video functionality with smooth animations
- [x] Implement long-press gesture to auto-submit guess with haptic feedback
- [x] Remove extraneous buttons, overlays, and debugging information
- [x] Position all controls at bottom for modern, thumb-friendly mobile use
- [x] Create gesture-driven interaction system (tap/hold)
- [x] Preserve clean header with only back navigation
- [x] Implement modern UI with fullscreen minimal design and intuitive statement selection

## lie selection in guessing
- [x] Optimize the button hold detection to reduce or eliminate any delay, making the selection response instant and snappier upon holding down.
- [x] Add clear instructional text near the selection buttons that informs users to "Hold down the button to select and submit your guess."
- [x] Implement a circular progress indicator around or near the button that visually fills clockwise while the button is being held, clearly showing how much hold time remains until the guess is submitted.
- [x] The circular indicator should complete a full circle exactly when the hold duration is met, providing intuitive and immediate feedback on the selection process.

## Simpler challenge creation UI
- [x] combine the lie-selection portion of the challenge creation with the preview challenge screen
- [x] remove the edit button 
- [x] Make the create challenge button a full width button, and make it say "submit challenge" rather than "create challenge (debug)"
- [x] Implement full-screen video interface similar to challenge guessing screen
- [x] Add clear header "Select the Lie" to guide users
- [x] Add navigation buttons to switch between recorded statements
- [x] Include prominent "Mark as Lie" button for current statement
- [x] Provide "Submit Challenge" button that activates after lie selection
- [x] Place "Retake" button for re-recording statements without leaving screen
- [x] Remove separate preview screen entirely - consolidated into single interface

## video playing during guess mode
- [x] video replay during making a guess sometimes plays a split second of the next statement

## Guess mode layout
- [x] There are currently 2 statements at the bottom of the guessing interface: "tap to watch - hold to select and submit" and "hold down the button to tselect and submit your guess". I'd like you to reduce these to a single statement.
- [x] When guessing, there is a bubble that indicates what statement is currently being watched. This bubble is currently underneath of the statement navigation circles. I'd like the statement bubble to be at the top of the screen instead. 

## Baloney Statement Feature
- [ ] Add the ability for users to record a brief explanatory statement specifically about the lie within their challenge.

## Challenge Naming
- [ ] Provide a text input field allowing users to name their challenge during creation, ensuring the name is saved and displayed appropriately.

## Swipe navigation
- [ ] Implement intuitive swipe navgiation to go between the main screens

These prompts can be used directly as commit messages, feature branch intents, or as descriptive comments/commit prompts for Copilot-assisted code development.