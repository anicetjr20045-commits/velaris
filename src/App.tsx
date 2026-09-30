import { useState, useEffect, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { CockpitView } from './components/CockpitView';
import { StudioView } from './components/StudioView';
import { AcademyView } from './components/AcademyView';
import { QrConnectModal } from './components/QrConnectModal';
import { NewOrderModal } from './components/NewOrderModal';
import { INITIAL_METRICS, INITIAL_ORDERS, ACADEMY_MODULES } from './data/mockData';
import type { Order, StudioMetrics } from './types';

const STORAGE_KEY = 'velaris_studio_orders_v1';

export function App() {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'studio' | 'academy' | 'qr'>('cockpit');
  
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
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState<boolean>(true);
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

  // Compute dynamic metrics in real time
  const currentMetrics: StudioMetrics = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => {
      // Comptabiliser les commandes payées ou livrées
      return sum + (o.amount || 0);
    }, 0);

    const deliveredCount = orders.filter((o) => o.status === 'livre').length;
    const activeCount = orders.filter((o) => o.status !== 'livre').length;
    const totalLeads = INITIAL_METRICS.adLeadsCount + (orders.length - INITIAL_ORDERS.length);
    const conversion = totalLeads > 0 ? Math.round((orders.length / totalLeads) * 1000) / 10 : 39.4;

    return {
      totalRevenue: Math.max(INITIAL_METRICS.totalRevenue, totalRevenue * 40), // Base de volume studio
      ordersDelivered: INITIAL_METRICS.ordersDelivered + deliveredCount,
      ordersActive: activeCount,
      adLeadsCount: totalLeads,
      conversionRate: Math.min(95, Math.max(25, conversion)),
      currency: 'FCFA',
    };
  }, [orders]);

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
  };

  return (
    <div className="min-h-screen bg-[#08090d] text-[#e5c158] font-sans selection:bg-[#d4af37]/30 selection:text-[#f3e5ab]">
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-[#d4af37]/5 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 h-[600px] w-[600px] rounded-full bg-purple-500/5 blur-[140px]" />
      </div>

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Navigation Bar */}
        <Navbar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            if (tab === 'qr') {
              setIsQrModalOpen(true);
            } else {
              setActiveTab(tab);
            }
          }}
          isWhatsAppConnected={isWhatsAppConnected}
          onOpenQrModal={() => setIsQrModalOpen(true)}
          onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
        />

        {/* Main Content Area */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 pt-6">
          {activeTab === 'cockpit' && (
            <CockpitView
              metrics={currentMetrics}
              orders={orders}
              onSelectOrderForStudio={handleSelectOrderForStudio}
              onOpenQrModal={() => setIsQrModalOpen(true)}
              onOpenNewOrderModal={() => setIsNewOrderModalOpen(true)}
            />
          )}

          {activeTab === 'studio' && (
            <StudioView
              key={selectedOrderId}
              orders={orders}
              selectedOrderId={selectedOrderId}
              onSelectOrder={setSelectedOrderId}
              onUpdateOrder={handleUpdateOrder}
            />
          )}

          {activeTab === 'academy' && (
            <AcademyView modules={ACADEMY_MODULES} />
          )}
        </main>
      </div>

      {/* QR Code Pairing Modal */}
      <QrConnectModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
        isWhatsAppConnected={isWhatsAppConnected}
        setIsWhatsAppConnected={setIsWhatsAppConnected}
      />

      {/* New Order / Lead Modal */}
      <NewOrderModal
        isOpen={isNewOrderModalOpen}
        onClose={() => setIsNewOrderModalOpen(false)}
        onAddOrder={handleAddNewOrder}
      />
    </div>
  );
}

export default App;
