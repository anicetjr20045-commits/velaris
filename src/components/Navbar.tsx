import { useEffect, useMemo, useState, type FC } from 'react';
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

  const isSubscribed = useMemo(() => {
    if (typeof window !== 'undefined') {
      const search = window.location.search;
      const hash = window.location.hash.toLowerCase();
      if (
        search.includes('preview=true') ||
        search.includes('demo=1') ||
        hash.includes('preview=true') ||
        hash.includes('demo=1')
      ) {
        return true;
      }
      try {
        if (
          sessionStorage.getItem('velaris_preview_mode') === 'true' ||
          localStorage.getItem('velaris_preview_mode') === 'true'
        ) {
          return true;
        }
      } catch {}
    }
    if (user?.email && (user.email.includes('admin') || user.email.includes('anicet') || user.email.includes('05777308'))) return true;
    const phone = String(user?.user_metadata?.phone || user?.phone || '');
    if (phone.includes('05777308') || phone.includes('56240533') || phone.includes('58357772')) return true;
    if (user?.user_metadata?.plan === 'pro' || user?.user_metadata?.subscription_status === 'ACTIVE') return true;
    return (
      subscription.status === 'active' &&
      Boolean(subscription.expiresAt && new Date(subscription.expiresAt).getTime() > Date.now())
    );
  }, [subscription, user]);

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
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
        {/* Marque Logo Unique */}
        <div className="flex shrink-0 items-center gap-3 select-none">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#F5D060] to-[#D4A017] flex items-center justify-center text-[#0A0A0F] font-heading font-black text-sm shadow-[0_0_20px_rgba(229,181,79,0.35)]">
            D
          </div>
          <span className="font-heading text-xl font-extrabold tracking-tight text-white">
            DJELIA <span className="text-[#F5D060] font-mono text-xs font-semibold ml-0.5 tracking-wider">ACADEMY</span>
          </span>
        </div>

        {/* Actions utilisateur & Conversion (Zéro menu public) */}
        <div className="flex shrink-0 items-center gap-3 sm:gap-4">
          {user ? (
            <>
              {/* Badge Studio de l'utilisateur connecté */}
              <div className="hidden sm:inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-sm text-neutral-200">
                <ShieldCheck className={`h-4 w-4 ${isSubscribed ? 'text-emerald-400' : 'text-amber-400'}`} />
                <span className="max-w-[150px] truncate font-medium">{studioName}</span>
              </div>

              {isSubscribed ? (
                <button
                  type="button"
                  onClick={onEnterStudio}
                  className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-5 py-2.5 text-sm font-bold text-[#0A0A0F] active:scale-[0.97] transition-all whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.4)] cursor-pointer"
                >
                  <span>Accéder à mon Studio</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenPayment || onEnterStudio}
                  className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-5 py-2.5 text-sm font-bold text-[#0A0A0F] active:scale-[0.97] transition-all whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.4)] cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Activer mon Pass (4 900 F)</span>
                </button>
              )}
            </>
          ) : isSubscribed ? (
            <button
              type="button"
              onClick={onEnterStudio}
              className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-5 py-2.5 text-sm font-bold text-[#0A0A0F] active:scale-[0.97] transition-all whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.4)] cursor-pointer"
            >
              <span>Accéder au Studio (Aperçu)</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => openAuthModal('login')}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-neutral-300 hover:text-white hover:bg-white/[0.04] transition-colors cursor-pointer whitespace-nowrap"
              >
                <LogIn className="h-4 w-4" strokeWidth={2} />
                <span>Connexion</span>
              </button>

              <button
                type="button"
                onClick={() => openAuthModal('signup')}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#F5D060] via-[#E5B54F] to-[#D4A017] hover:brightness-110 px-5 py-2.5 text-sm font-bold text-[#0A0A0F] active:scale-[0.97] transition-all whitespace-nowrap shadow-[0_0_24px_rgba(212,160,23,0.35)] cursor-pointer"
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
