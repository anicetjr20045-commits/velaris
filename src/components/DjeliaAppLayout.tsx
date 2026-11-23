import { useEffect, useMemo, useState, type FC, type ReactNode } from 'react';
import {
  GraduationCap,
  Smartphone,
  TrendingUp,
  Share2,
  Lock,
  MessagesSquare,
  Music2,
  Zap,
  LayoutGrid,
  Wallet,
  Sparkles,
  UserRound,
  Crown,
  LogOut,
  LogIn,
  ShieldCheck,
  Menu,
  X,
  ArrowLeft,
  Search,
  Plus,
  QrCode,
  Home
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics, ConversationItem } from '../types';
import { CockpitView } from './CockpitView';
import { ConversationsView } from './ConversationsView';
import { AutomationsView } from './AutomationsView';
import { WhatsAppLinesView } from './WhatsAppLinesView';
import { VentesCaisseView } from './VentesCaisseView';
import { StudioCopilotView } from './StudioCopilotView';
import { AdminConsoleView } from './AdminConsoleView';
import { StudioProfileView } from './StudioProfileView';
import { PlaygroundView } from './PlaygroundView';
import { AffiliationView } from './AffiliationView';
import { PlanGate } from './PlanGate';
import { CommandPalette, isMacPlatform, type PaletteCommand } from './CommandPalette';
import { getLiveConversations } from '../services/supabase';
import { useStudioLive } from '../hooks/useStudioLive';
import { applyReadState, useReadState } from '../services/readState';
import { getStudioSubscription, subscribeToBilling } from '../services/billing';
import { createSubscriptionCheckout } from '../services/saspay';

const EMPTY_STUDIO_METRICS: StudioMetrics = {
  totalRevenue: 0,
  ordersDelivered: 0,
  ordersActive: 0,
  adLeadsCount: 0,
  conversionRate: 0,
  currency: 'FCFA',
};
const EMPTY_CONVERSATIONS: ConversationItem[] = [];

export type DjeliaPillar = 'academy' | 'whatsapp' | 'ventes' | 'affiliation';

