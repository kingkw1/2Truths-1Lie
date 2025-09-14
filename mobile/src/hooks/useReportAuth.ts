/**
 * Report Authentication Hook
 * Provides authentication utilities specifically for content reporting
 */

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useAuth } from './useAuth';
import { reportService } from '../services/reportService';

export interface ReportAuthState {
  canReport: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  authMessage?: string;
}

export interface ReportAuthActions {
  checkReportAuth: () => ReportAuthState;
  handleAuthRequired: (onAuthSuccess?: () => void) => void;
  validateReportPermissions: () => Promise<boolean>;
}

export const useReportAuth = (): ReportAuthState & ReportAuthActions => {
  const { isAuthenticated, isGuest, triggerAuthFlow } = useAuth();

  const checkReportAuth = useCallback((): ReportAuthState => {
    const authStatus = reportService.getAuthenticationStatus();
    
    return {
      canReport: authStatus.canReport,
      isAuthenticated: authStatus.isAuthenticated,
      isGuest: authStatus.isGuest,
      authMessage: authStatus.authMessage,
    };
  }, []);

  const handleAuthRequired = useCallback((onAuthSuccess?: () => void) => {
    const authState = checkReportAuth();
    
    if (authState.canReport) {
      // User can already report, call success callback if provided
      onAuthSuccess?.();
      return;
    }

    const alertTitle = authState.isGuest 
      ? 'Account Required' 
      : 'Sign In Required';
    
    const alertMessage = authState.authMessage || 
      'Please sign in to report inappropriate content';

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign In',
          style: 'default',
          onPress: () => {
            console.log('🚩 REPORT_AUTH: Triggering auth flow');
            triggerAuthFlow();
            // Note: onAuthSuccess would need to be called after successful auth
            // This would require integration with auth flow completion
          },
        },
      ]
    );
  }, [checkReportAuth, triggerAuthFlow]);

  const validateReportPermissions = useCallback(async (): Promise<boolean> => {
    try {
      const authCheck = reportService.canUserReport();
      
      if (!authCheck.canReport) {
        console.log('🚩 REPORT_AUTH: User cannot report:', authCheck.reason);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('🚩 REPORT_AUTH: Error validating permissions:', error);
      return false;
    }
  }, []);

  const currentState = checkReportAuth();

  return {
    ...currentState,
    checkReportAuth,
    handleAuthRequired,
    validateReportPermissions,
  };
};

export default useReportAuth;