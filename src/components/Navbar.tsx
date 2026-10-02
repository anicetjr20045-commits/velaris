import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FC } from 'react';
import { LogIn, Menu, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { VelarisMark } from './VelarisMark';
import { SonarGlyph } from './SonarMascot';

type NavTab = 'home' | 'cockpit' | 'studio' | 'academy' | 'qr' | 'decouvrir' | 'copilot';

interface NavbarProps {
  activeTab: NavTab;
  setActiveTab: (tab: NavTab) => void;
  isWhatsAppConnected: boolean;
  onOpenQrModal: () => void;
  onOpenNewOrderModal?: () => void;
}

const NAV_ITEMS: { id: NavTab; label: string }[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'studio', label: 'Atelier' },
  { id: 'cockpit', label: 'Cockpit' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'academy', label: 'Académie' },
];

const WHATSAPP_URL = 'https://wa.me/22656240533?text=' + encodeURIComponent('Bonjour Velaris, je souhaite créer une chanson personnalisée.');

export const Navbar: FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  isWhatsAppConnected,
  onOpenQrModal,
}) => {
  const { user, openAuthModal } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  const studioName = user
    ? (user.user_metadata?.studio_name as string) || (user.email ? user.email.split('@')[0] : 'Mon Studio')
    : '';

  const handleNavClick = (tab: NavTab) => {
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  /* La barre se densifie dès qu'on quitte le haut de page */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* Pastille active qui glisse d'un lien à l'autre */
  useLayoutEffect(() => {
    const measure = () => {
      const el = navRef.current?.querySelector<HTMLElement>(`[data-nav="${activeTab}"]`);
      setIndicator(el ? { left: el.offsetLeft, width: el.offsetWidth } : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [activeTab]);

  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsMobileMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors duration-300 ease-luxury ${
        scrolled || isMobileMenuOpen ? 'border-white/[0.08] bg-[#050608]/80 backdrop-blur-2xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        {/* Marque */}
        <button
          type="button"
          onClick={() => handleNavClick('home')}
          className="group flex shrink-0 items-center gap-2.5 select-none cursor-pointer"
          aria-label="Velaris, accueil"
        >
          <VelarisMark className="h-7 w-7 text-white transition-transform duration-500 ease-luxury group-hover:rotate-[24deg]" />
          <span className="font-heading text-[17px] font-bold tracking-tight text-white">Velaris</span>
        </button>

        {/* Navigation desktop */}
        <nav
          ref={navRef}
          className="relative hidden md:flex items-center gap-0.5 rounded-full border border-white/[0.07] bg-white/[0.02] p-1"
          aria-label="Navigation principale"
        >
          {indicator && (
            <span
              aria-hidden="true"
              className="absolute top-1 bottom-1 rounded-full bg-white/[0.09] border border-white/[0.08] transition-[left,width] duration-300 ease-luxury"
              style={{ left: indicator.left, width: indicator.width }}
            />
          )}
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                data-nav={item.id}
                onClick={() => handleNavClick(item.id)}
                aria-current={active ? 'page' : undefined}
                className={`relative z-10 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap transition-colors duration-200 cursor-pointer ${
                  active ? 'text-white font-medium' : 'text-neutral-400 hover:text-white'
                }`}
              >
                {item.id === 'copilot' && <SonarGlyph size={14} />}
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Actions desktop */}
        <div className="hidden md:flex shrink-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenQrModal}
            title={isWhatsAppConnected ? 'Passerelle WhatsApp connectée' : 'Scannez le QR code pour connecter WhatsApp'}
            className="inline-flex items-center gap-2 rounded-full px-2.5 py-1.5 text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            <span className="relative flex h-2 w-2">
              {!isWhatsAppConnected && <span className="absolute inset-0 rounded-full bg-amber-400 vx-breathe" />}
              <span className={`relative h-2 w-2 rounded-full ${isWhatsAppConnected ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            </span>
            <span className="hidden lg:inline">{isWhatsAppConnected ? 'WhatsApp actif' : 'Connecter WhatsApp'}</span>
          </button>

          {user ? (
            <button
              type="button"
              onClick={() => handleNavClick('cockpit')}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-200 hover:border-white/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShieldCheck className="h-3 w-3 text-emerald-400" strokeWidth={1.75} />
              <span className="max-w-[120px] truncate">{studioName}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogIn className="h-3 w-3" strokeWidth={1.75} />
              Connexion
            </button>
          )}

          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-neutral-200 active:scale-[0.97] transition-all duration-150 ease-press whitespace-nowrap shadow-[0_0_24px_rgba(255,255,255,0.10)]"
          >
            Commander sur WhatsApp
          </a>
        </div>

        {/* Mobile */}
        <div className="flex md:hidden shrink-0 items-center gap-2">
          <a
            href={WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-black whitespace-nowrap"
          >
            Commander
          </a>
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(o => !o)}
            aria-label={isMobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={isMobileMenuOpen}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.12] bg-white/[0.03] text-white cursor-pointer"
          >
            {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Menu mobile */}
      {isMobileMenuOpen && (
        <div className="vx-view-enter md:hidden border-t border-white/[0.06] px-5 pt-3 pb-6 space-y-5">
          <nav className="flex flex-col" aria-label="Navigation mobile">
            {NAV_ITEMS.map((item, i) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  style={{ '--i': i } as CSSProperties}
                  className={`vx-stagger flex items-center justify-between border-b border-white/[0.05] py-3.5 text-left font-heading text-lg tracking-tight cursor-pointer ${
                    active ? 'text-white' : 'text-neutral-400'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {item.id === 'copilot' && <SonarGlyph size={18} />}
                    {item.label}
                  </span>
                  {active && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </button>
              );
            })}
          </nav>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => {
                onOpenQrModal();
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-neutral-300 cursor-pointer"
            >
              <span>Passerelle WhatsApp</span>
              <span className={`inline-flex items-center gap-1.5 ${isWhatsAppConnected ? 'text-emerald-300' : 'text-amber-300'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${isWhatsAppConnected ? 'bg-emerald-400' : 'bg-amber-400 vx-breathe'}`} />
                {isWhatsAppConnected ? 'Active' : 'Scan QR requis'}
              </span>
            </button>

            {user ? (
              <button
                type="button"
                onClick={() => handleNavClick('cockpit')}
                className="w-full flex items-center justify-between rounded-2xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-xs text-neutral-200 cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.75} />
                  {studioName}
                </span>
                <span className="font-mono text-[10px] text-neutral-500">Espace privé</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  openAuthModal('login');
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 rounded-full border border-white/[0.15] py-3 text-xs font-medium text-white cursor-pointer"
              >
                <LogIn className="h-3.5 w-3.5" />
                Connexion à l'espace studio
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
