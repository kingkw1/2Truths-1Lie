/**
 * Example component showing how to integrate ReportButton with ReportModal
 * This demonstrates the complete reporting workflow
 */

import React, { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { ReportButton } from './ReportButton';
import { ReportModal, ModerationReason } from './ReportModal';
import { useAppDispatch } from '../store';
import { submitReport } from '../store/slices/reportingSlice';
import { useToast } from '../hooks/useToast';
import { Toast } from './Toast';

interface ReportingExampleProps {
  challengeId: string;
  onReportSubmitted?: () => void;
}

export const ReportingExample: React.FC<ReportingExampleProps> = ({
  challengeId,
  onReportSubmitted,
}) => {
  const dispatch = useAppDispatch();
  const [showReportModal, setShowReportModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasReported, setHasReported] = useState(false);
  const { toast, showSuccess, showError, hideToast } = useToast();

  const handleReportPress = () => {
    if (hasReported) {
      Alert.alert(
        'Already Reported',
        'You have already reported this challenge.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    setShowReportModal(true);
  };

  const handleReportSubmit = async (reason: ModerationReason, details?: string) => {
    try {
      setIsSubmitting(true);
      
      // Use Redux action to submit report
      await dispatch(submitReport({
        challengeId,
        reason,
        details
      })).unwrap();

      // Mark as reported to prevent duplicate reports
      setHasReported(true);
      
      // Show success message
      showSuccess('Challenge reported. Thank you for helping keep our community safe.');
      
      // Notify parent component
      onReportSubmitted?.();
      
    } catch (error: any) {
      console.error('Failed to submit report:', error);
      
      // Show appropriate error message
      if (error.message.includes('already reported')) {
        setHasReported(true);
        showError('You have already reported this challenge.');
      } else if (error.message.includes('Authentication required')) {
        showError('Please log in to report content.');
      } else if (error.message.includes('not found')) {
        showError('Challenge not found.');
      } else {
        showError('Failed to submit report. Please try again.');
      }
      
      throw error; // Re-throw so modal can handle it
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleModalClose = () => {
    setShowReportModal(false);
  };

  return (
    <View style={styles.container}>
      <ReportButton
        challengeId={challengeId}
        onPress={handleReportPress}
        disabled={hasReported || isSubmitting}
        size="medium"
        variant="default"
      />
      
      <ReportModal
        visible={showReportModal}
        onClose={handleModalClose}
        onSubmit={handleReportSubmit}
        isSubmitting={isSubmitting}
      />
      
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onHide={hideToast}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // This component is just a wrapper, no specific styling needed
  },
});

export default ReportingExample;