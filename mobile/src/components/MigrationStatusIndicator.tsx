/**
 * Migration Status Indicator Component
 * Shows migration status and provides migration controls
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { useMigration, useMigrationStatus } from '../hooks/useMigration';

interface MigrationStatusIndicatorProps {
  showDetails?: boolean;
  autoHide?: boolean;
  onMigrationComplete?: (success: boolean) => void;
}

export const MigrationStatusIndicator: React.FC<MigrationStatusIndicatorProps> = ({
  showDetails = false,
  autoHide = true,
  onMigrationComplete,
}) => {
  const { hasLegacyItems, legacyCount, migrationNeeded, loading, error, refresh } = useMigrationStatus();
  const [showMigrationModal, setShowMigrationModal] = useState(false);

  // Don't show if no migration needed and autoHide is enabled
  if (autoHide && !migrationNeeded && !loading) {
    return null;
  }

  const handleMigrationPress = () => {
    if (migrationNeeded) {
      setShowMigrationModal(true);
    }
  };

  const getStatusColor = () => {
    if (loading) return '#666';
    if (error) return '#ff4444';
    if (migrationNeeded) return '#ff9500';
    return '#4CAF50';
  };

  const getStatusText = () => {
    if (loading) return 'Checking migration status...';
    if (error) return 'Migration check failed';
    if (migrationNeeded) return `${legacyCount} items need migration`;
    return 'All media migrated';
  };

  const getStatusIcon = () => {
    if (loading) return '⏳';
    if (error) return '❌';
    if (migrationNeeded) return '⚠️';
    return '✅';
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, { borderColor: getStatusColor() }]}
        onPress={handleMigrationPress}
        disabled={loading || !migrationNeeded}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>{getStatusIcon()}</Text>
          <View style={styles.textContainer}>
            <Text style={[styles.statusText, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
            {showDetails && migrationNeeded && (
              <Text style={styles.detailText}>
                Tap to migrate legacy media files
              </Text>
            )}
          </View>
          {loading && (
            <ActivityIndicator size="small" color={getStatusColor()} />
          )}
        </View>
      </TouchableOpacity>

      <MigrationModal
        visible={showMigrationModal}
        onClose={() => setShowMigrationModal(false)}
        onComplete={(success) => {
          setShowMigrationModal(false);
          refresh();
          onMigrationComplete?.(success);
        }}
      />
    </>
  );
};

interface MigrationModalProps {
  visible: boolean;
  onClose: () => void;
  onComplete: (success: boolean) => void;
}

const MigrationModal: React.FC<MigrationModalProps> = ({
  visible,
  onClose,
  onComplete,
}) => {
  const migration = useMigration();
  const [migrationStep, setMigrationStep] = useState<'discover' | 'confirm' | 'migrate' | 'complete'>('discover');

  React.useEffect(() => {
    if (visible) {
      setMigrationStep('discover');
      migration.discoverLegacyMedia();
    }
  }, [visible]);

  const handleStartMigration = async () => {
    setMigrationStep('migrate');
    
    try {
      const success = await migration.runMigration({
        dryRun: false,
        batchSize: 3,
        cleanup: true,
      });
      
      setMigrationStep('complete');
      
      // Auto-close after showing results
      setTimeout(() => {
        onComplete(success);
      }, 2000);
      
    } catch (error) {
      Alert.alert(
        'Migration Failed',
        'Failed to migrate media files. Please try again.',
        [{ text: 'OK', onPress: onClose }]
      );
    }
  };

  const handleDryRun = async () => {
    try {
      await migration.runMigration({
        dryRun: true,
        batchSize: 3,
      });
      
      Alert.alert(
        'Dry Run Complete',
        `Found ${migration.legacyItems.length} items that can be migrated.`,
        [
          { text: 'Cancel', style: 'cancel', onPress: onClose },
          { text: 'Migrate Now', onPress: handleStartMigration },
        ]
      );
    } catch (error) {
      Alert.alert('Dry Run Failed', 'Failed to check migration. Please try again.');
    }
  };

  const renderDiscoverStep = () => (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Media Migration</Text>
      
      {migration.isDiscovering ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Discovering legacy media files...</Text>
        </View>
      ) : (
        <>
          <Text style={styles.modalText}>
            Found {migration.legacyItems.length} legacy media files that need migration to persistent server URLs.
          </Text>
          
          {migration.legacyItems.length > 0 && (
            <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
              {migration.legacyItems.slice(0, 5).map((item, index) => (
                <View key={item.id} style={styles.itemRow}>
                  <Text style={styles.itemType}>{item.type.toUpperCase()}</Text>
                  <Text style={styles.itemUrl} numberOfLines={1}>
                    {item.url.length > 40 ? `...${item.url.slice(-40)}` : item.url}
                  </Text>
                </View>
              ))}
              {migration.legacyItems.length > 5 && (
                <Text style={styles.moreItemsText}>
                  ...and {migration.legacyItems.length - 5} more items
                </Text>
              )}
            </ScrollView>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            
            {migration.legacyItems.length > 0 && (
              <>
                <TouchableOpacity style={styles.dryRunButton} onPress={handleDryRun}>
                  <Text style={styles.dryRunButtonText}>Test Migration</Text>
                </TouchableOpacity>
                
                <TouchableOpacity style={styles.migrateButton} onPress={handleStartMigration}>
                  <Text style={styles.migrateButtonText}>Migrate Now</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </>
      )}
    </View>
  );

  const renderMigrateStep = () => (
    <View style={styles.modalContent}>
      <Text style={styles.modalTitle}>Migrating Media</Text>
      
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>
          Migrating {migration.legacyItems.length} media files...
        </Text>
        <Text style={styles.subText}>
          This may take a few minutes depending on file sizes
        </Text>
      </View>
    </View>
  );

  const renderCompleteStep = () => {
    const result = migration.migrationResult;
    const success = result && result.failed === 0;
    
    return (
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>
          {success ? 'Migration Complete!' : 'Migration Finished'}
        </Text>
        
        <View style={styles.resultsContainer}>
          <Text style={[styles.resultIcon, { color: success ? '#4CAF50' : '#ff9500' }]}>
            {success ? '✅' : '⚠️'}
          </Text>
          
          {result && (
            <>
              <Text style={styles.resultText}>
                Successfully migrated: {result.migrated}
              </Text>
              {result.failed > 0 && (
                <Text style={[styles.resultText, { color: '#ff4444' }]}>
                  Failed: {result.failed}
                </Text>
              )}
              {result.skipped > 0 && (
                <Text style={styles.resultText}>
                  Skipped: {result.skipped}
                </Text>
              )}
            </>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.modal}>
        {migrationStep === 'discover' && renderDiscoverStep()}
        {migrationStep === 'migrate' && renderMigrateStep()}
        {migrationStep === 'complete' && renderCompleteStep()}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderRadius: 8,
    margin: 8,
    padding: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
  },
  detailText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  modal: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalContent: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  modalText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  loadingContainer: {
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  subText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  itemsList: {
    maxHeight: 200,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  itemType: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#007AFF',
    backgroundColor: '#e3f2fd',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginRight: 8,
    minWidth: 50,
    textAlign: 'center',
  },
  itemUrl: {
    fontSize: 12,
    color: '#666',
    flex: 1,
  },
  moreItemsText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '500',
  },
  dryRunButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#e3f2fd',
  },
  dryRunButtonText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  migrateButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  migrateButtonText: {
    color: '#fff',
    fontWeight: '500',
  },
  resultsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  resultIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  resultText: {
    fontSize: 16,
    marginVertical: 4,
    textAlign: 'center',
  },
});

export default MigrationStatusIndicator;