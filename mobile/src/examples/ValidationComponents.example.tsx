import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { FormInput } from '../components/FormInput';
import { ErrorMessage } from '../components/ErrorMessage';
import { useFormValidation } from '../hooks/useFormValidation';
import { validateLoginForm, validateSignupForm } from '../utils/validation';
import { authService } from '../services/authService';

/**
 * Example: Login Screen using validation components
 */
interface LoginExampleProps {
  onLoginSuccess: () => void;
  onNavigateToSignup: () => void;
}

export const LoginExample: React.FC<LoginExampleProps> = ({
  onLoginSuccess,
  onNavigateToSignup,
}) => {
  const {
    values,
    errors,
    isSubmitting,
    setValue,
    handleSubmit,
  } = useFormValidation({
    initialValues: { email: '', password: '' },
    validate: validateLoginForm,
    onSubmit: async (formData) => {
      await authService.login(formData.email.trim(), formData.password);
      onLoginSuccess();
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Sign In</Text>
            <Text style={styles.subtitle}>Welcome back! Sign in to your account</Text>
          </View>

          <View style={styles.form}>
            <FormInput
              label="Email"
              value={values.email}
              onChangeText={(text) => setValue('email', text)}
              error={errors.email}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              required
            />

            <FormInput
              label="Password"
              value={values.password}
              onChangeText={(text) => setValue('password', text)}
              error={errors.password}
              placeholder="Enter your password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              required
            />

            <ErrorMessage message={errors.general} variant="banner" />

            <TouchableOpacity
              style={[
                styles.signInButton,
                isSubmitting && styles.signInButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity
                onPress={onNavigateToSignup}
                disabled={isSubmitting}
              >
                <Text style={styles.signUpLink}>Sign up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

/**
 * Example: Signup Screen using validation components
 */
interface SignupExampleProps {
  onSignupSuccess: () => void;
  onNavigateToLogin: () => void;
}

export const SignupExample: React.FC<SignupExampleProps> = ({
  onSignupSuccess,
  onNavigateToLogin,
}) => {
  const {
    values,
    errors,
    isSubmitting,
    setValue,
    handleSubmit,
  } = useFormValidation({
    initialValues: { email: '', password: '', confirmPassword: '' },
    validate: validateSignupForm,
    onSubmit: async (formData) => {
      await authService.signup(formData.email.trim(), formData.password);
      onSignupSuccess();
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Sign up to save your progress and compete with friends</Text>
          </View>

          <View style={styles.form}>
            <FormInput
              label="Email"
              value={values.email}
              onChangeText={(text) => setValue('email', text)}
              error={errors.email}
              placeholder="Enter your email"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              required
            />

            <FormInput
              label="Password"
              value={values.password}
              onChangeText={(text) => setValue('password', text)}
              error={errors.password}
              placeholder="Create a password"
              helperText="Must be at least 8 characters with letters and numbers"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              required
            />

            <FormInput
              label="Confirm Password"
              value={values.confirmPassword}
              onChangeText={(text) => setValue('confirmPassword', text)}
              error={errors.confirmPassword}
              placeholder="Confirm your password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
              required
            />

            <ErrorMessage message={errors.general} variant="banner" />

            <TouchableOpacity
              style={[
                styles.signUpButton,
                isSubmitting && styles.signUpButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text style={styles.signUpButtonText}>Create Account</Text>
              )}
            </TouchableOpacity>

            <View style={styles.signInContainer}>
              <Text style={styles.signInText}>Already have an account? </Text>
              <TouchableOpacity
                onPress={onNavigateToLogin}
                disabled={isSubmitting}
              >
                <Text style={styles.signInLink}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
  },
  header: {
    marginTop: 40,
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    lineHeight: 22,
  },
  form: {
    flex: 1,
  },
  signInButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signInButtonDisabled: {
    backgroundColor: '#ccc',
  },
  signInButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  signUpButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  signUpButtonDisabled: {
    backgroundColor: '#ccc',
  },
  signUpButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  signUpText: {
    fontSize: 16,
    color: '#666',
  },
  signUpLink: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 30,
  },
  signInText: {
    fontSize: 16,
    color: '#666',
  },
  signInLink: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});