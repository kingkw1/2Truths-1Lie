import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { PurchasesPackage } from 'react-native-purchases';

interface ProductCardProps {
  pkg: PurchasesPackage;
  onPress: (pkg: PurchasesPackage) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({ pkg, onPress }) => {
  return (
    <Pressable onPress={() => onPress(pkg)} style={styles.card}>
      <View>
        <Text style={styles.title}>{pkg.product.title}</Text>
        <Text style={styles.description}>{pkg.product.description}</Text>
      </View>
      <View>
        <Text style={styles.price}>{pkg.product.priceString}</Text>
      </View>
    </Pressable>
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
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  description: {
    fontSize: 14,
    color: '#888',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
