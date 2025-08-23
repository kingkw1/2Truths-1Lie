---
include: conditional
pattern: "**/*.test.*"
---

# Testing Standards

## Testing Scope
- Write unit tests for all game logic functions in `src/game/`
- Integration tests for key API endpoints under `src/api/`
- Basic UI tests for critical user flows and components.

## Tools
- Use Jest and React Testing Library as the base testing framework.
- Use msw (Mock Service Worker) to mock API calls in UI tests.

## Test Writing Practices
- Test one behavior or function per test case.
- Use descriptive test names:  
  `test('calculateScore correctly sums points when all guesses are correct', () => {...})`
- Mock external dependencies where appropriate.
- Include boundary cases and error scenarios.

## Test Coverage
- Aim for at least 80% coverage on business logic and API.
- Review coverage reports as part of CI.

## Build and Test Validation

- Tests should be run in conjunction with build verification to ensure stable merges.
- Developers and automation pipelines must run build commands (e.g., `npm run build`) and type checking (`npm run type-check`) prior to finalizing task completion.
- Test failures or build errors must prevent task closure until resolved.
- Maintain CI integration to automate these checks on every push.

## Running Tests
- Tests runnable via `npm test` or `yarn test`.
- Include test scripts in `package.json`.
- Run tests before every commit to ensure stability.

## Test Data
- Use fixture files or test factories for reproducible inputs.
- Avoid hard-coded data in multiple tests.

---

