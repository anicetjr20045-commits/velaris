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
  ArrowLeft
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { Order, StudioMetrics } from '../types';
import { RevenusView } from './RevenusView';
import { ConversationsView } from './ConversationsView';
import { PipelineView } from './PipelineView';
import { AutomationsView } from './AutomationsView';
import { WhatsAppLinesView } from './WhatsAppLinesView';
import { VentesCaisseView } from './VentesCaisseView';

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
    (user?.email ? user.email.split('@')[0] : 'Invité Démo');
  const userInitials = (userDisplayName.slice(0, 2) || 'ST').toUpperCase();

  const navGroups = [
    {
      title: 'MON BUSINESS',
      items: [
        { id: 'revenus' as StudioTab, label: 'Mes revenus', icon: LayoutGrid },
        { id: 'ventes' as StudioTab, label: 'Ventes & Caisse', icon: Wallet },
        { id: 'conversations' as StudioTab, label: 'Discussions WhatsApp', icon: MessagesSquare, badge: 42 },
        { id: 'pipeline' as StudioTab, label: 'Suivi clients', icon: Columns3 },
        { id: 'couts' as StudioTab, label: 'Coûts & marges', icon: Percent },
        { id: 'analyste' as StudioTab, label: 'Analyste', icon: TrendingUp },
      ]
    },
    {
      title: 'PARAMÈTRES STUDIO',
      items: [
        { id: 'whatsapp' as StudioTab, label: 'Lignes WhatsApp', icon: Smartphone },
        { id: 'automations' as StudioTab, label: 'Automatisations', icon: Zap },
        { id: 'tarifs' as StudioTab, label: 'Tarifs & Formules', icon: Tag },
      ]
    },
    {
      title: 'SUPERVISION & ADMINISTRATION',
      items: [
        { id: 'admin' as StudioTab, label: 'Console Admin', icon: Crown },
        { id: 'studio_ai' as StudioTab, label: 'Mon Studio IA (Suno)', icon: Music2 },
        { id: 'academy' as StudioTab, label: 'Académie Studio', icon: GraduationCap },
      ]
    }
  ];

  const handleTabClick = (tab: StudioTab) => {
    setCurrentTab(tab);
    setIsMobileDrawerOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#070709] text-[#e0e2e6] flex flex-col md:flex-row relative">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 w-full flex items-center justify-between px-4 py-3 bg-[#0b0a08]/95 border-b border-white/[0.08] backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsMobileDrawerOpen(true)}
            className="p-1.5 rounded-lg text-stone-300 hover:text-white hover:bg-white/[0.05]"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1.5">
            <span className="font-heading font-bold text-sm text-white tracking-wider">
              VELARIS
            </span>
            <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#c5a059]/15 text-[#e5c158] font-bold border border-[#c5a059]/30">
              Studio
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-semibold tracking-wider uppercase">
            Atelier Actif
          </span>
        </div>
      </header>

      {/* Drawer Overlay for Mobile */}
      {isMobileDrawerOpen && (
        <div 
          onClick={() => setIsMobileDrawerOpen(false)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Left Sidebar (Desktop & Mobile Drawer) */}
      <aside
        className={`fixed md:sticky top-0 bottom-0 left-0 z-50 md:z-30 w-72 shrink-0 flex flex-col bg-[#0b0a08] border-r border-white/[0.08] transition-transform duration-300 ease-in-out ${
          isMobileDrawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } h-screen`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#1c1914] to-[#0d0c0a] border border-[#c5a059]/40 flex items-center justify-center text-[#c5a059] shadow-lg shrink-0">
              <Music2 className="h-5 w-5" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-base tracking-wider text-white">
                  VELARIS
                </span>
                <span className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded bg-[#c5a059]/15 text-[#e5c158] font-bold border border-[#c5a059]/30">
                  Studio
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[9px] text-emerald-400 font-semibold tracking-wider uppercase">
                  Atelier Actif 24/7
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsMobileDrawerOpen(false)}
            className="md:hidden p-1.5 text-stone-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Bouton retour Vitrine */}
        <div className="px-3 pt-3">
          <button
            onClick={onReturnToHome}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs text-stone-400 hover:text-white hover:bg-white/[0.04] border border-white/[0.04] transition-all cursor-pointer"
          >
            <span className="flex items-center gap-2">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Retour à la vitrine</span>
            </span>
            <span className="text-[10px] text-stone-500">Public</span>
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto no-scrollbar">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">
                {group.title}
              </div>

              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleTabClick(item.id)}
                    className={`w-full group flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium transition-all text-left cursor-pointer ${
                      isActive
                        ? 'bg-[#181612] text-[#c5a059] font-semibold border-l-2 border-[#c5a059] shadow-sm'
                        : 'text-stone-300 hover:bg-[#12110e] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 truncate">
                      <Icon className={`h-4 w-4 shrink-0 transition-transform ${
                        isActive ? 'text-[#c5a059]' : 'text-stone-400 group-hover:text-stone-200'
                      }`} />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 rounded-full bg-rose-600 text-white text-[10px] font-bold tracking-tight">
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
        <div className="p-3 border-t border-white/[0.08] bg-[#090807]">
          {user ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#12110e] p-3 flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-8 w-8 rounded-full bg-[#1c1914] border border-[#c5a059]/40 flex items-center justify-center text-xs font-bold text-[#e5c158] shrink-0">
                  {userInitials}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-stone-200 truncate">
                    {userDisplayName}
                  </div>
                  <div className="text-[10px] text-emerald-400 truncate flex items-center gap-1 font-mono">
                    <ShieldCheck className="h-3 w-3 shrink-0" />
                    <span>Données isolées (RLS)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={async () => {
                  await signOut();
                  onReturnToHome();
                }}
                title="Se déconnecter"
                className="p-1.5 rounded-lg text-stone-400 hover:text-rose-400 hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] bg-[#12110e] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-[11px] font-semibold text-stone-300">Mode Démonstration</span>
                </div>
                <span className="text-[9px] uppercase font-mono text-stone-500">Public</span>
              </div>
              <p className="text-[10px] text-stone-400">
                Chaque studio possède ses données privées étanches.
              </p>
              <button
                onClick={() => openAuthModal('login')}
                className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-xs font-bold text-black hover:bg-stone-200 transition-colors cursor-pointer"
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
            <h1 className="font-serif text-3xl font-bold text-[#f3f4f6]">Coûts & marges</h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6">
                <div className="text-xs uppercase tracking-widest text-stone-400 mb-1">Marge Brute Moyenne</div>
                <div className="font-serif text-4xl font-bold text-emerald-400">92.4 %</div>
                <p className="text-xs text-stone-400 mt-2">Coût moyen de production IA Suno : ~150 F CFA par chanson.</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6">
                <div className="text-xs uppercase tracking-widest text-stone-400 mb-1">Coût par Lead WhatsApp</div>
                <div className="font-serif text-4xl font-bold text-[#c5a059]">65 F CFA</div>
                <p className="text-xs text-stone-400 mt-2">Campagnes Meta Ads calibrées.</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6">
                <div className="text-xs uppercase tracking-widest text-stone-400 mb-1">Bénéfice Net Réalisé</div>
                <div className="font-serif text-4xl font-bold text-white">3 367 000 F</div>
                <p className="text-xs text-stone-400 mt-2">Sur 3 644 400 F CFA de CA total.</p>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'analyste' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="font-serif text-3xl font-bold text-[#f3f4f6]">Analyste Commercial & Conversion</h1>
            <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 space-y-4">
              <div className="text-sm text-stone-300">
                Performance globale des 30 derniers jours :
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-stone-300">
                  <span>Taux de closing des briefs recueillis</span>
                  <span className="font-bold text-[#c5a059]">46.8 %</span>
                </div>
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                  <div className="bg-[#c5a059] h-full rounded-full" style={{ width: '46.8%' }} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between text-xs text-stone-300">
                  <span>Délai moyen de livraison studio</span>
                  <span className="font-bold text-emerald-400">18 minutes</span>
                </div>
                <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden">
                  <div className="bg-emerald-400 h-full rounded-full" style={{ width: '92%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'tarifs' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <h1 className="font-serif text-3xl font-bold text-[#f3f4f6]">Tarifs & Formules Studio</h1>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 space-y-2">
                <div className="text-xs uppercase font-bold text-[#c5a059]">Formule Découverte</div>
                <div className="font-serif text-3xl font-bold text-white">1 200 F CFA</div>
                <p className="text-xs text-stone-400">1 chanson personnalisée, 1 voix, livraison audio WhatsApp.</p>
              </div>
              <div className="rounded-2xl border border-[#c5a059]/40 bg-[#14120e] p-6 space-y-2 shadow-xl">
                <div className="text-xs uppercase font-bold text-[#e5c158]">Formule Complète (Best-Seller)</div>
                <div className="font-serif text-3xl font-bold text-white">3 000 F CFA</div>
                <p className="text-xs text-stone-400">Paroles sur-mesure + 2 versions audio masterisées + pochette souvenir.</p>
              </div>
              <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 space-y-2">
                <div className="text-xs uppercase font-bold text-stone-300">Formule Prestige / Mariage</div>
                <div className="font-serif text-3xl font-bold text-white">5 000 F CFA</div>
                <p className="text-xs text-stone-400">Duo de voix, arrangements personnalisés, paroles imprimables HD.</p>
              </div>
            </div>
          </div>
        )}

        {currentTab === 'admin' && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-2">
              <Crown className="h-6 w-6 text-[#c5a059]" />
              <h1 className="font-serif text-3xl font-bold text-[#f3f4f6]">Console Administration</h1>
            </div>
            <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 space-y-4">
              <div className="text-xs text-stone-400">
                Statut du serveur de production & Passerelles :
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05] flex justify-between">
                  <span className="text-stone-300">Serveur WAHA</span>
                  <span className="text-emerald-400 font-semibold font-mono">OPÉRATIONNEL (WORKING)</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05] flex justify-between">
                  <span className="text-stone-300">Moteur Suno IA</span>
                  <span className="text-emerald-400 font-semibold font-mono">PRÊT (Mastering 18 min)</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05] flex justify-between">
                  <span className="text-stone-300">Base PostgreSQL</span>
                  <span className="text-emerald-400 font-semibold font-mono">SYNCHRONISÉE</span>
                </div>
                <div className="p-3 rounded-xl bg-black/30 border border-white/[0.05] flex justify-between">
                  <span className="text-stone-300">Réceptionniste Sarah</span>
                  <span className="text-emerald-400 font-semibold font-mono">ACTIVE</span>
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
