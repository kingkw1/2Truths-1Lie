/**
 * Enhanced Camera Error Handler Component
 * Specialized error handling for camera recording operations with hardware-specific recovery
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { ErrorDetails } from '../services/enhancedErrorHandlingService';
import { EnhancedErrorDisplay } from './EnhancedErrorDisplay';

export interface CameraErrorHandlerProps {
  error: ErrorDetails | null;
  isRetrying?: boolean;
  retryCount?: number;
  maxRetries?: number;
  availableStorage?: number; // in bytes
  onRetry?: () => void;
  onCancel?: () => void;
  onRequestPermissions?: () => void;
  onSwitchCamera?: () => void;
  onReduceQuality?: () => void;
  onOpenSettings?: () => void;
  style?: any;
}

export const CameraErrorHandler: React.FC<CameraErrorHandlerProps> = ({
  error,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  availableStorage,
  onRetry,
  onCancel,
  onRequestPermissions,
  onSwitchCamera,
  onReduceQuality,
  onOpenSettings,
  style,
}) => {
  const [showHelp, setShowHelp] = useState(false);

  if (!error) return null;

  const getCameraSpecificActions = useCallback(() => {
    const actions = [];

    switch (error.type) {
      case 'permission':
        actions.push(
          <TouchableOpacity
            key="permissions"
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={onRequestPermissions}
          >
            <Text style={styles.primaryActionButtonText}>Grant Permissions</Text>
          </TouchableOpacity>
        );

        actions.push(
          <TouchableOpacity
            key="settings"
            style={[styles.actionButton, styles.secondaryActionButton]}
            onPress={() => {
              Alert.alert(
                'Open Settings',
                'Go to device settings to manually grant camera and microphone permissions.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Open Settings', 
                    onPress: () => {
                      if (Platform.OS === 'ios') {
                        Linking.openURL('app-settings:');
                      } else {
                        Linking.openSettings();
                      }
                    }
                  },
                ]
              );
            }}
          >
            <Text style={styles.secondaryActionButtonText}>Open Settings</Text>
          </TouchableOpacity>
        );
        break;

      case 'hardware':
        actions.push(
          <TouchableOpacity
            key="switch"
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={onSwitchCamera}
          >
            <Text style={styles.primaryActionButtonText}>Switch Camera</Text>
          </TouchableOpacity>
        );

        actions.push(
          <TouchableOpacity
            key="restart"
            style={[styles.actionButton, styles.warningActionButton]}
            onPress={() => {
              Alert.alert(
                'Restart Required',
                'Camera hardware issues often require restarting the app or device. Would you like to restart the app?',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { 
                    text: 'Restart App',
                    style: 'destructive',
                    onPress: () => {
                      // This should be handled by the parent component
                      console.log('App restart requested');
                    }
                  },
                ]
              );
            }}
          >
            <Text style={styles.warningActionButtonText}>Restart App</Text>
          </TouchableOpacity>
        );
        break;

      case 'storage':
        const storageGB = availableStorage ? 
          Math.round(availableStorage / (1024 * 1024 * 1024) * 10) / 10 : 0;

        actions.push(
          <TouchableOpacity
            key="cleanup"
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => {
              Alert.alert(
                'Free Up Space',
                `You have ${storageGB}GB available. Recording requires at least 100MB of free space.`,
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear App Cache', onPress: () => console.log('Clear cache requested') },
                  { text: 'Delete Old Videos', onPress: () => console.log('Delete videos requested') },
                ]
              );
            }}
          >
            <Text style={styles.primaryActionButtonText}>Free Up Space</Text>
          </TouchableOpacity>
        );

        if (storageGB > 0.1) { // If there's some space, offer quality reduction
          actions.push(
            <TouchableOpacity
              key="quality"
              style={[styles.actionButton, styles.secondaryActionButton]}
              onPress={onReduceQuality}
            >
              <Text style={styles.secondaryActionButtonText}>Record Lower Quality</Text>
            </TouchableOpacity>
          );
        }
        break;

      case 'recording':
        if (error.message.toLowerCase().includes('interrupted') || 
            error.message.toLowerCase().includes('background')) {
          actions.push(
            <TouchableOpacity
              key="foreground"
              style={[styles.actionButton, styles.infoActionButton]}
              onPress={() => setShowHelp(true)}
            >
              <Text style={styles.infoActionButtonText}>Background Tips</Text>
            </TouchableOpacity>
          );
        }

        actions.push(
          <TouchableOpacity
            key="retry"
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={onRetry}
            disabled={isRetrying || retryCount >= maxRetries}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.primaryActionButtonText}>
                {retryCount >= maxRetries ? 'Max Retries Reached' : 'Try Recording Again'}
              </Text>
            )}
          </TouchableOpacity>
        );
        break;

      default:
        if (error.retryable) {
          actions.push(
            <TouchableOpacity
              key="retry"
              style={[styles.actionButton, styles.primaryActionButton]}
              onPress={onRetry}
              disabled={isRetrying}
            >
              {isRetrying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryActionButtonText}>Try Again</Text>
              )}
            </TouchableOpacity>
          );
        }
    }

    // Always add cancel option
    actions.push(
      <TouchableOpacity
        key="cancel"
        style={[styles.actionButton, styles.cancelActionButton]}
        onPress={onCancel}
      >
        <Text style={styles.cancelActionButtonText}>Cancel</Text>
      </TouchableOpacity>
    );

    return actions;
  }, [error, isRetrying, retryCount, maxRetries, availableStorage, onRetry, onCancel, onRequestPermissions, onSwitchCamera, onReduceQuality]);

  const getHardwareInfo = () => {
    if (error.type !== 'hardware') return null;

    return (
      <View style={styles.hardwareInfo}>
        <Text style={styles.hardwareInfoTitle}>Camera Troubleshooting:</Text>
        <Text style={styles.hardwareInfoText}>• Close other camera apps (Instagram, Snapchat, etc.)</Text>
        <Text style={styles.hardwareInfoText}>• Check if camera works in other apps</Text>
        <Text style={styles.hardwareInfoText}>• Restart your device if issues persist</Text>
        <Text style={styles.hardwareInfoText}>• Try using the front-facing camera instead</Text>
      </View>
    );
  };

  const getStorageBreakdown = () => {
    if (error.type !== 'storage' || !availableStorage) return null;

    const storageGB = Math.round(availableStorage / (1024 * 1024 * 1024) * 10) / 10;
    const recommendedGB = 0.5; // 500MB recommended
    const minimumGB = 0.1; // 100MB minimum

    return (
      <View style={styles.storageInfo}>
        <Text style={styles.storageInfoTitle}>Storage Information:</Text>
        <Text style={styles.storageInfoText}>
          Available: {storageGB}GB
        </Text>
        <Text style={styles.storageInfoText}>
          Recommended: {recommendedGB}GB
        </Text>
        <Text style={styles.storageInfoText}>
          Minimum: {minimumGB}GB
        </Text>
        {storageGB < minimumGB && (
          <Text style={styles.criticalStorageText}>
            ⚠️ Critical: Recording not possible with current storage
          </Text>
        )}
      </View>
    );
  };

  const getPermissionGuide = () => {
    if (error.type !== 'permission') return null;

    return (
      <View style={styles.permissionGuide}>
        <Text style={styles.permissionGuideTitle}>Required Permissions:</Text>
        <Text style={styles.permissionGuideText}>📷 Camera - For video recording</Text>
        <Text style={styles.permissionGuideText}>🎤 Microphone - For audio recording</Text>
        <Text style={styles.permissionGuideText}>💾 Storage - For saving videos</Text>
        
        <Text style={styles.permissionStepsTitle}>How to grant permissions:</Text>
        <Text style={styles.permissionStepsText}>
          {Platform.OS === 'ios' 
            ? '1. Tap "Grant Permissions" or go to Settings > 2Truths-1Lie\n2. Enable Camera and Microphone\n3. Return to the app'
            : '1. Tap "Grant Permissions" or go to Settings > Apps > 2Truths-1Lie\n2. Go to Permissions\n3. Enable Camera, Microphone, and Storage\n4. Return to the app'
          }
        </Text>
      </View>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <EnhancedErrorDisplay
        error={error}
        isRetrying={isRetrying}
        retryCount={retryCount}
        maxRetries={maxRetries}
        compact={false}
        showDetails={false}
      />

      {/* Camera-specific information */}
      {getHardwareInfo()}
      {getStorageBreakdown()}
      {getPermissionGuide()}

      {/* Camera-specific actions */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Camera Actions:</Text>
        <View style={styles.actionButtons}>
          {getCameraSpecificActions()}
        </View>
      </View>

      {/* Background Recording Help Modal */}
      <Modal
        visible={showHelp}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowHelp(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Preventing Recording Interruptions</Text>
            
            <Text style={styles.modalSection}>📱 Keep App Active:</Text>
            <Text style={styles.modalText}>• Keep the app in the foreground while recording</Text>
            <Text style={styles.modalText}>• Don't switch to other apps during recording</Text>
            <Text style={styles.modalText}>• Avoid incoming calls if possible</Text>
            
            <Text style={styles.modalSection}>🔋 Battery Settings:</Text>
            <Text style={styles.modalText}>• Disable battery optimization for this app</Text>
            <Text style={styles.modalText}>• Turn off auto-lock during recording</Text>
            <Text style={styles.modalText}>• Keep device charged during long recordings</Text>
            
            <Text style={styles.modalSection}>📳 Notifications:</Text>
            <Text style={styles.modalText}>• Consider enabling Do Not Disturb mode</Text>
            <Text style={styles.modalText}>• Close unnecessary background apps</Text>
            
            <TouchableOpacity
              style={styles.modalCloseButton}
              onPress={() => setShowHelp(false)}
            >
              <Text style={styles.modalCloseButtonText}>Got It</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  hardwareInfo: {
    backgroundColor: '#fff3cd',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#ffc107',
  },
  hardwareInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#856404',
    marginBottom: 8,
  },
  hardwareInfoText: {
    fontSize: 13,
    color: '#856404',
    lineHeight: 18,
    marginBottom: 4,
  },
  storageInfo: {
    backgroundColor: '#f8d7da',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#dc3545',
  },
  storageInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#721c24',
    marginBottom: 8,
  },
  storageInfoText: {
    fontSize: 13,
    color: '#721c24',
    lineHeight: 18,
    marginBottom: 2,
  },
  criticalStorageText: {
    fontSize: 12,
    color: '#dc3545',
    fontWeight: '600',
    marginTop: 4,
  },
  permissionGuide: {
    backgroundColor: '#cce5ff',
    padding: 12,
    borderRadius: 8,
    marginVertical: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  permissionGuideTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#003d82',
    marginBottom: 8,
  },
  permissionGuideText: {
    fontSize: 13,
    color: '#003d82',
    lineHeight: 18,
    marginBottom: 4,
  },
  permissionStepsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#003d82',
    marginTop: 8,
    marginBottom: 4,
  },
  permissionStepsText: {
    fontSize: 12,
    color: '#003d82',
    lineHeight: 16,
  },
  actionsContainer: {
    marginTop: 16,
  },
  actionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 100,
    marginBottom: 8,
  },
  primaryActionButton: {
    backgroundColor: '#007AFF',
  },
  secondaryActionButton: {
    backgroundColor: '#6c757d',
  },
  warningActionButton: {
    backgroundColor: '#ffc107',
  },
  infoActionButton: {
    backgroundColor: '#17a2b8',
  },
  cancelActionButton: {
    backgroundColor: '#dc3545',
  },
  primaryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  warningActionButtonText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '600',
  },
  infoActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelActionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxWidth: 350,
    width: '100%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalSection: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
    marginTop: 12,
    marginBottom: 6,
  },
  modalText: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
    marginLeft: 8,
  },
  modalCloseButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  modalCloseButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
