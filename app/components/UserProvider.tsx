"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { authenticatedFetch, API_ENDPOINTS } from "../utils/api";

export type User = {
  id: string;
  username: string;
  email?: string;
  roles?: string[];
  isGuest?: boolean;
  avatarUrl?: string | null;
  sub?: string;
} | null;

type UserContextType = {
  user: User;
  loading: boolean;
  refreshUser: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ 
  children,
  userPromise 
}: { 
  children: React.ReactNode;
  userPromise?: Promise<User>;
}) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    setLoading(true);
    try {
      const res = await authenticatedFetch(API_ENDPOINTS.AUTH.ME);
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // If a promise is provided, we can use it to initialize the state
  useEffect(() => {
    let isMounted = true;

    const resolvePromise = async () => {
      if (userPromise) {
        try {
          const data = await userPromise;
          if (isMounted) {
            setUser(data);
            setLoading(false);
          }
        } catch {
          if (isMounted) setLoading(false);
        }
      } else {
        // Fallback to client-side fetch if no promise provided
        await fetchUser();
      }
    };

    resolvePromise();
    return () => { isMounted = false; };
  }, [userPromise]);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser: fetchUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
