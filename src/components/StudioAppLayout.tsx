import { useState, type FC, type ReactNode } from 'react';
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
  Layers
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics } from '../types';
import { RevenusView } from './RevenusView';
import { ConversationsView } from './ConversationsView';
import { PipelineView } from './PipelineView';
import { AutomationsView } from './AutomationsView';
import { WhatsAppLinesView } from './WhatsAppLinesView';
import { VentesCaisseView } from './VentesCaisseView';
import { StudioCopilotView } from './StudioCopilotView';

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
}

export const StudioAppLayout: FC<StudioAppLayoutProps> = ({
  initialTab = 'revenus',
  orders,
  metrics,
  onReturnToHome,
  renderStudioAI,
  renderAcademy,
  onSelectOrderForStudio
}) => {
  const { user, signOut, openAuthModal } = useAuth();
  const [currentTab, setCurrentTab] = useState<StudioTab>(initialTab);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const userDisplayName = (user?.user_metadata?.studio_name as string) || 
    (user?.user_metadata?.full_name as string) || 
    (user?.email ? user.email.split('@')[0] : 'Studio Invité');
  const userInitials = (userDisplayName.slice(0, 2) || 'ST').toUpperCase();

  const navGroups = [
    {
      title: 'BUSINESS & PILOTAGE',
      items: [
        { id: 'revenus' as StudioTab, label: 'Mes revenus', icon: LayoutGrid },
        { id: 'ventes' as StudioTab, label: 'Ventes & Caisse', icon: Wallet },
        { id: 'conversations' as StudioTab, label: 'Discussions WhatsApp', icon: MessagesSquare, badge: 'Direct' },
        { id: 'pipeline' as StudioTab, label: 'Suivi clients', icon: Columns3 },
        { id: 'couts' as StudioTab, label: 'Coûts & marges', icon: Percent },
        { id: 'analyste' as StudioTab, label: 'Analyste & Copilot IA', icon: TrendingUp },
      ]
    },
    {
      title: 'CONNECTIVITÉ & RÈGLES',
      items: [
        { id: 'whatsapp' as StudioTab, label: 'Lignes WhatsApp', icon: Smartphone },
        { id: 'automations' as StudioTab, label: 'Automatisations', icon: Zap },
        { id: 'tarifs' as StudioTab, label: 'Tarifs & Formules', icon: Tag },
      ]
    },
    {
      title: 'STUDIO & ACADÉMIE',
      items: [
        { id: 'studio_ai' as StudioTab, label: 'Atelier Studio IA (Suno)', icon: Music2 },
        { id: 'academy' as StudioTab, label: 'Académie Studio', icon: GraduationCap },
        { id: 'admin' as StudioTab, label: 'Supervision Système', icon: Crown },
      ]
    }
  ];

  const handleTabClick = (tab: StudioTab) => {
    setCurrentTab(tab);
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#050608] text-[#E5E7EB] flex flex-col md:flex-row relative selection:bg-white/20 selection:text-white">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-[#07080B]/95 border-b border-white/[0.06] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Ouvrir le menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs tracking-widest text-white uppercase">
              VELARIS
            </span>
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded border border-white/10 bg-white/[0.04] text-neutral-300 font-mono">
              STUDIO OS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-mono tracking-wider uppercase font-semibold">
            Opérationnel
          </span>
        </div>
      </header>

      {/* Drawer Overlay for Mobile */}
      {isMobileDrawerOpen && (
        <div 
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden transition-opacity"
        />
      )}

      {/* Left Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 flex flex-col bg-[#07080B] border-r border-white/[0.06] transition-transform duration-300 ease-in-out ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/[0.06] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white shadow-inner shrink-0">
              <Layers className="h-4 w-4" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-sm tracking-tight text-white">
                  VELARIS
                </span>
                <span className="text-[9px] uppercase font-mono tracking-widest px-1.5 py-0.2 rounded border border-white/10 bg-white/[0.04] text-neutral-400">
                  STUDIO
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-neutral-400 font-mono tracking-wider">
                  Poste connecté • 24/7
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden p-1.5 text-neutral-400 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Bouton retour Vitrine */}
        <div className="px-3 pt-3">
          <button
            onClick={onReturnToHome}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs text-neutral-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.04] transition-all cursor-pointer group"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5 text-neutral-500 group-hover:text-white transition-colors" />
              <span>Retour à la vitrine</span>
            </span>
            <span className="text-[10px] font-mono text-neutral-500">Public</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-mono font-medium tracking-widest text-neutral-400 uppercase">
                {group.title}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full group relative flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-white/[0.08] text-white shadow-[0_1px_12px_rgba(255,255,255,0.04)]'
                        : 'text-neutral-400 hover:bg-white/[0.03] hover:text-neutral-200'
                    }`}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-white" />
                    )}
                    <div className="flex items-center gap-2.5 truncate">
                      <Icon className={`h-4 w-4 shrink-0 transition-colors ${
                        isActive ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="ml-2 inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[10px] font-mono tracking-tight bg-white/[0.06] text-neutral-400 border border-white/[0.08]">
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
        <div className="p-3 border-t border-white/[0.06] bg-[#07080B]">
          {user ? (
            <div className="rounded-lg border border-white/[0.06] bg-[#0D0F14] p-3 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-md bg-white/[0.08] border border-white/[0.1] flex items-center justify-center text-xs font-mono font-bold text-white shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-white truncate">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate flex items-center gap-1 font-mono">
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    <span>Poste RLS Privé</span>
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  await signOut();
                  onReturnToHome();
                }}
                title="Se déconnecter"
                className="p-1.5 rounded-md text-neutral-400 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.06] bg-[#0D0F14] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-medium text-neutral-300">Session Démo Publique</span>
                </div>
                <span className="text-[9px] uppercase font-mono text-neutral-500">Public</span>
              </div>
              <p className="text-[10px] text-neutral-400 leading-relaxed">
                Connectez-vous pour obtenir votre ligne WhatsApp privée et vos données isolées.
              </p>
              <button
                onClick={() => openAuthModal('login')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer shadow-sm"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Mon Espace Studio</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 p-4 sm:p-8 lg:p-10 max-w-7xl">
        {currentTab === 'revenus' && (
          <RevenusView
            orders={orders}
            metrics={metrics}
            onOpenPipeline={() => setCurrentTab('pipeline')}
            onOpenConversations={() => setCurrentTab('conversations')}
            onOpenVentes={() => setCurrentTab('ventes')}
          />
        )}

        {currentTab === 'ventes' && (
          <VentesCaisseView
            orders={orders}
            onSelectOrderForStudio={onSelectOrderForStudio}
          />
        )}

        {currentTab === 'conversations' && (
          <ConversationsView
            onOpenOrderForStudio={(name) => {
              const matched = orders.find(o => o.clientName.toLowerCase().includes(name.toLowerCase()));
              if (matched) {
                onSelectOrderForStudio(matched.id);
                setCurrentTab('studio_ai');
              }
            }}
          />
        )}

        {currentTab === 'pipeline' && (
          <PipelineView
            onSelectLeadForStudio={(leadId) => {
              const matched = orders.find(o => o.id === leadId);
              onSelectOrderForStudio(matched ? matched.id : orders[0]?.id || 'ORD-9821');
              setCurrentTab('studio_ai');
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
              <div className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">TELEMETRIE FINANCIÈRE</div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">Coûts & Marges Studio</h1>
              <p className="text-xs text-neutral-400 mt-1">Structure unitaire de rentabilité et cashflow net par commande.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Marge Brute Moyenne</div>
                <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-emerald-400">92.4 %</div>
                <p className="text-xs text-neutral-400">Coût moyen de génération IA Suno : ~150 F CFA par composition.</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Coût par Lead WhatsApp</div>
                <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">65 F CFA</div>
                <p className="text-xs text-neutral-400">Taux de conversion moyen : 1 closing pour 4 à 6 prospects entrants.</p>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-2">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Bénéfice Net Réalisé</div>
                <div className="font-mono text-3xl sm:text-4xl font-bold tracking-tight text-white">3 367 000 F</div>
                <p className="text-xs text-neutral-400">Sur 3 644 400 F CFA encaissés directement sur Wave & Orange Money.</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">Grille Analytique des Dépenses</div>
              <div className="space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Abonnement Suno IA Pro / Premier</span>
                  <span className="text-white font-semibold">12 000 F CFA / mois</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Hébergement Serveur WAHA (VPS Dédié)</span>
                  <span className="text-white font-semibold">3 500 F CFA / mois</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                  <span className="text-neutral-300">Frais de transfert Mobile Money (Retraits)</span>
                  <span className="text-white font-semibold">1.0 % fixe</span>
                </div>
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
              <div className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">GRILLE COMMERCIALE</div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">Tarifs & Formules Studio</h1>
              <p className="text-xs text-neutral-400 mt-1">Formules étalonnées pour maximiser le taux de closing WhatsApp.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Formule Découverte</div>
                <div className="font-mono text-3xl font-bold text-white">1 200 F</div>
                <p className="text-xs text-neutral-400">1 chanson personnalisée, 1 voix studio, livraison master audio direct.</p>
                <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-neutral-400">
                  Délai moyen : 15 minutes
                </div>
              </div>

              <div className="rounded-xl border border-white/20 bg-[#0D0F14] p-6 space-y-3 relative shadow-[0_10px_30px_rgba(255,255,255,0.03)]">
                <div className="inline-flex px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-widest bg-white text-black font-semibold">
                  Best-Seller Studio
                </div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-300">Formule Complète</div>
                <div className="font-mono text-3xl font-bold text-white">3 000 F</div>
                <p className="text-xs text-neutral-300">Paroles sur-mesure + 2 versions audio masterisées + pochette carrée souvenir.</p>
                <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-emerald-400">
                  Délai moyen : 18 minutes
                </div>
              </div>

              <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-3">
                <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">Formule Prestige / Mariage</div>
                <div className="font-mono text-3xl font-bold text-white">5 000 F</div>
                <p className="text-xs text-neutral-400">Duo de voix, arrangements personnalisés, livret de paroles HD pour impression.</p>
                <div className="pt-3 border-t border-white/[0.06] text-[11px] font-mono text-neutral-400">
                  Délai moyen : 25 minutes
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'admin' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-white">
                <Server className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[11px] font-mono tracking-widest text-neutral-400 uppercase">SUPERVISION INFRASTRUCTURE</div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">Console Système & Passerelles</h1>
              </div>
            </div>

            <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 space-y-4">
              <div className="text-xs font-mono uppercase tracking-wider text-neutral-400">
                Statut des Nœuds d'Exécution & Microservices
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Activity className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Passerelle WAHA VPS</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">WORKING</span>
                </div>
                <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Cpu className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Moteur Audio Suno</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">18 MIN READY</span>
                </div>
                <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    <span>PostgreSQL & RLS</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">ISOLÉ PAR STUDIO</span>
                </div>
                <div className="p-3.5 rounded-lg bg-white/[0.02] border border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-2 text-neutral-300">
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Webhook Bridge VPS</span>
                  </div>
                  <span className="text-emerald-400 font-semibold">PORT 3001 OK</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'studio_ai' && renderStudioAI()}

        {currentTab === 'academy' && renderAcademy()}
      </main>
    </div>
  );
};
