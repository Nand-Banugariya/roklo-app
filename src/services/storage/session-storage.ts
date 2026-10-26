import * as SecureStore from "expo-secure-store";

const KEY = "roklo.access-token";
export const sessionStorage = {
  read: () => SecureStore.getItemAsync(KEY),
  write: (token: string) =>
    SecureStore.setItemAsync(KEY, token, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    }),
  remove: () => SecureStore.deleteItemAsync(KEY),
};
