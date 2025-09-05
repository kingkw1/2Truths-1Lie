/**
 * Cross-Device Media Viewer Component
 * Demonstrates cross-device accessibility for uploaded videos (iOS/Android, multi-login)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  RefreshControl,
} from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import useCrossDeviceMedia from '../hooks/useCrossDeviceMedia';
import { CrossDeviceMediaItem } from '../services/crossDeviceMediaService';

interface CrossDeviceMediaViewerProps {
  onMediaSelect?: (media: CrossDeviceMediaItem) => void;
  showSyncControls?: boolean;
}

export const CrossDeviceMediaViewer: React.FC<CrossDeviceMediaViewerProps> = ({
  onMediaSelect,
  showSyncControls = true,
}) => {
  const {
    mediaLibrary,
    isLoading,
    error,
    hasMore,
    totalCount,
    syncStatus,
    lastSyncResult,
    loadMediaLibrary,
    syncMediaLibrary,
    verifyMediaAccess,
    getOptimizedStreamingUrl,
    refreshLibrary,
    isFormatSupported,
    devicePreferences,
  } = useCrossDeviceMedia();

  const [selectedMedia, setSelectedMedia] = useState<CrossDeviceMediaItem | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{[key: string]: any}>({});

  // Handle media selection and verification
  const handleMediaSelect = async (media: CrossDeviceMediaItem) => {
    setSelectedMedia(media);
    setPlayingUrl(null);

    try {
      // Verify accessibility
      const verification = await verifyMediaAccess(media.mediaId);
      setVerificationStatus(prev => ({
        ...prev,
        [media.mediaId]: verification,
      }));

      if (verification.accessible && verification.deviceCompatible) {
        // Get optimized streaming URL
        const streamingUrl = await getOptimizedStreamingUrl(media.mediaId);
        if (streamingUrl) {
          setPlayingUrl(streamingUrl);
        } else {
          Alert.alert('Playback Error', 'Failed to get streaming URL for this media');
        }
      } else {
        let message = 'Media cannot be played on this device';
        if (!verification.accessible) {
          message = 'Media is not accessible';
        } else if (!verification.deviceCompatible) {
          message = `Media format not supported on ${Platform.OS}`;
        }
        Alert.alert('Compatibility Issue', message);
      }

      onMediaSelect?.(media);
    } catch (error: any) {
      Alert.alert('Error', `Failed to verify media: ${error.message}`);
    }
  };

  // Handle sync
  const handleSync = async () => {
    try {
      const result = await syncMediaLibrary();
      Alert.alert(
        'Sync Complete',
        `Synced: ${result.syncedCount}, New: ${result.newMediaCount}, Deleted: ${result.deletedCount}`
      );
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message);
    }
  };

  // Load more media
  const handleLoadMore = () => {
    if (hasMore && !isLoading) {
      const nextPage = Math.floor(mediaLibrary.length / 50) + 1;
      loadMediaLibrary(nextPage, 50);
    }
  };

  // Render media item
  const renderMediaItem = ({ item }: { item: CrossDeviceMediaItem }) => {
    const verification = verificationStatus[item.mediaId];
    const isSupported = isFormatSupported(item.mimeType || 'video/mp4');

    return (
      <TouchableOpacity
        style={[
          styles.mediaItem,
          selectedMedia?.mediaId === item.mediaId && styles.selectedMediaItem,
        ]}
        onPress={() => handleMediaSelect(item)}
      >
        <View style={styles.mediaInfo}>
          <Text style={styles.mediaFilename} numberOfLines={1}>
            {item.filename}
          </Text>
          <Text style={styles.mediaDetails}>
            Size: {Math.round(item.fileSize / 1024 / 1024 * 100) / 100} MB • 
            Duration: {Math.round(item.duration / 1000)}s
          </Text>
          <Text style={styles.mediaDetails}>
            Storage: {item.storageType} • Device: {item.deviceInfo || 'Unknown'}
          </Text>
          <Text style={styles.mediaDetails}>
            Uploaded: {new Date(item.uploadedAt).toLocaleDateString()}
          </Text>
        </View>

        <View style={styles.statusContainer}>
          {/* Accessibility Status */}
          <View style={[
            styles.statusBadge,
            item.isAccessible ? styles.accessibleBadge : styles.inaccessibleBadge,
          ]}>
            <Text style={styles.statusText}>
              {item.isAccessible ? '✓ Accessible' : '✗ Not Accessible'}
            </Text>
          </View>

          {/* Format Compatibility */}
          <View style={[
            styles.statusBadge,
            isSupported ? styles.compatibleBadge : styles.incompatibleBadge,
          ]}>
            <Text style={styles.statusText}>
              {isSupported ? `✓ ${Platform.OS}` : `✗ ${Platform.OS}`}
            </Text>
          </View>

          {/* Verification Status */}
          {verification && (
            <View style={[
              styles.statusBadge,
              verification.accessible && verification.deviceCompatible 
                ? styles.verifiedBadge 
                : styles.unverifiedBadge,
            ]}>
              <Text style={styles.statusText}>
                {verification.accessible && verification.deviceCompatible 
                  ? '✓ Verified' 
                  : '⚠ Issues'}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render header
  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Cross-Device Media Library</Text>
      <Text style={styles.subtitle}>
        Platform: {Platform.OS} • Total: {totalCount} media files
      </Text>
      
      {/* Device Preferences */}
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceInfoTitle}>Device Preferences:</Text>
        <Text style={styles.deviceInfoText}>
          Format: {devicePreferences.preferredFormat}
        </Text>
        <Text style={styles.deviceInfoText}>
          Max Resolution: {devicePreferences.maxResolution}
        </Text>
        <Text style={styles.deviceInfoText}>
          Hardware Decoding: {devicePreferences.supportsHardwareDecoding ? 'Yes' : 'No'}
        </Text>
      </View>

      {/* Sync Controls */}
      {showSyncControls && (
        <View style={styles.syncControls}>
          <TouchableOpacity
            style={[styles.syncButton, syncStatus.syncInProgress && styles.disabledButton]}
            onPress={handleSync}
            disabled={syncStatus.syncInProgress}
          >
            {syncStatus.syncInProgress ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.syncButtonText}>Sync Library</Text>
            )}
          </TouchableOpacity>

          {syncStatus.lastSyncTime && (
            <Text style={styles.syncStatus}>
              Last sync: {syncStatus.lastSyncTime.toLocaleString()}
            </Text>
          )}

          {lastSyncResult && (
            <Text style={styles.syncResult}>
              Last sync: {lastSyncResult.syncedCount} synced, {lastSyncResult.newMediaCount} new, {lastSyncResult.deletedCount} deleted
            </Text>
          )}
        </View>
      )}

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={mediaLibrary}
        renderItem={renderMediaItem}
        keyExtractor={(item) => item.mediaId}
        ListHeaderComponent={renderHeader}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refreshLibrary}
          />
        }
        ListFooterComponent={
          isLoading ? (
            <View style={styles.loadingFooter}>
              <ActivityIndicator size="large" color="#007AFF" />
            </View>
          ) : null
        }
      />

      {/* Video Player */}
      {selectedMedia && playingUrl && (
        <View style={styles.videoContainer}>
          <Text style={styles.videoTitle}>Playing: {selectedMedia.filename}</Text>
          <Video
            source={{ uri: playingUrl }}
            style={styles.video}
            useNativeControls
            resizeMode={ResizeMode.CONTAIN}
            shouldPlay={false}
          />
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => {
              setSelectedMedia(null);
              setPlayingUrl(null);
            }}
          >
            <Text style={styles.closeButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  deviceInfo: {
    backgroundColor: '#f8f9fa',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  deviceInfoTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  deviceInfoText: {
    fontSize: 12,
    color: '#666',
  },
  syncControls: {
    marginBottom: 12,
  },
  syncButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  syncStatus: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  syncResult: {
    fontSize: 12,
    color: '#28a745',
    textAlign: 'center',
  },
  errorContainer: {
    backgroundColor: '#ffe6e6',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
  mediaItem: {
    backgroundColor: '#fff',
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  selectedMediaItem: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  mediaInfo: {
    marginBottom: 8,
  },
  mediaFilename: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  mediaDetails: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 4,
    marginBottom: 4,
  },
  accessibleBadge: {
    backgroundColor: '#e8f5e8',
  },
  inaccessibleBadge: {
    backgroundColor: '#ffe6e6',
  },
  compatibleBadge: {
    backgroundColor: '#e3f2fd',
  },
  incompatibleBadge: {
    backgroundColor: '#fff3e0',
  },
  verifiedBadge: {
    backgroundColor: '#e8f5e8',
  },
  unverifiedBadge: {
    backgroundColor: '#fff3e0',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },
  loadingFooter: {
    padding: 20,
    alignItems: 'center',
  },
  videoContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  video: {
    width: '100%',
    height: 200,
    backgroundColor: '#000',
  },
  closeButton: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  closeButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default CrossDeviceMediaViewer;