import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';

interface PaywallModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const PaywallModal: React.FC<PaywallModalProps> = ({ isVisible, onClose }) => {
  const navigation = useNavigation();

  const handleUpgrade = () => {
    onClose();
    navigation.navigate('Store');
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={isVisible}
      onRequestClose={onClose}
    >
      <View style={styles.centeredView}>
        <View style={styles.modalView}>
          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>X</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Go Pro!</Text>
          <View style={styles.benefitsList}>
            <Text style={styles.benefitItem}>- Unlimited Challenge Creation</Text>
            <Text style={styles.benefitItem}>- Monthly 'AI Detector' Tokens</Text>
            <Text style={styles.benefitItem}>- Exclusive Pro Badge</Text>
          </View>
          <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
            <Text style={styles.upgradeButtonText}>View Upgrade Options</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalView: {
    margin: 20,
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 35,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  closeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
  closeButtonText: {
    fontSize: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  benefitsList: {
    alignSelf: 'flex-start',
    marginBottom: 20,
  },
  benefitItem: {
    fontSize: 16,
    marginBottom: 10,
  },
  upgradeButton: {
    backgroundColor: '#007AFF',
    borderRadius: 20,
    padding: 10,
    elevation: 2,
  },
  upgradeButtonText: {
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
