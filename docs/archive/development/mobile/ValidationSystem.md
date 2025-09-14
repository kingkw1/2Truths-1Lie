# Form Validation System

This document describes the reusable form validation system implemented for the authentication screens and other forms throughout the application.

## Overview

The validation system consists of:

1. **Validation Utilities** (`utils/validation.ts`) - Pure functions for validating different types of input
2. **Form Components** (`components/FormInput.tsx`, `components/ErrorMessage.tsx`) - Reusable UI components with built-in error display
3. **Form Hook** (`hooks/useFormValidation.ts`) - Custom hook for managing form state and validation
4. **Type Definitions** - TypeScript interfaces for type safety

## Components

### ErrorMessage

A reusable component for displaying validation errors with two variants:

```tsx
import { ErrorMessage } from '../components/ErrorMessage';

// Inline error (default)
<ErrorMessage message="Email is required" />

// Banner error for general form errors
<ErrorMessage message="Login failed" variant="banner" />
```

**Props:**
- `message?: string` - The error message to display
- `variant?: 'inline' | 'banner'` - Display style (default: 'inline')
- `testID?: string` - Test identifier for testing

### FormInput

A reusable input component with built-in validation error display:

```tsx
import { FormInput } from '../components/FormInput';

<FormInput
  label="Email"
  value={email}
  onChangeText={setEmail}
  error={errors.email}
  placeholder="Enter your email"
  keyboardType="email-address"
  required
/>
```

**Props:**
- `label: string` - Input label text
- `error?: string` - Validation error message
- `helperText?: string` - Helper text shown when no error exists
- `required?: boolean` - Shows required indicator (*)
- `containerStyle?: object` - Custom container styling
- `inputStyle?: object` - Custom input styling
- `labelStyle?: object` - Custom label styling
- All standard `TextInputProps` are supported

## Validation Utilities

### Individual Validators

```tsx
import {
  validateEmail,
  validatePassword,
  validateConfirmPassword,
  validateRequired,
} from '../utils/validation';

// Email validation
const emailResult = validateEmail('user@example.com');
// Returns: { isValid: true } or { isValid: false, error: 'Error message' }

// Password validation with custom requirements
const passwordResult = validatePassword('myPassword123', {
  minLength: 8,
  requireLetter: true,
  requireNumber: true,
  requireSpecialChar: false,
});

// Confirm password validation
const confirmResult = validateConfirmPassword('password123', 'password123');

// Required field validation
const requiredResult = validateRequired('value', 'Field Name');
```

### Form Validators

```tsx
import { validateLoginForm, validateSignupForm } from '../utils/validation';

// Login form validation
const loginErrors = validateLoginForm({
  email: 'user@example.com',
  password: 'password123',
});

// Signup form validation
const signupErrors = validateSignupForm({
  email: 'user@example.com',
  password: 'password123',
  confirmPassword: 'password123',
});
```

### Utility Functions

```tsx
import {
  hasFormErrors,
  clearFormError,
  clearAllFormErrors,
} from '../utils/validation';

// Check if form has any errors
const hasErrors = hasFormErrors(errors);

// Clear specific error
const updatedErrors = clearFormError(errors, 'email');

// Clear all errors
const emptyErrors = clearAllFormErrors();
```

## Form Validation Hook

The `useFormValidation` hook provides complete form state management:

```tsx
import { useFormValidation } from '../hooks/useFormValidation';
import { validateLoginForm } from '../utils/validation';

const LoginForm = () => {
  const {
    values,
    errors,
    isSubmitting,
    isValid,
    setValue,
    setError,
    clearError,
    clearAllErrors,
    handleSubmit,
    reset,
  } = useFormValidation({
    initialValues: { email: '', password: '' },
    validate: validateLoginForm,
    onSubmit: async (formData) => {
      await authService.login(formData.email, formData.password);
    },
  });

  return (
    <View>
      <FormInput
        label="Email"
        value={values.email}
        onChangeText={(text) => setValue('email', text)}
        error={errors.email}
        required
      />
      
      <FormInput
        label="Password"
        value={values.password}
        onChangeText={(text) => setValue('password', text)}
        error={errors.password}
        secureTextEntry
        required
      />
      
      <ErrorMessage message={errors.general} variant="banner" />
      
      <TouchableOpacity onPress={handleSubmit} disabled={isSubmitting}>
        <Text>Submit</Text>
      </TouchableOpacity>
    </View>
  );
};
```

