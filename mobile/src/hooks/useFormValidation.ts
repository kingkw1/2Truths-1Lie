import { useState, useCallback } from 'react';
import { FormErrors, hasFormErrors } from '../utils/validation';

export interface UseFormValidationOptions<T> {
  initialValues: T;
  validate: (values: T) => FormErrors;
  onSubmit: (values: T) => Promise<void> | void;
}

export interface UseFormValidationReturn<T> {
  values: T;
  errors: FormErrors;
  isSubmitting: boolean;
  isValid: boolean;
  setValue: (field: keyof T, value: any) => void;
  setError: (field: string, error: string) => void;
  clearError: (field: string) => void;
  clearAllErrors: () => void;
  handleSubmit: () => Promise<void>;
  reset: () => void;
}

/**
 * Custom hook for form validation and state management
 */
export function useFormValidation<T extends Record<string, any>>({
  initialValues,
  validate,
  onSubmit,
}: UseFormValidationOptions<T>): UseFormValidationReturn<T> {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isValid = !hasFormErrors(errors);

  const setValue = useCallback((field: keyof T, value: any) => {
    setValues(prev => ({ ...prev, [field]: value }));
    
    // Clear error for this field when user starts typing
    if (errors[field as string]) {
      setErrors(prev => ({ ...prev, [field as string]: undefined }));
    }
  }, [errors]);

  const setError = useCallback((field: string, error: string) => {
    setErrors(prev => ({ ...prev, [field]: error }));
  }, []);

  const clearError = useCallback((field: string) => {
    setErrors(prev => ({ ...prev, [field]: undefined }));
  }, []);

  const clearAllErrors = useCallback(() => {
    setErrors({});
  }, []);

  const handleSubmit = useCallback(async () => {
    // Validate form
    const validationErrors = validate(values);
    setErrors(validationErrors);

    // If there are validation errors, don't submit
    if (hasFormErrors(validationErrors)) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit(values);
    } catch (error: any) {
      // Handle submission errors
      if (error.message) {
        setError('general', error.message);
      } else {
        setError('general', 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validate, onSubmit, setError]);

  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
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
  };
}