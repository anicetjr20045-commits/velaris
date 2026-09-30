import type { FC } from 'react';

interface NavbarProps {
  activeTab: 'home' | 'cockpit' | 'studio' | 'academy' | 'qr';
  setActiveTab: (tab: 'home' | 'cockpit' | 'studio' | 'academy' | 'qr') => void;
  isWhatsAppConnected: boolean;
  onOpenQrModal: () => void;
  onOpenNewOrderModal?: () => void;
}

export const Navbar: FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isWhatsAppConnected,
  onOpenQrModal,
}) => {
  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.07] bg-[#050608]/85 backdrop-blur-2xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
          {/* Logo & Brand */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group select-none"
          >
            {/* Minimalist Acoustic Emblem */}
            <div className="flex h-7 w-7 items-center justify-center rounded-full border border-white/20 bg-white/[0.04] transition-colors group-hover:border-white/50">
              <span className="h-2 w-2 rounded-full bg-white" />
            </div>

            <div className="flex items-baseline gap-2">
              <span className="font-heading text-lg font-bold tracking-tight text-white">
                VELARIS
              </span>
              <span className="text-[10px] tracking-widest text-neutral-400 uppercase font-medium">
                Studio
              </span>
            </div>
          </div>

          {/* Desktop Navigation: Pure Minimalist Typography */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-medium tracking-tight">
            <button
              onClick={() => setActiveTab('home')}
              className={`transition-colors py-1 relative ${
                activeTab === 'home'
                  ? 'text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Accueil
              {activeTab === 'home' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className={`transition-colors py-1 relative ${
                activeTab === 'studio'
                  ? 'text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Atelier de composition
              {activeTab === 'studio' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('cockpit')}
              className={`transition-colors py-1 relative ${
                activeTab === 'cockpit'
                  ? 'text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Cockpit des ventes
              {activeTab === 'cockpit' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('academy')}
              className={`transition-colors py-1 relative ${
                activeTab === 'academy'
                  ? 'text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Académie
              {activeTab === 'academy' && (
                <span className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-white rounded-full" />
              )}
            </button>
          </nav>

          {/* Right Actions: Professional Status & Sharp Action */}
          <div className="flex items-center gap-4">
            <button
              onClick={onOpenQrModal}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition-colors ${
                isWhatsAppConnected
                  ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400 hover:bg-emerald-500/10'
                  : 'border-white/10 bg-white/[0.02] text-neutral-400 hover:text-white hover:border-white/20'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isWhatsAppConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span className="font-medium text-[11px]">
                {isWhatsAppConnected ? 'Ligne WhatsApp active' : 'Connecter WhatsApp'}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className="hidden sm:inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-neutral-200 active:scale-95"
            >
              Ouvrir l'atelier
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Bar: Pure & Architectural */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-white/[0.08] bg-[#050608]/95 backdrop-blur-2xl px-4 py-2.5 safe-area-bottom">
        <div className="flex w-full items-center justify-around text-[11px] font-medium">
          <button
            onClick={() => setActiveTab('home')}
            className={`px-2 py-1 transition-colors ${
              activeTab === 'home' ? 'text-white font-bold' : 'text-neutral-500'
            }`}
          >
            Accueil
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`px-2 py-1 transition-colors ${
              activeTab === 'studio' ? 'text-white font-bold' : 'text-neutral-500'
            }`}
          >
            Atelier
          </button>
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`px-2 py-1 transition-colors ${
              activeTab === 'cockpit' ? 'text-white font-bold' : 'text-neutral-500'
            }`}
          >
            Cockpit
          </button>
          <button
            onClick={() => setActiveTab('academy')}
            className={`px-2 py-1 transition-colors ${
              activeTab === 'academy' ? 'text-white font-bold' : 'text-neutral-500'
            }`}
          >
            Académie
          </button>
        </div>
      </div>
    </>
  );
};
