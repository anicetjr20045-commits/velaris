import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export function getSupabaseAdmin() {
  let supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://zoamdwupbhegcmancaeu.supabase.co';
  let supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || '';
  if (!supabaseSecretKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (m && m[1].trim() === 'SUPABASE_SECRET_KEY') {
            supabaseSecretKey = m[2].trim();
            break;
          }
        }
      }
    } catch {}
  }
  if (!supabaseSecretKey) return null;
  return createClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export interface CreditDebitResult {
  ok: boolean;
  status?: number;
  error?: string;
  userId?: string;
  newBalance?: number;
  refund?: () => Promise<void>;
}

/**
 * Débite `amount` crédits côté serveur sur `user_metadata.credits` via le JWT Supabase.
 * Fournit une fonction `refund()` si l'appel fournisseur échoue ensuite.
 */
export async function debitUserCredits(
  authHeader: string | undefined,
  amount: number,
  reason: string,
  kind: string = 'usage',
): Promise<CreditDebitResult> {
  if (amount <= 0) return { ok: true };
  const token = String(authHeader || '').startsWith('Bearer ')
    ? String(authHeader).slice(7).trim()
    : '';
  if (!token) {
    return { ok: false, status: 401, error: 'Session requise. Veuillez vous reconnecter.' };
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return { ok: false, status: 500, error: 'Configuration serveur incomplète.' };
  }

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    return { ok: false, status: 401, error: 'Session expirée. Veuillez vous reconnecter.' };
  }

  const user = userData.user;
  const meta = (user.user_metadata || {}) as Record<string, any>;
  const currentBalance = Math.round((Number(meta.credits) || 0) * 100) / 100;

  if (currentBalance < amount) {
    return {
      ok: false,
      status: 402,
      error: `Crédits insuffisants (${currentBalance.toFixed(2)} disponible, ${amount} requis). Rechargez dans Crédits & Compte.`,
    };
  }

  const newBalance = Math.max(0, Math.round((currentBalance - amount) * 100) / 100);
  const { error: updErr } = await admin.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...meta,
      credits: newBalance,
      updated_at: new Date().toISOString(),
    },
  });
  if (updErr) {
    return { ok: false, status: 500, error: 'Impossible de débiter les crédits.' };
  }

  try {
    await admin.from('credit_transactions').insert({
      user_id: user.id,
      amount_cfa: 0,
      credits_added: -amount,
      balance_after: newBalance,
      transaction_ref: `DEBIT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      payment_provider: 'STUDIO',
      status: 'SUCCESS',
      kind,
      reason: reason.slice(0, 120),
    });
  } catch {}

  const refund = async () => {
    try {
      const { data: latest } = await admin.auth.admin.getUserById(user.id);
      const latestMeta = (latest?.user?.user_metadata || meta) as Record<string, any>;
      const cur = Math.round((Number(latestMeta.credits) || 0) * 100) / 100;
      const restored = Math.round((cur + amount) * 100) / 100;
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: { ...latestMeta, credits: restored, updated_at: new Date().toISOString() },
      });
    } catch {}
  };

  return { ok: true, userId: user.id, newBalance, refund };
}
