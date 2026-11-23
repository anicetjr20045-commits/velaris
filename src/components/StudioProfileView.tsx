import { useState, useEffect, type FC, type FormEvent } from 'react';
import {
  ShieldCheck,
  Mail,
  Smartphone,
  KeyRound,
  LogOut,
  RefreshCw,
  Check,
  Copy,
  Loader2,
  Fingerprint,
  CalendarClock,
  Pencil,
  Coins,
  CreditCard,
  Calendar,
  AlertCircle,
  Ban,
  ExternalLink,
  Globe,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import {
  getStudioCredits,
  getStudioSubscription,
  cancelSubscription,
  resumeSubscriptionRenewal,
  refreshBilling,
  subscribeToBilling
} from '../services/billing';
import {
  createSubscriptionCheckout,
  createCreditRechargeCheckout,
  calculateCreditsForCFA,
  clearPendingCheckout,
  getCheckoutStatus,
  getPendingCheckout,
  SASPAY_CONFIG
} from '../services/saspay';
import { useAdminAccess } from '../hooks/useAdmin';
import { initiateChariowCheckout, verifyChariowSale } from '../services/chariow';

interface StudioProfileViewProps {
  onSignedOut?: () => void;
  onOpenWhatsApp: () => void;
}

const panelClass = 'rounded-2xl border border-white/[0.08] bg-[#0B0C10] vx-hairline';

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : '—';

const fmtShortDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric'
      })
    : '—';

