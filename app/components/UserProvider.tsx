"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { authenticatedFetch, API_ENDPOINTS, SESSION_EXPIRED_EVENT } from "../utils/api";

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
  logout: () => Promise<void>;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

// Note: the old "userPromise" prop was removed. Nothing in the app ever
// passed it, so it was dead code that only made this component harder
// to read.
export function UserProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  // Asks the backend who is signed in and stores the answer.
  // All state updates here happen after the network call, which also
  // keeps the React lint rule about state updates in effects happy.
  const loadUser = useCallback(async () => {
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
  }, []);

  // Manual refresh (used after sign-in or profile edits): shows the
  // loading state again while the user is re-fetched.
  const refreshUser = useCallback(async () => {
    setLoading(true);
    await loadUser();
  }, [loadUser]);

  // One shared sign-out for the whole app. Before this, four different
  // components (navbar, mobile nav, home page, profile page) each had
  // their own copy of the same steps, and they could drift apart.
  // The token is removed in "finally" so the user is signed out locally
  // even if the server request fails.
  const logout = useCallback(async () => {
    try {
      await authenticatedFetch(API_ENDPOINTS.AUTH.SIGNOUT);
    } finally {
      localStorage.removeItem("token");
      setUser(null);
      router.push("/");
    }
  }, [router]);

  useEffect(() => {
    // Fetching the signed-in user once on mount is intentional here;
    // every state update in loadUser happens after the network call.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadUser();
  }, [loadUser]);

  // authenticatedFetch fires this event when any request returns 401
  // (the session expired). Drop the user from state so the UI stops
  // showing them as signed in. We only clear state here — no extra
  // network request — to avoid a loop of failing calls.
  useEffect(() => {
    const onSessionExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onSessionExpired);
  }, []);

  return (
    <UserContext.Provider value={{ user, loading, refreshUser, logout }}>
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
