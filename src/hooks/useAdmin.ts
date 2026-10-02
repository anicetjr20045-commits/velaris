import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '../services/supabase';

/**
 * Accès à la console de direction :
 * - `admin`        : profiles.is_admin (RPC velaris_is_admin) ou email listé dans VITE_ADMIN_EMAILS ;
 * - `denied`       : studio connecté sans droit d'administration ;
 * - `unconfigured` : RPC absente et aucun email administrateur configuré (accès ouvert, signalé) ;
 * - `demo`         : visiteur non connecté (données de démonstration uniquement).
 */
export type AdminAccess = 'loading' | 'admin' | 'denied' | 'unconfigured' | 'demo';

const ADMIN_EMAILS = (import.meta.env.VITE_ADMIN_EMAILS || '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean);

export function useAdminAccess(): AdminAccess {
  const { user } = useAuth();
  const [access, setAccess] = useState<AdminAccess>(user ? 'loading' : 'demo');

  useEffect(() => {
    if (!user) {
      setAccess('demo');
      return;
    }
    let cancelled = false;
    setAccess('loading');
    supabase.rpc('velaris_is_admin').then(({ data, error }) => {
      if (cancelled) return;
      const listed = !!user.email && ADMIN_EMAILS.includes(user.email.toLowerCase());
      if (!error) setAccess(data === true || listed ? 'admin' : 'denied');
      else if (listed) setAccess('admin');
      else setAccess(ADMIN_EMAILS.length ? 'denied' : 'unconfigured');
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return access;
}
