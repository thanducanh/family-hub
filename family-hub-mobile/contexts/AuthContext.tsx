import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, removeToken, setToken as setApiToken, api, setUnauthorizedCallback } from '../lib/api';

interface AuthContextType {
  token: string | null;
  user: any | null;
  isLoading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<any | null>;
  setUserProfile: (user: any | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  refreshUser: async () => null,
  setUserProfile: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const res = await api.get('/api/auth/me');
      if (res.data && res.data.user) {
        setUser(res.data.user);
        return res.data.user;
      }
      if (res.user) {
        setUser(res.user);
        return res.user;
      }
      return null;
    } catch (err) {
      console.error('Failed to fetch user:', err);
      throw err;
    }
  };

  useEffect(() => {
    setUnauthorizedCallback(() => {
      setToken(null);
      setUser(null);
    });

    // Check token on mount
    getToken()
      .then(async (storedToken) => {
        if (storedToken) {
          try {
            await setApiToken(storedToken);
            await fetchUser();
            setToken(storedToken);
          } catch (err: any) {
            console.error('Session verify error:', err);
            if (err.status === 401) {
              await removeToken();
              setToken(null);
              setUser(null);
            } else {
              setToken(storedToken); // keep token for network errors
            }
          }
        } else {
          setToken(null);
          setUser(null);
        }
      })
      .catch((err) => {
        console.error('Failed to get token:', err);
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = async (newToken: string) => {
    await setApiToken(newToken);
    setToken(newToken);
    try {
      await fetchUser();
    } catch (err) {
      console.error('Failed to fetch user during login', err);
    }
  };

  const logout = async () => {
    await removeToken();
    setToken(null);
    setUser(null);
  };

  const setUserProfile = (nextUser: any | null) => {
    setUser(nextUser);
  };

  return (
    <AuthContext.Provider value={{ token, user, isLoading, login, logout, refreshUser: fetchUser, setUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
