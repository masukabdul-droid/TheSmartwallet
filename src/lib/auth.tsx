// ─── Supabase Auth System ─────────────────────────────────────────────────
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "./supabase";
import type { User as SupabaseUser, Session } from "@supabase/supabase-js";

export interface User {
  id: string;
  username: string;
  displayName: string;
  color: string;
  avatar?: string;
  createdAt: string;
}

export interface AuthState {
  currentUser: User | null;
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<{ success: boolean; error?: string }>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  resetPassword: (email: string) => Promise<{ success: boolean; error?: string }>;
}

const USER_COLORS = [
  "hsl(160,84%,39%)", "hsl(200,80%,50%)", "hsl(280,70%,60%)",
  "hsl(40,90%,55%)", "hsl(0,72%,51%)", "hsl(220,60%,55%)", "hsl(330,70%,55%)"
];

function supabaseUserToUser(u: SupabaseUser, profile?: any): User {
  return {
    id: u.id,
    username: u.email || u.id,
    displayName: profile?.display_name || u.email?.split("@")[0] || "User",
    color: profile?.color || USER_COLORS[Math.abs(u.id.charCodeAt(0)) % USER_COLORS.length],
    avatar: profile?.avatar,
    createdAt: u.created_at,
  };
}

const AuthContext = createContext<AuthState | null>(null);

const CACHE_KEY = "swc_user_cache";

function getCachedUser(): User | null {
  try { return JSON.parse(sessionStorage.getItem(CACHE_KEY) || "null"); } catch { return null; }
}
function setCachedUser(u: User | null) {
  if (u) sessionStorage.setItem(CACHE_KEY, JSON.stringify(u));
  else sessionStorage.removeItem(CACHE_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Seed from cache — instant on refresh, no spinner
  const [currentUser, setCurrentUser] = useState<User | null>(() => getCachedUser());
  const [session, setSession] = useState<Session | null>(null);
  // If we have a cached user, start as NOT loading — data loads immediately
  const [loading, setLoading] = useState(() => getCachedUser() === null);

  const loadProfile = async (supabaseUser: SupabaseUser): Promise<User> => {
    // Check cache first to avoid extra network call on refresh
    const cached = getCachedUser();
    if (cached && cached.id === supabaseUser.id) return cached;
    const { data } = await supabase.from("user_profiles").select("*").eq("user_id", supabaseUser.id).single();
    return supabaseUserToUser(supabaseUser, data || {});
  };

  useEffect(() => {
    // getSession is synchronous for cached tokens — resolves immediately
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        const user = await loadProfile(session.user);
        setCurrentUser(user);
        setCachedUser(user);
      } else {
        setCachedUser(null);
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Ignore the initial INITIAL_SESSION event — already handled by getSession above
      if (event === "INITIAL_SESSION") return;
      setSession(session);
      if (session?.user) {
        const user = await loadProfile(session.user);
        setCurrentUser(user);
        setCachedUser(user);
      } else {
        setCurrentUser(null);
        setCachedUser(null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const logout = async () => { await supabase.auth.signOut(); setCurrentUser(null); setSession(null); setCachedUser(null); };

  const register = async (email: string, displayName: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { success: false, error: error.message };
    if (data.user) {
      const color = USER_COLORS[Math.floor(Math.random() * USER_COLORS.length)];
      await supabase.from("user_profiles").upsert({ user_id: data.user.id, display_name: displayName || email.split("@")[0], color });
    }
    return { success: true };
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    const { error: e } = await supabase.auth.signInWithPassword({ email: currentUser?.username || "", password: oldPassword });
    if (e) return { success: false, error: "Current password is incorrect" };
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
    if (error) return { success: false, error: error.message };
    return { success: true };
  };

  return (
    <AuthContext.Provider value={{ currentUser, session, loading, login, logout, register, changePassword, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
