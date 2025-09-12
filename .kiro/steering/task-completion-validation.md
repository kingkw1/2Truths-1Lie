---
include: always
---

# Task Completion Validation Standards

## Compiler Error Checking Requirements

### Pre-Task Completion Validation
Before marking any task as "complete", Kiro must perform the following validation steps:

1. **TypeScript Compilation Check**
   - Run `npx tsc --noEmit` in the mobile directory to check for TypeScript errors
   - **Note**: Currently there are known TypeScript errors in network resilience test files that are being addressed
   - New tasks must not introduce additional TypeScript compilation errors beyond the known issues
   - All TypeScript compilation errors in NEW code must be resolved before task completion

2. **Mobile Build Validation**
   - Verify mobile code compiles with `npx tsc --noEmit` (type-check script currently unavailable)
   - Check that Expo/React Native bundler can process all modified files without errors
   - Ensure no import/export errors or missing dependencies
   - Known issues: Network resilience test files have typing issues that need resolution

3. **Backend Syntax Validation**
   - For Python files, run basic syntax checking with `python -m py_compile <file>`
   - Verify all imports are available and properly structured
   - Check for any obvious runtime errors in modified code

### Error Resolution Process
When compiler errors are detected:

1. **Immediate Fix Required**
   - Do not mark task as complete until all compiler errors are resolved
   - Address each error systematically, starting with syntax errors
   - Verify fixes don't introduce new compilation issues

2. **Common Error Categories to Check**
   - Missing imports or incorrect import paths
   - TypeScript type mismatches or missing type annotations
   - Undefined variables or functions
   - Syntax errors (missing brackets, semicolons, etc.)
   - React Native component prop type mismatches
   - Missing dependencies in package.json

3. **Validation Commands**
   - Mobile: `cd mobile && npm run type-check` or `npx tsc --noEmit`
   - Backend: `cd backend && python -m mypy .` (if mypy is configured)
   - General: `npm run build` or equivalent build commands

### Task Completion Checklist
Before marking any development task as complete, verify:

- [ ] All modified files compile without errors
- [ ] TypeScript type checking passes
- [ ] No missing imports or dependencies
- [ ] Mobile app can start without compilation errors
- [ ] Backend services can start without syntax errors
- [ ] All new code follows existing patterns and conventions

### Error Communication
When compiler errors are found:
- Clearly list each error with file location and description
- Explain the fix being applied
- Confirm resolution with re-compilation
- Document any architectural decisions made during error resolution

### Integration with Existing Standards
This validation process complements existing code quality standards:
- Must pass before running tests (testing-standards.md)
- Ensures code follows conventions (code-conventions.md)
- Maintains technical stack integrity (tech.md)

## Automated Validation Integration
Where possible, integrate these checks into:
- Pre-commit hooks for immediate feedback
- CI/CD pipelines for automated validation
- Development workflow scripts for consistent checking