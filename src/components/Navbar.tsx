import { useEffect, useState, type FC } from 'react';
import { LogIn, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getStudioSubscription, subscribeToBilling } from '../services/billing';

interface NavbarProps {
  onEnterStudio?: () => void;
  onOpenPayment?: () => void;
}

export const Navbar: FC<NavbarProps> = ({
  onEnterStudio,
  onOpenPayment,
}) => {
  const { user, openAuthModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [subscription, setSubscription] = useState(getStudioSubscription);

  useEffect(() => {
    return subscribeToBilling(() => {
      setSubscription(getStudioSubscription());
    });
  }, []);

  const isSubscribed =
    Boolean(user?.email && (user.email.includes('admin') || user.email.includes('anicet'))) ||
    Boolean(user?.user_metadata?.plan === 'pro') ||
    (subscription.status === 'active' && Boolean(subscription.expiresAt && new Date(subscription.expiresAt).getTime() > Date.now()));

  const studioName = user
    ? (user.user_metadata?.studio_name as string) || (user.email ? user.email.split('@')[0] : 'Mon Studio')
    : '';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors duration-300 ease-luxury ${
        scrolled ? 'border-white/[0.08] bg-[#050608]/90 backdrop-blur-2xl' : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        {/* Marque Logo Unique */}
        <div className="flex shrink-0 items-center gap-2.5 select-none">
          <div className="h-7 w-7 rounded-lg bg-[#D4A017] flex items-center justify-center text-[#0A0A0F] font-heading font-black text-xs">
            D
          </div>
          <span className="font-heading text-[17px] font-bold tracking-tight text-white">
            DJELIA <span className="text-[#D4A017] font-mono text-xs">ACADEMY</span>
          </span>
        </div>

        {/* Actions utilisateur & Conversion (Zéro menu public) */}
        <div className="flex shrink-0 items-center gap-2.5 sm:gap-3">
          {user ? (
            <>
              {/* Badge Studio de l'utilisateur connecté */}
              <div className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/[0.1] bg-white/[0.03] px-3 py-1.5 text-xs text-neutral-300">
                <ShieldCheck className={`h-3 w-3 ${isSubscribed ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="max-w-[130px] truncate">{studioName}</span>
              </div>

              {isSubscribed ? (
                <button
                  type="button"
                  onClick={onEnterStudio}
                  className="inline-flex items-center gap-2 rounded-full bg-[#D4A017] hover:bg-[#F5D060] px-4 py-2 text-xs font-semibold text-[#0A0A0F] active:scale-[0.97] transition-all duration-150 whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.35)] cursor-pointer"
                >
                  <span>Accéder à mon Studio</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenPayment || onEnterStudio}
                  className="inline-flex items-center gap-2 rounded-full bg-[#D4A017] hover:bg-[#F5D060] px-4 py-2 text-xs font-semibold text-[#0A0A0F] active:scale-[0.97] transition-all duration-150 whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.35)] cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Activer mon Pass (4 900 F)</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-neutral-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="h-3 w-3" strokeWidth={1.75} />
                <span>Connexion</span>
              </button>

              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#D4A017] hover:bg-[#F5D060] px-4 py-2 text-xs font-semibold text-[#0A0A0F] active:scale-[0.97] transition-all duration-150 whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.35)] cursor-pointer"
              >
                <span>Rejoindre l'Académie</span>
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
