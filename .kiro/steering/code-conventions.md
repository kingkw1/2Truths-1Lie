---
include: always
---

# Code Conventions

## Naming
- Use **camelCase** for variables and functions: `calculateScore()`
- Use **PascalCase** for React components: `GameBoard`
- Use **kebab-case** for folder names: `game-logic/`
- Use meaningful, descriptive names; avoid abbreviations unless widely understood.

## File Organization
- Keep one primary React or JS component/function per file.
- Separate utilities into `src/utils/`
- API logic only in `src/api/`
- Core game rules and mechanics confined to `src/game/`
- Avoid large files: refactor into smaller reusable modules.

## Style & Formatting
- Use Prettier with 2-space indentation.
- Always include type annotations if using TypeScript.
- Use ESLint with recommended rules to enforce code quality.
- Comment complex logic with docstrings and inline comments.

## React Patterns
- Use functional components and React Hooks.
- Avoid class-based components.
- Prefer local state for UI state; lift state up only when necessary.
- Use context or global state only for app-wide data.

## Error Handling
- Gracefully handle unexpected user inputs and API errors.
- Display user-friendly error messages.

## Code Quality and Build Compliance

- All code changes must ensure the project compiles successfully with zero build errors.
- The application should run correctly with `npm run start` or equivalent without runtime errors.
- TypeScript type checking must pass. Before completing a task, run `npm run type-check` and ensure there are no errors.
- Tasks are not considered complete until the build passes and no compilation issues exist.
- Automated test suites covering new or modified features must pass before merging code.
- Failed builds or tests must trigger immediate fixes rather than partial or broken implementations.
- Developers and automation (e.g., Kiro) should respect these quality gates and prioritize compilation success.

## Commit Messages
- Use clear, imperative style: `Add game board component`  
---