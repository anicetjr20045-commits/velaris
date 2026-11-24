import { useState, useEffect, type FC, type FormEvent } from 'react';
import {
  Coins,
  CreditCard,
  LogOut,
  AlertCircle,
  Loader2,
  CalendarClock,
  Settings,
  Pencil,
  X,
  Check,
  ArrowRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabase';
import {
  getStudioCredits,
  getStudioSubscription,
  refreshBilling,
  subscribeToBilling
} from '../services/billing';
import {
  createCreditRechargeCheckout,
  calculateCreditsForCFA,
  clearPendingCheckout,
  getCheckoutStatus,
  getPendingCheckout,
  SASPAY_CONFIG
} from '../services/saspay';
import { initiateChariowCheckout, verifyChariowSale } from '../services/chariow';

interface StudioProfileViewProps {
  onSignedOut?: () => void;
  onOpenWhatsApp: () => void;
}

const fmtDate = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
      })
    : '—';

export const StudioProfileView: FC<StudioProfileViewProps> = ({ onSignedOut }) => {
  const { user, signOut } = useAuth();

  const currentName = (user?.user_metadata?.studio_name as string) || '';
  const [studioName, setStudioName] = useState(currentName);
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

  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState<'signout' | 'checkout' | null>(null);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  // Billing state
  const [credits, setCredits] = useState(getStudioCredits());
  const [subscription, setSubscription] = useState(getStudioSubscription());
  const [freeAmountCfa, setFreeAmountCfa] = useState<number>(1000);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    return subscribeToBilling(() => {
      setCredits(getStudioCredits());
      setSubscription(getStudioSubscription());
    });
  }, []);

  /* Retour de paiement : Chariow ou SasPay */
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

      (async () => {
        setNotice({ tone: 'ok', text: 'Validation de votre abonnement Chariow en cours…' });
        for (let i = 0; i < 4; i++) {
          const res = await verifyChariowSale(saleId);
          if (res.activated) {
            await refreshBilling();
            setNotice({ tone: 'ok', text: 'Paiement Chariow confirmé ! Votre Pass Créateur et vos 30 crédits sont actifs.' });
            return;
          }
          await new Promise(r => setTimeout(r, 2000));
        }
        await refreshBilling();
        setNotice({ tone: 'ok', text: 'Paiement Chariow enregistré. Votre Pass est actif.' });
      })();
      return;
    }

    // Retour SasPay
    const pending = getPendingCheckout();
    if (params.get('payment') !== 'return' || !pending) return;
    params.delete('payment');
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', clean);

    (async () => {
      setNotice({ tone: 'ok', text: 'Vérification de votre paiement auprès de SasPay…' });
      for (let i = 0; i < 5; i++) {
        const st = await getCheckoutStatus(pending.id);
        if (st.status === 'PAID') {
          await refreshBilling();
          clearPendingCheckout();
          setNotice({ tone: 'ok', text: 'Paiement confirmé par SasPay. Vos crédits sont disponibles.' });
          return;
        }
        await new Promise(r => setTimeout(r, 3000));
      }
    })();
  }, [user]);

  const initials = ((currentName || user?.email || 'VS').slice(0, 2)).toUpperCase();

  const handleChariowSubscribe = async () => {
    if (!user) return;
    setBusy('checkout');
    const res = await initiateChariowCheckout({
      userId: user.id,
      email: user.email || '',
      fullName: (user.user_metadata?.studio_name as string) || (user.user_metadata?.full_name as string) || 'Créateur Velaris',
      phone: (user.user_metadata?.phone as string) || '',
    });
    setBusy(null);
    if (res.success && res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
    } else {
      setNotice({ tone: 'err', text: res.error || 'Impossible d’initialiser le paiement Chariow.' });
    }
  };

  const handleRechargeCredits = async (amountCfa: number) => {
    if (amountCfa < SASPAY_CONFIG.rates.minCfaRecharge) return;
    setBusy('checkout');
    const res = await createCreditRechargeCheckout(amountCfa);
    setBusy(null);
    if (res.success && res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
    } else {
      setNotice({ tone: 'err', text: res.error || 'Erreur lors de l’initialisation de la recharge.' });
    }
  };

  const saveStudioSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanName = studioName.trim();
      const cleanSlug = studioSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '') || 'mon-studio';
      const { error } = await supabase.auth.updateUser({
        data: {
          studio_name: cleanName,
          studio_slug: cleanSlug,
          studio_bio: studioBio.trim().slice(0, 200),
          studio_price: studioPrice,
        }
      });
      if (error) throw error;
      setNotice({ tone: 'ok', text: 'Paramètres du studio enregistrés avec succès.' });
      setShowSettingsModal(false);
    } catch (err: any) {
      setNotice({ tone: 'err', text: err?.message || 'Erreur lors de l’enregistrement.' });
    } finally {
      setSaving(false);
    }
  };

  const expiresTime = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : 0;
  const now = Date.now();
  const daysRemaining = expiresTime > now ? Math.ceil((expiresTime - now) / (1000 * 3600 * 24)) : 0;
  const isExpired = subscription.status === 'expired' || (Boolean(subscription.expiresAt) && expiresTime <= now);
  const isExpiringSoon = subscription.status === 'active' && daysRemaining <= 5 && daysRemaining > 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {/* En-tête épuré */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Mon Compte</h1>
          <p className="text-xs text-[#8E94A3] mt-0.5">Abonnement, crédits et identité du studio</p>
        </div>
        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] hover:bg-white/[0.06] text-xs font-medium text-[#C7CAD4] hover:text-white transition cursor-pointer"
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Paramètres</span>
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2.5 p-3 rounded-xl border text-xs font-medium ${
            notice.tone === 'ok'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
              : 'border-rose-500/30 bg-rose-500/10 text-rose-200'
          }`}
        >
          {notice.tone === 'ok' ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}

      {/* CARTE 1 : UTILISATEUR & PASS CRÉATEUR */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#08090D] p-5 sm:p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#E0C583]/5 border border-[#D4AF37]/40 flex items-center justify-center text-sm font-bold text-[#E0C583] font-mono shrink-0">
              {initials}
            </div>
            <div>
              <div className="text-sm font-bold text-white">{currentName || 'Créateur Velaris'}</div>
              <div className="text-xs text-[#8E94A3]">{user?.email || 'Membre Studio'}</div>
            </div>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border ${
              !isExpired && subscription.status === 'active'
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${!isExpired && subscription.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`} />
            <span>{!isExpired && subscription.status === 'active' ? 'Pass Actif' : 'Expiré'}</span>
          </span>
        </div>

        {/* Alerte si expiré ou expire bientôt */}
        {isExpired && (
          <div className="p-3.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-xs text-rose-200 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Votre Pass a expiré le {fmtDate(subscription.expiresAt)}. Réactivez pour débloquer le studio.</span>
          </div>
        )}
        {isExpiringSoon && (
          <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-200 flex items-center gap-2.5">
            <CalendarClock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Votre Pass expire dans {daysRemaining} jour{daysRemaining > 1 ? 's' : ''} ({fmtDate(subscription.expiresAt)}).</span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-[#8E94A3] pt-2 border-t border-white/[0.06]">
          <span>Tarif : <strong className="text-white">4 900 F CFA / mois</strong></span>
          <span>Échéance : <strong className="text-white">{fmtDate(subscription.expiresAt)}</strong></span>
        </div>

        <button
          type="button"
          disabled={busy === 'checkout'}
          onClick={handleChariowSubscribe}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 text-black text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_20px_rgba(245,208,96,0.25)]"
        >
          {busy === 'checkout' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <CreditCard className="w-4 h-4" />
              <span>{isExpired ? 'Réactiver mon Pass Créateur (4 900 F CFA)' : 'Renouveler mon Pass (4 900 F CFA)'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </div>

      {/* CARTE 2 : SOLDE DE CRÉDITS STUDIO */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#08090D] p-5 sm:p-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
            <Coins className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs text-[#8E94A3]">Solde de production</div>
            <div className="font-mono text-2xl font-black text-white mt-0.5">
              {credits.balance.toFixed(0)}{' '}
              <span className="text-xs font-normal text-[#E0C583]">crédits</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowRechargeModal(true)}
          className="px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/10 text-xs font-semibold text-white transition cursor-pointer"
        >
          Recharger
        </button>
      </div>

      {/* BOUTON DÉCONNEXION */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={async () => {
            setBusy('signout');
            await signOut();
            setBusy(null);
            onSignedOut?.();
          }}
          className="text-xs text-[#8E94A3] hover:text-rose-400 flex items-center gap-1.5 transition cursor-pointer py-2 px-3"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Se déconnecter</span>
        </button>
      </div>

      {/* MODAL RECHARGE CRÉDITS */}
      {showRechargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#08090D] border border-white/[0.1] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Coins className="w-4 h-4 text-[#E5B54F]" />
                Recharger des Crédits
              </div>
              <button
                type="button"
                onClick={() => setShowRechargeModal(false)}
                className="text-[#8E94A3] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs text-[#C7CAD4] block">Montant en F CFA :</label>
              <div className="grid grid-cols-3 gap-2">
                {[1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setFreeAmountCfa(amt)}
                    className={`p-2.5 rounded-xl border text-center transition cursor-pointer ${
                      freeAmountCfa === amt
                        ? 'border-[#D4AF37] bg-[#D4AF37]/10 text-white font-bold'
                        : 'border-white/10 text-[#C7CAD4] hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-mono">{amt.toLocaleString('fr-FR')} F</div>
                    <div className="text-[10px] text-[#E0C583] font-mono mt-0.5">
                      {calculateCreditsForCFA(amt).formattedCredits} cr
                    </div>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleRechargeCredits(freeAmountCfa)}
                className="w-full py-3 rounded-xl bg-[#D4AF37] hover:bg-[#E0C583] text-black text-xs font-bold transition mt-2 cursor-pointer"
              >
                Payer {freeAmountCfa.toLocaleString('fr-FR')} F CFA via Mobile Money
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PARAMÈTRES STUDIO */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md bg-[#08090D] border border-white/[0.1] rounded-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/[0.06] pb-3">
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-[#D4AF37]" />
                Paramètres du Studio
              </div>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                className="text-[#8E94A3] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveStudioSettings} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[#C7CAD4] font-medium mb-1">Nom public du studio</label>
                <input
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  placeholder="Ex: Studio Fatou"
                  className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[#C7CAD4] font-medium mb-1">Identifiant d'URL unique (slug)</label>
                <input
                  type="text"
                  value={studioSlug}
                  onChange={(e) => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  placeholder="studio-fatou"
                  className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                />
              </div>

              <div>
                <label className="block text-[#C7CAD4] font-medium mb-1">Prix annoncé par chanson</label>
                <select
                  value={studioPrice}
                  onChange={(e) => setStudioPrice(Number(e.target.value))}
                  className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                >
                  <option value={1500}>1 500 F CFA</option>
                  <option value={2000}>2 000 F CFA</option>
                  <option value={3000}>3 000 F CFA</option>
                  <option value={5000}>5 000 F CFA</option>
                </select>
              </div>

              <div>
                <label className="block text-[#C7CAD4] font-medium mb-1">Biographie courte</label>
                <textarea
                  rows={2}
                  value={studioBio}
                  onChange={(e) => setStudioBio(e.target.value)}
                  placeholder="Présentation rapide de votre studio..."
                  className="w-full bg-[#040507] border border-white/10 rounded-xl p-2.5 text-white text-xs focus:outline-none focus:border-[#D4AF37] resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-bold hover:bg-neutral-200 transition cursor-pointer mt-2"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
