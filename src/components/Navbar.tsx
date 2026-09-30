import type { FC } from 'react';
import { 
  Radio, 
  Sparkles, 
  LayoutDashboard, 
  Music, 
  GraduationCap, 
  QrCode, 
  CheckCircle2,
  Home,
  MessageCircle
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
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#090a0f]/90 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          {/* Logo & Brand */}
          <div 
            onClick={() => setActiveTab('home')}
            className="flex items-center gap-3 cursor-pointer"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#d4af37] via-[#c59e2b] to-[#8f6d14] shadow-[0_0_20px_rgba(212,175,55,0.25)]">
              <Sparkles className="h-5 w-5 text-black" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-['Space_Grotesk'] text-xl font-bold tracking-tight text-white">
                  VELARIS
                </span>
                <span className="rounded-full bg-[#d4af37]/15 px-2 py-0.5 text-[10px] font-semibold text-[#e5c158] border border-[#d4af37]/30">
                  STUDIO MUSICAL
                </span>
              </div>
              <p className="text-[11px] font-medium text-white/50 hidden sm:block">
                Chansons Personnalisées & Production IA
              </p>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 rounded-2xl bg-white/[0.04] p-1.5 border border-white/[0.06]">
            <button
              onClick={() => setActiveTab('home')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'home'
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#e5c158] text-black shadow-md'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Home className="h-4 w-4" />
              Accueil
            </button>
            <button
              onClick={() => setActiveTab('studio')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'studio'
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#e5c158] text-black shadow-md'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <Music className="h-4 w-4" />
              Studio 1-Clic
            </button>
            <button
              onClick={() => setActiveTab('cockpit')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'cockpit'
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#e5c158] text-black shadow-md'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <LayoutDashboard className="h-4 w-4" />
              Cockpit Ventes
            </button>
            <button
              onClick={() => setActiveTab('academy')}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                activeTab === 'academy'
                  ? 'bg-gradient-to-r from-[#d4af37] to-[#e5c158] text-black shadow-md'
                  : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}
            >
              <GraduationCap className="h-4 w-4" />
              Académie
            </button>
          </nav>

          {/* Actions: Commander WhatsApp & WhatsApp Status */}
          <div className="flex items-center gap-2.5">
            <a
              href="https://wa.me/22656240533?text=Bonjour%20le%20Studio%20Velaris%20!%20Je%20souhaite%20commander%20une%20chanson%20personnalis%C3%A9e."
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 rounded-full bg-gradient-to-r from-[#d4af37] via-[#e5c158] to-[#c59e2b] px-4 py-2 text-xs font-bold text-black shadow-md hover:scale-105 active:scale-95 transition-all"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Commander sur WhatsApp</span>
            </a>

            <button
              onClick={onOpenQrModal}
              className={`group flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all ${
                isWhatsAppConnected
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
              }`}
            >
              {isWhatsAppConnected ? (
                <>
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                  </span>
                  <span className="font-semibold tracking-wide hidden lg:inline">WhatsApp Actif</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                </>
              ) : (
                <>
                  <Radio className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  <span className="font-semibold">Scanner QR</span>
                  <QrCode className="h-3.5 w-3.5 opacity-70 group-hover:scale-110 transition-transform" />
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Bar for Smartphone Ergonomics */}
      <div className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-white/[0.08] bg-[#090a0f]/95 backdrop-blur-2xl px-2 py-2 safe-area-bottom">
        <div className="flex w-full items-center justify-around">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'home'
                ? 'text-[#e5c158] font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Home className="h-5 w-5" />
            <span className="text-[10px]">Accueil</span>
          </button>
          <button
            onClick={() => setActiveTab('studio')}
            className={`relative flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'studio'
                ? 'text-[#e5c158] font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <Music className="h-5 w-5" />
            <span className="text-[10px]">Studio</span>
          </button>
          <button
            onClick={() => setActiveTab('cockpit')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'cockpit'
                ? 'text-[#e5c158] font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-[10px]">Cockpit</span>
          </button>
          <button
            onClick={() => setActiveTab('academy')}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              activeTab === 'academy'
                ? 'text-[#e5c158] font-bold'
                : 'text-white/50 hover:text-white'
            }`}
          >
            <GraduationCap className="h-5 w-5" />
            <span className="text-[10px]">Académie</span>
          </button>
          <button
            onClick={onOpenQrModal}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              isWhatsAppConnected ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            <QrCode className="h-5 w-5" />
            <span className="text-[10px]">QR Code</span>
          </button>
        </div>
      </div>
    </>
  );
};
