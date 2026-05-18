import AsyncStorage from '@react-native-async-storage/async-storage';

const USERNAME_KEY = 'birddex_username';
const TOKEN_KEY = 'birddex_token';

export const storage = {
  getUsername:   (): Promise<string | null> => AsyncStorage.getItem(USERNAME_KEY),
  setUsername:   (u: string): Promise<void> => AsyncStorage.setItem(USERNAME_KEY, u),
  clearUsername: (): Promise<void>           => AsyncStorage.removeItem(USERNAME_KEY),

  getToken:   (): Promise<string | null> => AsyncStorage.getItem(TOKEN_KEY),
  setToken:   (t: string): Promise<void>  => AsyncStorage.setItem(TOKEN_KEY, t),
  clearToken: (): Promise<void>           => AsyncStorage.removeItem(TOKEN_KEY),

  clearAll: (): Promise<void> =>
    AsyncStorage.multiRemove([USERNAME_KEY, TOKEN_KEY]),
};