### Hook API

**Parameters:**
- `initialValues: T` - Initial form values
- `validate: (values: T) => FormErrors` - Validation function
- `onSubmit: (values: T) => Promise<void> | void` - Submit handler

**Returns:**
- `values: T` - Current form values
- `errors: FormErrors` - Current validation errors
- `isSubmitting: boolean` - Submission state
- `isValid: boolean` - Whether form is currently valid
- `setValue: (field: keyof T, value: string) => void` - Update field value
- `setError: (field: string, error: string) => void` - Set field error
- `clearError: (field: string) => void` - Clear field error
- `clearAllErrors: () => void` - Clear all errors
- `handleSubmit: () => Promise<void>` - Submit form with validation
- `reset: () => void` - Reset form to initial state

## Usage Examples

### Basic Login Form

```tsx
import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { FormInput, ErrorMessage } from '../components';
import { useFormValidation } from '../hooks';
import { validateLoginForm } from '../utils';

const LoginScreen = ({ onLogin }) => {
  const form = useFormValidation({
    initialValues: { email: '', password: '' },
    validate: validateLoginForm,
    onSubmit: onLogin,
  });

  return (
    <View>
      <FormInput
        label="Email"
        value={form.values.email}
        onChangeText={(text) => form.setValue('email', text)}
        error={form.errors.email}
        keyboardType="email-address"
        required
      />
      
      <FormInput
        label="Password"
        value={form.values.password}
        onChangeText={(text) => form.setValue('password', text)}
        error={form.errors.password}
        secureTextEntry
        required
      />
      
      <ErrorMessage message={form.errors.general} variant="banner" />
      
      <TouchableOpacity onPress={form.handleSubmit} disabled={form.isSubmitting}>
        <Text>{form.isSubmitting ? 'Signing In...' : 'Sign In'}</Text>
      </TouchableOpacity>
    </View>
  );
};
```

### Custom Validation

```tsx
import { FormErrors } from '../utils/validation';

interface CustomFormData {
  username: string;
  age: string;
}

const validateCustomForm = (data: CustomFormData): FormErrors => {
  const errors: FormErrors = {};
  
  if (!data.username.trim()) {
    errors.username = 'Username is required';
  } else if (data.username.length < 3) {
    errors.username = 'Username must be at least 3 characters';
  }
  
  const age = parseInt(data.age);
  if (isNaN(age) || age < 13) {
    errors.age = 'Must be at least 13 years old';
  }
  
  return errors;
};

const CustomForm = () => {
  const form = useFormValidation({
    initialValues: { username: '', age: '' },
    validate: validateCustomForm,
    onSubmit: async (data) => {
      // Handle submission
    },
  });

  // ... render form
};
```

## Testing

All validation utilities and components include comprehensive test coverage:

- `utils/__tests__/validation.test.ts` - Validation function tests
- `components/__tests__/ErrorMessage.test.tsx` - Error message component tests
- `components/__tests__/FormInput.test.tsx` - Form input component tests
- `hooks/__tests__/useFormValidation.test.ts` - Form validation hook tests

Run tests with:
```bash
npm test -- --testPathPattern="validation|ErrorMessage|FormInput|useFormValidation"
```

## Best Practices

1. **Use TypeScript interfaces** for form data to ensure type safety
2. **Validate on submit** rather than on every keystroke for better UX
3. **Clear errors on input change** to provide immediate feedback when users fix issues
4. **Use appropriate validation rules** - stricter for signup, more lenient for login
5. **Handle network errors** in the onSubmit handler and display them as general errors
6. **Provide helpful error messages** that guide users on how to fix issues
7. **Use consistent styling** across all forms by leveraging the reusable components

## Migration Guide

To migrate existing forms to use the validation system:

1. Replace manual validation logic with validation utilities
2. Replace custom input components with `FormInput`
3. Replace error display logic with `ErrorMessage`
4. Use `useFormValidation` hook for state management
5. Update tests to use the new component APIs

See `examples/ValidationComponents.example.tsx` for complete migration examples.