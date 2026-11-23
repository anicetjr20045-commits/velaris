import { useEffect, useState, type ReactNode } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { AuthContext, type AuthModalMode } from './authContextDef';

// Lien de retour des emails Supabase (respecte le sous-chemin GitHub Pages /velaris/)
const authRedirectUrl = () => `${window.location.origin}${window.location.pathname}`;

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
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>('login');

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      // Retour depuis l'email de réinitialisation : saisie du nouveau mot de passe
      if (event === 'PASSWORD_RECOVERY') {
        setAuthModalMode('recovery');
        setAuthModalOpen(true);
      }
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

  const openAuthModal = (mode: AuthModalMode = 'login') => {
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

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: authRedirectUrl(),
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la connexion Google' };
    }
  };

  const sendWhatsAppOtp = async (phone: string) => {
    try {
      const res = await fetch('/api/auth-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-code', phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: data.error || 'Impossible d\'envoyer le code WhatsApp' };
      }
      return { success: true, challengeToken: data.challengeToken };
    } catch (err: any) {
      return { success: false, error: err.message || 'Passerelle WhatsApp injoignable' };
    }
  };

  const verifyWhatsAppOtp = async (phone: string, code: string, challengeToken: string, studioName?: string) => {
    try {
      const res = await fetch('/api/auth-whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify-code', phone, code, challengeToken, studioName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: data.error || 'Code de vérification incorrect' };
      }
      const { email, emailOtp } = data;
      const verifyRes = await supabase.auth.verifyOtp({
        email,
        token: emailOtp,
        type: 'email',
      });
      if (verifyRes.error) {
        return { error: verifyRes.error.message };
      }
      setAuthModalOpen(false);
      setIsDemoMode(false);
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de la validation' };
    }
  };

  const signInWithMagicLink = async (email: string) => {
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: authRedirectUrl(),
        },
      });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Erreur lors de l\'envoi du lien magique' };
    }
  };

  const verifyEmailOtp = async (email: string, token: string) => {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: 'email',
      });
      if (error) return { error: error.message };
      if (data.session) {
        setAuthModalOpen(false);
        setIsDemoMode(false);
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Code email invalide' };
    }
  };

  const signUp = async (email: string, password: string, studioName?: string, phone?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: authRedirectUrl(),
          data: {
            studio_name: studioName?.trim() || 'Mon Studio Djelia',
            full_name: studioName?.trim() || email.split('@')[0],
            phone: phone?.trim() || undefined,
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

      // Pas de session possible tant que l'adresse n'est pas confirmée
      return { error: null, requiresEmailConfirmation: true };
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
    try {
      localStorage.removeItem('velaris_active_tab');
      localStorage.removeItem('velaris_studio_subtab');
    } catch {
      // ignore
    }
    setUser(null);
    setSession(null);
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: authRedirectUrl(),
      });
      return { error: error ? error.message : null };
    } catch (err: any) {
      return { error: err.message || 'Impossible d\'envoyer le lien de réinitialisation' };
    }
  };

  const updatePassword = async (password: string) => {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { error: error.message };
      return { error: null };
    } catch (err: any) {
      return { error: err.message || 'Impossible de mettre à jour le mot de passe' };
    }
  };

  const resendConfirmation = async (email: string) => {
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email.trim(),
        options: { emailRedirectTo: authRedirectUrl() },
      });
      return { error: error ? error.message : null };
    } catch (err: any) {
      return { error: err.message || 'Impossible de renvoyer l\'email de confirmation' };
    }
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
        signInWithGoogle,
        sendWhatsAppOtp,
        verifyWhatsAppOtp,
        signInWithMagicLink,
        verifyEmailOtp,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        resendConfirmation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
