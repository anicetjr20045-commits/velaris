import { useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import {
  GraduationCap,
  Music2,
  Smartphone,
  UserCircle,
  Globe,
  LogOut,
  Menu,
  X,
  Sparkles,
  ShieldCheck,
  ChevronRight,
  ArrowRight
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Normalisation des onglets vers les 4 piliers fondamentaux
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
    setMobileMenuOpen(false);
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

  const userDisplayName =
    (user?.user_metadata?.studio_name as string) ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split('@')[0] : 'Membre Studio');

  const userInitials = (userDisplayName.slice(0, 2) || 'VS').toUpperCase();

  // Menu Navigation Groups (Architecture Velarisse Haute-Horlogerie)
  const navGroups = [
    {
      title: 'PILOTAGE DU STUDIO',
      items: [
        {
          id: 'academy' as const,
          label: 'Académie & Cursus',
          sublabel: 'Méthode & Vidéos Pas-à-Pas',
          icon: GraduationCap,
          badge: '4 Modules',
          badgeColor: 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#E0C583]',
        },
        {
          id: 'studio_ai' as const,
          label: 'Studio IA de Musique',
          sublabel: 'Paroles & Générateur Suno',
          icon: Music2,
          badge: 'Suno V6',
          badgeColor: 'border-white/10 bg-white/5 text-[#C7CAD4]',
        },
        {
          id: 'whatsapp' as const,
          label: 'Mon WhatsApp & Pilote',
          sublabel: 'Connexion QR & Automatisations',
          icon: Smartphone,
          badge: 'Actif 24/7',
          badgeColor: 'border-[#00E599]/30 bg-[#00E599]/10 text-[#00E599]',
        },
      ],
    },
    {
      title: 'ESPACE MEMBRE & GESTION',
      items: [
        {
          id: 'profile' as const,
          label: 'Mon Compte & Abonnement',
          sublabel: 'Pass Créateur & Solde',
          icon: UserCircle,
          badge: `${credits.balance} crédits`,
          badgeColor: 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-[#E0C583]',
        },
      ],
    },
  ];

  // Si l'utilisateur n'est pas abonné : Paywall minimaliste
  if (!isPro) {
    const isExpired =
      subscription.status === 'expired' ||
      Boolean(subscription.expiresAt && new Date(subscription.expiresAt).getTime() <= Date.now());

    return (
      <div className="min-h-screen bg-[#020204] text-[#E2E4E9] flex flex-col selection:bg-[#D4AF37]/30 selection:text-white">
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

  // Sidebar Menu Content (commun Desktop et Mobile Drawer)
  const sidebarContent = (
    <div className="h-full flex flex-col justify-between p-5 space-y-6">
      <div className="space-y-6">
        {/* En-tête Marque */}
        <div className="flex items-center justify-between pb-5 border-b border-white/[0.08]">
          <div
            onClick={onReturnToHome}
            className="flex items-center gap-3 cursor-pointer select-none"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#1A1E29] via-[#0D0F15] to-[#040507] border border-[#D4AF37]/50 flex items-center justify-center shadow-[0_0_15px_rgba(212,175,55,0.25)]">
              <svg className="w-5 h-5 text-[#E0C583]" viewBox="0 0 24 24" fill="none">
                <path d="M4 6L12 20L20 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7.5 6L12 14L16.5 6" stroke="#FFFFFF" strokeOpacity="0.7" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div>
              <span className="font-heading text-xl font-extrabold text-white tracking-wider block leading-none">
                VELARIS
              </span>
              <span className="text-[10px] font-mono tracking-[0.25em] text-[#D4AF37] uppercase block mt-1 font-semibold">
                STUDIO OS
              </span>
            </div>
          </div>

          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden p-2 rounded-lg text-[#8E94A3] hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Groupes de navigation */}
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <div className="px-3 text-[10px] font-mono uppercase tracking-[0.18em] text-[#8E94A3] font-semibold">
                {group.title}
              </div>

              <div className="space-y-1.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentTab === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleTabClick(item.id)}
                      className={`w-full group relative flex items-center justify-between px-3.5 py-3 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer border ${
                        isActive
                          ? 'border-[#D4AF37]/40 bg-[#D4AF37]/10 text-white font-semibold shadow-[0_4px_20px_rgba(212,175,55,0.12)] before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-[#D4AF37]'
                          : 'border-transparent text-[#C7CAD4] hover:bg-white/[0.04] hover:text-white hover:border-white/[0.06]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-[#D4AF37]' : 'text-[#8E94A3] group-hover:text-white'}`} />
                        <div className="truncate text-left">
                          <span className="block truncate font-medium">{item.label}</span>
                        </div>
                      </div>

                      {item.badge && (
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border shrink-0 ${item.badgeColor}`}>
                          {item.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Lien retour Vitrine dans le menu */}
          <div className="pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={onReturnToHome}
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs text-[#8E94A3] hover:text-white hover:bg-white/[0.04] transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4" />
                <span>Voir le site public</span>
              </div>
              <ArrowRight className="w-3.5 h-3.5 opacity-60" />
            </button>
          </div>
        </nav>
      </div>

      {/* Profil Utilisateur & Déconnexion en bas du menu */}
      <div className="pt-4 border-t border-white/[0.08]">
        <div className="p-3.5 rounded-2xl bg-[#08090D] border border-white/[0.08] flex items-center justify-between gap-3 shadow-inner">
          <div
            onClick={() => handleTabClick('profile')}
            className="flex items-center gap-3 min-w-0 cursor-pointer text-left"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#D4AF37]/20 to-[#E0C583]/5 border border-[#D4AF37]/40 flex items-center justify-center text-xs font-bold text-[#E0C583] shrink-0 font-mono">
              {userInitials}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate">
                {userDisplayName}
              </div>
              <div className="text-[10px] font-mono text-[#00E599] flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>Pass Créateur Actif</span>
              </div>
            </div>
          </div>

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
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020204] text-[#E2E4E9] flex selection:bg-[#D4AF37]/30 selection:text-white">
      
      {/* ===================================================================== */}
      {/* 1. LE VRAI MENU : SIDEBAR GAUCHE DESKTOP (FIXE & STRUCTURÉE)           */}
      {/* ===================================================================== */}
      <aside className="hidden md:flex w-72 shrink-0 flex-col fixed inset-y-0 left-0 z-40 bg-[#040507]/95 border-r border-white/[0.08] backdrop-blur-2xl">
        {sidebarContent}
      </aside>

      {/* ===================================================================== */}
      {/* 2. LE VRAI MENU : DRAWER MOBILE SLIDE-OUT (AVEC HAMBURGER ET OVERLAY)  */}
      {/* ===================================================================== */}
      <div
        className={`fixed inset-0 z-50 md:hidden transition-all duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Backdrop sombre */}
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Tiroir coulissant */}
        <div
          className={`absolute inset-y-0 left-0 w-80 max-w-[85vw] bg-[#040507] border-r border-white/[0.1] shadow-2xl transition-transform duration-300 ease-luxury ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 3. COLONNE PRINCIPALE DE L'APPLICATION (AVEC HEADER ET CONTENU)       */}
      {/* ===================================================================== */}
      <div className="flex-1 md:pl-72 flex flex-col min-w-0">
        
        {/* Header supérieur avec Fil d'Ariane & Bouton Menu Mobile */}
        <header className="sticky top-0 z-30 h-16 border-b border-white/[0.08] bg-[#040507]/80 backdrop-blur-2xl px-4 sm:px-8 flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            {/* Bouton Hamburger Vrai Menu Mobile */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-white hover:bg-white/[0.08] transition cursor-pointer"
              aria-label="Ouvrir le menu"
            >
              <Menu className="w-5 h-5 text-[#E0C583]" />
            </button>

            {/* Fil d'Ariane épuré */}
            <div className="flex items-center gap-2 text-xs sm:text-sm font-medium">
              <span className="text-[#8E94A3] font-mono">Velaris Studio</span>
              <ChevronRight className="w-3.5 h-3.5 text-neutral-600" />
              <span className="text-white font-bold capitalize">
                {currentTab === 'academy' && 'Académie & Cursus'}
                {currentTab === 'studio_ai' && 'Studio IA de Musique'}
                {currentTab === 'whatsapp' && 'Mon WhatsApp & Pilote'}
                {currentTab === 'profile' && 'Mon Compte & Pass'}
              </span>
            </div>
          </div>

          {/* Badges d'état droits */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-mono font-bold text-[#E0C583]">
              <Sparkles className="w-3.5 h-3.5 text-[#D4AF37]" />
              <span>{credits.balance} crédits</span>
            </div>

            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono px-3 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-[#00E599]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00E599] animate-pulse" />
              Serveur Live 24/7
            </span>
          </div>

        </header>

        {/* Zone centrale de travail */}
        <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-8 lg:p-10">
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

    </div>
  );
};
