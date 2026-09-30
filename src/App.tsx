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

const STORAGE_KEY = 'velaris_studio_orders_v1';

export function App() {
  const waha = useWahaSession('Test');

  // Support #decouvrir or default to home
  const [activeTab, setActiveTab] = useState<'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir'>(() => {
    if (typeof window !== 'undefined' && (window.location.hash === '#decouvrir' || window.location.pathname === '/decouvrir')) {
      return 'decouvrir';
    }
    return 'home';
  });
  
  // Initialize orders with localStorage persistence
  const [orders, setOrders] = useState<Order[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // ignore JSON parse error
    }
    return INITIAL_ORDERS;
  });

  const [selectedOrderId, setSelectedOrderId] = useState<string>(() => orders[0]?.id || INITIAL_ORDERS[0].id);
  const [manualConnected, setManualConnected] = useState<boolean | null>(null);
  const { user } = useAuth();
  const isWhatsAppConnected = manualConnected !== null ? manualConnected : waha.isOnline;
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState<boolean>(false);

  // Sync to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
    } catch {
      // storage quota or private browsing
    }
  }, [orders]);

  // Fetch user-specific orders from Supabase when logged in (isolated via RLS)
  useEffect(() => {
    if (user) {
      getLiveOrders().then((live) => {
        if (live && live.length > 0) {
          setOrders(live);
          setSelectedOrderId(live[0].id);
        }
      });
    }
  }, [user]);

  // Compute dynamic metrics from verified real production data
  const currentMetrics: StudioMetrics = useMemo(() => {
    return {
      ...REAL_STUDIO_METRICS,
      totalRevenue: REAL_STUDIO_METRICS.totalRevenue,
      currency: 'FCFA',
    };
  }, []);

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
                setActiveTab('studio');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenCockpit={() => {
                setActiveTab('cockpit');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onOpenAcademy={() => {
                setActiveTab('academy');
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

        {/* Interior Studio OS (Cockpit, Studio IA, Discussions, Pipeline, Automations, WhatsApp Lines) */}
        {(activeTab === 'cockpit' || activeTab === 'studio' || activeTab === 'academy') && (
          <div className="w-full flex-1">
            <StudioAppLayout
              initialTab={activeTab === 'cockpit' ? 'revenus' : activeTab === 'studio' ? 'studio_ai' : 'academy'}
              orders={orders}
              metrics={currentMetrics}
              onReturnToHome={() => {
                setActiveTab('home');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onSelectOrderForStudio={handleSelectOrderForStudio}
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
