import type { FC, ReactNode } from 'react';
import { Lock, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';

interface PlanGateProps {
  isPro: boolean;
  featureTitle: string;
  featureDescription: string;
  onUpgrade: () => void;
  children: ReactNode;
}

export const PlanGate: FC<PlanGateProps> = ({
  isPro,
  featureTitle,
  featureDescription,
  onUpgrade,
  children
}) => {
  if (isPro) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4 sm:p-6">
      <div className="max-w-md w-full rounded-2xl bg-[#141420] border border-white/[0.08] p-8 text-center space-y-6 shadow-2xl relative overflow-hidden">
        {/* Glow discret */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-24 bg-[#D4A017]/10 blur-3xl pointer-events-none" />

        <div className="h-16 w-16 mx-auto rounded-full bg-[#D4A017]/10 border border-[#D4A017]/30 flex items-center justify-center text-[#D4A017] shadow-[0_0_24px_-4px_rgba(212,160,23,0.3)]">
          <Lock className="h-7 w-7" strokeWidth={1.75} />
        </div>

        <div className="space-y-2 relative z-10">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono tracking-widest uppercase text-[#D4A017] px-3 py-1 rounded-full bg-[#D4A017]/10 border border-[#D4A017]/20">
            <ShieldCheck className="h-3 w-3" />
            Plan Djelia Pro Requis
          </span>
          <h2 className="text-xl font-heading font-bold text-white pt-2">{featureTitle}</h2>
          <p className="text-sm text-[#8E94A3] leading-relaxed">
            {featureDescription}
          </p>
        </div>

        <div className="rounded-xl bg-[#0A0A0F] border border-white/[0.06] p-4 text-left space-y-2.5 text-xs text-[#8E94A3] relative z-10">
          <div className="flex items-center gap-2 text-white font-medium">
            <Sparkles className="h-4 w-4 text-[#D4A017]" />
            <span>Débloqué avec Djelia Pro (10 000 F CFA / mois) :</span>
          </div>
          <div className="space-y-1.5 pl-6">
            <p>• Votre ligne WhatsApp connectée 24/7 par QR code</p>
            <p>• Concierge IA & réponses instantanées aux prospects</p>
            <p>• Générateur de musique IA Suno & livraison automatique</p>
            <p>• Pipeline CRM & analyste financier Copilot IA</p>
          </div>
        </div>

        <button
          onClick={onUpgrade}
          className="relative z-10 w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-[#D4A017] hover:bg-[#F5D060] text-[#0A0A0F] font-semibold text-sm transition-all duration-200 cursor-pointer shadow-[0_0_24px_-4px_rgba(212,160,23,0.45)] hover:shadow-[0_0_32px_-4px_rgba(212,160,23,0.65)] active:scale-[0.98]"
        >
          <span>Passer à Djelia Pro (10 000 F / mois)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};
