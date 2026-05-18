import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { storage } from './storage';
import { api } from './api';
import type { Bird, User } from './types';

interface AppContextType {
  authUsername: string | null;
  viewUsername: string;
  region: string;
  birds: Bird[];
  friends: User[];
  loading: boolean;
  error: string | null;
  isOwner: boolean;
  login: (username: string, token: string) => void;
  logout: () => void;
  switchViewUser: (username: string) => Promise<void>;
  switchRegion: (region: string) => Promise<void>;
  refreshBirds: () => Promise<void>;
  updateBird: (bird: Bird) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [authUsername, setAuthUsername] = useState<string | null>(null);
  const [viewUsername, setViewUsername] = useState('isaak');
  const [region, setRegion] = useState('BC');
  const [birds, setBirds] = useState<Bird[]>([]);
  const [friends, setFriends] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const viewUsernameRef = useRef(viewUsername);
  viewUsernameRef.current = viewUsername;

  const loadUserData = useCallback(async (username: string) => {
    setLoading(true);
    setError(null);
    try {
      const [user, birdsData, friendsData] = await Promise.all([
        api.getUser(username),
        api.getUserBirds(username),
        api.getUserFriends(username),
      ]);
      setViewUsername(user.username);
      setRegion(user.region);
      setBirds(birdsData);
      setFriends(friendsData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore session from AsyncStorage on mount — no server roundtrip needed
  useEffect(() => {
    Promise.all([storage.getUsername(), storage.getToken()]).then(([savedUser, savedToken]) => {
      if (savedToken) {
        api.setToken(savedToken);
      }
      const initial = savedUser ?? 'isaak';
      if (savedUser) setAuthUsername(savedUser);
      loadUserData(initial);
    });
  }, [loadUserData]);

  const login = useCallback((username: string, token: string) => {
    api.setToken(token);
    setAuthUsername(username);
    storage.setUsername(username);
    storage.setToken(token);
  }, []);

  const logout = useCallback(() => {
    api.setToken(null);
    setAuthUsername(null);
    storage.clearAll();
  }, []);

  const switchViewUser = useCallback(
    (username: string) => loadUserData(username),
    [loadUserData]
  );

  const switchRegion = useCallback(async (newRegion: string) => {
    const current = viewUsernameRef.current;
    await api.patchUser(current, { region: newRegion });
    await loadUserData(current);
  }, [loadUserData]);

  const refreshBirds = useCallback(async () => {
    try {
      const birdsData = await api.getUserBirds(viewUsernameRef.current);
      setBirds(birdsData);
    } catch { /* silent */ }
  }, []);

  const updateBird = useCallback((updated: Bird) => {
    setBirds(prev => prev.map(b => (b.id === updated.id ? updated : b)));
  }, []);

  const isOwner =
    authUsername != null &&
    authUsername.toLowerCase() === viewUsername.toLowerCase();

  return (
    <AppContext.Provider
      value={{
        authUsername,
        viewUsername,
        region,
        birds,
        friends,
        loading,
        error,
        isOwner,
        login,
        logout,
        switchViewUser,
        switchRegion,
        refreshBirds,
        updateBird,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
