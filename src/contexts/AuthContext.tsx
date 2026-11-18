'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import type { Profile } from '@/types';

// ----------------------------------------------------------------
// Types
// ----------------------------------------------------------------
interface AuthContextValue {
  /** The raw Supabase Auth user object (null while loading or unauthenticated). */
  user: User | null;
  /** The extended profile row from the `profiles` table. */
  profile: Profile | null;
  /** True during the initial session-resolution and profile-fetch phase. */
  loading: boolean;
  /** Signs the user out and clears local state. */
  signOut: () => Promise<void>;
  /** Manually refresh the profile from the database. */
  refreshProfile: () => Promise<void>;
}

// ----------------------------------------------------------------
// Context
// ----------------------------------------------------------------
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ----------------------------------------------------------------
// AuthProvider
// ----------------------------------------------------------------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  // Ref to track the current user ID so we don't re-fetch on unrelated events.
  const userIdRef = useRef<string | null>(null);

  // ----------------------------------------------------------------
  // Fetch profile from the `profiles` table
  // ----------------------------------------------------------------
  const fetchProfile = useCallback(
    async (userId: string): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from('profiles')
        .select(
          'id, employee_id, full_name, email, department, designation, role, joining_date, is_active, created_at, avatar_url'
        )
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[AuthContext] Failed to fetch profile:', error.message);
        return null;
      }

      return data as Profile;
    },
    [supabase]
  );

  // ----------------------------------------------------------------
  // Public API: refreshProfile
  // ----------------------------------------------------------------
  const refreshProfile = useCallback(async () => {
    if (!userIdRef.current) return;
    const p = await fetchProfile(userIdRef.current);
    setProfile(p);
  }, [fetchProfile]);

  // ----------------------------------------------------------------
  // Public API: signOut
  // ----------------------------------------------------------------
  const signOut = useCallback(async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('[AuthContext] Sign-out error:', err);
    } finally {
      setUser(null);
      setProfile(null);
      userIdRef.current = null;
      setLoading(false);
    }
  }, [supabase]);

  // ----------------------------------------------------------------
  // Handle auth state transitions
  // ----------------------------------------------------------------
  const handleAuthChange = useCallback(
    async (event: AuthChangeEvent, session: Session | null) => {
      const newUser = session?.user ?? null;

      setUser(newUser);

      if (newUser) {
        // Only re-fetch profile if the user ID actually changed.
        if (newUser.id !== userIdRef.current) {
          userIdRef.current = newUser.id;
          const p = await fetchProfile(newUser.id);
          setProfile(p);
        }
      } else {
        userIdRef.current = null;
        setProfile(null);
      }

      // After INITIAL_SESSION we know the starting auth state.
      if (event === 'INITIAL_SESSION') {
        setLoading(false);
      }
    },
    [fetchProfile]
  );

  // ----------------------------------------------------------------
  // Subscribe to Supabase auth state changes on mount.
  // ----------------------------------------------------------------
  useEffect(() => {
    // getSession() seeds the initial state; onAuthStateChange fires
    // INITIAL_SESSION synchronously with the existing session, so we
    // don't need a separate getSession() call.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(handleAuthChange);

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, handleAuthChange]);

  // ----------------------------------------------------------------
  // Context value
  // ----------------------------------------------------------------
  const value: AuthContextValue = {
    user,
    profile,
    loading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ----------------------------------------------------------------
// useAuth hook
// ----------------------------------------------------------------

/**
 * Returns the current authentication state and helpers.
 *
 * @example
 *   const { user, profile, loading, signOut } = useAuth();
 *
 *   if (loading) return <Spinner />;
 *   if (!user) return <Redirect to="/login" />;
 *
 *   return <p>Hello, {profile?.full_name}!</p>;
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}

export default AuthProvider;
