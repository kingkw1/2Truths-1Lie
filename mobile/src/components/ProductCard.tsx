import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';

interface ProductCardProps {
  pkg: PurchasesPackage;
  onPress: (pkg: PurchasesPackage) => void;
  disabled?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ pkg, onPress, disabled = false }) => {
  // Check if this package has a free trial
  const hasFreeTrial = pkg.product.introPrice != null;
  const trialPeriod = pkg.product.introPrice?.periodNumberOfUnits || 0;
  const trialUnit = pkg.product.introPrice?.periodUnit || 'day';
  
  return (
        <TouchableOpacity 
      style={[styles.card, disabled && styles.disabledCard]} 
      onPress={() => onPress(pkg)}
      disabled={disabled}
    >
      <View style={styles.productInfo}>
        <Text style={styles.title}>{pkg.product.title}</Text>
        <Text style={styles.description}>{pkg.product.description}</Text>
        
        {/* Free Trial Badge */}
        {hasFreeTrial && (
          <View style={styles.trialBadge}>
            <Text style={styles.trialText}>
              🎉 FREE TRIAL: {trialPeriod} {trialUnit}{trialPeriod > 1 ? 's' : ''} free
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.priceContainer}>
        {hasFreeTrial && (
          <Text style={styles.trialLabel}>Then</Text>
        )}
        <Text style={styles.price}>{pkg.product.priceString}</Text>
        {pkg.packageType === 'ANNUAL' && (
          <Text style={styles.periodLabel}>per year</Text>
        )}
        {pkg.packageType === 'MONTHLY' && (
          <Text style={styles.periodLabel}>per month</Text>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: '#FFFFFF',
  },
  disabledCard: {
    opacity: 0.6,
    backgroundColor: '#F5F5F5',
  },
  productInfo: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  trialBadge: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  trialText: {
    fontSize: 12,
    color: '#1976D2',
    fontWeight: '600',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  trialLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  periodLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});
