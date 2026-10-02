import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FC, type ReactNode } from 'react';
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
import { REAL_STUDIO_METRICS } from '../data/realProductionData';

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
const panelClass = 'rounded-2xl border border-white/[0.08] bg-[#08090C] vx-hairline';

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

  const ruleRef = useRef<HTMLSpanElement | null>(null);
  const itemRefs = useRef<Partial<Record<StudioTab, HTMLButtonElement | null>>>({});

  const userDisplayName = (user?.user_metadata?.studio_name as string) ||
    (user?.user_metadata?.full_name as string) ||
    (user?.email ? user.email.split('@')[0] : 'Studio Invité');
  const userInitials = (userDisplayName.slice(0, 2) || 'ST').toUpperCase();

  const navGroups = [
    {
      title: 'Pilotage',
      items: [
        { id: 'revenus' as StudioTab, label: 'Cockpit', icon: LayoutGrid },
        { id: 'ventes' as StudioTab, label: 'Ventes & Caisse', icon: Wallet },
        { id: 'conversations' as StudioTab, label: 'Discussions WhatsApp', icon: MessagesSquare, badge: 'Direct' },
        { id: 'pipeline' as StudioTab, label: 'Suivi clients', icon: Columns3 },
        { id: 'couts' as StudioTab, label: 'Coûts & marges', icon: Percent },
        { id: 'analyste' as StudioTab, label: 'Analyste & Copilot IA', icon: TrendingUp },
      ]
    },
    {
      title: 'Connectivité & règles',
      items: [
        { id: 'whatsapp' as StudioTab, label: 'Lignes WhatsApp', icon: Smartphone },
        { id: 'automations' as StudioTab, label: 'Automatisations', icon: Zap },
        { id: 'tarifs' as StudioTab, label: 'Tarifs & Formules', icon: Tag },
      ]
    },
    {
      title: 'Atelier & académie',
      items: [
        { id: 'studio_ai' as StudioTab, label: 'Atelier Studio IA', icon: Music2 },
        { id: 'academy' as StudioTab, label: 'Académie Studio', icon: GraduationCap },
        { id: 'admin' as StudioTab, label: 'Supervision Système', icon: Crown },
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

  // Réglet actif : un seul indicateur qui glisse d'un item à l'autre (transform uniquement)
  useLayoutEffect(() => {
    const rule = ruleRef.current;
    const target = itemRefs.current[currentTab];
    if (!rule || !target) return;
    rule.style.transform = `translate3d(0, ${target.offsetTop + 8}px, 0)`;
    rule.style.height = `${target.offsetHeight - 16}px`;
    rule.style.opacity = '1';
  }, [currentTab]);

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
    <div className="vx-halo min-h-screen bg-[#050608] text-[#E5E7EB] flex flex-col md:flex-row relative selection:bg-white/20 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-[#08090C]/85 border-b border-white/[0.08] backdrop-blur-xl">
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
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 flex flex-col bg-[#08090C]/95 md:bg-[#08090C]/70 backdrop-blur-xl border-r border-white/[0.08] transition-transform duration-[360ms] ease-luxury ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen`}
      >
        {/* Brand Header */}
        <div className="px-5 h-16 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative h-9 w-9 rounded-xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/[0.1] flex items-center justify-center text-white shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <VelarisMark className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-[15px] tracking-tight text-white">
                  Velaris
                </span>
                <span className="text-[9px] font-mono tracking-widest px-1.5 py-px rounded border border-white/10 bg-white/[0.04] text-neutral-400">
                  STUDIO OS
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 vx-breathe" />
                <span className="text-[10px] text-neutral-400 font-mono">
                  Atelier actif · 24/7
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
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.06] hover:border-white/[0.12] transition-all duration-200 ease-luxury cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5 text-neutral-500 group-hover:text-white group-hover:-translate-x-0.5 transition-all duration-200 ease-luxury" />
              <span>Retour à la vitrine</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-600">Public</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="relative flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar">
          {/* Réglet actif glissant */}
          <span
            ref={ruleRef}
            aria-hidden="true"
            className="absolute left-3 top-0 w-[2px] rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.45)] opacity-0 transition-[transform,height,opacity] duration-[360ms] ease-luxury"
          />

          {navGroups.map((group) => (
            <div key={group.title} className="space-y-0.5">
              <div className="px-3 pb-1.5 text-[11px] font-medium text-neutral-500">
                {group.title}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    ref={(el) => { itemRefs.current[item.id] = el; }}
                    onClick={() => handleTabClick(item.id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full group relative flex items-center justify-between rounded-lg pl-4 pr-3 py-2 text-[13px] font-medium transition-colors duration-150 ease-press text-left cursor-pointer ${
                      isActive
                        ? 'bg-white/[0.06] text-white'
                        : 'text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon strokeWidth={1.5} className={`h-4 w-4 shrink-0 transition-colors duration-150 ${
                        isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono text-emerald-300/90 bg-emerald-400/[0.06] border border-emerald-400/15">
                        <span className="h-1 w-1 rounded-full bg-emerald-400 vx-breathe" />
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer User Profile (Multi-Tenant Auth) */}
        <div className="p-3 border-t border-white/[0.06]">
          {user ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#0E1015] p-3 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-lg bg-gradient-to-b from-white/[0.12] to-white/[0.04] border border-white/[0.1] flex items-center justify-center text-[11px] font-mono font-bold text-white shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">
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
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer"
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
        <div className="hidden md:flex sticky top-0 z-20 h-16 items-center justify-between px-8 lg:px-10 border-b border-white/[0.06] bg-[#050608]/70 backdrop-blur-xl">
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
            <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.02] px-3 py-1 text-[11px] font-mono text-neutral-400">
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
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Coûts & marges studio</h1>
                  <p className="text-sm text-neutral-400 mt-1.5">Structure unitaire de rentabilité et cashflow net par commande.</p>
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
                  <div className="divide-y divide-white/[0.06] font-mono text-xs">
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
              <StudioCopilotView onNavigateToStudio={() => handleTabClick('studio_ai')} />
            )}

            {currentTab === 'tarifs' && (
              <div className="max-w-4xl mx-auto space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Tarifs & formules studio</h1>
                  <p className="text-sm text-neutral-400 mt-1.5">Formules étalonnées pour maximiser le taux de closing WhatsApp.</p>
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
                          ? 'border-white/20 bg-[#0E1015] shadow-[0_24px_60px_-20px_rgba(214,170,96,0.18)]'
                          : 'border-white/[0.08] bg-[#08090C] hover:border-white/[0.16]'
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
                      <div className={`pt-3 border-t border-white/[0.06] text-[11px] font-mono ${plan.featured ? 'text-[#D6AA60]' : 'text-neutral-500'}`}>
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
                  <div className="h-10 w-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white">
                    <Server className="h-4 w-4" strokeWidth={1.5} />
                  </div>
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Console système & passerelles</h1>
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
                        className="vx-stagger p-4 rounded-xl bg-white/[0.02] border border-white/[0.06] flex items-center justify-between"
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
