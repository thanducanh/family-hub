"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { AuthUser } from "@/components/family-app";
import { Member } from "@/types";

interface AuthContextType {
  user: AuthUser | null | undefined;
  setUser: (user: AuthUser | null | undefined) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: undefined,
  setUser: () => {},
  refreshUser: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);

  const refreshUser = async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store", credentials: "include", headers: { "pragma": "no-cache", "cache-control": "no-cache" } });
      const text = await response.text();
      let result;
      if (text) {
        try { result = JSON.parse(text); } catch { /* ignore */ }
      }
      if (response.ok && result?.user) {
        setUser({ ...result.user, member: result.member });
      } else {
        setUser(null);
      }
    } catch (error) {
      setUser(null);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, setUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
