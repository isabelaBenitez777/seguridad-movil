import * as SecureStore from 'expo-secure-store';

// Enclave seguro: iOS Keychain / Android Keystore
const OPTS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const REFRESH_KEY = 'refresh_token';
const SEED_KEY = 'totp_seed';

export const saveRefreshToken = (t: string) => SecureStore.setItemAsync(REFRESH_KEY, t, OPTS);
export const getRefreshToken = () => SecureStore.getItemAsync(REFRESH_KEY);
export const clearSession = () => SecureStore.deleteItemAsync(REFRESH_KEY);

export const saveTotpSeed = (s: string) => SecureStore.setItemAsync(SEED_KEY, s, OPTS);
export const getTotpSeed = () => SecureStore.getItemAsync(SEED_KEY);
export const deleteTotpSeed = () => SecureStore.deleteItemAsync(SEED_KEY);
