import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReportAuth } from '../hooks/useReportAuth';
import { ReportService } from '../services/reportService';
import { ReportError, ReportErrorType } from '../services/reportErrors';

// ModerationReason enum values from backend
export enum ModerationReason {
  INAPPROPRIATE_LANGUAGE = 'inappropriate_language',
  SPAM = 'spam',
  PERSONAL_INFO = 'personal_info',
  VIOLENCE = 'violence',
  HATE_SPEECH = 'hate_speech',
  ADULT_CONTENT = 'adult_content',
  COPYRIGHT = 'copyright',
  MISLEADING = 'misleading',
  LOW_QUALITY = 'low_quality',
}

// Human-readable labels for the reasons
const REASON_LABELS: Record<ModerationReason, string> = {
  [ModerationReason.INAPPROPRIATE_LANGUAGE]: 'Inappropriate Language',
  [ModerationReason.SPAM]: 'Spam',
  [ModerationReason.PERSONAL_INFO]: 'Personal Information',
  [ModerationReason.VIOLENCE]: 'Violence',
  [ModerationReason.HATE_SPEECH]: 'Hate Speech',
  [ModerationReason.ADULT_CONTENT]: 'Adult Content',
  [ModerationReason.COPYRIGHT]: 'Copyright Violation',
  [ModerationReason.MISLEADING]: 'Misleading Content',
  [ModerationReason.LOW_QUALITY]: 'Low Quality',
};

export interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: ModerationReason, details?: string) => Promise<void>;
  isSubmitting?: boolean;
}

export const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  onSubmit,
  isSubmitting = false,
}) => {
  const { validateReportPermissions } = useReportAuth();
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<ModerationReason | null>(null);
  const [details, setDetails] = useState('');
  const [isSubmittingLocal, setIsSubmittingLocal] = useState(false);

  const handleSubmit = async () => {
    // Validate permissions before submitting
    const hasPermission = await validateReportPermissions();
    
    if (!hasPermission) {
      Alert.alert(
        'Authentication Required',
        'Your session has expired. Please sign in again to report content.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (!selectedReason) {
      Alert.alert(
        'Reason Required',
        'Please select a reason for reporting this content.',
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setIsSubmittingLocal(true);
      await onSubmit(selectedReason, details.trim() || undefined);
      
      // Reset form after successful submission
      setSelectedReason(null);
      setDetails('');
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
      
      // Get user-friendly error message
      const userMessage = ReportService.getUserFriendlyErrorMessage(error);
      const isRecoverable = ReportService.isRecoverableError(error);
      
      // Determine alert title based on error type
      let alertTitle = 'Report Failed';
      if (error instanceof ReportError) {
        switch (error.type) {
          case ReportErrorType.AUTHENTICATION_ERROR:
            alertTitle = 'Authentication Required';
            break;
          case ReportErrorType.NETWORK_ERROR:
            alertTitle = 'Connection Error';
            break;
          case ReportErrorType.DUPLICATE_REPORT:
            alertTitle = 'Already Reported';
            break;
          case ReportErrorType.RATE_LIMIT:
            alertTitle = 'Too Many Reports';
            break;
          case ReportErrorType.NOT_FOUND:
            alertTitle = 'Challenge Not Found';
            break;
          case ReportErrorType.SERVER_ERROR:
            alertTitle = 'Server Error';
            break;
          default:
            alertTitle = 'Report Failed';
        }
      }
      
      // Show appropriate alert with retry option for recoverable errors
      const buttons = isRecoverable 
        ? [
            { text: 'Cancel', style: 'cancel' as const },
            { text: 'Retry', onPress: handleSubmit }
          ]
        : [{ text: 'OK' }];
      
      Alert.alert(alertTitle, userMessage, buttons);
    } finally {
      setIsSubmittingLocal(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting || isSubmittingLocal) {
      return; // Prevent closing while submitting
    }
    
    // Reset form when closing
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  const renderReasonOption = (reason: ModerationReason) => {
    const isSelected = selectedReason === reason;
    
    return (
      <TouchableOpacity
        key={reason}
        style={[
          styles.reasonOption,
          isSelected && styles.reasonOptionSelected,
        ]}
        onPress={() => setSelectedReason(reason)}
        disabled={isSubmitting || isSubmittingLocal}
        accessibilityRole="radio"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`Report reason: ${REASON_LABELS[reason]}`}
      >
        <View style={[
          styles.radioButton,
          isSelected && styles.radioButtonSelected,
        ]}>
          {isSelected && <View style={styles.radioButtonInner} />}
        </View>
        <Text style={[
          styles.reasonText,
          isSelected && styles.reasonTextSelected,
        ]}>
          {REASON_LABELS[reason]}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
            disabled={isSubmitting || isSubmittingLocal}
            accessibilityLabel="Cancel report"
            accessibilityRole="button"
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <Text style={styles.title}>Report Challenge</Text>
          
          <TouchableOpacity
            style={[
              styles.submitButton,
              (!selectedReason || isSubmitting || isSubmittingLocal) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={!selectedReason || isSubmitting || isSubmittingLocal}
            accessibilityLabel="Submit report"
            accessibilityRole="button"
          >
            <Text style={[
              styles.submitButtonText,
              (!selectedReason || isSubmitting || isSubmittingLocal) && styles.submitButtonTextDisabled,
            ]}>
              {isSubmitting || isSubmittingLocal ? 'Submitting...' : 'Submit'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>
            Help us keep our community safe by reporting inappropriate content. 
            Your report will be reviewed by our moderation team.
          </Text>

          <Text style={styles.sectionTitle}>Reason for Report</Text>
          
          <View style={styles.reasonsList}>
            {Object.values(ModerationReason).map(renderReasonOption)}
          </View>

          <Text style={styles.sectionTitle}>Additional Details (Optional)</Text>
          
          <TextInput
            style={styles.detailsInput}
            placeholder="Provide additional context about why you're reporting this content..."
            placeholderTextColor="#999"
            value={details}
            onChangeText={setDetails}
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
            editable={!isSubmitting && !isSubmittingLocal}
            accessibilityLabel="Additional details about the report"
            accessibilityHint="Optional field to provide more context"
          />
          
          <Text style={styles.characterCount}>
            {details.length}/1000 characters
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
  },
  submitButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
  },
  submitButtonTextDisabled: {
    color: '#999',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginTop: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
    marginTop: 8,
  },
  reasonsList: {
    marginBottom: 24,
  },
  reasonOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  reasonOptionSelected: {
    backgroundColor: '#e3f2fd',
    borderColor: '#007AFF',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: '#007AFF',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#007AFF',
  },
  reasonText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  reasonTextSelected: {
    color: '#007AFF',
    fontWeight: '500',
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#000',
    backgroundColor: '#fff',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 24,
  },
});

export default ReportModal;