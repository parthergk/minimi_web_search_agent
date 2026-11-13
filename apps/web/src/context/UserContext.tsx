"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../lib/api";

const STORAGE_KEY = "minimi_user";

interface UserContextValue {
  user: User | null;
  loading: boolean;
  setUser: (user: User) => void;
  clearUser: () => void;
}

const UserContext = createContext<UserContextValue | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setUserState(JSON.parse(saved) as User);
      }
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  function setUser(next: User) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setUserState(next);
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
  }

  return (
    <UserContext.Provider value={{ user, loading, setUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return ctx;
}

