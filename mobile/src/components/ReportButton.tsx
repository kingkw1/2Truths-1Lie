import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { useReportAuth } from '../hooks/useReportAuth';

interface ReportButtonProps {
  onPress: () => void;
  disabled?: boolean;
  style?: ViewStyle;
  iconStyle?: TextStyle;
  size?: 'small' | 'medium' | 'large';
  variant?: 'default' | 'minimal';
}

export const ReportButton: React.FC<ReportButtonProps> = ({
  onPress,
  disabled = false,
  style,
  iconStyle,
  size = 'medium',
  variant = 'default',
}) => {
  const { canReport } = useReportAuth();

  const handlePress = () => {
    // Always call onPress - authentication handling is done by parent component
    // This allows for consistent behavior and centralized auth logic
    if (!disabled) {
      onPress();
    }
  };

  const getButtonStyle = (): ViewStyle[] => {
    const baseStyle: ViewStyle[] = [styles.button];
    
    // Size variants
    switch (size) {
      case 'small':
        baseStyle.push(styles.buttonSmall);
        break;
      case 'large':
        baseStyle.push(styles.buttonLarge);
        break;
      default:
        baseStyle.push(styles.buttonMedium);
    }

    // Variant styles
    if (variant === 'minimal') {
      baseStyle.push(styles.buttonMinimal);
    } else {
      baseStyle.push(styles.buttonDefault);
    }

    // Disabled state
    if (disabled || !canReport) {
      baseStyle.push(styles.buttonDisabled);
    }

    // Custom style
    if (style) {
      baseStyle.push(style);
    }

    return baseStyle;
  };

  const getIconStyle = (): TextStyle[] => {
    const baseStyle: TextStyle[] = [styles.icon];
    
    // Size variants
    switch (size) {
      case 'small':
        baseStyle.push(styles.iconSmall);
        break;
      case 'large':
        baseStyle.push(styles.iconLarge);
        break;
      default:
        baseStyle.push(styles.iconMedium);
    }

    // Disabled state
    if (disabled || !canReport) {
      baseStyle.push(styles.iconDisabled);
    }

    // Custom style
    if (iconStyle) {
      baseStyle.push(iconStyle);
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={disabled || !canReport}
      activeOpacity={0.7}
      accessibilityLabel="Report inappropriate content"
      accessibilityHint="Tap to report this content as inappropriate"
      accessibilityRole="button"
    >
      <Text style={getIconStyle()}>🚩</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  buttonDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  buttonMinimal: {
    backgroundColor: 'transparent',
  },
  buttonSmall: {
    width: 32,
    height: 32,
    borderRadius: 6,
  },
  buttonMedium: {
    width: 40,
    height: 40,
    borderRadius: 8,
  },
  buttonLarge: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(200, 200, 200, 0.5)',
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowOpacity: 0,
    elevation: 0,
  },
  icon: {
    textAlign: 'center',
  },
  iconSmall: {
    fontSize: 16,
  },
  iconMedium: {
    fontSize: 20,
  },
  iconLarge: {
    fontSize: 24,
  },
  iconDisabled: {
    opacity: 0.5,
  },
});

export default ReportButton;