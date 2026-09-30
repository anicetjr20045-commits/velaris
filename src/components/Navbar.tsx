import type { FC } from 'react';
import { 
  Radio, 
  Sparkles, 
  LayoutDashboard, 
  Music, 
  GraduationCap, 
  QrCode, 
  CheckCircle2,
  Home
} from 'lucide-react';

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
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.06] bg-[#07080b]/80 backdrop-blur-2xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo & Brand */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.06] border border-white/[0.1] shadow-inner group-hover:border-white/20 transition-all">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base sm:text-lg font-bold tracking-tight text-white font-['Plus_Jakarta_Sans',sans-serif]">
                  Velaris
                </span>
                <span className="rounded-full bg-white/[0.06] border border-white/[0.08] px-2 py-0.5 text-[10px] font-medium text-white/70">
                  Studio OS
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/[0.03] p-1 border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'home'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Home className="h-3.5 w-3.5" />
              Accueil
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'studio'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
              Studio 1-Clic
            </button>
            <button
              onClick={() => setActiveTab('cockpit')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'cockpit'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              Cockpit Ventes
            </button>
            <button
              onClick={() => setActiveTab('academy')}
              className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                activeTab === 'academy'
                  ? 'bg-white text-black font-semibold shadow-sm'
                  : 'text-white/60 hover:text-white hover:bg-white/[0.04]'
              }`}
            >
              <GraduationCap className="h-3.5 w-3.5" />
              Académie
            </button>
          </nav>

          {/* Actions: WhatsApp status & White Pill CTA */}
          <div className="flex items-center gap-3">
            <button
              onClick={onOpenQrModal}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isWhatsAppConnected
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-white/10 bg-white/[0.04] text-white/70 hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {isWhatsAppConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="font-medium hidden lg:inline">WhatsApp Connecté</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </>
              ) : (
                <>
                  <Radio className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  <span className="font-medium">Scanner QR</span>
                  <QrCode className="h-3.5 w-3.5 opacity-70 group-hover:scale-110 transition-transform" />
                </>
              )}
            </button>

            <button
              onClick={() => setActiveTab('studio')}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 text-xs font-semibold text-black hover:bg-neutral-200 transition-all shadow-[0_0_20px_rgba(255,255,255,0.15)] hover:scale-105 active:scale-95"
            >
              <span>Accéder au Studio</span>
              <span className="text-[10px]">↗</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Bar for Smartphone Ergonomics */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-white/[0.06] bg-[#07080b]/90 backdrop-blur-2xl px-2 py-2 safe-area-bottom">
        <div className="flex w-full items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'home'
                ? 'text-white font-semibold'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Home className="h-4 w-4" />
            <span className="text-[10px]">Accueil</span>
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'studio'
                ? 'text-white font-semibold'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <Music className="h-4 w-4" />
            <span className="text-[10px]">Studio</span>
          </button>
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'cockpit'
                ? 'text-white font-semibold'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="text-[10px]">Cockpit</span>
          </button>
          <button
            onClick={() => setActiveTab('academy')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'academy'
                ? 'text-white font-semibold'
                : 'text-white/40 hover:text-white'
            }`}
          >
            <GraduationCap className="h-4 w-4" />
            <span className="text-[10px]">Académie</span>
          </button>
          <button
            onClick={onOpenQrModal}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              isWhatsAppConnected ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span className="text-[10px]">QR Code</span>
          </button>
        </div>
      </div>
    </>
  );
};
