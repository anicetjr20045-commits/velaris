import { useState, type FC } from 'react';
import { 
  X, 
  QrCode, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck,
  RotateCw,
  Loader2
} from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';

interface QrConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isWhatsAppConnected: boolean;
  setIsWhatsAppConnected: (connected: boolean) => void;
}

export const QrConnectModal: FC<QrConnectModalProps> = ({
  isOpen,
  onClose,
  setIsWhatsAppConnected,
}) => {
  const waha = useWahaSession('Test');
  const [isRestarting, setIsRestarting] = useState(false);

  if (!isOpen) return null;

  const handleRestartSession = async () => {
    setIsRestarting(true);
    await waha.restart();
    setIsRestarting(false);
  };

  const handleDisconnect = async () => {
    await waha.stop();
    setIsWhatsAppConnected(false);
  };

  const isConnected = waha.isOnline;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0c0d14] p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/[0.06] hover:text-white cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center pb-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8f6d14] text-black shadow-lg shadow-[#d4af37]/20">
            <QrCode className="h-6 w-6" />
          </div>
          <h2 className="font-serif text-xl font-bold text-white">
            {isConnected ? 'WhatsApp Connecté' : 'Lier votre WhatsApp'}
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            {isConnected
              ? 'Votre session WhatsApp Alex (+226 56 24 05 33) est active sur la passerelle WAHA.'
              : 'Scannez le QR Code en direct pour synchroniser vos commandes et automatisations.'}
          </p>
        </div>

        {/* Main Content: Connected State vs Live QR Code */}
        {isConnected ? (
          <div className="my-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-5 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold text-white">
                Session Active : +226 56 24 05 33
              </h3>
              <p className="text-xs text-emerald-300 mt-0.5 font-mono">
                Passerelle WAHA • Statut : {waha.status}
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c158] py-2.5 text-xs font-bold text-black cursor-pointer shadow"
              >
                Accéder au Studio OS
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 cursor-pointer"
              >
                Déconnecter cette session
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visual Live QR Code Display */}
            <div className="relative mx-auto flex h-56 w-56 items-center justify-center rounded-2xl border-2 border-dashed border-[#d4af37]/40 bg-white p-3 shadow-2xl">
              <img
                src={waha.qrUrl}
                alt="QR Code WAHA Live"
                className="h-full w-full object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const parent = e.currentTarget.parentElement;
                  if (parent && !parent.querySelector('.qr-err')) {
                    const d = document.createElement('div');
                    d.className = 'qr-err text-center p-3 text-black text-xs';
                    d.innerHTML = '<p class="font-bold">QR Code en préparation</p><p class="text-[10px] text-stone-600 mt-1">Cliquez sur Relancer la session ci-dessous</p>';
                    parent.appendChild(d);
                  }
                }}
              />

              {(isRestarting || waha.isLoading) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/80 backdrop-blur-sm text-white">
                  <RefreshCw className="h-8 w-8 text-[#e5c158] animate-spin mb-2" />
                  <span className="text-xs font-semibold">Génération du QR Code...</span>
                </div>
              )}
            </div>

            {/* Instruction Steps */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-stone-300 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-black font-bold text-[9px]">
                  1
                </span>
                <span>Ouvrez WhatsApp sur votre smartphone dédié</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-mono text-[10px]">
                  2
                </span>
                <span>Allez dans <strong>Appareils connectés</strong> › <strong>Lier un appareil</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-mono text-[10px]">
                  3
                </span>
                <span>Pointez votre caméra vers ce QR code</span>
              </div>
            </div>

            {/* Actions Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleRestartSession}
                disabled={isRestarting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-white hover:bg-neutral-200 py-2.5 text-xs font-bold text-black shadow-md cursor-pointer transition-all disabled:opacity-50"
              >
                {isRestarting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                <span>Relancer la session WAHA</span>
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Passerelle WAHA sécurisée (API Key chiffrée)</span>
        </div>
      </div>
    </div>
  );
};
