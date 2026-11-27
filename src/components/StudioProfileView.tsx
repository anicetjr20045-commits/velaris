import { useState, useEffect, type FC, type FormEvent } from 'react';
import {
  AlertCircle,
  Loader2,
  CalendarClock,
  LogOut,
  X,
  Check
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
  clearPendingCheckout,
  getCheckoutStatus,
  getPendingCheckout,
} from '../services/saspay';
import {
  CHARIOW_CREDIT_PACKS,
  initiateChariowCheckout,
  verifyChariowSale,
} from '../services/chariow';

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

  const [credits, setCredits] = useState(getStudioCredits());
  const [subscription, setSubscription] = useState(getStudioSubscription());
  const [selectedPackId, setSelectedPackId] = useState<string>(CHARIOW_CREDIT_PACKS[1].productId);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  useEffect(() => {
    return subscribeToBilling(() => {
      setCredits(getStudioCredits());
      setSubscription(getStudioSubscription());
    });
  }, []);

  // Retour de paiement Chariow ou SasPay
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);

    if (params.get('payment') === 'success' && params.get('sale_id')) {
      const saleId = params.get('sale_id')!;
      params.delete('payment');
      params.delete('sale_id');
      const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
      window.history.replaceState(null, '', clean);

      (async () => {
        setNotice({ tone: 'ok', text: 'Validation de votre paiement Chariow en cours…' });
        for (let i = 0; i < 4; i++) {
          const res = await verifyChariowSale(saleId);
          if (res.activated) {
            await refreshBilling();
            const msg =
              res.kind === 'credits'
                ? `Recharge confirmée : +${res.creditsAdded ?? ''} crédits ajoutés à votre compte.`
                : `Paiement confirmé. Votre Pass Créateur et vos ${res.creditsAdded ?? 30} crédits sont actifs.`;
            setNotice({ tone: 'ok', text: msg });
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        await refreshBilling();
        setNotice({ tone: 'ok', text: 'Paiement enregistré. Votre solde a été actualisé.' });
      })();
      return;
    }

    const pending = getPendingCheckout();
    if (params.get('payment') !== 'return' || !pending) return;
    params.delete('payment');
    const clean = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', clean);

    (async () => {
      setNotice({ tone: 'ok', text: 'Vérification de votre recharge SasPay…' });
      for (let i = 0; i < 5; i++) {
        const st = await getCheckoutStatus(pending.id);
        if (st.status === 'PAID') {
          await refreshBilling();
          clearPendingCheckout();
          setNotice({ tone: 'ok', text: 'Recharge confirmée. Vos crédits sont disponibles.' });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
    })();
  }, [user]);

  const handleChariowSubscribe = async () => {
    if (!user) return;
    setBusy('checkout');
    const res = await initiateChariowCheckout({
      userId: user.id,
      email: user.email || '',
      fullName:
        (user.user_metadata?.studio_name as string) ||
        (user.user_metadata?.full_name as string) ||
        'Créateur Velaris',
      phone: (user.user_metadata?.phone as string) || '',
    });
    setBusy(null);
    if (res.success && res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
    } else {
      setNotice({ tone: 'err', text: res.error || 'Impossible d’initialiser le paiement Chariow.' });
    }
  };

  const handleRechargeCredits = async (productId: string) => {
    if (!user) return;
    setBusy('checkout');
    const res = await initiateChariowCheckout({
      userId: user.id,
      email: user.email || '',
      fullName:
        (user.user_metadata?.studio_name as string) ||
        (user.user_metadata?.full_name as string) ||
        'Créateur Velaris',
      phone: (user.user_metadata?.phone as string) || '',
      productId,
    });
    setBusy(null);
    if (res.success && res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
    } else {
      setNotice({ tone: 'err', text: res.error || 'Impossible d’initialiser le paiement Chariow.' });
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
        },
      });
      if (error) throw error;
      setNotice({ tone: 'ok', text: 'Paramètres du compte enregistrés.' });
      setShowSettingsModal(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.';
      setNotice({ tone: 'err', text: msg });
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
    <div className="space-y-8 pb-8">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Crédits & Compte</h1>
          <p className="text-sm text-[#8A90A0]">
            Recharges de production, abonnement et réglages.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowSettingsModal(true)}
          className="px-4 py-2 rounded-full bg-[#0D0F14] hover:bg-[#141720] text-xs font-medium text-white transition-colors cursor-pointer shrink-0"
        >
          Modifier profil
        </button>
      </div>

      {notice && (
        <div
          className={`flex items-center gap-2.5 p-4 rounded-2xl text-xs font-medium ${
            notice.tone === 'ok'
              ? 'bg-[#10D98E]/10 text-[#10D98E]'
              : 'bg-rose-500/10 text-rose-300'
          }`}
        >
          {notice.tone === 'ok' ? (
            <Check className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* 1. Carte Crédits lumineuse façon Stripe */}
      <section className="stripe-glow-card rounded-[28px] p-6 space-y-6">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-medium text-white/75">Crédits disponibles</span>
          <span className="text-4xl font-bold text-white tabular-nums leading-none">
            {Number(credits.balance || 0).toFixed(2).replace(/\.00$/, '')}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {CHARIOW_CREDIT_PACKS.map((pack) => (
            <button
              key={pack.productId}
              type="button"
              onClick={() => setSelectedPackId(pack.productId)}
              className={`py-3 px-2 rounded-2xl text-center transition-colors cursor-pointer border ${
                selectedPackId === pack.productId
                  ? 'bg-white text-black border-white font-semibold'
                  : 'bg-black/35 text-white border-white/[0.1] hover:bg-black/55'
              }`}
            >
              <span className="block text-sm font-bold tabular-nums">
                +{pack.credits} cr.
              </span>
              <span
                className={`block text-[11px] mt-0.5 tabular-nums ${
                  selectedPackId === pack.productId ? 'text-black/70' : 'text-white/60'
                }`}
              >
                {pack.priceCfa.toLocaleString('fr-FR')} F
              </span>
            </button>
          ))}
        </div>

        {(() => {
          const activePack = CHARIOW_CREDIT_PACKS.find((p) => p.productId === selectedPackId) || CHARIOW_CREDIT_PACKS[0];
          return (
            <button
              type="button"
              disabled={busy === 'checkout'}
              onClick={() => handleRechargeCredits(activePack.productId)}
              className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              {busy === 'checkout' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <span>
                  Recharger +{activePack.credits} crédits ({activePack.priceCfa.toLocaleString('fr-FR')} F CFA)
                </span>
              )}
            </button>
          );
        })()}
      </section>

      {/* 2. Abonnement Pass Créateur */}
      <section className="rounded-3xl bg-[#0D0F14] p-6 space-y-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-base font-semibold text-white">Pass Créateur</p>
            <p className="text-xs text-[#8A90A0] mt-0.5">
              4 900 F CFA / mois · Échéance {fmtDate(subscription.expiresAt)}
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-[11px] font-semibold shrink-0 ${
              !isExpired && subscription.status === 'active'
                ? 'bg-[#10D98E]/15 text-[#10D98E]'
                : 'bg-rose-500/15 text-rose-300'
            }`}
          >
            {!isExpired && subscription.status === 'active' ? 'Actif' : 'Expiré'}
          </span>
        </div>

        {isExpired && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 text-xs text-rose-200 flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Votre Pass a expiré. Réactivez-le pour continuer.</span>
          </div>
        )}

        {isExpiringSoon && (
          <div className="p-3.5 rounded-2xl bg-[#E2BD6B]/10 text-xs text-[#E2BD6B] flex items-center gap-2.5">
            <CalendarClock className="w-4 h-4 shrink-0" />
            <span>Expire dans {daysRemaining} jour{daysRemaining > 1 ? 's' : ''}.</span>
          </div>
        )}

        <button
          type="button"
          disabled={busy === 'checkout'}
          onClick={handleChariowSubscribe}
          className="w-full py-3.5 rounded-2xl bg-white/[0.07] hover:bg-white/[0.12] text-sm font-semibold text-white transition-colors cursor-pointer"
        >
          {isExpired ? 'Réactiver mon Pass (4 900 F CFA)' : 'Renouveler via Chariow'}
        </button>
      </section>

      {/* 3. Compte & Déconnexion */}
      <section className="rounded-3xl bg-[#0D0F14] p-5 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {currentName || 'Créateur Velaris'}
          </p>
          <p className="text-xs text-[#8A90A0] truncate mt-0.5">
            {user?.email || 'Membre Studio'}
          </p>
        </div>

        <button
          type="button"
          onClick={async () => {
            setBusy('signout');
            await signOut();
            setBusy(null);
            onSignedOut?.();
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium text-[#8A90A0] hover:text-rose-400 hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Déconnexion</span>
        </button>
      </section>

      {/* Modale Paramètres Studio */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0D0F14] border border-white/[0.08] rounded-3xl p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">Paramètres du compte</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                aria-label="Fermer"
                className="w-8 h-8 rounded-full flex items-center justify-center text-[#8A90A0] hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={saveStudioSettings} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="prof-name" className="block text-xs text-[#8A90A0]">
                  Nom du studio
                </label>
                <input
                  id="prof-name"
                  type="text"
                  value={studioName}
                  onChange={(e) => setStudioName(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prof-slug" className="block text-xs text-[#8A90A0]">
                  Identifiant URL (/s/...)
                </label>
                <input
                  id="prof-slug"
                  type="text"
                  value={studioSlug}
                  onChange={(e) => setStudioSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prof-price" className="block text-xs text-[#8A90A0]">
                  Tarif par chanson
                </label>
                <select
                  id="prof-price"
                  value={studioPrice}
                  onChange={(e) => setStudioPrice(Number(e.target.value))}
                  className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
                >
                  <option value={1500}>1 500 F CFA</option>
                  <option value={2000}>2 000 F CFA</option>
                  <option value={3000}>3 000 F CFA</option>
                  <option value={5000}>5 000 F CFA</option>
                  <option value={10000}>10 000 F CFA</option>
                  <option value={15000}>15 000 F CFA</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="prof-bio" className="block text-xs text-[#8A90A0]">
                  Biographie courte
                </label>
                <textarea
                  id="prof-bio"
                  rows={2}
                  value={studioBio}
                  onChange={(e) => setStudioBio(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white resize-none focus:outline-none focus:border-[#E2BD6B]"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-3.5 rounded-2xl bg-white text-black text-sm font-semibold hover:bg-white/90 transition-colors cursor-pointer"
              >
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