export type StudioTab =
  | 'academy'
  // Pilier WhatsApp
  | 'conversations'
  | 'studio_ai'
  | 'automations'
  | 'lines'
  | 'whatsapp'
  | 'playground'
  // Pilier Ventes
  | 'revenus'
  | 'ventes'
  | 'analyste'
  | 'pipeline'
  // Pilier Affiliation
  | 'affiliation'
  // Compte / Admin
  | 'profile'
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
  orders,
  metrics,
  onReturnToHome,
  renderStudioAI,
  renderAcademy,
  onSelectOrderForStudio,
  onOpenQrModal,
  onOpenNewOrderModal
}) => {
  const { user, signOut, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<StudioTab>(initialTab);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  // État de l'abonnement en direct (détection Plan Start vs Pro)
  const [subscription, setSubscription] = useState(getStudioSubscription);
  useEffect(() => {
    return subscribeToBilling(() => {
      setSubscription(getStudioSubscription());
    });
  }, []);

  const isPro = useMemo(() => {
    // Si l'utilisateur est admin ou a un abonnement Pro actif
    if (user?.email && (user.email.includes('admin') || user.email.includes('anicet'))) return true;
    if (user?.user_metadata?.plan === 'pro') return true;
    return subscription.status === 'active' && (subscription.planId === 'pro' || subscription.planId === 'quarterly');
  }, [subscription, user]);

  // Synchronisation avec l'onglet initial si transmis par le parent
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (prevInitialTab !== initialTab) {
    setPrevInitialTab(initialTab);
    setCurrentTab(initialTab);
  }

  const userDisplayName = (user?.user_metadata?.studio_name as string) ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split('@')[0] : 'Membre Invité');
  const userInitials = (userDisplayName.slice(0, 2) || 'DJ').toUpperCase();

  // Conversations non lues
  const { data: rawConversations } = useStudioLive(
    getLiveConversations,
    EMPTY_CONVERSATIONS,
    ['conversations', 'messages'],
    [user?.id]
  );
  const readState = useReadState();
  const liveConversations = useMemo(
    () => applyReadState(rawConversations, readState.readOverrides, readState.archiveOverrides),
    [rawConversations, readState]
  );
  const unreadCount = liveConversations.filter((c) => !c.isArchived && c.unread).length;
  const pendingLyricsCount = orders.filter((o) => o.status === 'brief_recu').length;

  // Détermination du pilier actif
  const currentPillar: DjeliaPillar = useMemo(() => {
    if (['conversations', 'studio_ai', 'automations', 'lines', 'playground'].includes(currentTab)) {
      return 'whatsapp';
    }
    if (['revenus', 'ventes', 'analyste'].includes(currentTab)) {
      return 'ventes';
    }
    if (currentTab === 'affiliation') {
      return 'affiliation';
    }
    return 'academy';
  }, [currentTab]);

  const handleTabClick = (tab: StudioTab) => {
    setCurrentTab(tab);
    setIsMobileDrawerOpen(false);
    onTabChange?.(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePillarClick = (pillar: DjeliaPillar) => {
    if (pillar === 'academy') handleTabClick('academy');
    else if (pillar === 'whatsapp') handleTabClick('conversations');
    else if (pillar === 'ventes') handleTabClick('revenus');
    else if (pillar === 'affiliation') handleTabClick('affiliation');
  };

  const handleUpgradeToPro = async () => {
    if (!user) {
      openAuthModal('login');
      return;
    }
    setIsUpgrading(true);
    setUpgradeError(null);
    try {
      const res = await createSubscriptionCheckout('pro');
      if (res.success && res.checkoutUrl) {
        window.location.href = res.checkoutUrl;
      } else {
        setUpgradeError(res.error || 'Erreur lors de l\'initialisation du paiement');
      }
    } catch (err: any) {
      setUpgradeError(err?.message || 'Erreur inconnue');
    } finally {
      setIsUpgrading(false);
    }
  };

  const openOrderInStudio = (orderId: string) => {
    onSelectOrderForStudio(orderId);
    handleTabClick('studio_ai');
  };

  // 4 Piliers Fondamentaux
  const pillarsConfig: {
    id: DjeliaPillar;
    num: string;
    label: string;
    sublabel: string;
    icon: typeof GraduationCap;
    requiresPro: boolean;
    defaultTab: StudioTab;
    subTabs?: { id: StudioTab; label: string; icon: typeof LayoutGrid; count?: number }[];
  }[] = [
    {
      id: 'academy',
      num: '01',
      label: 'Académie',
      sublabel: 'Méthode & Formations',
      icon: GraduationCap,
      requiresPro: false,
      defaultTab: 'academy'
    },
    {
      id: 'whatsapp',
      num: '02',
      label: 'Mon WhatsApp',
      sublabel: 'Studio IA & Discussions',
      icon: Smartphone,
      requiresPro: true,
      defaultTab: 'conversations',
      subTabs: [
        { id: 'conversations', label: 'Discussions WhatsApp', icon: MessagesSquare, count: unreadCount },
        { id: 'studio_ai', label: 'Textes & Studio Musique', icon: Music2, count: pendingLyricsCount },
        { id: 'automations', label: 'Automatisations émojis', icon: Zap },
        { id: 'lines', label: 'Connexion Ligne WAHA', icon: QrCode },
        { id: 'playground', label: 'Playground WhatsApp', icon: Sparkles },
      ]
    },
    {
      id: 'ventes',
      num: '03',
      label: 'Mes Ventes',
      sublabel: 'Dashboard & Pipeline',
      icon: TrendingUp,
      requiresPro: true,
      defaultTab: 'revenus',
      subTabs: [
        { id: 'revenus', label: 'Chiffre d\'Affaires', icon: LayoutGrid },
        { id: 'ventes', label: 'Ventes & Caisse', icon: Wallet },
        { id: 'analyste', label: 'Analyste Copilot IA', icon: Sparkles },
      ]
    },
    {
      id: 'affiliation',
      num: '04',
      label: 'Mon Affiliation',
      sublabel: 'Commissions 25%',
      icon: Share2,
      requiresPro: false,
      defaultTab: 'affiliation'
    }
  ];

  // Palette Cmd+K
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      { id: 'tab-academy', label: '01 Académie Studio', group: 'Piliers', icon: GraduationCap, run: () => handleTabClick('academy') },
      { id: 'tab-conversations', label: '02 Discussions WhatsApp', group: 'WhatsApp', icon: MessagesSquare, run: () => handleTabClick('conversations') },
      { id: 'tab-studio_ai', label: 'Textes & Musique Suno', group: 'WhatsApp', icon: Music2, run: () => handleTabClick('studio_ai') },
      { id: 'tab-revenus', label: '03 Chiffre d\'affaires', group: 'Ventes', icon: LayoutGrid, run: () => handleTabClick('revenus') },
      { id: 'tab-affiliation', label: '04 Mon Espace Affiliation', group: 'Piliers', icon: Share2, run: () => handleTabClick('affiliation') },
      { id: 'tab-profile', label: 'Mon Profil Studio', group: 'Compte', icon: UserRound, run: () => handleTabClick('profile') },
    ];
    if (onOpenNewOrderModal) {
      list.push({ id: 'new-order', label: 'Nouvelle commande', group: 'Actions', icon: Plus, run: onOpenNewOrderModal });
    }
    if (onOpenQrModal) {
      list.push({ id: 'connect-wa', label: 'Connecter WhatsApp (QR)', group: 'Actions', icon: QrCode, run: onOpenQrModal });
    }
    list.push(
      user
        ? { id: 'sign-out', label: 'Se déconnecter', group: 'Compte', icon: LogOut, run: () => void signOut() }
        : { id: 'sign-in', label: 'Se connecter', group: 'Compte', icon: LogIn, run: () => openAuthModal('login') }
    );
    list.push({ id: 'home', label: 'Retour à la vitrine', group: 'Compte', icon: Home, run: onReturnToHome });
    return list;
  }, [user, onOpenNewOrderModal, onOpenQrModal, onReturnToHome]);

  const shortcutLabel = isMacPlatform() ? '⌘K' : 'Ctrl K';

  return (
    <div className="min-h-screen bg-[#0A0A0F] text-[#F0F0F5] flex flex-col md:flex-row relative selection:bg-[#D4A017]/30 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-[#12121A]/90 border-b border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="-ml-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-[#8E94A3] hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-[#D4A017] flex items-center justify-center text-[#0A0A0F] font-heading font-black text-xs">
              D
            </div>
            <span className="font-heading font-bold text-sm tracking-tight text-white">DJELIA ACADEMY</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-white/[0.1] text-[#D4A017] bg-[#D4A017]/10">
            {isPro ? 'PRO' : 'START'}
          </span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="h-9 w-9 inline-flex items-center justify-center rounded-xl text-[#8E94A3] hover:text-white hover:bg-white/[0.05]"
            aria-label="Rechercher"
          >
            <Search className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Drawer Overlay for Mobile */}
      <div
        onClick={() => setIsMobileDrawerOpen(false)}
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden transition-opacity duration-300 ${
          isMobileDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Left Sidebar */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 flex flex-col bg-[#12121A]/95 md:bg-[#12121A]/85 backdrop-blur-xl border-r border-white/[0.08] transition-transform duration-300 ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#D4A017]/10 border border-[#D4A017]/30 flex items-center justify-center text-[#D4A017] shrink-0 font-heading font-extrabold text-base shadow-[0_0_16px_-4px_rgba(212,160,23,0.3)]">
              D
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-base tracking-wide text-white">
                  DJELIA
                </span>
                <span className="text-[10px] font-semibold tracking-wider px-1.5 py-[1px] rounded bg-[#D4A017] text-[#0A0A0F]">
                  ACADEMY
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono tracking-wider text-emerald-400">
                  STUDIO ACTIF 24/7
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden -mr-2 h-9 w-9 inline-flex items-center justify-center rounded-xl text-neutral-400 hover:text-white"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bouton retour Vitrine */}
        <div className="px-3 pt-3">
          <button
            onClick={onReturnToHome}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-[#8E94A3] hover:text-white hover:bg-white/[0.04] border border-white/[0.06] transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5 text-neutral-500" />
              <span>Retour à la vitrine</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-600">Site</span>
          </button>
        </div>

        {/* Navigation Principale : Les 4 Piliers */}
        <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto no-scrollbar">
          <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#8E94A3]/60">
            Espace Membre
          </div>

          <div className="space-y-1.5">
            {pillarsConfig.map((pillar) => {
              const Icon = pillar.icon;
              const isPillarActive = currentPillar === pillar.id;
              const isLocked = pillar.requiresPro && !isPro;

              return (
                <div key={pillar.id} className="space-y-1">
                  <button
                    onClick={() => handlePillarClick(pillar.id)}
                    className={`w-full group relative flex items-center justify-between rounded-xl px-3 py-2.5 text-xs transition-all duration-200 text-left cursor-pointer border ${
                      isPillarActive
                        ? 'bg-[#D4A017]/10 border-[#D4A017]/40 text-white font-semibold shadow-[0_0_20px_-8px_rgba(212,160,23,0.35)]'
                        : 'bg-transparent border-transparent text-[#8E94A3] hover:bg-white/[0.03] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[10px] font-mono font-bold ${isPillarActive ? 'text-[#D4A017]' : 'text-neutral-600'}`}>
                        {pillar.num}
                      </span>
                      <Icon className={`h-4 w-4 shrink-0 ${isPillarActive ? 'text-[#D4A017]' : 'text-neutral-500 group-hover:text-neutral-300'}`} />
                      <div className="truncate">
                        <div className="truncate">{pillar.label}</div>
                      </div>
                    </div>

                    {isLocked ? (
                      <Lock className="h-3.5 w-3.5 text-[#D4A017]/80 shrink-0" />
                    ) : (
                      <span className="text-[10px] font-mono text-neutral-600 group-hover:text-neutral-400">
                        →
                      </span>
                    )}
                  </button>

                  {/* Sous-onglets actifs pour WhatsApp ou Ventes */}
                  {isPillarActive && pillar.subTabs && (
                    <div className="pl-7 pr-1 py-1 space-y-1">
                      {pillar.subTabs.map((sub) => {
                        const SubIcon = sub.icon;
                        const isSubActive = currentTab === sub.id;
                        return (
                          <button
                            key={sub.id}
                            onClick={() => handleTabClick(sub.id)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] transition-colors cursor-pointer ${
                              isSubActive
                                ? 'bg-white/[0.08] text-[#D4A017] font-medium'
                                : 'text-[#8E94A3] hover:text-white hover:bg-white/[0.03]'
                            }`}
                          >
                            <span className="flex items-center gap-2 truncate">
                              <SubIcon className="h-3 w-3" />
                              <span className="truncate">{sub.label}</span>
                            </span>
                            {!!sub.count && (
                              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#E11D48] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                                {sub.count}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Section Paramètres Studio */}
          <div className="pt-2 border-t border-white/[0.06] space-y-1">
            <div className="px-3 text-[10px] font-mono uppercase tracking-widest text-[#8E94A3]/60 mb-1">
              Configuration
            </div>
            <button
              onClick={() => handleTabClick('profile')}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                currentTab === 'profile'
                  ? 'bg-white/[0.08] text-white font-medium'
                  : 'text-[#8E94A3] hover:text-white hover:bg-white/[0.03]'
              }`}
            >
              <UserRound className="h-3.5 w-3.5" />
              <span>Mon profil studio</span>
            </button>

            {user?.email && (user.email.includes('admin') || user.email.includes('anicet')) && (
              <button
                onClick={() => handleTabClick('admin')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors cursor-pointer ${
                  currentTab === 'admin'
                    ? 'bg-white/[0.08] text-[#D4A017] font-medium'
                    : 'text-[#8E94A3] hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <Crown className="h-3.5 w-3.5 text-[#D4A017]" />
                <span>Console Admin</span>
              </button>
            )}
          </div>
        </nav>

        {/* Upgrade Banner pour membres Start */}
        {!isPro && (
          <div className="p-3 mx-3 mb-2 rounded-xl bg-gradient-to-b from-[#D4A017]/15 to-[#D4A017]/5 border border-[#D4A017]/25 text-center space-y-2">
            <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-white">
              <Sparkles className="h-3.5 w-3.5 text-[#D4A017]" />
              <span>Passer en Djelia Pro</span>
            </div>
            <p className="text-[11px] text-[#8E94A3] leading-tight">
              Débloquez WhatsApp, le Concierge IA et le Dashboard financier.
            </p>
            <button
              onClick={handleUpgradeToPro}
              disabled={isUpgrading}
              className="w-full py-1.5 px-3 rounded-full bg-[#D4A017] hover:bg-[#F5D060] text-[#0A0A0F] font-semibold text-xs transition-colors cursor-pointer shadow-[0_0_12px_rgba(212,160,23,0.3)]"
            >
              {isUpgrading ? 'Ouverture SasPay…' : '10 000 F / mois'}
            </button>
            {upgradeError && (
              <p className="text-[10px] text-red-400">{upgradeError}</p>
            )}
          </div>
        )}

        {/* Footer Profil Utilisateur */}
        <div className="p-3 border-t border-white/[0.08]">
          {user ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#141420] p-2.5 flex items-center justify-between gap-2">
              <button
                onClick={() => handleTabClick('profile')}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
              >
                <div className="h-8 w-8 rounded-full bg-[#D4A017]/15 border border-[#D4A017]/30 flex items-center justify-center text-xs font-bold text-[#D4A017] shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-white truncate">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate flex items-center gap-1 font-mono">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    <span>{isPro ? 'Plan Pro Actif' : 'Plan Start'}</span>
                  </div>
                </div>
              </button>

              <button
                onClick={async () => {
                  await signOut();
                  onReturnToHome();
                }}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
                title="Se déconnecter"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-[#141420] p-3 space-y-2 text-center">
              <span className="text-[10px] font-mono text-[#D4A017] block">Session Visiteur</span>
              <button
                onClick={() => openAuthModal('login')}
                className="w-full py-1.5 px-3 rounded-full bg-[#D4A017] text-[#0A0A0F] font-semibold text-xs cursor-pointer hover:bg-[#F5D060] transition-colors"
              >
                Se connecter
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Fil d'Ariane Desktop */}
        <div className="hidden md:flex sticky top-0 z-20 h-14 items-center justify-between px-8 border-b border-white/[0.08] bg-[#0A0A0F]/80 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-xs font-medium text-[#8E94A3]">
            <span className="text-[#D4A017] font-mono">Djelia Academy</span>
            <span>/</span>
            <span className="text-white capitalize">{currentTab.replace('_', ' ')}</span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaletteOpen(true)}
              className="inline-flex items-center gap-2 h-8 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 text-xs text-[#8E94A3] hover:text-white transition-colors cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" />
              <span>Aller à…</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] text-[#8E94A3]">{shortcutLabel}</kbd>
            </button>

            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono px-2.5 py-1 rounded-full border border-white/[0.08] bg-white/[0.02] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Serveur Live
            </span>
          </div>
        </div>

        {/* Vue Principale */}
        <main className="flex-1 min-w-0 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
          {/* PILIER 01 : ACADÉMIE */}
          {currentTab === 'academy' && renderAcademy()}

          {/* PILIER 02 : MON WHATSAPP (Gated par Plan Pro) */}
          {['conversations', 'studio_ai', 'automations', 'lines', 'playground'].includes(currentTab) && (
            <PlanGate
              isPro={isPro}
              featureTitle="WhatsApp Studio & Concierge IA"
              featureDescription="Connectez votre numéro de téléphone WhatsApp à WAHA, répondez automatiquement à vos prospects et fabriquez vos chansons en automatique."
              onUpgrade={handleUpgradeToPro}
            >
              {currentTab === 'conversations' && (
                <ConversationsView
                  onOpenOrderForStudio={(name) => {
                    const matched = orders.find(o => o.clientName.toLowerCase().includes(name.toLowerCase()));
                    if (matched) openOrderInStudio(matched.id);
                  }}
                />
              )}
              {currentTab === 'studio_ai' && renderStudioAI()}
              {currentTab === 'automations' && <AutomationsView />}
              {currentTab === 'lines' && <WhatsAppLinesView />}
              {currentTab === 'playground' && <PlaygroundView />}
            </PlanGate>
          )}

          {/* PILIER 03 : MES VENTES (Gated par Plan Pro) */}
          {['revenus', 'ventes', 'analyste'].includes(currentTab) && (
            <PlanGate
              isPro={isPro}
              featureTitle="Dashboard Chiffre d'Affaires & Pipeline"
              featureDescription="Suivez en direct vos encaissements Wave et Orange Money, gérez vos leads chauds et laissez l'analyste Copilot IA optimiser votre rentabilité."
              onUpgrade={handleUpgradeToPro}
            >
              {currentTab === 'revenus' && (
                <CockpitView
                  metrics={metrics ?? EMPTY_STUDIO_METRICS}
                  orders={orders}
                  onSelectOrderForStudio={openOrderInStudio}
                  onOpenQrModal={onOpenQrModal ?? (() => handleTabClick('lines'))}
                  onOpenNewOrderModal={onOpenNewOrderModal}
                  onOpenConversations={() => handleTabClick('conversations')}
                />
              )}
              {currentTab === 'ventes' && (
                <VentesCaisseView
                  orders={orders}
                  onSelectOrderForStudio={openOrderInStudio}
                />
              )}
              {currentTab === 'analyste' && (
                <StudioCopilotView
                  orders={orders}
                  metrics={metrics ?? EMPTY_STUDIO_METRICS}
                  onNavigateToStudio={() => handleTabClick('studio_ai')}
                  onOpenQrModal={onOpenQrModal ?? (() => handleTabClick('lines'))}
                />
              )}
            </PlanGate>
          )}

          {/* PILIER 04 : MON AFFILIATION (Accessible à tous) */}
          {currentTab === 'affiliation' && <AffiliationView />}

          {/* COMPTE & ADMIN */}
          {currentTab === 'profile' && (
            <StudioProfileView onOpenWhatsApp={() => handleTabClick('lines')} onSignedOut={onReturnToHome} />
          )}

          {currentTab === 'admin' && (
            <AdminConsoleView
              orders={orders}
              metrics={metrics ?? EMPTY_STUDIO_METRICS}
              conversations={liveConversations}
            />
          )}
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={paletteCommands} />
    </div>
  );
};
