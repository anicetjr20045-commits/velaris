import { useEffect, useState, type CSSProperties, type FC, type ReactNode } from 'react';
import {
  LayoutGrid,
  Wallet,
  MessagesSquare,
  Columns3,
  Percent,
  TrendingUp,
  Smartphone,
  Zap,
  Tag,
  Crown,
  Music2,
  GraduationCap,
  LogOut,
  LogIn,
  ShieldCheck,
  Menu,
  X,
  ArrowLeft,
  Server,
  Activity,
  Cpu,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics } from '../types';
import { CockpitView } from './CockpitView';
import { ConversationsView } from './ConversationsView';
import { PipelineView } from './PipelineView';
import { AutomationsView } from './AutomationsView';
import { WhatsAppLinesView } from './WhatsAppLinesView';
import { VentesCaisseView } from './VentesCaisseView';
import { StudioCopilotView } from './StudioCopilotView';
import { VelarisMark } from './VelarisMark';
import { REAL_CONVERSATIONS, REAL_STUDIO_METRICS } from '../data/realProductionData';
import { getLiveConversations } from '../services/supabase';
import { useStudioLive } from '../hooks/useStudioLive';

export type StudioTab =
  | 'revenus'
  | 'ventes'
  | 'conversations'
  | 'pipeline'
  | 'couts'
  | 'analyste'
  | 'whatsapp'
  | 'automations'
  | 'tarifs'
  | 'admin'
  | 'studio_ai'
  | 'academy';

interface StudioAppLayoutProps {
  initialTab?: StudioTab;
  orders: Order[];
  metrics?: StudioMetrics;
  onReturnToHome: () => void;
  renderStudioAI: () => ReactNode;
  renderAcademy: () => ReactNode;
  onSelectOrderForStudio: (orderId: string) => void;
  onOpenQrModal?: () => void;
  onOpenNewOrderModal?: () => void;
}

/* Marque Velaris : sillons de vinyle + tête de lecture */
const panelClass = 'rounded-2xl border border-[#2D261E] bg-[#13110E] vx-hairline';

