import { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { StudioView } from './components/StudioView';
import { AcademyView } from './components/AcademyView';
import { DecouvrirView } from './components/DecouvrirView';
import { StudioAppLayout } from './components/StudioAppLayout';
import { QrConnectModal } from './components/QrConnectModal';
import { NewOrderModal } from './components/NewOrderModal';
import { AuthModal } from './components/AuthModal';
import { CosmicBackground } from './components/CosmicBackground';
import { INITIAL_ORDERS, ACADEMY_MODULES } from './data/mockData';
import { REAL_STUDIO_METRICS } from './data/realProductionData';
import { useWahaSession } from './hooks/useWaha';
import { useAuth } from './hooks/useAuth';
import { getLiveOrders, createLiveOrder } from './services/supabase';
import type { Order, StudioMetrics } from './types';

export function App() {
  const { user, openAuthModal, isDemoMode } = useAuth();
  const sessionName = user ? (`studio_${user.id.slice(0, 8)}`) : 'Test';
  const waha = useWahaSession(sessionName);

  // Support #copilot, #analyste, #studio, #cockpit, #decouvrir or default to home
  const [activeTab, setActiveTab] = useState<'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir' | 'copilot'>(() => {
    if (typeof window !== 'undefined') {
      const h = window.location.hash;
      if (h === '#copilot' || h === '#analyste') return 'copilot';
      if (h === '#studio') return 'studio';
      if (h === '#cockpit') return 'cockpit';
      if (h === '#decouvrir' || window.location.pathname === '/decouvrir') return 'decouvrir';
    }
    return 'home';
  });
  
  const storageKey = user ? `velaris_studio_orders_${user.id}` : 'velaris_studio_orders_demo';

  // Initialize orders with user-scoped or demo persistence
  const [orders, setOrders] = useState<Order[]>(() => {
    if (typeof window === 'undefined') return INITIAL_ORDERS;
    try {
      const saved = localStorage.getItem('velaris_studio_orders_demo');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_ORDERS;
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => orders[0]?.id || INITIAL_ORDERS[0].id);
  const [manualConnected, setManualConnected] = useState<boolean | null>(null);
  const isWhatsAppConnected = manualConnected !== null ? manualConnected : waha.isOnline;
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);

  // Sync to user-specific or demo localStorage
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(orders));
    } catch {
      // storage quota or private browsing
    }
  }, [orders, storageKey]);

  // Fetch strictly isolated orders from Supabase when logged in
  useEffect(() => {
    if (user) {
      getLiveOrders().then((live) => {
        setOrders(live || []);
        if (live && live.length > 0) {
          setSelectedOrderId(live[0].id);
        } else {
          setSelectedOrderId('');
        }
      });
    } else if (isDemoMode) {
      setOrders(INITIAL_ORDERS);
      setSelectedOrderId(INITIAL_ORDERS[0].id);
    }
  }, [user, isDemoMode]);

  // Dynamic metrics: computed from user's live studio orders, or demo metrics if visitor
  const currentMetrics: StudioMetrics = useMemo(() => {
    if (!user) {
      return {
        ...REAL_STUDIO_METRICS,
        currency: 'FCFA',
      };
    }

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
  }, [user, orders]);

  // Switch to studio with a specific order
  const handleSelectOrderForStudio = (orderId: string) => {
    setSelectedOrderId(orderId);
    setActiveTab('studio');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Update order in state
  const handleUpdateOrder = (updated: Order) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === updated.id ? updated : o))
    );
  };

  // Add new order from modal
  const handleAddNewOrder = (newOrder: Order) => {
    setOrders((prev) => [newOrder, ...prev]);
    setSelectedOrderId(newOrder.id);
    setActiveTab('studio');
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
                setActiveTab(tab);
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
                if (!user && !isDemoMode) {
                  openAuthModal('login');
                  return;
                }
                setActiveTab('studio');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenCockpit={() => {
                if (!user && !isDemoMode) {
                  openAuthModal('login');
                  return;
                }
                setActiveTab('cockpit');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenAcademy={() => {
                setActiveTab('academy');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenCopilot={() => {
                setActiveTab('copilot');
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
              initialTab={activeTab === 'copilot' ? 'analyste' : activeTab === 'cockpit' ? 'revenus' : activeTab === 'studio' ? 'studio_ai' : 'academy'}
              orders={orders}
              metrics={currentMetrics}
              onReturnToHome={() => {
                setActiveTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
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
