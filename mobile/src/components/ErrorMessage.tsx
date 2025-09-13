import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface ErrorMessageProps {
  message?: string;
  variant?: 'inline' | 'banner';
  testID?: string;
}

/**
 * Reusable error message component for displaying validation errors
 */
export const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  variant = 'inline',
  testID,
}) => {
  if (!message) {
    return null;
  }

  const containerStyle = variant === 'banner' ? styles.bannerContainer : styles.inlineContainer;
  const textStyle = variant === 'banner' ? styles.bannerText : styles.inlineText;

  return (
    <View style={containerStyle} testID={testID}>
      <Text style={textStyle}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  inlineContainer: {
    marginTop: 4,
  },
  inlineText: {
    color: '#ff4444',
    fontSize: 14,
    lineHeight: 18,
  },
  bannerContainer: {
    backgroundColor: '#fff5f5',
    borderWidth: 1,
    borderColor: '#ff4444',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  bannerText: {
    color: '#ff4444',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 18,
  },
});