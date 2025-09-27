import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const HAPTICS_ENABLED_KEY = 'hapticsEnabled';

const isHapticsEnabled = async () => {
  try {
    const value = await AsyncStorage.getItem(HAPTICS_ENABLED_KEY);
    return value !== 'false';
  } catch (e) {
    // If we can't get the value, default to enabled
    return true;
  }
};

type ImpactStyle = 'light' | 'medium' | 'heavy';
type NotificationType = 'success' | 'warning' | 'error';

export const triggerImpact = async (style: ImpactStyle) => {
  if (await isHapticsEnabled()) {
    const hapticStyle = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    }[style];
    Haptics.impactAsync(hapticStyle);
  }
};

export const triggerNotification = async (type: NotificationType) => {
  if (await isHapticsEnabled()) {
    const hapticType = {
      success: Haptics.NotificationFeedbackType.Success,
      warning: Haptics.NotificationFeedbackType.Warning,
      error: Haptics.NotificationFeedbackType.Error,
    }[type];
    Haptics.notificationAsync(hapticType);
  }
};

const HapticsService = {
  triggerImpact,
  triggerNotification,
};

export default HapticsService;