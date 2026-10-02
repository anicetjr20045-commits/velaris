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
  Sparkles,
  ExternalLink,
  Globe
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import {
  getStudioCredits,
  getStudioSubscription,
  rechargeCredits,
  cancelSubscription,
  activateSubscription,
  subscribeToBilling
} from '../services/billing';
import {
  createSasPayCheckout,
  createSasPayFreeAmountCheckout,
  calculateCreditsForCFA,
  SASPAY_CONFIG
} from '../services/saspay';
import type { SubscriptionPlanId } from '../types/billing';

interface StudioProfileViewProps {
  onSignedOut?: () => void;
  onOpenWhatsApp: () => void;
}

const panelClass = 'rounded-2xl border border-[#2D261E] bg-[#13110E] vx-hairline';

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

  useEffect(() => {
    const unsub = subscribeToBilling(() => {
      setCredits(getStudioCredits());
      setSubscription(getStudioSubscription());
    });
    return unsub;
  }, []);

  const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
  const initials = ((currentName || user?.email || 'ST').slice(0, 2)).toUpperCase();

  const flash = (tone: 'ok' | 'err', text: string) => {
    setNotice({ tone, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    const clean = studioName.replace(/[<>"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (!clean || clean === currentName) return;
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ data: { studio_name: clean } });
    setSaving(false);
    if (error) flash('err', "Impossible d'enregistrer le nom du studio.");
    else flash('ok', 'Nom du studio mis à jour.');
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

  // Souscription SasPay Checkout
  const handleSubscribe = async (planId: SubscriptionPlanId) => {
    setBusy('checkout');
    const plan = planId === 'quarterly' ? SASPAY_CONFIG.plans.quarterly : SASPAY_CONFIG.plans.monthly;
    const checkoutRes = await createSasPayCheckout({
      amount: plan.priceXOF,
      description: `${plan.name} - Studio Velaris`,
      customerEmail: user?.email || 'studio@velaris.money',
      customerName: studioName || 'Studio Velaris',
      metadata: {
        type: 'subscription',
        planId,
        userId: user?.id || 'demo'
      }
    });
    setBusy(null);

    if (checkoutRes.success && checkoutRes.data?.checkoutUrl) {
      // Activer immédiatement en local pour réactivité studio + ouvrir lien SasPay réel
      activateSubscription(planId, checkoutRes.data.id, 'SasPay Mobile Money');
      flash('ok', `Redirection vers la passerelle de paiement SasPay (${plan.priceXOF.toLocaleString('fr-FR')} F CFA)...`);
      window.open(checkoutRes.data.checkoutUrl, '_blank');
    } else {
      flash('err', checkoutRes.error || 'Impossible d’initialiser le paiement SasPay.');
    }
  };

  // Recharge en montant libre SasPay (calcul temps réel à 85 F CFA / crédit)
  const handleRechargeFreeAmount = async (amountCfa: number) => {
    if (amountCfa < SASPAY_CONFIG.rates.minCfaRecharge) {
      flash('err', `Le montant minimum pour un paiement SasPay est de ${SASPAY_CONFIG.rates.minCfaRecharge} F CFA.`);
      return;
    }
    setBusy('checkout');
    const res = await createSasPayFreeAmountCheckout({
      amountCfa,
      customerEmail: user?.email || 'studio@velaris.money',
      customerName: studioName || 'Studio Velaris',
      userId: user?.id || 'demo'
    });
    setBusy(null);

    if (res.success && res.checkoutUrl) {
      if (res.creditsExpected && res.creditsExpected > 0) {
        rechargeCredits(res.creditsExpected, 'SASPAY-LIBRE', 'SasPay Mobile Money');
        flash('ok', `${res.creditsExpected} crédits provisionnés ! Redirection vers SasPay (${amountCfa.toLocaleString('fr-FR')} F CFA)...`);
      } else {
        flash('ok', 'Redirection vers la passerelle de paiement SasPay...');
      }
      setShowRechargeModal(false);
      window.open(res.checkoutUrl, '_blank');
    } else {
      flash('err', res.error || 'Erreur lors du paiement libre SasPay.');
    }
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
    flash('ok', 'Abonnement résilié. Votre accès reste garanti jusqu’à la date d’expiration.');
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
        <p className="text-sm sm:text-base text-[#A8A29E] mt-2">
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
      <section className={`${panelClass} p-5 sm:p-6 space-y-5 border-[#E5B54F]/30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1C1710] to-[#0E0C0A]`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl border border-[#E5B54F]/40 bg-[#E5B54F]/10 flex items-center justify-center text-[#F3CA75]">
              <Coins className="h-6 w-6" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[17px] font-semibold text-white">Solde de Crédits Studio</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-300">
                  <Sparkles className="h-2.5 w-2.5" />
                  N'expirent jamais
                </span>
              </div>
              <p className="text-xs text-[#A8A29E] mt-0.5">
                1 crédit = 1 génération chanson complète (85 F CFA) · Micro-crédits IA inclus
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono text-3xl font-bold tracking-tight text-[#F3CA75]">
                {credits.balance.toFixed(2)}
              </div>
              <div className="text-[11px] text-[#A8A29E]">crédits disponibles</div>
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
          <div className="p-5 rounded-2xl border border-[#3A3022] bg-[#161310] space-y-5 vx-fade-in shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#2D261E] pb-3">
              <div>
                <div className="text-base font-semibold text-white flex items-center gap-2">
                  <Coins className="h-4 w-4 text-[#E5B54F]" />
                  Recharge de crédits en Paiement Libre
                </div>
                <div className="text-xs text-[#A8A29E] mt-0.5">
                  1 crédit = 85 F CFA · Crédits sans date d'expiration · Mobile Money & Carte
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowRechargeModal(false)}
                className="text-xs text-[#A8A29E] hover:text-white px-2 py-1 rounded-lg border border-white/5 hover:border-white/20 transition-colors"
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
                    className="w-full h-12 rounded-xl border border-[#3A3022] bg-[#0E0C0A] px-4 font-mono text-lg font-bold text-white focus:border-[#E5B54F] outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-[#A8A29E] pointer-events-none">
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
                          : 'border-[#2D261E] bg-[#110F0D] hover:border-[#3A3022] text-neutral-300'
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
            <div className="pt-3 border-t border-[#2D261E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-[#A8A29E]">
                Vous préférez saisir le montant directement sur la page SasPay ?
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
          <div className="rounded-xl border border-[#2D261E] bg-[#0E0C0A] divide-y divide-[#221C16] max-h-48 overflow-y-auto">
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
                  <div className="font-mono text-[10px] text-neutral-500">{tx.balanceAfter.toFixed(2)} solde</div>
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
            <div className="h-12 w-12 rounded-xl border border-[#3A3022] bg-[#1A1713] flex items-center justify-center text-[#E5B54F]">
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
                    ? 'Résilié (actif jusqu’à échéance)'
                    : 'Expiré'}
                </span>
              </div>
              <p className="text-xs text-[#A8A29E] mt-0.5">
                Pass d'accès à la plateforme Studio Velaris · Paiement sécurisé SasPay
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="font-mono text-2xl font-bold text-white">
              {subscription.priceXOF.toLocaleString('fr-FR')} F CFA
            </div>
            <div className="text-xs text-[#A8A29E] flex items-center gap-1 sm:justify-end mt-0.5">
              <Calendar className="h-3.5 w-3.5 text-[#E5B54F]" />
              Expire le :{' '}
              <strong className="text-neutral-200">{fmtShortDate(subscription.expiresAt)}</strong>
            </div>
          </div>
        </div>

        {/* Détails et actions abonnement */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3.5 rounded-xl border border-[#2D261E] bg-[#171512] space-y-1">
            <div className="text-xs text-neutral-400">Pass Mensuel (30 jours)</div>
            <div className="font-mono text-base font-semibold text-white">3 000 F CFA / mois</div>
            <p className="text-[11px] text-neutral-500 leading-tight">Accès studio illimité, passerelle WhatsApp et CRM.</p>
            <button
              type="button"
              disabled={busy === 'checkout'}
              onClick={() => handleSubscribe('monthly')}
              className="mt-2 w-full h-8 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold text-white hover:bg-white/10 active:scale-[0.98] transition-all"
            >
              Souscrire mensuel
            </button>
          </div>

          <div className="p-3.5 rounded-xl border border-[#E5B54F]/30 bg-[#E5B54F]/[0.04] space-y-1 relative">
            <span className="absolute top-3 right-3 text-[10px] font-bold text-[#F3CA75] uppercase tracking-wider">
              - 2 000 F CFA
            </span>
            <div className="text-xs text-neutral-400">Pass 3 Mois (Trimestriel)</div>
            <div className="font-mono text-base font-semibold text-[#F3CA75]">7 000 F CFA / 3 mois</div>
            <p className="text-[11px] text-neutral-500 leading-tight">Idéal pour les studios actifs (2 333 F/mois).</p>
            <button
              type="button"
              disabled={busy === 'checkout'}
              onClick={() => handleSubscribe('quarterly')}
              className="mt-2 w-full h-8 rounded-lg bg-[#E5B54F] text-xs font-semibold text-black hover:bg-[#F0C068] active:scale-[0.98] transition-all"
            >
              Souscrire 3 mois
            </button>
          </div>
        </div>

        {/* Résiliation */}
        <div className="pt-2 border-t border-[#2D261E] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="text-xs text-neutral-500">
            Dernier paiement : {subscription.lastPaymentRef || 'SASPAY-REF-INIT'} via{' '}
            {subscription.lastPaymentMethod || 'Mobile Money'}
          </div>

          {subscription.status === 'active' && !showCancelConfirm && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="text-xs text-neutral-400 hover:text-rose-400 transition-colors flex items-center gap-1"
            >
              <Ban className="h-3 w-3" />
              Résilier mon abonnement
            </button>
          )}

          {showCancelConfirm && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-300">Confirmer la résiliation ?</span>
              <button
                type="button"
                onClick={handleCancelSub}
                className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 text-xs font-semibold hover:bg-rose-500/30"
              >
                Oui, résilier
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

      {/* Module 2-bis : Webhook SasPay & Synchronisation Temps Réel */}
      <section className={`${panelClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2D261E] pb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl border border-[#3A3022] bg-[#1A1713] flex items-center justify-center text-[#E5B54F]">
              <Globe className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-semibold text-white">Webhook SasPay & Confirmation Instantanée</h2>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                  LIVE
                </span>
              </div>
              <p className="text-xs text-[#A8A29E] mt-0.5">
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
          <div className="p-3.5 rounded-xl border border-[#2D261E] bg-[#0E0C0A] space-y-1.5">
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
          <div className="p-3.5 rounded-xl border border-[#2D261E] bg-[#0E0C0A] space-y-1.5">
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
            <strong className="text-white">Sécurité active :</strong> Signature HMAC-SHA256, tolérance d'horodatage 300s (anti-rejeu)
          </div>
        </div>
      </section>


      {/* Module 3 : Identité & Nom du Studio */}
      <section className={`${panelClass} p-5 sm:p-6 space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="h-16 w-16 shrink-0 rounded-full bg-[radial-gradient(circle_at_35%_30%,#3A3022,#13110E_70%)] border border-[#E5B54F]/40 flex items-center justify-center font-display text-xl font-bold text-[#F3CA75]">
            {initials}
          </div>

          <form onSubmit={saveName} className="flex-1 space-y-1.5">
            <label htmlFor="profile-studio-name" className="text-xs font-medium text-neutral-400">
              Nom du studio
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Pencil className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                <input
                  id="profile-studio-name"
                  value={studioName}
                  maxLength={60}
                  onChange={e => setStudioName(e.target.value)}
                  placeholder="Mon Studio Velaris"
                  className="w-full h-11 rounded-xl border border-[#2D261E] bg-[#1A1713] pl-9 pr-3 text-[15px] text-white placeholder-neutral-600 focus:border-[#E5B54F]/60 focus:outline-none focus:ring-2 focus:ring-[#E5B54F]/15 transition-[border-color,box-shadow]"
                />
              </div>
              <button
                type="submit"
                disabled={saving || !studioName.trim() || studioName.trim() === currentName}
                className="h-11 shrink-0 inline-flex items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-semibold text-black hover:bg-neutral-200 disabled:opacity-40 active:scale-[0.98] transition-all"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Enregistrer
              </button>
            </div>
          </form>
        </div>

        <dl className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-px rounded-xl overflow-hidden border border-[#2D261E] bg-[#2D261E]">
          {facts.map(({ icon: Icon, label, value, mono }) => (
            <div key={label} className="bg-[#13110E] px-4 py-3.5 flex items-start gap-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-[#78716C]" strokeWidth={1.5} />
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
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#2D261E] bg-[#1A1713] px-4 h-12">
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
            className="w-full h-11 rounded-xl border border-[#3A3022] text-[13px] font-semibold text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white transition-colors"
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
              className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-[#3A3022] text-[13px] font-medium text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
              Renouveler jeton
            </button>
            <button
              onClick={handlePasswordReset}
              disabled={busy !== null}
              className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-[#3A3022] text-[13px] font-medium text-neutral-200 hover:border-[#E5B54F]/50 hover:text-white disabled:opacity-50 transition-colors"
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
