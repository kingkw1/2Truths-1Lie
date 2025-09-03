/**
 * Upload UI Integration Example
 * Demonstrates how to use the enhanced upload UI components
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { EnhancedUploadUI, UploadProgressIndicator } from '../components';
import { useUploadManager } from '../hooks/useUploadManager';

interface UploadUIExampleProps {
  statementIndex: number;
  videoUri: string;
  filename: string;
  duration: number;
}

export const UploadUIExample: React.FC<UploadUIExampleProps> = ({
  statementIndex,
  videoUri,
  filename,
  duration,
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadMode, setUploadMode] = useState<'progress' | 'full'>('progress');

  const uploadManager = useUploadManager(statementIndex, {
    maxRetries: 3,
    compressionQuality: 0.8,
    maxFileSize: 50 * 1024 * 1024, // 50MB
  });

  const handleStartUpload = async () => {
    try {
      const result = await uploadManager.startUpload(videoUri, filename, duration);
      Alert.alert('Upload Complete', `Video uploaded successfully! Media ID: ${result.mediaId}`);
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    }
  };

  const handleRetryUpload = async () => {
    try {
      const result = await uploadManager.retryUpload(videoUri, filename, duration);
      Alert.alert('Upload Complete', `Video uploaded successfully! Media ID: ${result.mediaId}`);
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message);
    }
  };

  const handleCancelUpload = () => {
    uploadManager.cancelUpload();
    setShowUploadModal(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload UI Examples</Text>
      
      {/* Upload State Display */}
      <View style={styles.stateContainer}>
        <Text style={styles.stateTitle}>Upload State:</Text>
        <Text style={styles.stateText}>
          Status: {uploadManager.state.isUploading ? 'Uploading' : 'Idle'}
        </Text>
        <Text style={styles.stateText}>
          Progress: {uploadManager.state.progress}%
        </Text>
        <Text style={styles.stateText}>
          Error: {uploadManager.state.error || 'None'}
        </Text>
        <Text style={styles.stateText}>
          Retry Count: {uploadManager.state.retryCount}
        </Text>
      </View>

      {/* Mode Selection */}
      <View style={styles.modeContainer}>
        <Text style={styles.modeTitle}>Display Mode:</Text>
        <View style={styles.modeButtons}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              uploadMode === 'progress' && styles.modeButtonActive,
            ]}
            onPress={() => setUploadMode('progress')}
          >
            <Text style={styles.modeButtonText}>Progress Only</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              uploadMode === 'full' && styles.modeButtonActive,
            ]}
            onPress={() => setUploadMode('full')}
          >
            <Text style={styles.modeButtonText}>Full UI</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Upload Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleStartUpload}
          disabled={uploadManager.state.isUploading}
        >
          <Text style={styles.primaryButtonText}>Start Upload</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleRetryUpload}
          disabled={!uploadManager.state.canRetry}
        >
          <Text style={styles.secondaryButtonText}>Retry Upload</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.dangerButton]}
          onPress={handleCancelUpload}
          disabled={!uploadManager.state.canCancel}
        >
          <Text style={styles.dangerButtonText}>Cancel Upload</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={() => setShowUploadModal(true)}
        >
          <Text style={styles.secondaryButtonText}>Show Modal</Text>
        </TouchableOpacity>
      </View>

      {/* Upload UI Display */}
      {uploadMode === 'progress' && (
        <UploadProgressIndicator
          statementIndex={statementIndex}
          visible={uploadManager.state.isUploading || !!uploadManager.state.error}
          onRetry={handleRetryUpload}
          onCancel={handleCancelUpload}
          allowCancel={true}
          allowRetry={uploadManager.state.canRetry}
        />
      )}

      {uploadMode === 'full' && (
        <EnhancedUploadUI
          statementIndex={statementIndex}
          videoUri={videoUri}
          filename={filename}
          duration={duration}
          onUploadComplete={(result) => {
            Alert.alert('Upload Complete', `Success! Media ID: ${result.mediaId}`);
          }}
          onUploadError={(error) => {
            Alert.alert('Upload Error', error);
          }}
          onCancel={() => {
            Alert.alert('Upload Cancelled', 'Upload was cancelled by user');
          }}
          autoStart={false}
          showModal={false}
        />
      )}

      {/* Modal Example */}
      <EnhancedUploadUI
        statementIndex={statementIndex}
        videoUri={videoUri}
        filename={filename}
        duration={duration}
        onUploadComplete={(result) => {
          Alert.alert('Upload Complete', `Success! Media ID: ${result.mediaId}`);
          setShowUploadModal(false);
        }}
        onUploadError={(error) => {
          Alert.alert('Upload Error', error);
        }}
        onCancel={() => {
          setShowUploadModal(false);
        }}
        autoStart={false}
        showModal={showUploadModal}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  stateContainer: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  stateText: {
    fontSize: 14,
    marginBottom: 4,
    color: '#666',
  },
  modeContainer: {
    marginBottom: 20,
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  modeButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: '#4a90e2',
  },
  modeButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  controlsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    minWidth: '45%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    backgroundColor: '#4a90e2',
  },
  secondaryButton: {
    backgroundColor: '#6c757d',
  },
  dangerButton: {
    backgroundColor: '#dc3545',
  },
  primaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  dangerButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default UploadUIExample;