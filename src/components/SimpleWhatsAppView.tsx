import { useState, type FC } from 'react';
import { RotateCw, Check } from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';
import { useAuth } from '../hooks/useAuth';

export const SimpleWhatsAppView: FC = () => {
  const { user } = useAuth();
  const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
  const waha = useWahaSession(sessionName, { enabled: true, syncToStudio: true });

  const [showQrWhenConnected, setShowQrWhenConnected] = useState(false);

  const [autopilot, setAutopilot] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('velaris_autopilot_enabled');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [welcomeMessage, setWelcomeMessage] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('velaris_welcome_message') ||
        "Bonjour ! Bienvenue chez notre Studio de Chansons Personnalisées. Pour qui souhaitez-vous créer une chanson et pour quelle occasion ?"
      );
    } catch {
      return "Bonjour ! Bienvenue chez notre Studio de Chansons Personnalisées. Pour qui souhaitez-vous créer une chanson et pour quelle occasion ?";
    }
  });

  const [paymentPhone, setPaymentPhone] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('velaris_payment_phone') ||
        (user?.user_metadata?.phone as string) ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [paymentName, setPaymentName] = useState<string>(() => {
    try {
      return (
        localStorage.getItem('velaris_payment_name') ||
        (user?.user_metadata?.studio_name as string) ||
        ''
      );
    } catch {
      return '';
    }
  });

  const [autoVoice, setAutoVoice] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('velaris_auto_voice');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('velaris_autopilot_enabled', String(autopilot));
      localStorage.setItem('velaris_welcome_message', welcomeMessage);
      localStorage.setItem('velaris_payment_phone', paymentPhone);
      localStorage.setItem('velaris_payment_name', paymentName);
      localStorage.setItem('velaris_auto_voice', String(autoVoice));
      setIsDirty(false);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const connectedPhone = waha.session?.me?.id
    ? '+' + waha.session.me.id.split('@')[0]
    : null;

  const shouldShowQr = !waha.isOnline || showQrWhenConnected;

  return (
    <div className="space-y-8 pb-8">
      {/* En-tête simple */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-white">WhatsApp</h1>
        <p className="text-sm text-[#8A90A0]">
          Connectez votre numéro et activez vos réponses automatiques.
        </p>
      </div>

      {/* Statut de connexion */}
      <section className="rounded-3xl bg-[#0D0F14] p-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <span
            className={`w-3 h-3 rounded-full shrink-0 ${
              waha.isOnline ? 'bg-[#10D98E]' : 'bg-[#E2BD6B]'
            }`}
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {waha.isOnline ? connectedPhone || 'Ligne connectée' : 'En attente de scan'}
            </p>
            <p className="text-xs text-[#8A90A0] mt-0.5 truncate">
              {waha.isOnline
                ? 'Passerelle active 24h/24'
                : 'Scannez le QR Code ci-dessous pour connecter'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {waha.isOnline && (
            <button
              type="button"
              onClick={() => setShowQrWhenConnected((prev) => !prev)}
              className="px-3.5 py-2 rounded-full bg-white/[0.06] hover:bg-white/[0.1] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              {showQrWhenConnected ? 'Masquer QR' : 'QR Code'}
            </button>
          )}
          <button
            type="button"
            onClick={() => waha.restart()}
            aria-label="Rafraîchir la connexion WhatsApp"
            className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.1] flex items-center justify-center text-[#8A90A0] hover:text-white transition-colors cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </section>

      {/* Bloc QR Code (affiché si déconnecté ou sur demande) */}
      {shouldShowQr && (
        <section className="rounded-3xl bg-[#0D0F14] p-6 flex flex-col items-center text-center space-y-5">
          <div className="p-4 rounded-2xl bg-white flex items-center justify-center min-h-[208px] min-w-[208px]">
            {waha.qrUrl ? (
              <img
                src={waha.qrUrl}
                alt="QR Code WhatsApp"
                className="w-48 h-48 object-contain"
              />
            ) : (
              <div className="text-center text-black/60 text-xs space-y-2 py-8 px-4">
                <RotateCw className="w-5 h-5 animate-spin mx-auto text-black/40" />
                <p>Génération du QR Code…</p>
              </div>
            )}
          </div>

          <div className="space-y-1 max-w-xs">
            <p className="text-sm font-semibold text-white">Scanner avec WhatsApp</p>
            <p className="text-xs text-[#8A90A0] leading-relaxed">
              Ouvrez WhatsApp → Paramètres → Appareils connectés → Connecter un appareil.
            </p>
          </div>

          <button
            type="button"
            onClick={() => waha.restart()}
            className="px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.12] text-xs font-medium text-white inline-flex items-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Régénérer le QR Code</span>
          </button>
        </section>
      )}

      {/* Automatisations */}
      <section className="space-y-5">
        <h2 className="text-base font-semibold text-white">Automatisations</h2>

        <div className="rounded-3xl bg-[#0D0F14] divide-y divide-white/[0.06] px-5">
          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Pilote Automatique</p>
              <p className="text-xs text-[#8A90A0] mt-0.5">
                Accueille les clients et prend le brief 24h/24
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autopilot}
              aria-label="Activer le Pilote Automatique"
              onClick={() => {
                setAutopilot((v) => !v);
                setIsDirty(true);
              }}
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                autopilot ? 'bg-[#10D98E]' : 'bg-white/15'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-black transition-transform ${
                  autopilot ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-white">Vocal de procédure</p>
              <p className="text-xs text-[#8A90A0] mt-0.5">
                Envoie une note vocale expliquant comment commander
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoVoice}
              aria-label="Activer le vocal de procédure"
              onClick={() => {
                setAutoVoice((v) => !v);
                setIsDirty(true);
              }}
              className={`w-12 h-7 rounded-full p-1 transition-colors shrink-0 cursor-pointer ${
                autoVoice ? 'bg-[#E2BD6B]' : 'bg-white/15'
              }`}
            >
              <span
                className={`block w-5 h-5 rounded-full bg-black transition-transform ${
                  autoVoice ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Message d'accueil & Mobile Money */}
        <div className="rounded-3xl bg-[#0D0F14] p-5 sm:p-6 space-y-5">
          <div className="space-y-2">
            <label htmlFor="wa-welcome-msg" className="block text-xs font-medium text-[#8A90A0]">
              Message d'accueil automatique
            </label>
            <textarea
              id="wa-welcome-msg"
              rows={3}
              value={welcomeMessage}
              onChange={(e) => {
                setWelcomeMessage(e.target.value);
                setIsDirty(true);
              }}
              placeholder="Message envoyé au client lorsqu'il vous écrit pour la première fois..."
              className="w-full p-3.5 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white leading-relaxed focus:outline-none focus:border-[#E2BD6B]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="wa-momo-phone" className="block text-xs font-medium text-[#8A90A0]">
                Numéro Wave / Orange Money
              </label>
              <input
                id="wa-momo-phone"
                type="tel"
                value={paymentPhone}
                onChange={(e) => {
                  setPaymentPhone(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="+226 70 00 00 00"
                className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white tabular-nums focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="wa-momo-name" className="block text-xs font-medium text-[#8A90A0]">
                Nom du titulaire
              </label>
              <input
                id="wa-momo-name"
                type="text"
                value={paymentName}
                onChange={(e) => {
                  setPaymentName(e.target.value);
                  setIsDirty(true);
                }}
                placeholder="Ex : Awa Diallo"
                className="w-full px-3.5 py-3 rounded-2xl bg-[#06070A] border border-white/[0.08] text-sm text-white focus:outline-none focus:border-[#E2BD6B]"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSaveSettings}
            className={`w-full py-3.5 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isSaved
                ? 'bg-[#10D98E]/15 text-[#10D98E]'
                : isDirty
                ? 'bg-white text-black hover:bg-white/90'
                : 'bg-white/[0.07] text-white/80 hover:bg-white/[0.12]'
            }`}
          >
            {isSaved ? (
              <>
                <Check className="w-4 h-4" />
                <span>Automatisations enregistrées</span>
              </>
            ) : (
              <span>{isDirty ? 'Enregistrer les changements' : 'Enregistrer les automatisations'}</span>
            )}
          </button>
        </div>
      </section>
    </div>
  );
};
