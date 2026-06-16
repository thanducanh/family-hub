import { Platform } from 'react-native';

function getNativeSecureStore() {
  try {
    return require('expo-secure-store');
  } catch (error) {
    console.warn('SecureStore is not available:', error);
    return null;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    const SecureStore = getNativeSecureStore();
    return SecureStore ? await SecureStore.getItemAsync(key) : null;
  } catch (error) {
    console.warn('Error reading setting:', error);
    return null;
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    const SecureStore = getNativeSecureStore();
    if (SecureStore) await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.warn('Error saving setting:', error);
  }
}

export async function removeSetting(key: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
      return;
    }
    const SecureStore = getNativeSecureStore();
    if (SecureStore) await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn('Error removing setting:', error);
  }
}
