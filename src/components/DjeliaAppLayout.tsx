import { useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import {
  GraduationCap,
  Music2,
  Smartphone,
  UserRound,
  ArrowLeft,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics } from '../types';
import { StudioProfileView } from './StudioProfileView';
import { SimpleWhatsAppView } from './SimpleWhatsAppView';
import { PlanGate } from './PlanGate';
import { getStudioCredits, getStudioSubscription, subscribeToBilling } from '../services/billing';
import { initiateChariowCheckout } from '../services/chariow';

export type StudioTab =
  | 'academy'
  | 'studio_ai'
  | 'whatsapp'
  | 'profile'
  | 'conversations'
  | 'automations'
  | 'lines'
  | 'playground'
  | 'revenus'
  | 'ventes'
  | 'analyste'
  | 'pipeline'
  | 'affiliation'
  | 'admin';

interface DjeliaAppLayoutProps {
  initialTab?: StudioTab;
  onTabChange?: (tab: StudioTab) => void;
  orders: Order[];
  metrics?: StudioMetrics;
  onReturnToHome: () => void;
  renderStudioAI: () => ReactNode;
  renderAcademy: () => ReactNode;
  onSelectOrderForStudio: (orderId: string) => void;
  onOpenQrModal?: () => void;
  onOpenNewOrderModal?: () => void;
}

export const DjeliaAppLayout: FC<DjeliaAppLayoutProps> = ({
  initialTab = 'academy',
  onTabChange,
  orders: _orders,
  metrics: _metrics,
  onReturnToHome,
  renderStudioAI,
  renderAcademy,
  onSelectOrderForStudio: _onSelectOrderForStudio,
}) => {
  const { user, signOut, openAuthModal } = useAuth();
  
  // Normalize tab to the 4 essential clean tabs
  const normalizeTab = (t: StudioTab): 'academy' | 'studio_ai' | 'whatsapp' | 'profile' => {
    if (t === 'academy') return 'academy';
    if (t === 'studio_ai') return 'studio_ai';
    if (['whatsapp', 'conversations', 'automations', 'lines', 'playground'].includes(t)) return 'whatsapp';
    if (t === 'profile') return 'profile';
    return 'academy';
  };

  const [currentTab, setCurrentTab] = useState<'academy' | 'studio_ai' | 'whatsapp' | 'profile'>(() =>
    normalizeTab(initialTab)
  );

  const [subscription, setSubscription] = useState(getStudioSubscription);
  const [credits, setCredits] = useState(getStudioCredits);

  useEffect(() => {
    return subscribeToBilling(() => {
      setSubscription(getStudioSubscription());
      setCredits(getStudioCredits());
    });
  }, []);

  const isPro = useMemo(() => {
    // 0. Mode Démo / Aperçu Développeur
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const hash = window.location.hash.toLowerCase();
      if (
        search.includes('preview=true') ||
        search.includes('demo=1') ||
        hash.includes('preview=true') ||
        hash.includes('demo=1')
      ) {
        return true;
      }
      try {
        if (
          sessionStorage.getItem('velaris_preview_mode') === 'true' ||
          localStorage.getItem('velaris_preview_mode') === 'true'
        ) {
          return true;
        }
      } catch {}
    }

    // 1. Si l'utilisateur est admin ou créateur (email ou téléphone)
    if (user?.email && (user.email.includes('admin') || user.email.includes('anicet') || user.email.includes('05777308'))) return true;
    const phone = String(user?.user_metadata?.phone || user?.phone || '');
    if (phone.includes('05777308') || phone.includes('56240533') || phone.includes('58357772')) return true;
    if (user?.user_metadata?.plan === 'pro' || user?.user_metadata?.subscription_status === 'ACTIVE') return true;

    // 2. Vérification d'abonnement actif Chariow
    const hasActiveDate = subscription.expiresAt
      ? new Date(subscription.expiresAt).getTime() > Date.now()
      : false;
    return subscription.status === 'active' && hasActiveDate;
  }, [subscription, user]);

  const handleTabClick = (tab: 'academy' | 'studio_ai' | 'whatsapp' | 'profile') => {
    setCurrentTab(tab);
    onTabChange?.(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpgradeToPro = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    const res = await initiateChariowCheckout({
      userId: user.id,
      email: user.email || '',
      fullName:
        (user.user_metadata?.studio_name as string) ||
        (user.user_metadata?.full_name as string) ||
        'Créateur Velaris',
      phone: (user.user_metadata?.phone as string) || '',
    });
    if (res.success && res.checkoutUrl) {
      window.location.assign(res.checkoutUrl);
    }
  };

  // Si l'utilisateur n'est pas abonné : Paywall minimaliste
  if (!isPro) {
    const isExpired =
      subscription.status === 'expired' ||
      Boolean(subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= Date.now());

    return (
      <div className="min-h-screen bg-[#020204] text-[#E2E4E9] flex flex-col selection:bg-[#D4AF37]/30 selection:text-white">
        {/* Header sobre */}
        <header className="h-20 border-b border-white/[0.06] bg-[#040507]/90 backdrop-blur-xl px-5 sm:px-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1E29] via-[#0D0F15] to-[#040507] border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.18)]">
              <svg className="w-5 h-5 text-[#E0C583]" viewBox="0 0 24 24" fill="none">
                <path d="M4 6L12 20L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.5 6L12 14L16.5 6" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-heading text-lg font-bold text-white tracking-wider">VELARIS</span>
              <span className="text-[9px] font-mono tracking-[0.28em] text-[#8E94A3] uppercase block">ACADEMY</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onReturnToHome}
              className="btn-titanium-gold text-xs px-4 py-2 rounded-xl cursor-pointer"
            >
              Retour à l'accueil
            </button>
            <button
              onClick={() => void signOut()}
              className="text-xs text-rose-400 hover:text-rose-300 px-3 py-2 cursor-pointer"
            >
              Déconnexion
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-8 flex items-center justify-center">
          <PlanGate
            isPro={false}
            featureDescription={
              isExpired
                ? 'Votre abonnement a expiré. Réactivez votre Pass Créateur (4 900 F CFA) pour débloquer immédiatement l’Académie, le Studio IA et vos automatisations WhatsApp.'
                : 'Activez votre Pass Créateur (4 900 F CFA / 30 jours) pour débloquer l’ensemble des outils et vos 30 crédits.'
            }
            onUpgrade={handleUpgradeToPro}
          >
            {null}
          </PlanGate>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020204] text-[#E2E4E9] flex flex-col selection:bg-[#D4AF37]/30 selection:text-white">
      {/* ===================================================================== */}
      {/* APEX DOCK ÉPURÉ HAUT-DE-GAMME (NAVIGATION MINIMALISTE SANS CHARGE)      */}
      {/* ===================================================================== */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#040507]/90 backdrop-blur-2xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-4">
          
          {/* Logo marque */}
          <div
            onClick={onReturnToHome}
            className="flex items-center gap-3 cursor-pointer select-none"
            title="Retour à la vitrine"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1A1E29] via-[#0D0F15] to-[#040507] border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.18)]">
              <svg className="w-5 h-5 text-[#E0C583]" viewBox="0 0 24 24" fill="none">
                <path d="M4 6L12 20L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.5 6L12 14L16.5 6" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-heading text-lg font-bold text-white tracking-wider block leading-none">
                VELARIS
              </span>
              <span className="text-[9px] font-mono tracking-[0.25em] text-[#8E94A3] uppercase block mt-1">
                STUDIO OS
              </span>
            </div>
          </div>

          {/* 4 Onglets Centraux Purs (Académie, Studio IA, WhatsApp, Compte) */}
          <nav className="hidden sm:flex items-center p-1 rounded-xl bg-[#08090D] border border-white/[0.08] text-xs font-medium text-[#C7CAD4]">
            <button
              type="button"
              onClick={() => handleTabClick('academy')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                currentTab === 'academy'
                  ? 'bg-white/[0.1] text-white font-bold shadow-sm'
                  : 'text-[#8E94A3] hover:text-white'
              }`}
            >
              <GraduationCap className="w-4 h-4 text-[#D4AF37]" />
              <span>1. Académie</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('studio_ai')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                currentTab === 'studio_ai'
                  ? 'bg-white/[0.1] text-white font-bold shadow-sm'
                  : 'text-[#8E94A3] hover:text-white'
              }`}
            >
              <Music2 className="w-4 h-4 text-[#D4AF37]" />
              <span>2. Studio IA</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('whatsapp')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                currentTab === 'whatsapp'
                  ? 'bg-white/[0.1] text-white font-bold shadow-sm'
                  : 'text-[#8E94A3] hover:text-white'
              }`}
            >
              <Smartphone className="w-4 h-4 text-[#00E599]" />
              <span>3. Mon WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => handleTabClick('profile')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-white/[0.1] text-white font-bold shadow-sm'
                  : 'text-[#8E94A3] hover:text-white'
              }`}
            >
              <UserRound className="w-4 h-4 text-[#C7CAD4]" />
              <span>4. Mon Compte</span>
            </button>
          </nav>

          {/* Contrôles droits : Crédits & Déconnexion */}
          <div className="flex items-center gap-3">
            {/* Pill Solde Crédits */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-mono font-bold text-[#E0C583]">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{credits.balance} crédits</span>
            </div>

            {/* Bouton retour Vitrine */}
            <button
              type="button"
              onClick={onReturnToHome}
              className="text-xs font-mono text-[#8E94A3] hover:text-white px-3 py-1.5 rounded-lg border border-white/[0.08] hover:bg-white/[0.04] transition cursor-pointer flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Vitrine</span>
            </button>

            {/* Déconnexion */}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                onReturnToHome();
              }}
              className="p-2 rounded-xl text-[#8E94A3] hover:text-rose-400 hover:bg-white/[0.04] transition cursor-pointer"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer / Tabs */}
        <div className="flex sm:hidden border-t border-white/[0.06] bg-[#040507] px-2 py-2 justify-between text-xs font-medium">
          <button
            type="button"
            onClick={() => handleTabClick('academy')}
            className={`flex-1 py-1.5 text-center rounded-lg ${currentTab === 'academy' ? 'bg-white/10 text-white font-bold' : 'text-[#8E94A3]'}`}
          >
            Académie
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('studio_ai')}
            className={`flex-1 py-1.5 text-center rounded-lg ${currentTab === 'studio_ai' ? 'bg-white/10 text-white font-bold' : 'text-[#8E94A3]'}`}
          >
            Studio IA
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('whatsapp')}
            className={`flex-1 py-1.5 text-center rounded-lg ${currentTab === 'whatsapp' ? 'bg-white/10 text-white font-bold' : 'text-[#8E94A3]'}`}
          >
            WhatsApp
          </button>
          <button
            type="button"
            onClick={() => handleTabClick('profile')}
            className={`flex-1 py-1.5 text-center rounded-lg ${currentTab === 'profile' ? 'bg-white/10 text-white font-bold' : 'text-[#8E94A3]'}`}
          >
            Compte
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* ZONE CENTRALE ÉPURÉE & IMMERSIVE (ZÉRO SURCHARGE, CONTENU NET)         */}
      {/* ===================================================================== */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {currentTab === 'academy' && renderAcademy()}
        {currentTab === 'studio_ai' && renderStudioAI()}
        {currentTab === 'whatsapp' && <SimpleWhatsAppView />}
        {currentTab === 'profile' && (
          <StudioProfileView
            onOpenWhatsApp={() => handleTabClick('whatsapp')}
            onSignedOut={onReturnToHome}
          />
        )}
      </main>

    </div>
  );
};
