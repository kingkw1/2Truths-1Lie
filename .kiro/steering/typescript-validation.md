---
inclusion: always
---

# TypeScript Validation Requirements

## Pre-Task Completion Validation

Before marking any task as complete, you MUST ensure that all TypeScript files you have modified compile without errors.

### Validation Process

1. **Run TypeScript Compilation Check**
   ```bash
   npx tsc --noEmit --skipLibCheck --esModuleInterop --jsx react-native [file-path]
   ```

2. **Fix All TypeScript Errors**
   - Address type mismatches
   - Fix missing imports
   - Resolve JSX configuration issues
   - Ensure proper interface implementations

3. **Verify No Compilation Errors**
   - Exit code must be 0
   - No error messages in output
   - All type checking passes

### Common TypeScript Issues to Check

- **Import/Export Issues**: Ensure proper module imports and exports
- **Type Annotations**: Verify all function parameters and return types
- **Interface Compliance**: Check that objects match their interface definitions
- **JSX Configuration**: Ensure JSX is properly configured for React Native
- **Generic Types**: Verify generic type parameters are correctly specified
- **Null/Undefined Handling**: Check for proper null safety

### Task Completion Criteria

A task is NOT complete until:
- [ ] All modified TypeScript files compile without errors
- [ ] All type checking passes
- [ ] No TypeScript compilation warnings for critical issues
- [ ] JSX elements are properly typed (for React components)

### Error Resolution Priority

1. **Critical Errors**: Type mismatches, missing required properties
2. **Import Errors**: Module resolution issues, missing dependencies
3. **JSX Errors**: Component prop type mismatches
4. **Configuration Errors**: TSConfig or build configuration issues

## Implementation Standards

- Always use proper TypeScript types instead of `any`
- Implement interfaces for complex objects
- Use generic types where appropriate
- Ensure proper error handling with typed exceptions
- Maintain type safety across async operations

## Validation Commands

For different file types:

```bash
# Single file validation
npx tsc --noEmit --skipLibCheck --esModuleInterop --jsx react-native src/path/to/file.tsx

# Multiple files validation
npx tsc --noEmit --skipLibCheck --esModuleInterop --jsx react-native src/path/to/file1.ts src/path/to/file2.tsx

# Full project validation (use sparingly due to performance)
npx tsc --noEmit --skipLibCheck
```

Remember: **NO TASK IS COMPLETE WITH TYPESCRIPT ERRORS**