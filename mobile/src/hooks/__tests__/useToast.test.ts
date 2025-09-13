import { renderHook, act } from '@testing-library/react-native';
import { useToast } from '../useToast';

describe('useToast', () => {
  it('initializes with toast not visible', () => {
    const { result } = renderHook(() => useToast());
    
    expect(result.current.toast.visible).toBe(false);
    expect(result.current.toast.message).toBe('');
    expect(result.current.toast.type).toBe('info');
  });

  it('shows toast with message and type', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Test message', 'success');
    });
    
    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Test message');
    expect(result.current.toast.type).toBe('success');
  });

  it('hides toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showToast('Test message', 'success');
    });
    
    expect(result.current.toast.visible).toBe(true);
    
    act(() => {
      result.current.hideToast();
    });
    
    expect(result.current.toast.visible).toBe(false);
  });

  it('shows success toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showSuccess('Success message');
    });
    
    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Success message');
    expect(result.current.toast.type).toBe('success');
  });

  it('shows error toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showError('Error message');
    });
    
    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Error message');
    expect(result.current.toast.type).toBe('error');
  });

  it('shows warning toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showWarning('Warning message');
    });
    
    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Warning message');
    expect(result.current.toast.type).toBe('warning');
  });

  it('shows info toast', () => {
    const { result } = renderHook(() => useToast());
    
    act(() => {
      result.current.showInfo('Info message');
    });
    
    expect(result.current.toast.visible).toBe(true);
    expect(result.current.toast.message).toBe('Info message');
    expect(result.current.toast.type).toBe('info');
  });
});