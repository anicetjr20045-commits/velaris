import { useState } from 'react';
import { Navbar } from './components/Navbar';
import { CockpitView } from './components/CockpitView';
import { StudioView } from './components/StudioView';
import { AcademyView } from './components/AcademyView';
import { QrConnectModal } from './components/QrConnectModal';
import { INITIAL_METRICS, INITIAL_ORDERS, ACADEMY_MODULES } from './data/mockData';
import type { Order } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'cockpit' | 'studio' | 'academy' | 'qr'>('cockpit');
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [selectedOrderId, setSelectedOrderId] = useState<string>(INITIAL_ORDERS[0].id);
  const [isWhatsAppConnected, setIsWhatsAppConnected] = useState<boolean>(true);
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);

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

  return (
    <div className="min-h-screen bg-[#08090d] text-[#e5e7eb] font-sans selection:bg-[#d4af37]/30 selection:text-[#f3e5ab]">
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
        />

        {/* Main Content Area */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 pt-6">
          {activeTab === 'cockpit' && (
            <CockpitView
              metrics={INITIAL_METRICS}
              orders={orders}
              onSelectOrderForStudio={handleSelectOrderForStudio}
              onOpenQrModal={() => setIsQrModalOpen(true)}
            />
          )}

          {activeTab === 'studio' && (
            <StudioView
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
    </div>
  );
}

export default App;
