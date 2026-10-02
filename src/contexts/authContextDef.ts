import { createContext } from 'react';
import type { User, Session } from '@supabase/supabase-js';

/** login / signup / reset (demande de lien) / recovery (nouveau mot de passe après clic sur le lien) */
export type AuthModalMode = 'login' | 'signup' | 'reset' | 'recovery';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isDemoMode: boolean;
  authModalOpen: boolean;
  authModalMode: AuthModalMode;
  openAuthModal: (mode?: AuthModalMode) => void;
  closeAuthModal: () => void;
  setDemoMode: (enabled: boolean) => void;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, studioName?: string) => Promise<{ error: string | null; requiresEmailConfirmation?: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  resendConfirmation: (email: string) => Promise<{ error: string | null }>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
