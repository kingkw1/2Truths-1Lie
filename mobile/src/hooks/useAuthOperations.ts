import { useState, useCallback } from 'react';
import { authService, AuthUser } from '../services/authService';

export interface AuthOperationState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
  progress: number;
  message: string;
}

export const useAuthOperations = () => {
  const [loginState, setLoginState] = useState<AuthOperationState>({
    isLoading: false,
    error: null,
    success: false,
    progress: 0,
    message: '',
  });

  const [signupState, setSignupState] = useState<AuthOperationState>({
    isLoading: false,
    error: null,
    success: false,
    progress: 0,
    message: '',
  });

  const resetLoginState = useCallback(() => {
    setLoginState({
      isLoading: false,
      error: null,
      success: false,
      progress: 0,
      message: '',
    });
  }, []);

  const resetSignupState = useCallback(() => {
    setSignupState({
      isLoading: false,
      error: null,
      success: false,
      progress: 0,
      message: '',
    });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    resetLoginState();
    
    setLoginState(prev => ({
      ...prev,
      isLoading: true,
      message: 'Validating credentials...',
      progress: 25,
    }));

    try {
      // Simulate progress updates for better UX
      setTimeout(() => {
        setLoginState(prev => ({
          ...prev,
          message: 'Connecting to server...',
          progress: 50,
        }));
      }, 500);

      const user = await authService.login(email, password);

      setLoginState(prev => ({
        ...prev,
        message: 'Login successful!',
        progress: 100,
        success: true,
      }));

      // Keep success state briefly before resetting
      setTimeout(() => {
        resetLoginState();
      }, 2000);

      return user;
    } catch (error: any) {
      setLoginState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Login failed',
        progress: 0,
        message: '',
      }));
      throw error;
    }
  }, [resetLoginState]);

  const signup = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    resetSignupState();
    
    setSignupState(prev => ({
      ...prev,
      isLoading: true,
      message: 'Validating information...',
      progress: 20,
    }));

    try {
      // Simulate progress updates for better UX
      setTimeout(() => {
        setSignupState(prev => ({
          ...prev,
          message: 'Creating your account...',
          progress: 50,
        }));
      }, 500);

      setTimeout(() => {
        setSignupState(prev => ({
          ...prev,
          message: 'Setting up your profile...',
          progress: 75,
        }));
      }, 1000);

      const user = await authService.signup(email, password);

      setSignupState(prev => ({
        ...prev,
        message: 'Account created successfully!',
        progress: 100,
        success: true,
      }));

      // Keep success state briefly before resetting
      setTimeout(() => {
        resetSignupState();
      }, 2000);

      return user;
    } catch (error: any) {
      setSignupState(prev => ({
        ...prev,
        isLoading: false,
        error: error.message || 'Signup failed',
        progress: 0,
        message: '',
      }));
      throw error;
    }
  }, [resetSignupState]);

  const retryLogin = useCallback((email: string, password: string) => {
    return login(email, password);
  }, [login]);

  const retrySignup = useCallback((email: string, password: string) => {
    return signup(email, password);
  }, [signup]);

  return {
    loginState,
    signupState,
    login,
    signup,
    retryLogin,
    retrySignup,
    resetLoginState,
    resetSignupState,
  };
};