import { useState, type FC } from 'react';
import { Menu, X, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

interface NavbarProps {
  activeTab: 'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir';
  setActiveTab: (tab: 'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir') => void;
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
  const { user, openAuthModal } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleNavClick = (tab: 'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir') => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const WHATSAPP_URL = 'https://wa.me/22656240533?text=' + encodeURIComponent('Bonjour Velaris, je souhaite créer une chanson personnalisée.');

  return (
    <>
      {/* Top Header */}
      <header className="sticky top-0 z-40 w-full border-b border-white/[0.08] bg-[#08080a]/90 backdrop-blur-2xl transition-all">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8 gap-4">
          {/* Logo & Brand (with explicit right margin to avoid crowding nav) */}
          <div 
            onClick={() => handleNavClick('home')}
            className="flex items-center gap-3 cursor-pointer group select-none shrink-0 mr-4 lg:mr-8"
          >
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

          {/* Desktop Navigation Links (with minimum 16px gap and generous spacing) */}
          <nav className="hidden md:flex items-center gap-6 lg:gap-8 text-xs font-medium tracking-tight">
            <button
              onClick={() => handleNavClick('home')}
              className={`transition-colors py-1 relative whitespace-nowrap ${
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
              onClick={() => handleNavClick('studio')}
              className={`transition-colors py-1 relative whitespace-nowrap ${
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
              onClick={() => handleNavClick('cockpit')}
              className={`transition-colors py-1 relative whitespace-nowrap ${
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
              onClick={() => handleNavClick('academy')}
              className={`transition-colors py-1 relative whitespace-nowrap ${
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

          {/* Desktop Right Actions: Gap >= 16px, White-space nowrap pastille */}
          <div className="hidden md:flex items-center gap-4 lg:gap-5 shrink-0 ml-4">
            <button
              onClick={onOpenQrModal}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap transition-colors ${
                isWhatsAppConnected
                  ? 'border-emerald-500/30 bg-emerald-500/[0.08] text-emerald-400 hover:bg-emerald-500/15'
                  : 'border-amber-500/30 bg-amber-500/[0.08] text-amber-300 hover:bg-amber-500/15'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${isWhatsAppConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
              <span className="font-medium text-xs whitespace-nowrap">
                {isWhatsAppConnected ? 'WhatsApp actif' : 'Scan QR requis'}
              </span>
            </button>

            {user ? (
              <button
                onClick={() => handleNavClick('cockpit')}
                className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/[0.04] px-3 py-1.5 text-xs text-neutral-200 hover:border-white/40 hover:bg-white/[0.08] transition-colors whitespace-nowrap"
              >
                <ShieldCheck className="h-3 w-3 text-emerald-400" />
                <span className="font-semibold text-xs max-w-[120px] truncate">
                  {(user.user_metadata?.studio_name as string) || (user.email ? user.email.split('@')[0] : 'Mon Studio')}
                </span>
              </button>
            ) : (
              <button
                onClick={() => openAuthModal('login')}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.04] px-3.5 py-1.5 text-xs font-semibold text-neutral-300 hover:text-white hover:border-white/35 transition-colors whitespace-nowrap"
              >
                <LogIn className="h-3 w-3" />
                <span>Connexion</span>
              </button>
            )}

            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-neutral-200 active:scale-95 whitespace-nowrap"
            >
              Commander sur WhatsApp
            </a>
          </div>

          {/* Mobile Right Bar: Single CTA + Burger button (Point 3) */}
          <div className="flex md:hidden items-center gap-2.5 shrink-0">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black whitespace-nowrap"
            >
              Commander
            </a>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? "Fermer le menu" : "Ouvrir le menu"}
              className="p-1.5 rounded-lg border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Slide-Down Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-white/[0.08] bg-[#08080a]/95 backdrop-blur-2xl px-6 py-6 space-y-4">
            <nav className="flex flex-col space-y-3 text-sm font-medium">
              <button
                onClick={() => handleNavClick('home')}
                className={`text-left py-2 border-b border-white/[0.04] ${
                  activeTab === 'home' ? 'text-white font-bold' : 'text-neutral-400'
                }`}
              >
                Accueil
              </button>
              <button
                onClick={() => handleNavClick('studio')}
                className={`text-left py-2 border-b border-white/[0.04] ${
                  activeTab === 'studio' ? 'text-white font-bold' : 'text-neutral-400'
                }`}
              >
                Atelier de composition
              </button>
              <button
                onClick={() => handleNavClick('cockpit')}
                className={`text-left py-2 border-b border-white/[0.04] ${
                  activeTab === 'cockpit' ? 'text-white font-bold' : 'text-neutral-400'
                }`}
              >
                Cockpit des ventes
              </button>
              <button
                onClick={() => handleNavClick('academy')}
                className={`text-left py-2 border-b border-white/[0.04] ${
                  activeTab === 'academy' ? 'text-white font-bold' : 'text-neutral-400'
                }`}
              >
                Académie
              </button>
            </nav>

            <div className="pt-2 flex flex-col gap-3">
              {!user ? (
                <button
                  onClick={() => {
                    openAuthModal('login');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[0.06] py-2.5 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
                >
                  <LogIn className="h-3.5 w-3.5" />
                  <span>Connexion Espace Studio</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    handleNavClick('cockpit');
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-3 text-xs text-emerald-300"
                >
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4" />
                    <span>{(user.user_metadata?.studio_name as string) || 'Mon Studio'}</span>
                  </span>
                  <span className="text-[10px] uppercase font-mono text-emerald-400">Isolé RLS</span>
                </button>
              )}

              <button
                onClick={() => {
                  onOpenQrModal();
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-neutral-300"
              >
                <span>État WhatsApp</span>
                <span className={`flex items-center gap-1.5 ${isWhatsAppConnected ? 'text-emerald-400' : 'text-amber-400'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${isWhatsAppConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`} />
                  {isWhatsAppConnected ? 'WhatsApp actif' : 'Scan QR requis'}
                </span>
              </button>

              <a
                href={WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full rounded-full bg-white text-black py-3 text-center text-xs font-bold"
              >
                Lancer une commande sur WhatsApp
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
};
