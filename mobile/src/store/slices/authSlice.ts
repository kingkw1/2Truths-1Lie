/**
 * Authentication Redux slice
 * Manages user authentication state, login/logout actions, and auth status
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { authService, AuthUser, AuthError } from '../../services/authService';

export interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  isLoading: boolean;
  error: string | null;
  lastAuthAction: 'login' | 'signup' | 'logout' | 'init' | null;
  tokenValidated: boolean;
  permissions: string[];
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isLoading: false,
  error: null,
  lastAuthAction: null,
  tokenValidated: false,
  permissions: [],
};

// Async thunks for authentication actions
export const initializeAuth = createAsyncThunk(
  'auth/initialize',
  async (_, { rejectWithValue }) => {
    try {
      await authService.initialize();
      const user = authService.getCurrentUser();
      const authStatus = authService.getAuthStatus();
      const permissions = await authService.getUserPermissions();
      
      return {
        user,
        isAuthenticated: authStatus.isAuthenticated,
        isGuest: authStatus.isGuest,
        permissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Failed to initialize authentication');
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const user = await authService.login(email, password);
      const permissions = await authService.getUserPermissions();
      
      return {
        user,
        permissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Login failed');
    }
  }
);

export const signupUser = createAsyncThunk(
  'auth/signup',
  async ({ email, password }: { email: string; password: string }, { rejectWithValue }) => {
    try {
      const user = await authService.signup(email, password);
      const permissions = await authService.getUserPermissions();
      
      return {
        user,
        permissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Signup failed');
    }
  }
);

export const logoutUser = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await authService.logout();
      const user = authService.getCurrentUser();
      const authStatus = authService.getAuthStatus();
      const permissions = await authService.getUserPermissions();
      
      return {
        user,
        isAuthenticated: authStatus.isAuthenticated,
        isGuest: authStatus.isGuest,
        permissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Logout failed');
    }
  }
);

export const validateToken = createAsyncThunk(
  'auth/validateToken',
  async (_, { rejectWithValue }) => {
    try {
      const isValid = await authService.validateToken();
      const permissions = await authService.getUserPermissions();
      
      return {
        isValid,
        permissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Token validation failed');
    }
  }
);

export const refreshAuthToken = createAsyncThunk(
  'auth/refreshToken',
  async (_, { rejectWithValue }) => {
    try {
      const newToken = await authService.refreshToken();
      const permissions = await authService.getUserPermissions();
      
      return {
        token: newToken,
        permissions,
      };
    } catch (error: any) {
      return rejectWithValue(error.message || 'Token refresh failed');
    }
  }
);

export const updateUserProfile = createAsyncThunk(
  'auth/updateProfile',
  async (updates: Partial<AuthUser>, { rejectWithValue }) => {
    try {
      const updatedUser = await authService.updateProfile(updates);
      return updatedUser;
    } catch (error: any) {
      return rejectWithValue(error.message || 'Profile update failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearAuthError: (state) => {
      state.error = null;
    },
    
    setAuthLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    
    // Sync action to update auth state from service
    syncAuthState: (state) => {
      const authStatus = authService.getAuthStatus();
      state.user = authStatus.user;
      state.isAuthenticated = authStatus.isAuthenticated;
      state.isGuest = authStatus.isGuest;
    },
    
    // Update permissions without async call
    setPermissions: (state, action: PayloadAction<string[]>) => {
      state.permissions = action.payload;
    },
    
    // Trigger auth flow for guest users who want to sign in
    triggerAuthFlow: (state) => {
      console.log('🎯 triggerAuthFlow action called - setting isAuthenticated to false');
      // Temporarily set to unauthenticated to trigger navigation to auth screens
      // This preserves the guest session but shows login/signup screens
      state.isAuthenticated = false;
      state.lastAuthAction = null;
    },
  },
  extraReducers: (builder) => {
    // Initialize auth
    builder
      .addCase(initializeAuth.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastAuthAction = 'init';
      })
      .addCase(initializeAuth.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.isGuest = action.payload.isGuest;
        state.permissions = action.payload.permissions;
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
        state.isAuthenticated = false;
        state.isGuest = true;
      });

    // Login user
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastAuthAction = 'login';
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isGuest = false;
        state.permissions = action.payload.permissions;
        state.tokenValidated = true;
        state.error = null;
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Signup user
    builder
      .addCase(signupUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastAuthAction = 'signup';
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        state.isGuest = false;
        state.permissions = action.payload.permissions;
        state.tokenValidated = true;
        state.error = null;
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Logout user
    builder
      .addCase(logoutUser.pending, (state) => {
        state.isLoading = true;
        state.error = null;
        state.lastAuthAction = 'logout';
      })
      .addCase(logoutUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.isAuthenticated = action.payload.isAuthenticated;
        state.isGuest = action.payload.isGuest;
        state.permissions = action.payload.permissions;
        state.tokenValidated = false;
        state.error = null;
      })
      .addCase(logoutUser.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });

    // Validate token
    builder
      .addCase(validateToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(validateToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokenValidated = action.payload.isValid;
        state.permissions = action.payload.permissions;
        
        if (!action.payload.isValid) {
          // Token is invalid, reset to guest state
          state.isAuthenticated = false;
          state.isGuest = true;
        }
      })
      .addCase(validateToken.rejected, (state, action) => {
        state.isLoading = false;
        state.tokenValidated = false;
        state.error = action.payload as string;
      });

    // Refresh token
    builder
      .addCase(refreshAuthToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(refreshAuthToken.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tokenValidated = true;
        state.permissions = action.payload.permissions;
        state.error = null;
      })
      .addCase(refreshAuthToken.rejected, (state, action) => {
        state.isLoading = false;
        state.tokenValidated = false;
        state.error = action.payload as string;
      });

    // Update profile
    builder
      .addCase(updateUserProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateUserProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateUserProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      });
  },
});

export const {
  clearAuthError,
  setAuthLoading,
  syncAuthState,
  setPermissions,
  triggerAuthFlow,
} = authSlice.actions;

// Selectors
export const selectAuth = (state: { auth: AuthState }) => state.auth;
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectIsGuest = (state: { auth: AuthState }) => state.auth.isGuest;
export const selectAuthLoading = (state: { auth: AuthState }) => state.auth.isLoading;
export const selectAuthError = (state: { auth: AuthState }) => state.auth.error;
export const selectUserPermissions = (state: { auth: AuthState }) => state.auth.permissions;
export const selectTokenValidated = (state: { auth: AuthState }) => state.auth.tokenValidated;

export default authSlice.reducer;