import { useEffect, useState, type FC } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_KEY = 'djelia_pwa_install_dismissed_at';
const DISMISS_DAYS_MS = 7 * 24 * 3600 * 1000;

export const PwaInstallPrompt: FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIos, setIsIos] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);
    if (standalone) return;

    try {
      const last = Number(localStorage.getItem(DISMISS_KEY) || '0');
      if (last && Date.now() - last < DISMISS_DAYS_MS) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } catch {
      setDismissed(false);
    }

    const ua = window.navigator.userAgent.toLowerCase();
    const iosDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIos(iosDevice);

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setDismissed(false);
    };

    const onInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      setDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    setShowIosGuide(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setDeferredPrompt(null);
        setDismissed(true);
      }
      return;
    }
    if (isIos) {
      setShowIosGuide((v) => !v);
    }
  };

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !isIos) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="rounded-3xl border border-[#E2BD6B]/30 bg-[#0A0C10]/95 backdrop-blur-xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.75)] space-y-3">
        <div className="flex items-start gap-3">
          <img
            src="/icons/icon-192.png"
            alt="Djelia Studio"
            className="w-11 h-11 rounded-2xl border border-white/10 object-cover shrink-0"
          />

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-white tracking-tight">
                Installer Djelia Studio
              </p>
              <button
                type="button"
                onClick={handleDismiss}
                aria-label="Fermer"
                className="p-1 rounded-full text-neutral-500 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-[11px] text-[#8A90A0] leading-snug mt-0.5">
              Ajoutez le studio sur votre téléphone pour un accès instantané plein écran, sans barre de navigateur.
            </p>
          </div>
        </div>

        {showIosGuide ? (
          <div className="rounded-2xl bg-[#050608] border border-white/[0.08] p-3 space-y-2 text-[11px] text-neutral-300">
            <div className="flex items-center gap-2">
              <Share className="w-3.5 h-3.5 text-[#E2BD6B] shrink-0" />
              <span>
                1. Touchez le bouton <strong className="text-white">Partager</strong> en bas de Safari.
              </span>
            </div>
            <div className="flex items-center gap-2">
              <PlusSquare className="w-3.5 h-3.5 text-[#E2BD6B] shrink-0" />
              <span>
                2. Choisissez <strong className="text-white">Sur l’écran d’accueil</strong> puis confirmez.
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-white hover:bg-neutral-200 text-black text-xs font-bold py-2.5 px-4 transition-all cursor-pointer active:scale-[0.98]"
            >
              {isIos ? <Smartphone className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              <span>{isIos ? 'Comment installer sur iPhone' : 'Installer l’application'}</span>
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-2.5 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] text-[11px] font-medium text-neutral-400 hover:text-white transition-colors cursor-pointer"
            >
              Plus tard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
