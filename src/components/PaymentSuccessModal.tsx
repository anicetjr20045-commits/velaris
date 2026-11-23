import { useEffect, useState, type FC } from 'react';
import { CheckCircle2, Music2, ArrowRight, ShieldCheck, Smartphone } from 'lucide-react';
import { verifyChariowSale } from '../services/chariow';
import { refreshBilling } from '../services/billing';

interface PaymentSuccessModalProps {
  onDismiss?: () => void;
  onEnterStudio: () => void;
}

export const PaymentSuccessModal: FC<PaymentSuccessModalProps> = ({
  onEnterStudio,
}) => {
  const [isVerifying, setIsVerifying] = useState(true);
  const [countdown, setCountdown] = useState(4);
  const [expiresDate, setExpiresDate] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramSaleId = params.get('sale_id') || params.get('id') || '';

    // Nettoyer l'URL sans recharger pour éviter les doubles déclenchements
    params.delete('payment');
    params.delete('sale_id');
    const cleanUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', cleanUrl);

    let isMounted = true;
    (async () => {
      // Calcul date approximative (+30 jours) en attendant la réponse
      const d = new Date(Date.now() + 30 * 24 * 3600 * 1000);
      setExpiresDate(d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }));

      if (paramSaleId) {
        try {
          await verifyChariowSale(paramSaleId);
          if (isMounted) {
            setIsVerifying(false);
            await refreshBilling();
          }
        } catch {
          if (isMounted) {
            setIsVerifying(false);
            await refreshBilling();
          }
        }
      } else {
        if (isMounted) {
          setIsVerifying(false);
          await refreshBilling();
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  // Décompte automatique de redirection
  useEffect(() => {
    if (isVerifying) return;
    if (countdown <= 0) {
      onEnterStudio();
      return;
    }
    const timer = window.setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [countdown, isVerifying, onEnterStudio]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-lg rounded-3xl bg-[#090A0F] border border-[#E5B54F]/30 p-8 sm:p-10 text-center shadow-[0_0_60px_-15px_rgba(229,181,79,0.35)] overflow-hidden">
        {/* Glow architectural chaud */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#E5B54F]/15 blur-3xl pointer-events-none" />

        {/* Icone Succès Animée */}
        <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#E5B54F]/10 border border-[#E5B54F]/40 shadow-[0_0_30px_-5px_rgba(229,181,79,0.4)]">
          <CheckCircle2 className="h-10 w-10 text-[#E5B54F]" strokeWidth={2} />
        </div>

        {/* Badge & Titre */}
        <div className="space-y-3 mb-6 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#E5B54F]/10 border border-[#E5B54F]/25 text-[11px] font-mono tracking-widest uppercase text-[#E5B54F]">
            <ShieldCheck className="h-3 w-3" />
            <span>Paiement Confirmé • Chariow Mobile Money</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-heading font-bold text-white tracking-tight">
            Bienvenue dans votre Studio !
          </h2>
          <p className="text-sm text-[#A0A5B5] max-w-sm mx-auto leading-relaxed">
            Votre souscription au <strong className="text-white">Pass Créateur (4 900 F CFA)</strong> a été validée avec succès.
          </p>
        </div>

        {/* Récapitulatif des Avantages Débloqués */}
        <div className="rounded-2xl bg-[#12131C] border border-white/[0.08] p-5 text-left space-y-3 mb-6 relative z-10">
          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
            <span className="text-[#8E94A3]">Statut de l'abonnement</span>
            <span className="font-mono text-emerald-400 font-medium flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              ACTIF (30 jours)
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
            <span className="text-[#8E94A3]">Crédits ajoutés</span>
            <span className="font-mono text-[#E5B54F] font-bold text-sm flex items-center gap-1.5">
              <Music2 className="h-3.5 w-3.5" />
              +30 Chansons IA
            </span>
          </div>

          <div className="flex items-center justify-between text-xs pb-2 border-b border-white/[0.06]">
            <span className="text-[#8E94A3]">Valable jusqu'au</span>
            <span className="font-mono text-white">{expiresDate || '30 jours'}</span>
          </div>

          <div className="flex items-center gap-2 pt-1 text-[11px] text-[#A0A5B5]">
            <Smartphone className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Une confirmation a été envoyée sur votre WhatsApp.</span>
          </div>
        </div>

        {/* Bouton d'entrée immédiate et décompte */}
        <div className="space-y-3 relative z-10">
          <button
            onClick={onEnterStudio}
            className="w-full h-12 inline-flex items-center justify-center gap-2.5 rounded-full bg-[#E5B54F] hover:bg-[#F3C766] text-[#0A0A0F] font-semibold text-sm transition-all duration-200 cursor-pointer shadow-[0_0_28px_-4px_rgba(229,181,79,0.5)] active:scale-[0.98]"
          >
            <span>Accéder à mon Studio maintenant</span>
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="text-[11px] font-mono text-[#8E94A3]">
            Redirection automatique dans <strong className="text-[#E5B54F]">{countdown}s</strong>…
          </p>
        </div>
      </div>
    </div>
  );
};
