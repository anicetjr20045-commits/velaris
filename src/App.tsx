import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { StudioView } from './components/StudioView';
import { AcademyView } from './components/AcademyView';
import { DecouvrirView } from './components/DecouvrirView';
import { StudioAppLayout, type StudioTab } from './components/StudioAppLayout';
import { QrConnectModal } from './components/QrConnectModal';
import { NewOrderModal } from './components/NewOrderModal';
import { AuthModal } from './components/AuthModal';
import { CosmicBackground } from './components/CosmicBackground';
import { ACADEMY_MODULES } from './data/mockData';
import { useWahaSession } from './hooks/useWaha';
import { useAuth } from './hooks/useAuth';
import { getLiveOrders, createLiveOrder, updateLiveOrder, subscribeStudioRealtime } from './services/supabase';
import type { Order, StudioMetrics } from './types';
import { ProtectedStreamView, type ProtectedShareData } from './components/ProtectedStreamView';
import { getSharedTrackById } from './services/shared-tracks';
import { ShieldCheck } from 'lucide-react';

export type MainTab = 'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir' | 'copilot';

/**
 * Détecte si une session d'authentification Supabase est persistée en local.
 * Permet d'éviter le flash de la page d'accueil dès le premier rendu synchrone.
 */
function checkHasSavedAuthSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && ((key.startsWith('sb-') && key.endsWith('-auth-token')) || key === 'supabase.auth.token')) {
        const item = localStorage.getItem(key);
        if (item && item.includes('access_token')) {
          return true;
        }
      }
    }
  } catch {
    // ignore
  }
  return false;
}

/**
 * Détermine l'onglet principal et le sous-onglet du Studio à partir du hash URL,
 * du stockage local et du statut d'authentification.
 */
function parseInitialRoute(): { activeTab: MainTab; studioSubTab: StudioTab } {
  if (typeof window === 'undefined') {
    return { activeTab: 'home', studioSubTab: 'studio_ai' };
  }

  const rawHash = window.location.hash.toLowerCase().replace('#', '').trim();
  const pathname = window.location.pathname;

  // 1. Navigation explicite par hash dans l'URL
  if (rawHash === 'decouvrir' || pathname === '/decouvrir') {
    return { activeTab: 'decouvrir', studioSubTab: 'studio_ai' };
  }
  if (rawHash === 'cockpit' || rawHash === 'revenus') {
    return { activeTab: 'cockpit', studioSubTab: 'revenus' };
  }
  if (rawHash === 'ventes' || rawHash === 'caisse') {
    return { activeTab: 'cockpit', studioSubTab: 'ventes' };
  }
  if (rawHash === 'copilot' || rawHash === 'analyste') {
    return { activeTab: 'copilot', studioSubTab: 'analyste' };
  }
  if (rawHash === 'academy' || rawHash === 'formation') {
    return { activeTab: 'academy', studioSubTab: 'academy' };
  }
  if (rawHash === 'studio' || rawHash === 'atelier' || rawHash === 'studio_ai') {
    return { activeTab: 'studio', studioSubTab: 'studio_ai' };
  }
  if (rawHash === 'conversations' || rawHash === 'discussions' || rawHash === 'messages') {
    return { activeTab: 'studio', studioSubTab: 'conversations' };
  }
  if (rawHash === 'pipeline') {
    return { activeTab: 'studio', studioSubTab: 'pipeline' };
  }
  if (rawHash === 'playground' || rawHash === 'play' || rawHash === 'simulateur') {
    return { activeTab: 'studio', studioSubTab: 'playground' };
  }
  if (rawHash === 'whatsapp') {
    return { activeTab: 'studio', studioSubTab: 'whatsapp' };
  }
  if (rawHash === 'automations') {
    return { activeTab: 'studio', studioSubTab: 'automations' };
  }
  if (rawHash === 'profile') {
    return { activeTab: 'studio', studioSubTab: 'profile' };
  }
  if (rawHash === 'admin') {
    return { activeTab: 'studio', studioSubTab: 'admin' };
  }
  if (rawHash === 'home' || rawHash === 'accueil') {
    return { activeTab: 'home', studioSubTab: 'studio_ai' };
  }

  // 2. Restauration depuis localStorage si l'utilisateur était déjà dans une vue de travail
  try {
    const savedActive = localStorage.getItem('velaris_active_tab') as MainTab | null;
    const savedSubTab = localStorage.getItem('velaris_studio_subtab') as StudioTab | null;

    if (savedActive && ['studio', 'cockpit', 'academy', 'copilot', 'decouvrir'].includes(savedActive)) {
      return {
        activeTab: savedActive,
        studioSubTab: savedSubTab || (savedActive === 'cockpit' ? 'revenus' : savedActive === 'copilot' ? 'analyste' : savedActive === 'academy' ? 'academy' : 'studio_ai'),
      };
    }
  } catch {
    // ignore
  }

  // 3. Utilisateur déjà connecté arrivant sur la racine -> redirection automatique vers l'Atelier
  if (checkHasSavedAuthSession()) {
    return { activeTab: 'studio', studioSubTab: 'studio_ai' };
  }

  return { activeTab: 'home', studioSubTab: 'studio_ai' };
}

