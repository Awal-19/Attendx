import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import api from './api';
import { getSavedPushToken, savePushToken } from './storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  if (Platform.OS === 'web') return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('attendx-alerts', {
      name: 'AttendX Alerts',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1d4ed8',
    });
  }

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
    const tokenRes = projectId
      ? await Notifications.getExpoPushTokenAsync({ projectId })
      : await Notifications.getExpoPushTokenAsync();
    const token = tokenRes.data;
    if (token) {
      await savePushToken(token);
      await api.post('/notifications/devices/', {
        expo_push_token: token,
        platform: Platform.OS,
        device_name: Device.modelName || Device.deviceName || Platform.OS,
      });
    }
    return token;
  } catch {
    return null;
  }
}

export async function unregisterPushTokenAsync() {
  try {
    const token = await getSavedPushToken();
    await api.delete('/notifications/devices/', {
      data: token ? { expo_push_token: token } : {},
    });
  } catch {
    // Ignore network errors during logout cleanup
  }
}

