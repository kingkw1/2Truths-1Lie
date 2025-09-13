import React from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TextInputProps,
} from 'react-native';
import { ErrorMessage } from './ErrorMessage';

export interface FormInputProps extends Omit<TextInputProps, 'style'> {
  label: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerStyle?: object;
  inputStyle?: object;
  labelStyle?: object;
}

/**
 * Reusable form input component with validation error display
 */
export const FormInput: React.FC<FormInputProps> = ({
  label,
  error,
  helperText,
  required = false,
  containerStyle,
  inputStyle,
  labelStyle,
  ...textInputProps
}) => {
  const hasError = Boolean(error);

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={[styles.label, labelStyle]}>
        {label}
        {required && <Text style={styles.required}> *</Text>}
      </Text>
      
      <TextInput
        style={[
          styles.input,
          hasError && styles.inputError,
          inputStyle,
        ]}
        placeholderTextColor="#999"
        {...textInputProps}
      />
      
      <ErrorMessage message={error} variant="inline" />
      
      {helperText && !error && (
        <Text style={styles.helperText}>{helperText}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#ff4444',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 16,
    fontSize: 16,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#ff4444',
    backgroundColor: '#fff5f5',
  },
  helperText: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 18,
  },
});