export const StudioAppLayout: FC<StudioAppLayoutProps> = ({
  initialTab = 'revenus',
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
  const { data: liveConversations } = useStudioLive(
    getLiveConversations,
    user ? [] : REAL_CONVERSATIONS,
    ['conversations', 'messages'],
    [user?.id]
  );
  const unreadCount = liveConversations.filter((c) => c.unread).length;

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
        { id: 'pipeline' as StudioTab, label: 'Suivi clients', icon: Columns3 },
        { id: 'couts' as StudioTab, label: 'Coûts & marges', icon: Percent },
        { id: 'analyste' as StudioTab, label: 'Analyste & Copilot IA', icon: TrendingUp },
      ]
    },
    {
      title: 'Paramètres studio',
      items: [
        { id: 'whatsapp' as StudioTab, label: 'Lignes WhatsApp', icon: Smartphone },
        { id: 'automations' as StudioTab, label: 'Automatisations', icon: Zap },
        { id: 'tarifs' as StudioTab, label: 'Tarifs & Formules', icon: Tag },
      ]
    },
    {
      title: 'Supervision & administration',
      items: [
        { id: 'studio_ai' as StudioTab, label: 'Atelier Studio IA', icon: Music2 },
        { id: 'academy' as StudioTab, label: 'Académie Studio', icon: GraduationCap },
        { id: 'admin' as StudioTab, label: 'Console Admin', icon: Crown },
      ]
    }
  ];

  const activeGroup = navGroups.find((g) => g.items.some((i) => i.id === currentTab));
  const activeItem = activeGroup?.items.find((i) => i.id === currentTab);

  const handleTabClick = (tab: StudioTab) => {
    setCurrentTab(tab);
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const openOrderInStudio = (orderId: string) => {
    onSelectOrderForStudio(orderId);
    handleTabClick('studio_ai');
  };

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
    <div className="vx-halo min-h-screen bg-[#0C0A09] text-[#E7E5E4] flex flex-col md:flex-row relative selection:bg-[#E5B54F]/30 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-[#13110E]/85 border-b border-[#2D261E] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors duration-150 ease-press"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" strokeWidth={1.5} />
          </button>

          <div className="flex items-center gap-2">
            <VelarisMark className="h-5 w-5 text-white" />
            <span className="font-heading font-bold text-sm tracking-tight text-white">Velaris</span>
            {activeItem && (
              <span className="text-xs text-neutral-500 truncate max-w-[9rem]">/ {activeItem.label}</span>
            )}
          </div>
        </div>

        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
          <span className="text-[10px] text-emerald-400 font-mono tracking-wider">En ligne</span>
        </span>
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
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 flex flex-col bg-[#0E0C0A]/95 md:bg-[#0E0C0A]/80 backdrop-blur-xl border-r border-[#2D261E] transition-transform duration-[360ms] ease-luxury ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen`}
      >
        {/* Brand Header */}
        <div className="px-5 py-5 border-b border-[#2D261E] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-11 w-11 rounded-full bg-[radial-gradient(circle_at_35%_30%,#2D261E,#0C0A09_70%)] border border-[#3A3022] flex items-center justify-center text-[#F3CA75] shrink-0">
              <VelarisMark className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-[19px] tracking-wide text-white">
                  VELARIS
                </span>
                <span className="text-[10px] font-semibold tracking-[0.14em] px-1.5 py-[1px] rounded-[4px] bg-[#E5B54F] text-[#0C0A09]">
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
            className="md:hidden p-1.5 text-neutral-400 hover:text-white transition-colors"
            aria-label="Fermer le menu"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bouton retour Vitrine */}
        <div className="px-3 pt-3">
          <button
            onClick={onReturnToHome}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-[13px] text-[#A8A29E] hover:text-white hover:bg-[#E5B54F]/[0.05] border border-[#2D261E] hover:border-[#3A3022] transition-all duration-200 ease-luxury cursor-pointer group"
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
              <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#78716C]">
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
                        : 'border-transparent text-[#A8A29E] font-medium hover:bg-[#E5B54F]/[0.04] hover:text-[#E7E5E4]'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon strokeWidth={1.6} className={`h-[18px] w-[18px] shrink-0 transition-colors duration-200 ${
                        isActive ? 'text-[#E5B54F]' : 'text-[#78716C] group-hover:text-[#D6D3D1]'
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
        <div className="p-3 border-t border-[#2D261E]">
          {user ? (
            <div className="rounded-xl border border-[#2D261E] bg-[#1A1713] p-3 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
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
              </div>

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
            <div className="rounded-xl border border-[#2D261E] bg-[#1A1713] p-3 space-y-2">
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#E5B54F] px-3 py-2 text-[13px] font-semibold text-[#0C0A09] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer"
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
        <div className="hidden md:flex sticky top-0 z-20 h-16 items-center justify-between px-8 lg:px-10 border-b border-[#2D261E] bg-[#0C0A09]/70 backdrop-blur-xl">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-[#2D261E] bg-white/[0.02] px-3 py-1 text-[11px] font-mono text-neutral-400">
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
                metrics={metrics ?? { ...REAL_STUDIO_METRICS, currency: 'FCFA' }}
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

            {currentTab === 'pipeline' && (
              <PipelineView
                onSelectLeadForStudio={(leadId) => {
                  const matched = orders.find(o => o.id === leadId);
                  openOrderInStudio(matched ? matched.id : orders[0]?.id || 'ORD-9821');
                }}
              />
            )}

            {currentTab === 'automations' && (
              <AutomationsView />
            )}

            {currentTab === 'whatsapp' && (
              <WhatsAppLinesView />
            )}

            {currentTab === 'couts' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Coûts & marges studio</h1>
                  <p className="text-sm sm:text-base text-[#A8A29E] mt-2 leading-relaxed">Structure unitaire de rentabilité et cashflow net par commande.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { label: 'Marge brute moyenne', value: '92,4 %', accent: 'text-emerald-400', note: 'Coût moyen de génération IA Suno : ~150 F CFA par composition.' },
                    { label: 'Coût par lead WhatsApp', value: '65 F CFA', accent: 'text-white', note: 'Taux de conversion moyen : 1 closing pour 4 à 6 prospects entrants.' },
                    { label: 'Bénéfice net réalisé', value: '3 367 000 F', accent: 'text-white', note: 'Sur 3 644 400 F CFA encaissés directement sur Wave & Orange Money.' },
                  ].map((card, i) => (
                    <div key={card.label} style={{ '--i': i } as CSSProperties} className={`${panelClass} p-6 space-y-2 vx-stagger`}>
                      <div className="text-xs text-neutral-400">{card.label}</div>
                      <div className={`font-mono text-3xl font-bold tracking-tight ${card.accent}`}>{card.value}</div>
                      <p className="text-xs text-neutral-500 leading-relaxed">{card.note}</p>
                    </div>
                  ))}
                </div>

                <div className={`${panelClass} p-6 space-y-4`}>
                  <div className="text-sm font-medium text-white">Grille analytique des dépenses</div>
                  <div className="divide-y divide-[#2D261E] font-mono text-xs">
                    {[
                      ['Abonnement Suno IA Pro / Premier', '12 000 F CFA / mois'],
                      ['Hébergement serveur WAHA (VPS dédié)', '3 500 F CFA / mois'],
                      ['Frais de transfert Mobile Money (retraits)', '1,0 % fixe'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between py-3">
                        <span className="text-neutral-400">{label}</span>
                        <span className="text-white font-semibold">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'analyste' && (
              <StudioCopilotView
                orders={orders}
                metrics={metrics ?? { ...REAL_STUDIO_METRICS, currency: 'FCFA' }}
                onNavigateToStudio={() => handleTabClick('studio_ai')}
              />
            )}

            {currentTab === 'tarifs' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Tarifs & formules studio</h1>
                  <p className="text-sm sm:text-base text-[#A8A29E] mt-2 leading-relaxed">Formules étalonnées pour maximiser le taux de closing WhatsApp.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {[
                    { name: 'Découverte', price: '1 200 F', desc: '1 chanson personnalisée, 1 voix studio, livraison master audio direct.', delay: '15 minutes', featured: false },
                    { name: 'Complète', price: '3 000 F', desc: 'Paroles sur-mesure + 2 versions audio masterisées + pochette carrée souvenir.', delay: '18 minutes', featured: true },
                    { name: 'Prestige / Mariage', price: '5 000 F', desc: 'Duo de voix, arrangements personnalisés, livret de paroles HD pour impression.', delay: '25 minutes', featured: false },
                  ].map((plan, i) => (
                    <div
                      key={plan.name}
                      style={{ '--i': i } as CSSProperties}
                      className={`vx-stagger relative rounded-2xl border p-6 space-y-3 vx-hairline transition-colors duration-300 ease-luxury ${
                        plan.featured
                          ? 'border-white/20 bg-[#1A1713] shadow-[0_24px_60px_-20px_rgba(229,181,79,0.18)]'
                          : 'border-[#2D261E] bg-[#13110E] hover:border-white/[0.16]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-neutral-300">{plan.name}</div>
                        {plan.featured && (
                          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-black">Best-seller</span>
                        )}
                      </div>
                      <div className="font-mono text-3xl font-bold tracking-tight text-white">{plan.price}</div>
                      <p className="text-xs text-neutral-400 leading-relaxed">{plan.desc}</p>
                      <div className={`pt-3 border-t border-[#2D261E] text-[11px] font-mono ${plan.featured ? 'text-[#E5B54F]' : 'text-neutral-500'}`}>
                        Délai moyen · {plan.delay}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentTab === 'admin' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-[#2D261E] flex items-center justify-center text-white">
                    <Server className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Console système & passerelles</h1>
                    <p className="text-sm text-neutral-400 mt-0.5">Statut des nœuds d'exécution et microservices.</p>
                  </div>
                </div>

                <div className={`${panelClass} p-2`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-mono">
                    {[
                      { icon: Activity, label: 'Passerelle WAHA VPS', status: 'WORKING' },
                      { icon: Cpu, label: 'Moteur audio Suno', status: '18 MIN READY' },
                      { icon: ShieldCheck, label: 'PostgreSQL & RLS', status: 'ISOLÉ PAR STUDIO' },
                      { icon: Zap, label: 'Webhook Bridge VPS', status: 'PORT 3001 OK' },
                    ].map(({ icon: Icon, label, status }, i) => (
                      <div
                        key={label}
                        style={{ '--i': i } as CSSProperties}
                        className="vx-stagger p-4 rounded-xl bg-white/[0.02] border border-[#2D261E] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2.5 text-neutral-300">
                          <Icon className="h-3.5 w-3.5 text-neutral-400" strokeWidth={1.5} />
                          <span>{label}</span>
                        </div>
                        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
                          {status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {currentTab === 'studio_ai' && renderStudioAI()}

            {currentTab === 'academy' && renderAcademy()}
          </div>
        </main>
      </div>
    </div>
  );
};
