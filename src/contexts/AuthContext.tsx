import { useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('velaris_demo_mode') === 'true';
    } catch {
      return false;
    }
  });

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');

  useEffect(() => {
    // 1. Initial Session Check
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Auth State Change Listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        setIsDemoMode(false);
        try {
          localStorage.removeItem('velaris_demo_mode');
        } catch {
          // ignore
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const openAuthModal = (mode: 'login' | 'signup' = 'login') => {
    setAuthModalMode(mode);
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const setDemoMode = (enabled: boolean) => {
    setIsDemoMode(enabled);
    try {
      if (enabled) {
        localStorage.setItem('velaris_demo_mode', 'true');
      } else {
        localStorage.removeItem('velaris_demo_mode');
      }
    } catch {
      // ignore
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        return { error: error.message };
      }

      setAuthModalOpen(false);
      setIsDemoMode(false);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la connexion' };
    }
  };

  const signUp = async (email: string, password: string, studioName?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            studio_name: studioName?.trim() || 'Mon Studio Velaris',
            full_name: studioName?.trim() || email.split('@')[0],
          },
        },
      });

      if (error) {
        return { error: error.message };
      }

      if (data.session) {
        setAuthModalOpen(false);
        setIsDemoMode(false);
        return { error: null, requiresEmailConfirmation: false };
      }

      // Connexion immédiate fluide sans frottement
      const loginRes = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (!loginRes.error && loginRes.data.session) {
        setAuthModalOpen(false);
        setIsDemoMode(false);
        return { error: null, requiresEmailConfirmation: false };
      }

      return { error: null, requiresEmailConfirmation: false };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la création du compte' };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isDemoMode,
        authModalOpen,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        setDemoMode,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
