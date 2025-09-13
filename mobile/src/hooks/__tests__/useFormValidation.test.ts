import { renderHook, act } from '@testing-library/react-native';
import { useFormValidation } from '../useFormValidation';
import { validateLoginForm } from '../../utils/validation';

describe('useFormValidation', () => {
  const mockOnSubmit = jest.fn();
  
  const defaultOptions = {
    initialValues: { email: '', password: '' } as const,
    validate: validateLoginForm,
    onSubmit: mockOnSubmit,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with initial values', () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    expect(result.current.values).toEqual({ email: '', password: '' });
    expect(result.current.errors).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.isValid).toBe(true);
  });

  it('should update values when setValue is called', () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    act(() => {
      result.current.setValue('email', 'test@example.com');
    });

    expect(result.current.values.email).toBe('test@example.com');
  });

  it('should clear error when setValue is called for field with error', () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    // Set an error first
    act(() => {
      result.current.setError('email', 'Invalid email');
    });

    expect(result.current.errors.email).toBe('Invalid email');

    // Update value should clear the error
    act(() => {
      result.current.setValue('email', 'test@example.com');
    });

    expect(result.current.errors.email).toBeUndefined();
  });

  it('should set and clear errors', () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    act(() => {
      result.current.setError('email', 'Invalid email');
    });

    expect(result.current.errors.email).toBe('Invalid email');
    expect(result.current.isValid).toBe(false);

    act(() => {
      result.current.clearError('email');
    });

    expect(result.current.errors.email).toBeUndefined();
    expect(result.current.isValid).toBe(true);
  });

  it('should clear all errors', () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    act(() => {
      result.current.setError('email', 'Invalid email');
      result.current.setError('password', 'Invalid password');
    });

    expect(result.current.errors.email).toBe('Invalid email');
    expect(result.current.errors.password).toBe('Invalid password');

    act(() => {
      result.current.clearAllErrors();
    });

    expect(result.current.errors).toEqual({});
  });

  it('should validate form before submission', async () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    await act(async () => {
      await result.current.handleSubmit();
    });

    // Should have validation errors for empty form
    expect(result.current.errors.email).toBeDefined();
    expect(result.current.errors.password).toBeDefined();
    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should submit when form is valid', async () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    act(() => {
      result.current.setValue('email', 'test@example.com');
      result.current.setValue('password', 'password123');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(mockOnSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
    });
  });

  it('should handle submission errors', async () => {
    const errorOnSubmit = jest.fn().mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() => 
      useFormValidation({
        initialValues: { email: '', password: '' } as const,
        validate: validateLoginForm,
        onSubmit: errorOnSubmit,
      })
    );

    act(() => {
      result.current.setValue('email', 'test@example.com');
      result.current.setValue('password', 'password123');
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.errors.general).toBe('Network error');
    expect(result.current.isSubmitting).toBe(false);
  });

  it('should set isSubmitting during submission', async () => {
    let resolveSubmit: () => void;
    const slowOnSubmit = jest.fn(() => new Promise<void>(resolve => {
      resolveSubmit = resolve;
    }));

    const { result } = renderHook(() => 
      useFormValidation({
        initialValues: { email: '', password: '' } as const,
        validate: validateLoginForm,
        onSubmit: slowOnSubmit,
      })
    );

    act(() => {
      result.current.setValue('email', 'test@example.com');
      result.current.setValue('password', 'password123');
    });

    // Start submission
    const submitPromise = act(async () => {
      await result.current.handleSubmit();
    });

    expect(result.current.isSubmitting).toBe(true);

    // Resolve submission
    act(() => {
      resolveSubmit();
    });

    await submitPromise;

    expect(result.current.isSubmitting).toBe(false);
  });

  it('should reset form to initial state', () => {
    const { result } = renderHook(() => useFormValidation(defaultOptions));

    act(() => {
      result.current.setValue('email', 'test@example.com');
      result.current.setError('password', 'Some error');
    });

    expect(result.current.values.email).toBe('test@example.com');
    expect(result.current.errors.password).toBe('Some error');

    act(() => {
      result.current.reset();
    });

    expect(result.current.values).toEqual({ email: '', password: '' });
    expect(result.current.errors).toEqual({});
    expect(result.current.isSubmitting).toBe(false);
  });
});