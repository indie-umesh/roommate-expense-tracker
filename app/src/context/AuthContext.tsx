import React, { createContext, useContext, useEffect, useState } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, normalizeIndianPhone, phoneToSyntheticEmail } from "../lib/supabase";
import type { Profile } from "../lib/types";

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  session: Session | null;
  loading: boolean;
  signInWithPhonePin: (phone: string, pin: string) => Promise<void>;
  signUpWithPhonePin: (phone: string, pin: string, displayName: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        return;
      }
      setProfile(data);
    } catch (err) {
      console.error("Failed to load profile:", err);
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Get session error:", error);
        }
        if (!isMounted) return;

        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (err) {
        console.error("Auth restore error:", err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function signInWithPhonePin(rawPhone: string, pin: string) {
    const syntheticEmail = phoneToSyntheticEmail(rawPhone);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: syntheticEmail,
      password: pin,
    });
    if (error) throw error;
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
    if (data.user) {
      await fetchProfile(data.user.id);
    }
  }

  async function signUpWithPhonePin(
    rawPhone: string,
    pin: string,
    displayName: string
  ) {
    const normalizedPhone = normalizeIndianPhone(rawPhone);
    const syntheticEmail = phoneToSyntheticEmail(rawPhone);

    const { data, error } = await supabase.auth.signUp({
      email: syntheticEmail,
      password: pin,
      options: {
        data: {
          display_name: displayName.trim(),
          phone: normalizedPhone,
        },
      },
    });
    if (error) throw error;

    // Immediately sign in if no active session returned
    if (!data.session) {
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password: pin,
      });
      if (signInError) throw signInError;
      if (signInData.session) {
        setSession(signInData.session);
        setUser(signInData.user);
      }
      if (signInData.user) {
        await supabase.from("profiles").upsert({
          id: signInData.user.id,
          phone: normalizedPhone,
          display_name: displayName.trim(),
        });
        await fetchProfile(signInData.user.id);
      }
    } else {
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await supabase.from("profiles").upsert({
          id: data.user.id,
          phone: normalizedPhone,
          display_name: displayName.trim(),
        });
        await fetchProfile(data.user.id);
      }
    }
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }

  async function refreshProfile() {
    if (user) {
      await fetchProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        session,
        loading,
        signInWithPhonePin,
        signUpWithPhonePin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
