import { useEffect, useState, type FC } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';
import { useAuth } from '../hooks/useAuth';
import { wahaSessionNameFor } from '../services/waha';

interface QrConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionName?: string;
  isWhatsAppConnected: boolean;
  setIsWhatsAppConnected: (connected: boolean) => void;
}

export const QrConnectModal: FC<QrConnectModalProps> = ({
  isOpen,
  onClose,
  sessionName: passedSessionName,
  setIsWhatsAppConnected,
}) => {
  const { user } = useAuth();
  // Un studio lie sa propre session (ou 'Test' par défaut)
  const sessionName = passedSessionName || wahaSessionNameFor(user?.id);
  // Sonde active dès que la modal est ouverte
  const waha = useWahaSession(sessionName, { enabled: isOpen });
  const [isRestarting, setIsRestarting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  useEffect(() => {
    if (waha.isOnline) setIsWhatsAppConnected(true);
  }, [waha.isOnline, setIsWhatsAppConnected]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleRestartSession = async () => {
    setIsRestarting(true);
    await waha.restart();
    setIsRestarting(false);
  };

  const handleDisconnect = async () => {
    await waha.stop();
    setConfirmDisconnect(false);
    setIsWhatsAppConnected(false);
  };

  const connectedPhone = waha.session?.me?.id ? `+${waha.session.me.id.split('@')[0]}` : 'Numéro du studio';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md vx-fade-in"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="qr-title"
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-[#0E1015] p-6 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/[0.06] hover:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="text-center pb-4">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.03] text-white">
            <QrCode className="h-5 w-5" strokeWidth={1.5} />
          </div>
          <h2 id="qr-title" className="text-xl font-bold tracking-tight text-white">
            {waha.isOnline ? 'WhatsApp Studio connecté' : 'Lier votre WhatsApp Studio'}
          </h2>
          <p className="text-xs text-neutral-400 mt-1">
            <span>Passerelle WhatsApp · session <span className="font-mono text-white/90">{sessionName}</span></span>
          </p>
        </div>

        {waha.isOnline ? (
          <div className="my-4 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-5 text-center space-y-3">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-400">
              <CheckCircle2 className="h-6 w-6" strokeWidth={1.6} />
            </div>
            <div>
              <h3 className="font-mono text-base font-bold tabular-nums text-white">{connectedPhone}</h3>
              <p className="text-xs text-emerald-300 mt-0.5 font-mono">Passerelle active · {sessionName}</p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full rounded-full bg-white py-2.5 text-xs font-bold text-black hover:bg-neutral-200 cursor-pointer transition-colors"
              >
                Accéder au Studio
              </button>
              {confirmDisconnect ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    className="flex-1 rounded-full border border-rose-500/40 bg-rose-500/15 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                  >
                    Confirmer la déconnexion
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDisconnect(false)}
                    className="flex-1 rounded-full border border-white/[0.08] py-2 text-xs text-neutral-300 hover:text-white cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDisconnect(true)}
                  className="w-full rounded-full border border-rose-500/25 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/10 cursor-pointer"
                >
                  Déconnecter cette ligne
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border border-white/[0.12] bg-white p-3 overflow-hidden">
              {waha.qrUrl && !isRestarting ? (
                <img src={waha.qrUrl} alt="QR code d'appairage WhatsApp" className="h-full w-full object-contain" />
              ) : (
                <div className="flex flex-col items-center justify-center text-center p-4 h-full w-full rounded-xl bg-[#08090C] text-white space-y-2.5">
                  {isRestarting ? (
                    <Loader2 className="h-7 w-7 text-white animate-spin" />
                  ) : (
                    <QrCode className="h-8 w-8 text-white/80" strokeWidth={1.5} />
                  )}
                  <span className="text-xs font-semibold text-white">
                    {isRestarting ? 'Initialisation de la passerelle…' : 'Code QR en attente d\'activation'}
                  </span>
                  <span className="text-[11px] text-neutral-400">
                    {isRestarting ? 'Génération de la clé WhatsApp…' : 'Cliquez sur le bouton ci-dessous pour afficher votre code.'}
                  </span>
                </div>
              )}
            </div>

            <ol className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3.5 text-xs text-neutral-300 space-y-2">
              {[
                'Ouvrez WhatsApp sur le smartphone de votre studio',
                'Allez dans Réglages ou Menu ⋮ > Appareils connectés',
                'Touchez « Connecter un appareil » et scannez ce code',
              ].map((step, i) => (
                <li key={step} className="flex items-start gap-2.5">
                  <span className="font-mono text-[11px] tabular-nums text-emerald-400 font-bold">{String(i + 1).padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            <button
              type="button"
              onClick={handleRestartSession}
              disabled={isRestarting}
              className="w-full flex items-center justify-center gap-2 rounded-full bg-white hover:bg-neutral-200 py-3 text-xs font-bold text-black cursor-pointer transition-colors disabled:opacity-50 shadow-[0_10px_30px_rgba(255,255,255,0.1)]"
            >
              {isRestarting ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <QrCode className="h-4 w-4 text-black" />}
              <span>{isRestarting ? 'Génération en cours…' : waha.qrUrl ? 'Rafraîchir le code QR' : 'Activer et afficher le Code QR'}</span>
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-neutral-500">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.6} />
          <span>Passerelle multi-studio · chaque ligne est étanche</span>
        </div>
      </div>
    </div>
  );
};