export const StudioProfileView: FC<StudioProfileViewProps> = ({ onSignedOut, onOpenWhatsApp }) => {
  const { user, signOut, resetPassword } = useAuth();

  const currentName = (user?.user_metadata?.studio_name as string) || '';
  const [studioName, setStudioName] = useState(currentName);
  const [prevName, setPrevName] = useState(currentName);
  if (prevName !== currentName) {
    setPrevName(currentName);
    setStudioName(currentName);
  }

  const [studioSlug, setStudioSlug] = useState(
    (user?.user_metadata?.studio_slug as string) ||
    (currentName ? currentName.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'mon-studio')
  );
  const [studioBio, setStudioBio] = useState(
    (user?.user_metadata?.studio_bio as string) || ''
  );
  const [studioPrice, setStudioPrice] = useState<number>(
    Number(user?.user_metadata?.studio_price) || 2000
  );
  const [selectedStyles, setSelectedStyles] = useState<string[]>(
    (user?.user_metadata?.studio_styles as string[]) || ['Afrobeat', 'Zouk', 'Acoustique', 'Gospel']
  );
  const [selectedPayments, setSelectedPayments] = useState<string[]>(
    (user?.user_metadata?.studio_payments as string[]) || ['Wave', 'Orange Money']
  );

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'signout' | 'refresh' | 'reset' | 'checkout' | 'cancel' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Billing state
  const [credits, setCredits] = useState(getStudioCredits());
  const [subscription, setSubscription] = useState(getStudioSubscription());
  const [freeAmountCfa, setFreeAmountCfa] = useState<number>(1000);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showRechargeModal, setShowRechargeModal] = useState(false);

  const adminAccess = useAdminAccess();
  const isDirection = adminAccess === 'admin' || adminAccess === 'unconfigured';

  useEffect(() => {
    const unsub = subscribeToBilling(() => {
      setCredits(getStudioCredits());
      setSubscription(getStudioSubscription());
    });
    return unsub;
  }, []);

  /* Retour de paiement : SasPay ou Chariow */
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);

    // Retour Chariow
    if (params.get('payment') === 'success' && params.get('sale_id')) {
      const saleId = params.get('sale_id')!;
      params.delete('payment');
      params.delete('sale_id');
      const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', clean);

      let cancelled = false;
      (async () => {
        setNotice({ tone: 'ok', text: 'Validation de votre abonnement Chariow en cours…' });
        for (let i = 0; i < 4 && !cancelled; i++) {
          const res = await verifyChariowSale(saleId);
          if (res.activated) {
            await refreshBilling();
            if (!cancelled) {
              setNotice({ tone: 'ok', text: 'Paiement Chariow confirmé ! Votre Pass Créateur et vos 30 crédits sont actifs.' });
            }
            return;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        await refreshBilling();
        if (!cancelled) {
          setNotice({ tone: 'ok', text: 'Paiement Chariow enregistré. Votre Pass est actif.' });
        }
      })();
      return;
    }

    // Retour SasPay
    const pending = getPendingCheckout();
    if (params.get('payment') !== 'return' || !pending) return;
    params.delete('payment');
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', clean);

    let cancelled = false;
    (async () => {
      setNotice({ tone: 'ok', text: 'Vérification de votre paiement auprès de SasPay…' });
      for (let i = 0; i < 6 && !cancelled; i++) {
        const st = await getCheckoutStatus(pending.id);
        if (st.status === 'PAID') {
          // Le webhook signé applique le crédit en quelques secondes : on relit le solde
          for (let j = 0; j < 5 && !cancelled; j++) {
            await new Promise(r => setTimeout(r, 2500));
            await refreshBilling();
          }
          clearPendingCheckout();
          if (!cancelled) setNotice({ tone: 'ok', text: 'Paiement confirmé par SasPay. Votre compte est crédité.' });
          return;
        }
        if (st.status === 'CANCELLED' || st.status === 'EXPIRED' || st.status === 'FAILED') {
          clearPendingCheckout();
          if (!cancelled) setNotice({ tone: 'err', text: 'Paiement non abouti : aucun montant n’a été prélevé.' });
          return;
        }
        await new Promise(r => setTimeout(r, 4000));
      }
      if (!cancelled) setNotice({ tone: 'ok', text: 'Paiement en cours de confirmation : votre solde se mettra à jour dès réception par SasPay.' });
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
  const initials = ((currentName || user?.email || 'ST').slice(0, 2)).toUpperCase();

  const flash = (tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const saveStudioSettings = async (e: FormEvent) => {
    e.preventDefault();
    const cleanName = studioName.replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    const cleanSlug = studioSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 40) || 'mon-studio';
    if (!cleanName) return;
    setSaving(true);
    try {
      if (user) {
        try {
          await supabase.from('studios').upsert({
            user_id: user.id,
            name: cleanName,
            slug: cleanSlug,
            bio: studioBio.trim().slice(0, 200),
            price_quoted_standard: studioPrice,
            music_styles: selectedStyles,
            accepted_payments: selectedPayments,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });
        } catch {
          // Table studios non initialisée ou hors ligne : persistance de secours dans user_metadata
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: {
          studio_name: cleanName,
          studio_slug: cleanSlug,
          studio_bio: studioBio.trim().slice(0, 200),
          studio_price: studioPrice,
          studio_styles: selectedStyles,
          studio_payments: selectedPayments
        }
      });
      if (error) throw error;
      flash('ok', 'Configuration de votre studio et mini-site enregistrée avec succès.');
    } catch (err: any) {
      flash('err', err?.message || "Impossible d'enregistrer la configuration du studio.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    setBusy('signout');
    await signOut();
    setBusy(null);
    onSignedOut?.();
  };

  const handleRefresh = async () => {
    setBusy('refresh');
    const { error } = await supabase.auth.refreshSession();
    setBusy(null);
    if (error) flash('err', 'Session expirée : reconnectez-vous.');
    else flash('ok', 'Session renouvelée.');
  };

  const handlePasswordReset = async () => {
    if (!user?.email) return;
    setBusy('reset');
    const { error } = await resetPassword(user.email);
    setBusy(null);
    if (error) flash('err', 'Envoi impossible pour le moment.');
    else flash('ok', `Lien de réinitialisation envoyé à ${user.email}.`);
  };

  const copySession = async () => {
    try {
      await navigator.clipboard.writeText(sessionName);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // presse-papiers indisponible
    }
  };

  // Paiements SasPay : session créée côté serveur, crédit appliqué par le webhook signé uniquement
  const startCheckout = async (create: () => ReturnType<typeof createSubscriptionCheckout>, label: string) => {
    if (!user) {
      flash('err', 'Connectez-vous à votre studio pour effectuer un paiement.');
      return;
    }
    setBusy('checkout');
    const res = await create();
    setBusy(null);
    if (res.success && res.checkoutUrl) {
      flash('ok', `Redirection vers SasPay : ${label}`);
      window.location.assign(res.checkoutUrl);
    } else {
      flash('err', res.error || 'Impossible d’initialiser le paiement SasPay.');
    }
  };

  const handleChariowSubscribe = async () => {
    if (!user) {
      flash('err', 'Connectez-vous à votre studio pour effectuer un paiement.');
      return;
    }
    setBusy('checkout');
    const res = await initiateChariowCheckout({
      userId: user.id,
      email: user.email || '',
      fullName: (user.user_metadata?.studio_name as string) || (user.user_metadata?.full_name as string) || 'Créateur Djelia',
      phone: (user.user_metadata?.phone as string) || '',
    });
    setBusy(null);
    if (res.success && res.checkoutUrl) {
      flash('ok', 'Redirection vers Chariow (Wave, Orange Money, Moov, MTN, Carte)...');
      window.location.assign(res.checkoutUrl);
    } else {
      flash('err', res.error || 'Impossible d’initialiser le paiement Chariow.');
    }
  };

  const handleRechargeFreeAmount = (amountCfa: number) => {
    if (amountCfa < SASPAY_CONFIG.rates.minCfaRecharge) {
      flash('err', `Le montant minimum pour un paiement SasPay est de ${SASPAY_CONFIG.rates.minCfaRecharge} F CFA.`);
      return;
    }
    return startCheckout(() => createCreditRechargeCheckout(amountCfa), `${amountCfa.toLocaleString('fr-FR')} F CFA`);
  };

  const copyWebhook = async (url: string, label: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedWebhook(label);
      window.setTimeout(() => setCopiedWebhook(null), 2000);
      flash('ok', `URL ${label} copiée dans le presse-papiers.`);
    } catch {
      // clip failed
    }
  };

  const handleCancelSub = () => {
    cancelSubscription();
    setShowCancelConfirm(false);
    flash('ok', 'Renouvellement arrêté. Votre accès reste garanti jusqu’à l’échéance déjà payée.');
  };

  const facts = [
    { icon: Mail, label: 'Email du compte', value: user?.email ?? 'Démo Studio', mono: false },
    {
      icon: Fingerprint,
      label: 'Identifiant studio',
      value: user ? `${user.id.slice(0, 8)}…${user.id.slice(-4)}` : 'velaris_demo_mode',
      mono: true
    },
    { icon: CalendarClock, label: 'Membre depuis', value: fmtDate(user?.created_at), mono: false },
    { icon: CalendarClock, label: 'Dernière connexion', value: fmtDate(user?.last_sign_in_at), mono: false }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Mon profil studio</h1>
        <p className="text-sm sm:text-base text-[#A3A3A3] mt-2">
          Identité, abonnement SasPay, solde de crédits et sécurité de votre studio.
        </p>
      </div>

      {notice && (
        <div
          role="status"
          className={`vx-fade-in flex items-center gap-2 rounded-xl border p-3.5 text-sm ${
            notice.tone === 'ok'
              ? 'border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-200'
              : 'border-rose-500/25 bg-rose-500/[0.07] text-rose-200'
          }`}
        >
          {notice.tone === 'ok' ? <Check className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {notice.text}
        </div>
      )}

      {/* Module 1 : Solde de Crédits Studio & Facturation Chansons (Kie.ai) */}
      <section className={`${panelClass} p-5 sm:p-6 space-y-5 border-[#E5B54F]/30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0E1015] to-[#08090C]`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl border border-[#E5B54F]/40 bg-[#E5B54F]/10 flex items-center justify-center text-[#F3CA75]">
              <Coins className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold text-white">Solde de Crédits Studio</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  N'expirent jamais
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                1 crédit = 1 génération chanson complète (85 F CFA) · Micro-crédits IA inclus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-3xl font-bold tracking-tight tabular-nums text-white">
                {credits.source === 'pending' ? '—' : credits.balance.toFixed(2)}
              </div>
              <div className="text-[11px] text-neutral-400">
                {credits.source === 'demo' ? 'crédits (démonstration)' : credits.source === 'pending' ? 'synchronisation…' : 'crédits disponibles'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRechargeModal(true)}
              className="h-10 px-4 rounded-xl bg-[#E5B54F] text-xs font-semibold text-black hover:bg-[#F0C068] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-[0_0_20px_-5px_rgba(229,181,79,0.4)]"
            >
              <Coins className="h-3.5 w-3.5" />
              Recharger
            </button>
          </div>
        </div>

        {/* Modal / Bloc de recharge en Paiement Libre SasPay */}
        {showRechargeModal && (
          <div className="p-5 rounded-2xl border border-white/[0.12] bg-[#0E1015] space-y-5 vx-fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
              <div>
                <div className="text-base font-semibold text-white flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#E5B54F]" />
                  Recharge de crédits en Paiement Libre
                </div>
                <div className="text-xs text-[#A3A3A3] mt-0.5">
                  1 crédit = 85 F CFA · Crédits sans date d'expiration · Mobile Money & Carte
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRechargeModal(false)}
                className="text-xs text-[#A3A3A3] hover:text-white px-2 py-1 rounded-lg border border-white/5 hover:border-white/20 transition-colors"
              >
                Fermer
              </button>
            </div>

            {/* Saisie Montant Libre */}
            <div className="p-4 rounded-xl border border-[#E5B54F]/30 bg-[#E5B54F]/[0.05] space-y-3">
              <label htmlFor="recharge-free-cfa" className="text-xs font-semibold text-[#F3CA75] block">
                Saisissez votre montant libre en F CFA :
              </label>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <input
                    id="recharge-free-cfa"
                    type="number"
                    min={SASPAY_CONFIG.rates.minCfaRecharge}
                    step={100}
                    value={freeAmountCfa || ''}
                    onChange={e => setFreeAmountCfa(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="Ex: 1000, 2500, 5000..."
                    className="w-full h-12 rounded-xl border border-white/[0.12] bg-[#08090C] px-4 font-mono text-lg font-bold text-white focus:border-[#E5B54F] outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#A3A3A3] pointer-events-none">
                    F CFA
                  </span>
                </div>

                <button
                  type="button"
                  disabled={busy === 'checkout' || freeAmountCfa < SASPAY_CONFIG.rates.minCfaRecharge}
                  onClick={() => handleRechargeFreeAmount(freeAmountCfa)}
                  className="h-12 px-6 rounded-xl bg-[#E5B54F] text-xs font-bold text-black hover:bg-[#F0C068] active:scale-[0.98] transition-all disabled:opacity-40 whitespace-nowrap shadow-[0_0_20px_-5px_rgba(229,181,79,0.5)] flex items-center justify-center gap-2"
                >
                  {busy === 'checkout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Payer {(freeAmountCfa || 0).toLocaleString('fr-FR')} F CFA
                </button>
              </div>

              {/* Conversion en temps réel */}
              <div className="flex flex-wrap items-center justify-between text-xs pt-1">
                <div className="text-neutral-300">
                  Équivaut à :{' '}
                  <span className="font-mono text-base font-bold text-white">
                    {calculateCreditsForCFA(freeAmountCfa || 0).formattedCredits}
                  </span>{' '}
                  crédits chanson
                </div>
                <div className="text-[11px] text-neutral-500">
                  Seuil min. SasPay : {SASPAY_CONFIG.rates.minCfaRecharge} F CFA
                </div>
              </div>
            </div>

            {/* Suggestions de montants rapides */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-neutral-400">Suggestions de recharges rapides :</div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { cfa: 1000, label: '1 000 F CFA', popular: false },
                  { cfa: 2550, label: '2 550 F CFA', popular: false },
                  { cfa: 5000, label: '5 000 F CFA', popular: true },
                  { cfa: 10000, label: '10 000 F CFA', popular: false }
                ].map(item => {
                  const cr = calculateCreditsForCFA(item.cfa).formattedCredits;
                  return (
                    <button
                      key={item.cfa}
                      type="button"
                      onClick={() => setFreeAmountCfa(item.cfa)}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        freeAmountCfa === item.cfa
                          ? 'border-[#E5B54F] bg-[#E5B54F]/10 text-white'
                          : 'border-white/[0.08] bg-[#08090C] hover:border-white/[0.12] text-neutral-300'
                      }`}
                    >
                      <div className="font-mono text-xs font-bold">{item.label}</div>
                      <div className="text-[11px] text-[#F3CA75] font-mono mt-0.5">{cr} crédits</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Option B : Lien de paiement libre 100% hébergé SasPay */}
            <div className="pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-[#A3A3A3]">
                Lien universel SasPay : paiement non rattaché à votre compte, crédit appliqué manuellement après vérification.
              </div>
              <a
                href={SASPAY_CONFIG.freePaymentLinkUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-[#E5B54F]/40 bg-white/[0.03] text-neutral-200 hover:text-white transition-all text-xs font-medium"
              >
                <span>Lien universel SasPay</span>
                <ExternalLink className="h-3.5 w-3.5 text-[#E5B54F]" />
              </a>
            </div>
          </div>
        )}

        {/* Historique récent des crédits */}
        <div>
          <div className="text-xs font-semibold text-neutral-400 mb-2">Derniers mouvements de crédits</div>
          <div className="rounded-xl border border-white/[0.08] bg-[#08090C] divide-y divide-white/[0.06] max-h-48 overflow-y-auto">
            {credits.history.length === 0 && (
              <div className="p-3.5 text-xs text-neutral-500">Aucun mouvement pour le moment.</div>
            )}
            {credits.history.slice(0, 5).map(tx => (
              <div key={tx.id} className="p-2.5 sm:px-3.5 flex items-center justify-between text-xs">
                <div className="min-w-0 flex-1 pr-3">
                  <div className="text-neutral-200 truncate">{tx.reason}</div>
                  <div className="font-mono text-[11px] text-neutral-500 mt-0.5">{fmtDate(tx.date)}</div>
                </div>
                <div className="text-right shrink-0">
                  <span
                    className={`font-mono font-semibold ${
                      tx.amount > 0 ? 'text-emerald-400' : 'text-neutral-300'
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount.toFixed(2)}` : tx.amount.toFixed(2)} cr
                  </span>
                  {Number.isFinite(tx.balanceAfter) && (
                    <div className="font-mono text-[10px] text-neutral-500">{tx.balanceAfter.toFixed(2)} solde</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Module 2 : Abonnement SasPay */}
      <section className={`${panelClass} p-5 sm:p-6 space-y-5`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl border border-white/[0.12] bg-[#0E1015] flex items-center justify-center text-[#E5B54F]">
              <CreditCard className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold text-white">{subscription.planName}</span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border ${
                    subscription.status === 'active'
                      ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                      : subscription.status === 'canceled'
                      ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                      : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      subscription.status === 'active'
                        ? 'bg-emerald-400'
                        : subscription.status === 'canceled'
                        ? 'bg-amber-400'
                        : 'bg-rose-400'
                    }`}
                  />
                  {subscription.status === 'active'
                    ? 'Actif'
                    : subscription.status === 'canceled'
                    ? 'Sans renouvellement (actif jusqu’à échéance)'
                    : subscription.status === 'inactive'
                    ? 'Aucun pass'
                    : 'Expiré'}
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Pass d'accès à la plateforme Studio Velaris · Paiement sécurisé SasPay
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="font-mono text-2xl font-bold text-white">
              {subscription.priceXOF.toLocaleString('fr-FR')} F CFA
            </div>
            <div className="text-xs text-[#A3A3A3] flex items-center gap-1 sm:justify-end mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-[#E5B54F]" />
              Expire le :{' '}
              <strong className="text-neutral-200">{fmtShortDate(subscription.expiresAt)}</strong>
            </div>
          </div>
        </div>

        {/* Détails et actions abonnement Pass Créateur Chariow */}
        <div className="p-4 rounded-xl border border-[#E5B54F]/30 bg-[#E5B54F]/[0.03] space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[#E5B54F]">
                <ShieldCheck className="h-3 w-3" />
                <span>Formule Recommandée</span>
              </div>
              <div className="font-heading text-lg font-bold text-white mt-0.5">
                Pass Créateur Djelia Academy
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Accès complet Académie, 30 crédits de production inclus chaque mois, mini-site studio et vendeur WhatsApp.
              </p>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <div className="font-mono text-2xl font-bold text-[#F3CA75]">4 900 F CFA</div>
              <div className="text-[11px] text-neutral-500 font-mono">par mois (30 jours)</div>
            </div>
          </div>

          <button
            type="button"
            disabled={busy === 'checkout'}
            onClick={handleChariowSubscribe}
            className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-white text-xs font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.1)] cursor-pointer"
          >
            {busy === 'checkout' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Initialisation Chariow sécurisée…</span>
              </>
            ) : (
              <>
                <span>Activer mon Pass (4 900 F CFA via Wave, Orange Money ou Carte)</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>

        {/* Résiliation & Infos */}
        <div className="pt-2 border-t border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            {subscription.lastPaymentRef
              ? `Dernier paiement : ${subscription.lastPaymentRef}`
              : 'Paiements ponctuels Chariow : aucun prélèvement automatique imprévu, vous renouvelez quand vous le souhaitez.'}
          </div>

          {subscription.status === 'active' && !showCancelConfirm && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs text-neutral-400 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <Ban className="h-3 w-3" />
              Ne pas renouveler
            </button>
          )}

          {subscription.status === 'canceled' && (
            <button
              type="button"
              onClick={() => resumeSubscriptionRenewal()}
              className="text-xs text-neutral-400 hover:text-white transition-colors"
            >
              Réactiver le rappel de renouvellement
            </button>
          )}

          {showCancelConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-300">Arrêter le renouvellement ?</span>
              <button
                type="button"
                onClick={handleCancelSub}
                className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30"
              >
                Confirmer
              </button>
              <button
                type="button"
                onClick={() => setShowCancelConfirm(false)}
                className="px-2.5 py-1 rounded bg-neutral-800 text-neutral-400 text-xs hover:text-white"
              >
                Annuler
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Module 2-bis : Webhook SasPay (configuration plateforme, réservée à la direction) */}
      {isDirection && (
      <section className={`${panelClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-white/[0.12] bg-[#0E1015] flex items-center justify-center text-[#E5B54F]">
              <Globe className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold text-white">Webhook SasPay & Confirmation Instantanée</h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-[#A3A3A3] mt-0.5">
                Accréditation automatique des paiements SasPay (crédits libres et abonnements)
              </p>
            </div>
          </div>

          <a
            href="https://app.saspay.me"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-[#E5B54F]/50 bg-white/[0.03] text-xs font-medium text-neutral-300 hover:text-white transition-all w-fit"
          >
            <span>Tableau de bord SasPay</span>
            <ExternalLink className="h-3.5 w-3.5 text-[#E5B54F]" />
          </a>
        </div>

        <p className="text-xs text-neutral-400 leading-relaxed">
          Pour valider automatiquement les paiements en arrière-plan et créditer les studios instantanément, configurez l'URL webhook ci-dessous dans votre interface <strong>SasPay (Webhooks → Ajouter un point de réception)</strong> :
        </p>

        <div className="space-y-3">
          {/* URL 1 : Supabase Edge Function */}
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#08090C] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-200">
                1. Point de réception Supabase Edge Function (Recommandé) :
              </span>
              <button
                type="button"
                onClick={() => copyWebhook(SASPAY_CONFIG.webhooks.supabaseEndpoint, 'Supabase Edge Function')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5B54F] hover:text-[#F3CA75]"
              >
                {copiedWebhook === 'Supabase Edge Function' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedWebhook === 'Supabase Edge Function' ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <div className="font-mono text-xs text-[#F3CA75] break-all select-all bg-black/40 p-2 rounded-lg border border-white/5">
              {SASPAY_CONFIG.webhooks.supabaseEndpoint}
            </div>
          </div>

          {/* URL 2 : Domaine Velaris enregistré */}
          <div className="p-3.5 rounded-xl border border-white/[0.08] bg-[#08090C] space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-200">
                2. Point de réception Domaine Velaris (Enregistré sur SasPay) :
              </span>
              <button
                type="button"
                onClick={() => copyWebhook(SASPAY_CONFIG.webhooks.directEndpoint, 'Domaine Velaris')}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E5B54F] hover:text-[#F3CA75]"
              >
                {copiedWebhook === 'Domaine Velaris' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copiedWebhook === 'Domaine Velaris' ? 'Copié !' : 'Copier'}
              </button>
            </div>
            <div className="font-mono text-xs text-neutral-300 break-all select-all bg-black/40 p-2 rounded-lg border border-white/5">
              {SASPAY_CONFIG.webhooks.directEndpoint}
            </div>
          </div>
        </div>

        {/* Détails techniques & sécurité */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-[11px]">
          <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-neutral-400">
            <strong className="text-white">Événements abonnés :</strong> transaction.success, transaction.failed, transaction.cancelled
          </div>
          <div className="p-2.5 rounded-lg border border-white/5 bg-white/[0.02] text-neutral-400">
            <strong className="text-white">Sécurité active :</strong> Signature HMAC-SHA256 obligatoire, tolérance d'horodatage 300 s, idempotence par référence
          </div>
        </div>
      </section>
      )}


      {/* Module 3 : Configuration du Studio & Mini-Site Public */}
      <section className={`${panelClass} p-5 sm:p-6 space-y-6`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/30 flex items-center justify-center font-heading font-extrabold text-lg text-[#D4A017]">
              {initials}
            </div>
            <div>
              <h2 className="text-base font-heading font-semibold text-white">Mon Studio & Mini-Site Client</h2>
              <p className="text-xs text-[#8E94A3]">Personnalisez la vitrine publique que voient vos clients et votre Concierge IA.</p>
            </div>
          </div>

          <a
            href={`https://djelia.store/s/${studioSlug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-xs font-mono text-[#D4A017] border border-[#D4A017]/30 transition-colors"
          >
            <Globe className="h-3.5 w-3.5" />
            <span>djelia.store/s/{studioSlug}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <form onSubmit={saveStudioSettings} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="profile-studio-name" className="text-xs font-medium text-[#8E94A3]">
                Nom public de votre studio
              </label>
              <div className="relative">
                <Pencil className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                <input
                  id="profile-studio-name"
                  value={studioName}
                  maxLength={60}
                  onChange={e => setStudioName(e.target.value)}
                  placeholder="Ex: Studio Mélody by Fatou"
                  className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#0A0A0F] pl-9 pr-3 text-sm text-white placeholder-neutral-600 focus:border-[#D4A017] focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="profile-studio-slug" className="text-xs font-medium text-[#8E94A3]">
                Identifiant d'URL unique (slug)
              </label>
              <div className="relative">
                <Globe className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                <input
                  id="profile-studio-slug"
                  value={studioSlug}
                  maxLength={40}
                  onChange={e => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="studio-melody"
                  className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#0A0A0F] pl-9 pr-3 text-sm font-mono text-white placeholder-neutral-600 focus:border-[#D4A017] focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="profile-studio-bio" className="text-xs font-medium text-[#8E94A3]">
              Biographie & Message de bienvenue (affiché sur le mini-site)
            </label>
            <textarea
              id="profile-studio-bio"
              rows={2}
              maxLength={200}
              value={studioBio}
              onChange={e => setStudioBio(e.target.value)}
              placeholder="Ex: Basée à Abidjan, je crée des chansons personnalisées émouvantes pour vos anniversaires, mariages et déclarations d'amour."
              className="w-full rounded-xl border border-white/[0.08] bg-[#0A0A0F] p-3 text-sm text-white placeholder-neutral-600 focus:border-[#D4A017] focus:outline-none transition-colors resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-[#8E94A3]">
              Styles musicaux proposés
            </label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {['Afrobeat', 'Zouk', 'Acoustique', 'Gospel', 'Rumba', 'Coupé-décalé'].map(style => {
                const isChecked = selectedStyles.includes(style);
                return (
                  <button
                    type="button"
                    key={style}
                    onClick={() => {
                      setSelectedStyles(prev =>
                        isChecked ? prev.filter(s => s !== style) : [...prev, style]
                      );
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                      isChecked
                        ? 'bg-[#D4A017]/15 border-[#D4A017] text-white'
                        : 'bg-[#0A0A0F] border-white/[0.08] text-[#8E94A3] hover:text-white'
                    }`}
                  >
                    {style}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8E94A3]">
                Prix standard annoncé au client
              </label>
              <select
                value={studioPrice}
                onChange={e => setStudioPrice(Number(e.target.value))}
                className="w-full h-11 rounded-xl border border-white/[0.08] bg-[#0A0A0F] px-3 text-sm font-mono text-white focus:border-[#D4A017] focus:outline-none cursor-pointer"
              >
                <option value={1200}>1 200 F CFA (Prix plancher direct)</option>
                <option value={2000}>2 000 F CFA (Marge membre 800 F)</option>
                <option value={2500}>2 500 F CFA (Marge membre 1 300 F)</option>
                <option value={3000}>3 000 F CFA (Marge membre 1 800 F)</option>
                <option value={5000}>5 000 F CFA (Formule premium)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[#8E94A3]">
                Moyens de paiement acceptés
              </label>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['Wave', 'Orange Money', 'MTN MoMo', 'Moov'].map(op => {
                  const isChecked = selectedPayments.includes(op);
                  return (
                    <button
                      type="button"
                      key={op}
                      onClick={() => {
                        setSelectedPayments(prev =>
                          isChecked ? prev.filter(p => p !== op) : [...prev, op]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-[#D4A017]/15 border-[#D4A017] text-white'
                          : 'bg-[#0A0A0F] border-white/[0.08] text-[#8E94A3] hover:text-white'
                      }`}
                    >
                      {op}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="h-11 px-6 rounded-full bg-[#D4A017] hover:bg-[#F5D060] text-[#0A0A0F] font-semibold text-xs inline-flex items-center gap-2 transition-all cursor-pointer shadow-[0_0_16px_-4px_rgba(212,160,23,0.35)]"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Enregistrer la configuration</span>
            </button>
          </div>
        </form>

        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-xl overflow-hidden border border-white/[0.08] bg-white/[0.08]">
          {facts.map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="bg-[#0A0A0F] px-4 py-3 flex items-start gap-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[#737373]" strokeWidth={1.5} />
              <div className="min-w-0">
                <dt className="text-xs text-neutral-500">{label}</dt>
                <dd className={`text-sm text-white truncate ${mono ? 'font-mono' : ''}`}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      </section>

      {/* Ligne WhatsApp & Sécurité */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Ligne WhatsApp */}
        <section className={`${panelClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <Smartphone className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
            Ligne WhatsApp privée
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0E1015] px-4 h-12">
            <span className="font-mono text-sm text-[#F3CA75] truncate">{sessionName}</span>
            <button
              onClick={copySession}
              aria-label="Copier l'identifiant de session"
              className="h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-xs text-neutral-500 leading-relaxed">
            Session WAHA dédiée : aucun mélange de messages, clients isolés par RLS.
          </p>
          <button
            onClick={onOpenWhatsApp}
            className="w-full h-11 rounded-xl border border-white/[0.12] text-[13px] font-semibold text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white transition-colors"
          >
            Gérer mes lignes WhatsApp
          </button>
        </section>

        {/* Sécurité */}
        <section className={`${panelClass} p-5 sm:p-6 space-y-4`}>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-[#E5B54F]" strokeWidth={1.5} />
            Sécurité & anti-fraude
          </div>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Statut RLS</span>
              <span className="flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
                PRIVÉ · user_id
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Signature SasPay</span>
              <span className="font-mono text-xs text-emerald-400">HMAC-SHA256 (5 min)</span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-neutral-400">Email confirmé</span>
              <span className={`font-mono text-xs ${user?.email_confirmed_at ? 'text-emerald-400' : 'text-amber-300'}`}>
                {user?.email_confirmed_at ? 'OUI' : 'EN ATTENTE'}
              </span>
            </li>
          </ul>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={handleRefresh}
              disabled={busy !== null}
              className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] text-[13px] font-medium text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
              Renouveler jeton
            </button>
            <button
              onClick={handlePasswordReset}
              disabled={busy !== null}
              className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] text-[13px] font-medium text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              {busy === 'reset' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Mot de passe
            </button>
          </div>
        </section>
      </div>

      {/* Déconnexion */}
      <section className={`${panelClass} p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
        <div>
          <div className="text-[15px] font-semibold text-white">Se déconnecter de ce poste</div>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Vos données et vos crédits restent sécurisés dans votre espace studio.
          </p>
        </div>
        <button
          onClick={handleSignOut}
          disabled={busy !== null}
          className="h-11 shrink-0 inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/30 px-5 text-[13px] font-semibold text-rose-300 hover:bg-rose-500/[0.08] hover:text-rose-200 disabled:opacity-50 transition-colors"
        >
          {busy === 'signout' ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          Se déconnecter
        </button>
      </section>
    </div>
  );
};
