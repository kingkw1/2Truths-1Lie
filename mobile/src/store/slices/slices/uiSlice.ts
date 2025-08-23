/**
 * UI State Redux slice
 * Manages general UI state, notifications, modals, and user interface elements
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  duration?: number;
  timestamp: Date;
}

export interface Modal {
  id: string;
  type: 'achievement' | 'levelUp' | 'confirmation' | 'tutorial';
  data?: any;
  isOpen: boolean;
}

export interface UIState {
  notifications: Notification[];
  modals: Modal[];
  isMenuOpen: boolean;
  currentScreen: 'menu' | 'create' | 'browse' | 'profile' | 'game';
  isLoading: boolean;
  loadingMessage: string;
  theme: 'light' | 'dark';
  soundEnabled: boolean;
  animationsEnabled: boolean;
  tutorialCompleted: boolean;
  showFPS: boolean;
}

const initialState: UIState = {
  notifications: [],
  modals: [],
  isMenuOpen: false,
  currentScreen: 'menu',
  isLoading: false,
  loadingMessage: '',
  theme: 'light',
  soundEnabled: true,
  animationsEnabled: true,
  tutorialCompleted: false,
  showFPS: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    showNotification: (state, action: PayloadAction<Omit<Notification, 'id' | 'timestamp'>>) => {
      const notification: Notification = {
        ...action.payload,
        id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date(),
      };
      
      state.notifications.push(notification);
      
      // Auto-remove after duration (default 5 seconds)
      const duration = notification.duration || 5000;
      setTimeout(() => {
        // This would be handled by middleware in a real app
      }, duration);
    },

    dismissNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        notif => notif.id !== action.payload
      );
    },

    clearAllNotifications: (state) => {
      state.notifications = [];
    },

    openModal: (state, action: PayloadAction<Omit<Modal, 'isOpen'>>) => {
      const modal: Modal = {
        ...action.payload,
        isOpen: true,
      };
      
      // Close any existing modal of the same type
      state.modals = state.modals.filter(m => m.type !== modal.type);
      state.modals.push(modal);
    },

    closeModal: (state, action: PayloadAction<string>) => {
      const modalIndex = state.modals.findIndex(m => m.id === action.payload);
      if (modalIndex !== -1 && state.modals[modalIndex]) {
        state.modals[modalIndex].isOpen = false;
      }
    },

    closeAllModals: (state) => {
      state.modals.forEach(modal => {
        modal.isOpen = false;
      });
    },

    toggleMenu: (state) => {
      state.isMenuOpen = !state.isMenuOpen;
    },

    setMenuOpen: (state, action: PayloadAction<boolean>) => {
      state.isMenuOpen = action.payload;
    },

    navigateToScreen: (state, action: PayloadAction<UIState['currentScreen']>) => {
      state.currentScreen = action.payload;
      state.isMenuOpen = false; // Close menu when navigating
    },

    setLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || '';
    },

    setTheme: (state, action: PayloadAction<'light' | 'dark'>) => {
      state.theme = action.payload;
    },

    toggleSound: (state) => {
      state.soundEnabled = !state.soundEnabled;
    },

    toggleAnimations: (state) => {
      state.animationsEnabled = !state.animationsEnabled;
    },

    completeTutorial: (state) => {
      state.tutorialCompleted = true;
    },

    toggleFPS: (state) => {
      state.showFPS = !state.showFPS;
    },

    // Batch update settings
    updateSettings: (state, action: PayloadAction<Partial<Pick<UIState, 'theme' | 'soundEnabled' | 'animationsEnabled'>>>) => {
      Object.assign(state, action.payload);
    },
  },
});

export const {
  showNotification,
  dismissNotification,
  clearAllNotifications,
  openModal,
  closeModal,
  closeAllModals,
  toggleMenu,
  setMenuOpen,
  navigateToScreen,
  setLoading,
  setTheme,
  toggleSound,
  toggleAnimations,
  completeTutorial,
  toggleFPS,
  updateSettings,
} = uiSlice.actions;

export default uiSlice.reducer;