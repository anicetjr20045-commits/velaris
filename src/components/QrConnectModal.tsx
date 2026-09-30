import { useState, type FC } from 'react';
import { 
  X, 
  QrCode, 
  Smartphone, 
  CheckCircle2, 
  RefreshCw, 
  ShieldCheck 
} from 'lucide-react';

interface QrConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  isWhatsAppConnected: boolean;
  setIsWhatsAppConnected: (connected: boolean) => void;
}

export const QrConnectModal: FC<QrConnectModalProps> = ({
  isOpen,
  onClose,
  isWhatsAppConnected,
  setIsWhatsAppConnected,
}) => {
  const [isScanning, setIsScanning] = useState(false);

  if (!isOpen) return null;

  const handleSimulateConnection = () => {
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      setIsWhatsAppConnected(true);
    }, 1500);
  };

  const handleDisconnect = () => {
    setIsWhatsAppConnected(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.1] bg-[#0c0d14] p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-white/50 hover:bg-white/[0.06] hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center pb-4">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#d4af37] to-[#8f6d14] text-black shadow-lg shadow-[#d4af37]/20">
            <QrCode className="h-6 w-6" />
          </div>
          <h2 className="font-['Space_Grotesk'] text-xl font-bold text-white">
            {isWhatsAppConnected ? 'WhatsApp Connecté' : 'Lier votre WhatsApp'}
          </h2>
          <p className="text-xs text-white/50 mt-1">
            {isWhatsAppConnected
              ? 'Votre numéro de vente est synchronisé avec le cockpit Velaris.'
              : 'Scannez le QR Code pour tracker vos commandes et automatiser les livraisons.'}
          </p>
        </div>

        {/* Main Content: Connected State vs QR Code */}
        {isWhatsAppConnected ? (
          <div className="my-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <div>
              <h3 className="font-['Space_Grotesk'] text-base font-bold text-white">
                Session Active : +226 56 24 05 33
              </h3>
              <p className="text-xs text-emerald-300 mt-0.5">
                Passerelle WAHA connectée • Mode Vendeur Actif
              </p>
            </div>
            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={onClose}
                className="w-full rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c158] py-2.5 text-xs font-bold text-black"
              >
                Accéder au Cockpit
              </button>
              <button
                onClick={handleDisconnect}
                className="w-full rounded-xl border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20"
              >
                Déconnecter cette session
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visual QR Code Display */}
            <div className="relative mx-auto flex h-52 w-52 items-center justify-center rounded-2xl border-2 border-dashed border-[#d4af37]/40 bg-white p-3 shadow-inner">
              {/* QR Pattern Simulation with SVG */}
              <svg viewBox="0 0 100 100" className="h-full w-full text-black">
                <rect x="0" y="0" width="30" height="30" fill="currentColor" />
                <rect x="5" y="5" width="20" height="20" fill="white" />
                <rect x="9" y="9" width="12" height="12" fill="currentColor" />

                <rect x="70" y="0" width="30" height="30" fill="currentColor" />
                <rect x="75" y="5" width="20" height="20" fill="white" />
                <rect x="79" y="9" width="12" height="12" fill="currentColor" />

                <rect x="0" y="70" width="30" height="30" fill="currentColor" />
                <rect x="5" y="75" width="20" height="20" fill="white" />
                <rect x="9" y="79" width="12" height="12" fill="currentColor" />

                {/* Data spots */}
                <rect x="36" y="10" width="8" height="8" fill="currentColor" />
                <rect x="48" y="10" width="6" height="14" fill="currentColor" />
                <rect x="36" y="24" width="18" height="6" fill="currentColor" />
                <rect x="10" y="38" width="14" height="6" fill="currentColor" />
                <rect x="10" y="48" width="8" height="16" fill="currentColor" />
                <rect x="38" y="38" width="24" height="24" fill="currentColor" />
                <rect x="42" y="42" width="16" height="16" fill="white" />
                <rect x="46" y="46" width="8" height="8" fill="currentColor" />
                <rect x="70" y="38" width="10" height="18" fill="currentColor" />
                <rect x="84" y="48" width="12" height="10" fill="currentColor" />
                <rect x="38" y="70" width="14" height="8" fill="currentColor" />
                <rect x="56" y="70" width="8" height="18" fill="currentColor" />
                <rect x="70" y="70" width="24" height="24" fill="currentColor" />
              </svg>

              {isScanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-2xl bg-black/75 backdrop-blur-sm text-white">
                  <RefreshCw className="h-8 w-8 text-[#e5c158] animate-spin mb-2" />
                  <span className="text-xs font-semibold">Connexion en cours...</span>
                </div>
              )}
            </div>

            {/* Instruction Steps */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-white/70 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-black font-bold text-[9px]">
                  1
                </span>
                <span>Ouvrez WhatsApp sur votre smartphone</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-black font-bold text-[9px]">
                  2
                </span>
                <span>Allez dans <strong>Appareils connectés</strong> ➔ <strong>Lier un appareil</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#d4af37] text-black font-bold text-[9px]">
                  3
                </span>
                <span>Pointez votre appareil vers cet écran</span>
              </div>
            </div>

            {/* Trigger Simulation Button */}
            <button
              onClick={handleSimulateConnection}
              disabled={isScanning}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#d4af37] to-[#e5c158] py-3 text-xs font-extrabold text-black shadow-lg shadow-[#d4af37]/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              <Smartphone className="h-4 w-4" />
              <span>Simuler Scan WhatsApp Réussi</span>
            </button>
          </div>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-white/40">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
          <span>Connexion sécurisée de bout en bout (Chiffrement WhatsApp)</span>
        </div>
      </div>
    </div>
  );
};