export function App() {
  const { user, isDemoMode } = useAuth();
  const sessionName = user ? (`studio_${user.id.slice(0, 8)}`) : 'Test';
  // Visiteurs non connectés : aucune sonde WAHA (le site public ne doit pas solliciter la passerelle)
  const waha = useWahaSession(sessionName, { enabled: !!user, syncToStudio: true });

  const initialRoute = useMemo(() => parseInitialRoute(), []);
  const [activeTab, setActiveTab] = useState<MainTab>(initialRoute.activeTab);
  const [studioSubTab, setStudioSubTab] = useState<StudioTab>(initialRoute.studioSubTab);

  // Détection du mode d'écoute publique sécurisé (?listen=...)
  const [listenShareData, setListenShareData] = useState<ProtectedShareData | null>(null);
  const [isLoadingListen, setIsLoadingListen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    return Boolean(urlParams.get('listen'));
  });

  useEffect(() => {
    let isMounted = true;
    const checkAndLoadListen = async () => {
      if (typeof window === 'undefined') return;
      const urlParams = new URLSearchParams(window.location.search);
      const listenId = urlParams.get('listen');
      if (!listenId) {
        if (isMounted) {
          setListenShareData(null);
          setIsLoadingListen(false);
        }
        return;
      }

      if (isMounted) setIsLoadingListen(true);
      const record = await getSharedTrackById(listenId);
      if (!isMounted) return;

      if (record) {
        setListenShareData({
          id: record.id,
          recipient: record.recipient,
          occasion: record.occasion,
          studioName: record.studio_name,
          creatorPhone: record.creator_phone,
          track1Title: record.track1_title,
          track1Url: record.track1_url,
          track2Title: record.track2_title,
          track2Url: record.track2_url,
          allowDownload: record.allow_download,
          createdAt: record.created_at || new Date().toISOString(),
        });
      } else {
        setListenShareData(null);
      }
      setIsLoadingListen(false);
    };

    void checkAndLoadListen();
    window.addEventListener('popstate', checkAndLoadListen);
    return () => {
      isMounted = false;
      window.removeEventListener('popstate', checkAndLoadListen);
    };
  }, []);

  // Mémorise si l'utilisateur connecté a délibérément cliqué sur "Retour à la vitrine"
  const userExplicitlyNavigatedToHomeRef = useRef<boolean>(
    typeof window !== 'undefined' && (window.location.hash === '#home' || window.location.hash === '#accueil')
  );

  // Synchronisation unifiée de la navigation (State, Hash URL, LocalStorage)
  const changeTab = useCallback((tab: MainTab, subTab?: StudioTab) => {
    setActiveTab(tab);

    const resolvedSubTab: StudioTab = subTab || (
      tab === 'cockpit' ? 'revenus' :
      tab === 'copilot' ? 'analyste' :
      tab === 'academy' ? 'academy' :
      tab === 'studio' ? (studioSubTab || 'studio_ai') :
      'studio_ai'
    );
    setStudioSubTab(resolvedSubTab);

    if (tab !== 'home') {
      userExplicitlyNavigatedToHomeRef.current = false;
    }

    try {
      localStorage.setItem('velaris_active_tab', tab);
      if (tab !== 'home') {
        localStorage.setItem('velaris_studio_subtab', resolvedSubTab);
      }
    } catch {
      // ignore
    }

    // Détermination et application du hash URL
    if (typeof window !== 'undefined') {
      let targetHash = '';
      if (tab === 'studio') {
        targetHash = resolvedSubTab === 'studio_ai' ? 'studio' : resolvedSubTab;
      } else if (tab === 'cockpit') {
        targetHash = resolvedSubTab === 'ventes' ? 'ventes' : 'cockpit';
      } else if (tab === 'academy') {
        targetHash = 'academy';
      } else if (tab === 'copilot') {
        targetHash = 'copilot';
      } else if (tab === 'decouvrir') {
        targetHash = 'decouvrir';
      } else if (tab === 'home') {
        targetHash = userExplicitlyNavigatedToHomeRef.current ? 'home' : '';
      }

      if (targetHash) {
        if (window.location.hash !== `#${targetHash}`) {
          window.location.hash = targetHash;
        }
      } else {
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
    }
  }, [studioSubTab]);

  // Initialisation du hash URL au montage si absent mais résolu sur studio/cockpit
  useEffect(() => {
    if (typeof window !== 'undefined' && (!window.location.hash || window.location.hash === '#')) {
      if (activeTab === 'studio') {
        window.location.hash = studioSubTab === 'studio_ai' ? 'studio' : studioSubTab;
      } else if (activeTab === 'cockpit') {
        window.location.hash = studioSubTab === 'ventes' ? 'ventes' : 'cockpit';
      } else if (activeTab === 'copilot') {
        window.location.hash = 'copilot';
      } else if (activeTab === 'academy') {
        window.location.hash = 'academy';
      }
    }
  }, []);

  // Redirection automatique des utilisateurs connectés vers l'Atelier dès confirmation de la session
  useEffect(() => {
    if (user && activeTab === 'home' && !userExplicitlyNavigatedToHomeRef.current) {
      changeTab('studio', 'studio_ai');
    }
  }, [user, activeTab, changeTab]);

  // Écoute des bascules Back / Forward du navigateur
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseInitialRoute();
      setActiveTab(route.activeTab);
      setStudioSubTab(route.studioSubTab);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Action explicite de retour à la vitrine
  const handleReturnToHome = useCallback(() => {
    userExplicitlyNavigatedToHomeRef.current = true;
    changeTab('home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [changeTab]);
  
  const storageKey = user ? `velaris_studio_orders_${user.id}` : 'velaris_studio_orders_demo';

  // Nettoyage proactif de tout résidu de commandes démo pour garantir un site vierge
  useEffect(() => {
    try {
      localStorage.removeItem('velaris_studio_orders_demo');
    } catch {
      // ignore
    }
  }, []);

  // Initialize orders with user-scoped persistence (starts clean)
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      if (user) {
        const saved = localStorage.getItem(`velaris_studio_orders_${user.id}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      }
    } catch {
      // ignore
    }
    return [];
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => orders[0]?.id || '');
  const [manualConnected, setManualConnected] = useState<boolean | null>(null);
  const isWhatsAppConnected = manualConnected !== null ? manualConnected : waha.isOnline;
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);

  // Sync to user-specific localStorage (only for authenticated studios)
  useEffect(() => {
    if (!user) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    } catch {
      // storage quota or private browsing
    }
  }, [orders, storageKey, user]);

  // Realtime synchronization of live orders from Supabase
  useEffect(() => {
    if (!user) {
      setOrders([]);
      setSelectedOrderId('');
      return;
    }

    let isMounted = true;
    const loadOrders = async () => {
      const live = await getLiveOrders();
      if (!isMounted) return;
      setOrders(live || []);
      setSelectedOrderId(prev => {
        if (prev && live.some(o => o.id === prev)) return prev;
        return live[0]?.id || '';
      });
    };

    loadOrders();

    // Abonnement Supabase Realtime aux modifications des commandes et contacts
    const unsubscribe = subscribeStudioRealtime(['orders', 'contacts'], () => {
      loadOrders();
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [user, isDemoMode]);

  // Dynamic metrics: computed from user's live studio orders (starts strictly at zero for new users)
  const currentMetrics: StudioMetrics = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'livre');
    const active = orders.filter((o) => o.status !== 'livre');
    const totalRevenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);

    return {
      totalRevenue,
      ordersDelivered: delivered.length,
      ordersActive: active.length,
      adLeadsCount: 0,
      conversionRate: orders.length > 0 ? Math.round((delivered.length / orders.length) * 100) : 0,
      currency: 'FCFA',
    };
  }, [orders]);

  // Switch to studio with a specific order
  const handleSelectOrderForStudio = (orderId: string) => {
    setSelectedOrderId(orderId);
    changeTab('studio', 'studio_ai');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update order in state and persist to Supabase
  const handleUpdateOrder = (updated: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
    if (user && updated.id) {
      updateLiveOrder(updated.id, {
        status: updated.status,
        lyrics: updated.lyrics,
      }).catch(console.error);
    }
  };

  // Add new order from modal
  const handleAddNewOrder = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrderId(newOrder.id);
    changeTab('studio', 'studio_ai');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Asynchronously persist to Supabase under the authenticated studio
    if (user) {
      createLiveOrder({
        clientName: newOrder.clientName,
        clientPhone: newOrder.clientPhone,
        occasion: newOrder.occasion,
        amount: newOrder.amount,
        paymentMethod: newOrder.paymentMethod,
        status: newOrder.status,
      }).catch(console.error);
    }
  };

  if (isLoadingListen) {
    return (
      <div className="min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center space-y-4 font-sans select-none">
        <div className="h-10 w-10 rounded-full border-2 border-white/20 border-t-[#E5B54F] animate-spin" />
        <p className="font-mono text-xs uppercase tracking-widest text-neutral-400">
          Studio Velaris · Connexion à la session d'écoute privée…
        </p>
      </div>
    );
  }

  if (listenShareData) {
    return (
      <ProtectedStreamView
        data={listenShareData}
        onClose={() => {
          setListenShareData(null);
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, '', cleanUrl);
        }}
      />
    );
  }

  const hasListenParam = typeof window !== 'undefined' && Boolean(new URLSearchParams(window.location.search).get('listen'));
  if (hasListenParam && !listenShareData) {
    return (
      <div className="min-h-screen bg-[#050608] text-white flex flex-col items-center justify-center px-6 text-center space-y-4 font-sans select-none">
        <div className="h-14 w-14 rounded-full border border-white/10 bg-white/[0.03] flex items-center justify-center text-neutral-400">
          <ShieldCheck className="h-6 w-6 text-[#E5B54F]" />
        </div>
        <h2 className="text-xl font-bold text-white">Lien d'écoute introuvable ou expiré</h2>
        <p className="text-sm text-neutral-400 max-w-md">
          Ce lien de streaming privé n'est plus accessible ou a été supprimé par le studio.
        </p>
        <button
          type="button"
          onClick={() => {
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, '', cleanUrl);
            window.location.href = cleanUrl;
          }}
          className="rounded-full bg-white px-5 py-2.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer"
        >
          Retour au studio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#07080a] text-[#e8eaed] font-sans selection:bg-white/20 selection:text-white relative">
      <CosmicBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Public Navigation Bar (only on home & decouvrir) */}
        {(activeTab === 'home' || activeTab === 'decouvrir') && (
          <Navbar
            activeTab={activeTab}
            setActiveTab={(tab) => {
              if (tab === 'qr') {
                setIsQrModalOpen(true);
              } else {
                changeTab(tab);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            isWhatsAppConnected={isWhatsAppConnected}
            onOpenQrModal={() => setIsQrModalOpen(true)}
            onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
          />
        )}

        {/* Main Content Area */}
        {activeTab === 'home' && (
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 pt-6">
            <LandingPage
              onOpenStudio={() => {
                changeTab('studio', 'studio_ai');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenCockpit={() => {
                changeTab('cockpit', 'revenus');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenAcademy={() => {
                changeTab('academy', 'academy');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenCopilot={() => {
                changeTab('copilot', 'analyste');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            />
          </main>
        )}

        {activeTab === 'decouvrir' && (
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 pt-6">
            <DecouvrirView />
          </main>
        )}

        {/* Interior Studio OS (Cockpit, Copilot IA, Studio IA, Discussions, Pipeline, Automations, WhatsApp Lines) */}
        {(activeTab === 'cockpit' || activeTab === 'studio' || activeTab === 'academy' || activeTab === 'copilot') && (
          <div className="w-full flex-1">
            <StudioAppLayout
              initialTab={studioSubTab}
              onTabChange={(tab) => {
                if (tab === 'revenus' || tab === 'ventes') {
                  changeTab('cockpit', tab);
                } else if (tab === 'analyste') {
                  changeTab('copilot', tab);
                } else if (tab === 'academy') {
                  changeTab('academy', tab);
                } else {
                  changeTab('studio', tab);
                }
              }}
              orders={orders}
              metrics={currentMetrics}
              onReturnToHome={handleReturnToHome}
              onSelectOrderForStudio={handleSelectOrderForStudio}
              onOpenQrModal={() => setIsQrModalOpen(true)}
              onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
              renderStudioAI={() => (
                <StudioView
                  key={selectedOrderId}
                  orders={orders}
                  selectedOrderId={selectedOrderId}
                  onSelectOrder={setSelectedOrderId}
                  onUpdateOrder={handleUpdateOrder}
                />
              )}
              renderAcademy={() => (
                <AcademyView modules={ACADEMY_MODULES} />
              )}
            />
          </div>
        )}
      </div>

      {/* QR Code Pairing Modal */}
      <QrConnectModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        sessionName={sessionName}
        isWhatsAppConnected={isWhatsAppConnected}
        setIsWhatsAppConnected={setManualConnected}
      />

      {/* New Order / Lead Modal */}
      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onAddOrder={handleAddNewOrder}
      />

      {/* Authentication & Studio Creation Modal */}
      <AuthModal />
    </div>
  );
}

export default App;
