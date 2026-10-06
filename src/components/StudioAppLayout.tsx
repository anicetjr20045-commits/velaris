import { useEffect, useMemo, useRef, useState, type FC, type ReactNode } from 'react';
import {
  LayoutGrid,
  Wallet,
  MessagesSquare,
  TrendingUp,
  Smartphone,
  Zap,
  Crown,
  Music2,
  GraduationCap,
  LogOut,
  LogIn,
  ShieldCheck,
  Menu,
  X,
  ArrowLeft,
  ChevronRight,
  UserRound,
  Search,
  Sparkles,
  Ellipsis,
  QrCode,
  Plus,
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
import { VelarisMark } from './VelarisMark';
import { AdminConsoleView } from './AdminConsoleView';
import { StudioProfileView } from './StudioProfileView';
import { PlaygroundView } from './PlaygroundView';
import { CommandPalette, isMacPlatform, type PaletteCommand } from './CommandPalette';
import { getLiveConversations } from '../services/supabase';
import { useStudioLive } from '../hooks/useStudioLive';
import { applyReadState, useReadState } from '../services/readState';

const EMPTY_STUDIO_METRICS: StudioMetrics = {
  totalRevenue: 0,
  ordersDelivered: 0,
  ordersActive: 0,
  adLeadsCount: 0,
  conversionRate: 0,
  currency: 'FCFA',
};
const EMPTY_CONVERSATIONS: ConversationItem[] = [];

export type StudioTab =
  | 'revenus'
  | 'ventes'
  | 'conversations'
  | 'playground'
  | 'pipeline'
  | 'analyste'
  | 'whatsapp'
  | 'automations'
  | 'profile'
  | 'admin'
  | 'studio_ai'
  | 'academy';

interface StudioAppLayoutProps {
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

/* Accès directs de la barre mobile ; « Plus » ouvre le tiroir complet */
const BOTTOM_TABS: { id: StudioTab; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'revenus', label: 'Cockpit', icon: LayoutGrid },
  { id: 'conversations', label: 'Discussions', icon: MessagesSquare },
  { id: 'studio_ai', label: 'Textes & Studio', icon: Music2 },
  { id: 'analyste', label: 'Copilot', icon: Sparkles }
];

export const StudioAppLayout: FC<StudioAppLayoutProps> = ({
  initialTab = 'revenus',
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
  const drawerTouchX = useRef<number | null>(null);

  // Resynchronise l'onglet quand le parent change de vue (ex. #studio après sélection de commande)
  const [prevInitialTab, setPrevInitialTab] = useState(initialTab);
  if (prevInitialTab !== initialTab) {
    setPrevInitialTab(initialTab);
    setCurrentTab(initialTab);
  }

  const userDisplayName = (user?.user_metadata?.studio_name as string) ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split('@')[0] : 'Studio Invité');
  const userInitials = (userDisplayName.slice(0, 2) || 'ST').toUpperCase();

  // Non-lus WhatsApp : Realtime Supabase + polling de secours
  const { data: rawConversations } = useStudioLive(
    getLiveConversations,
    EMPTY_CONVERSATIONS,
    ['conversations', 'messages'],
    [user?.id]
  );
  // Bascules lu / non-lu faites dans la boîte de réception
  const readState = useReadState();
  const liveConversations = useMemo(
    () => applyReadState(rawConversations, readState.readOverrides, readState.archiveOverrides),
    [rawConversations, readState]
  );
  const unreadCount = liveConversations.filter((c) => !c.isArchived && c.unread).length;
  const pendingLyricsCount = orders.filter((o) => o.status === 'brief_recu').length;

  const navGroups: {
    title: string;
    items: { id: StudioTab; label: string; icon: typeof LayoutGrid; count?: number }[];
  }[] = [
    {
      title: 'Mon business',
      items: [
        { id: 'revenus' as StudioTab, label: 'Mes revenus', icon: LayoutGrid },
        { id: 'ventes' as StudioTab, label: 'Ventes & Caisse', icon: Wallet },
        { id: 'conversations' as StudioTab, label: 'Discussions WhatsApp', icon: MessagesSquare, count: unreadCount },
        { id: 'playground' as StudioTab, label: 'Playground WhatsApp', icon: Sparkles },
        { id: 'analyste' as StudioTab, label: 'Analyste & Copilot IA', icon: TrendingUp },
      ]
    },
    {
      title: 'Création & Formation',
      items: [
        { id: 'studio_ai' as StudioTab, label: 'Textes & Atelier Studio', icon: Music2, count: pendingLyricsCount },
        { id: 'academy' as StudioTab, label: 'Académie Studio', icon: GraduationCap },
      ]
    },
    {
      title: 'Paramètres studio',
      items: [
        { id: 'whatsapp' as StudioTab, label: 'Lignes WhatsApp', icon: Smartphone },
        { id: 'automations' as StudioTab, label: 'Automatisations', icon: Zap },
        { id: 'profile' as StudioTab, label: 'Mon profil studio', icon: UserRound },
      ]
    },
    {
      title: 'Supervision',
      items: [
        { id: 'admin' as StudioTab, label: 'Console Admin', icon: Crown },
      ]
    }
  ];

  const activeGroup = navGroups.find((g) => g.items.some((i) => i.id === currentTab));
  const activeItem = activeGroup?.items.find((i) => i.id === currentTab);

  const handleTabClick = (tab: StudioTab) => {
    setCurrentTab(tab);
    setIsMobileDrawerOpen(false);
    onTabChange?.(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openOrderInStudio = (orderId: string) => {
    onSelectOrderForStudio(orderId);
    handleTabClick('studio_ai');
  };

  // Palette Cmd+K : tous les onglets + actions rapides
  const paletteCommands = useMemo<PaletteCommand[]>(() => {
    const go = navGroups.flatMap((g) =>
      g.items.map((item) => ({
        id: `tab-${item.id}`,
        label: item.label,
        group: 'Aller à',
        icon: item.icon,
        keywords: g.title,
        hint: item.count ? `${item.count} non lu${item.count > 1 ? 's' : ''}` : undefined,
        run: () => handleTabClick(item.id)
      }))
    );
    const actions: PaletteCommand[] = [];
    if (onOpenNewOrderModal) {
      actions.push({ id: 'new-order', label: 'Nouvelle commande', group: 'Actions', icon: Plus, keywords: 'créer brief client chanson', run: onOpenNewOrderModal });
    }
    actions.push({
      id: 'connect-wa',
      label: 'Connecter WhatsApp (QR code)',
      group: 'Actions',
      icon: QrCode,
      keywords: 'waha scanner ligne session',
      run: onOpenQrModal ?? (() => handleTabClick('whatsapp'))
    });
    actions.push(
      user
        ? { id: 'sign-out', label: 'Se déconnecter', group: 'Compte', icon: LogOut, keywords: 'logout quitter', run: () => void signOut() }
        : { id: 'sign-in', label: 'Se connecter à mon studio', group: 'Compte', icon: LogIn, keywords: 'login connexion compte', run: () => openAuthModal('login') }
    );
    actions.push({ id: 'home', label: 'Retour à la vitrine', group: 'Compte', icon: Home, keywords: 'accueil site public landing', run: onReturnToHome });
    return [...go, ...actions];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unreadCount, user, onOpenNewOrderModal, onOpenQrModal, onReturnToHome]);

  const isBottomTab = BOTTOM_TABS.some((t) => t.id === currentTab);
  const shortcutLabel = isMacPlatform() ? '⌘K' : 'Ctrl K';

  // Fermeture du tiroir mobile au clavier
  useEffect(() => {
    if (!isMobileDrawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMobileDrawerOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileDrawerOpen]);

  return (
    <div className="vx-halo min-h-screen bg-[#050608] text-[#E5E5E5] flex flex-col md:flex-row relative selection:bg-[#E5B54F]/30 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-[#0B0C10]/85 border-b border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="-ml-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 ease-press"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-2">
            <VelarisMark className="h-5 w-5 text-white" />
            <span className="font-heading font-bold text-sm tracking-tight text-white">Velaris</span>
            {activeItem && (
              <span key={activeItem.id} className="vx-fade-in text-xs text-neutral-500 truncate max-w-[9rem]">/ {activeItem.label}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="flex items-center gap-1.5 pr-1">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
            <span className="text-[10px] text-emerald-400 font-mono tracking-wider">En ligne</span>
          </span>
          <button
            onClick={() => setPaletteOpen(true)}
            className="-mr-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Rechercher dans le studio"
          >
            <Search className="h-[18px] w-[18px]" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      {/* Drawer Overlay for Mobile */}
      <div
        onClick={() => setIsMobileDrawerOpen(false)}
        className={`fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden transition-opacity duration-300 ease-luxury ${
          isMobileDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Left Sidebar (Desktop & Mobile Drawer) */}
      <aside
        onTouchStart={(e) => {
          drawerTouchX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          // Balayage vers la gauche pour refermer le tiroir
          if (drawerTouchX.current !== null && e.changedTouches[0].clientX - drawerTouchX.current < -60) {
            setIsMobileDrawerOpen(false);
          }
          drawerTouchX.current = null;
        }}
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 flex flex-col bg-[#08090C]/95 md:bg-[#08090C]/80 backdrop-blur-xl border-r border-white/[0.08] transition-transform duration-[360ms] ease-luxury ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-full bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,0.08),#050608_70%)] border border-white/[0.12] flex items-center justify-center text-[#F3CA75] shrink-0">
              <VelarisMark className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-[19px] tracking-wide text-white">
                  VELARIS
                </span>
                <span className="text-[10px] font-semibold tracking-[0.14em] px-1.5 py-[1px] rounded-[4px] bg-[#E5B54F] text-[#050608]">
                  STUDIO
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] vx-breathe" />
                <span className="text-[11px] font-semibold tracking-[0.12em] text-[#22C55E]">
                  ATELIER ACTIF 24/7
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden -mr-2 h-11 w-11 inline-flex items-center justify-center rounded-xl text-neutral-400 hover:text-white transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bouton retour Vitrine */}
        <div className="px-3 pt-3">
          <button
            onClick={onReturnToHome}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] text-[#A3A3A3] hover:text-white hover:bg-[#E5B54F]/[0.05] border border-white/[0.08] hover:border-white/[0.12] transition-all duration-200 ease-luxury cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5 text-neutral-500 group-hover:text-white group-hover:-translate-x-0.5 transition-all duration-200 ease-luxury" />
              <span>Retour à la vitrine</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-600">Public</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="relative flex-1 px-3 py-5 space-y-6 overflow-y-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#737373]">
                {group.title}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full group relative flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-[15px] transition-[color,background-color,border-color] duration-200 ease-luxury text-left cursor-pointer ${
                      isActive
                        ? 'border-[#E5B54F]/55 border-l-2 border-l-[#E5B54F] bg-gradient-to-r from-[#E5B54F]/[0.16] via-[#E5B54F]/[0.05] to-transparent text-[#F3CA75] font-semibold shadow-[0_0_24px_-8px_rgba(229,181,79,0.45)]'
                        : 'border-transparent text-[#A3A3A3] font-medium hover:bg-[#E5B54F]/[0.04] hover:text-[#E5E5E5]'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon strokeWidth={1.6} className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-[#E5B54F]' : 'text-[#737373] group-hover:text-[#D6D3D1]'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {!!item.count && (
                      <span
                        aria-label={`${item.count} non lus`}
                        className="ml-2 inline-flex min-w-[22px] h-[22px] items-center justify-center rounded-full bg-[#E11D48] px-1.5 text-[11px] font-bold tabular-nums text-white shadow-[0_0_12px_rgba(225,29,72,0.45)]"
                      >
                        {item.count > 99 ? '99+' : item.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer User Profile (Multi-Tenant Auth) */}
        <div className="p-3 border-t border-white/[0.08]">
          {user ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0E1015] p-3 flex items-center justify-between gap-2.5">
              <button
                onClick={() => handleTabClick('profile')}
                title="Mon profil studio"
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer"
              >
                <div className="h-9 w-9 rounded-full bg-[#E5B54F]/[0.12] border border-[#E5B54F]/40 flex items-center justify-center text-xs font-bold text-[#F3CA75] shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-emerald-400/90 truncate flex items-center gap-1 font-mono">
                    <ShieldCheck className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                    <span>Poste RLS privé</span>
                  </div>
                </div>
              </button>

              <button
                onClick={async () => {
                  await signOut();
                  onReturnToHome();
                }}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.08] bg-[#0E1015] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 vx-breathe" />
                  <span className="text-[11px] font-medium text-neutral-300">Session démo publique</span>
                </div>
              </div>
              <p className="text-[11px] text-neutral-400 leading-relaxed">
                Connectez-vous pour obtenir votre ligne WhatsApp privée et vos données isolées.
              </p>
              <button
                onClick={() => openAuthModal('login')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#E5B54F] px-3 py-2 text-[13px] font-semibold text-[#050608] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Mon espace studio</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Fil d'Ariane (desktop) */}
        <div className="hidden md:flex sticky top-0 z-20 h-16 items-center justify-between px-8 lg:px-10 border-b border-white/[0.08] bg-[#050608]/70 backdrop-blur-xl">
          <nav aria-label="Fil d'Ariane" className="flex items-center gap-1.5 text-[13px] min-w-0">
            <button
              onClick={() => handleTabClick('revenus')}
              className="text-neutral-500 hover:text-neutral-200 transition-colors cursor-pointer"
            >
              Studio OS
            </button>
            {activeGroup && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-neutral-700 shrink-0" />
                <span className="text-neutral-500 truncate">{activeGroup.title}</span>
              </>
            )}
            {activeItem && (
              <>
                <ChevronRight className="h-3.5 w-3.5 text-neutral-700 shrink-0" />
                <span key={activeItem.id} className="text-white font-medium truncate vx-fade-in">{activeItem.label}</span>
              </>
            )}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setPaletteOpen(true)}
              className="group inline-flex items-center gap-2.5 h-9 rounded-full border border-white/[0.08] bg-white/[0.02] pl-3 pr-1.5 text-[13px] text-neutral-500 hover:text-neutral-200 hover:border-white/[0.12] transition-colors duration-200 ease-luxury cursor-pointer"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={1.8} />
              <span className="hidden lg:inline">Aller à…</span>
              <kbd className="vx-kbd">{shortcutLabel}</kbd>
            </button>
            <span className="hidden lg:inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11px] font-mono text-neutral-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
              WAHA · Suno · Supabase
            </span>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 w-full max-w-7xl p-4 sm:p-8 lg:p-10">
          <div key={currentTab} className="vx-view-enter">
            {currentTab === 'revenus' && (
              <CockpitView
                metrics={metrics ?? EMPTY_STUDIO_METRICS}
                orders={orders}
                onSelectOrderForStudio={openOrderInStudio}
                onOpenQrModal={onOpenQrModal ?? (() => handleTabClick('whatsapp'))}
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

            {currentTab === 'conversations' && (
              <ConversationsView
                onOpenOrderForStudio={(name) => {
                  const matched = orders.find(o => o.clientName.toLowerCase().includes(name.toLowerCase()));
                  if (matched) openOrderInStudio(matched.id);
                }}
              />
            )}


            {currentTab === 'playground' && (
              <PlaygroundView />
            )}

            {currentTab === 'automations' && (
              <AutomationsView />
            )}

            {currentTab === 'whatsapp' && (
              <WhatsAppLinesView />
            )}

            {currentTab === 'analyste' && (
              <StudioCopilotView
                orders={orders}
                metrics={metrics ?? EMPTY_STUDIO_METRICS}
                onNavigateToStudio={() => handleTabClick('studio_ai')}
                onOpenQrModal={onOpenQrModal ?? (() => handleTabClick('whatsapp'))}
              />
            )}

            {currentTab === 'profile' && (
              <StudioProfileView onOpenWhatsApp={() => handleTabClick('whatsapp')} onSignedOut={onReturnToHome} />
            )}

            {currentTab === 'admin' && (
              <AdminConsoleView
                orders={orders}
                metrics={metrics ?? EMPTY_STUDIO_METRICS}
                conversations={liveConversations}
              />
            )}

            {currentTab === 'studio_ai' && renderStudioAI()}

            {currentTab === 'academy' && renderAcademy()}
          </div>
          <div className="vx-bottom-nav-spacer" aria-hidden />
        </main>
      </div>

      {/* Barre de navigation mobile inférieure (< 768px) */}
      <nav className="vx-bottom-nav" aria-label="Navigation principale">
        <div className="vx-bottom-nav-bar">
          {BOTTOM_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => handleTabClick(id)}
              aria-current={currentTab === id && !isMobileDrawerOpen ? 'page' : undefined}
              className="vx-bottom-nav-item"
            >
              <Icon className="h-5 w-5" strokeWidth={1.6} />
              <span>{label}</span>
              {id === 'conversations' && unreadCount > 0 && (
                <span className="vx-bottom-nav-badge" aria-label={`${unreadCount} non lus`}>
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            aria-current={isMobileDrawerOpen || !isBottomTab ? 'page' : undefined}
            aria-label="Plus d'onglets"
            className="vx-bottom-nav-item"
          >
            <Ellipsis className="h-5 w-5" strokeWidth={1.6} />
            <span>Plus</span>
          </button>
        </div>
      </nav>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={paletteCommands} />
    </div>
  );
};
