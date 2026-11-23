import { useState, type FC } from 'react';
import {
  Smartphone,
  CheckCircle2,
  RotateCw,
  QrCode,
  Zap,
  Save,
  Check,
  Power
} from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';
import { useAuth } from '../hooks/useAuth';

export const SimpleWhatsAppView: FC = () => {
  const { user } = useAuth();
  const sessionName = user ? `studio_${user.id.slice(0, 8)}` : 'Test';
  const waha = useWahaSession(sessionName, { enabled: true, syncToStudio: true });

  // Automations settings in localStorage
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

  const [isSaved, setIsSaved] = useState(false);

  const handleSaveSettings = () => {
    try {
      localStorage.setItem('velaris_autopilot_enabled', String(autopilot));
      localStorage.setItem('velaris_welcome_message', welcomeMessage);
      localStorage.setItem('velaris_payment_phone', paymentPhone);
      localStorage.setItem('velaris_payment_name', paymentName);
      localStorage.setItem('velaris_auto_voice', String(autoVoice));
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const connectedPhone = waha.session?.me?.id
    ? '+' + waha.session.me.id.split('@')[0]
    : null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Header épuré */}
      <div className="border-b border-white/[0.08] pb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00E599]/10 border border-[#00E599]/20 text-[#00E599] font-mono text-xs uppercase tracking-wider mb-2">
          <Smartphone className="w-3.5 h-3.5" />
          <span>Gestionnaire WhatsApp & Automatisations</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold text-white">
          Mon WhatsApp & Pilote Automatique
        </h1>
        <p className="text-sm text-[#8E94A3] mt-1">
          Connectez votre numéro et définissez vos coordonnées d'encaissement. Votre agent IA s'occupe de l'accueil et du paiement en toute autonomie.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        
        {/* CARTE 1 : CONNEXION DU NUMÉRO WHATSAPP */}
        <div className="spotlight-card p-6 sm:p-7 space-y-6 rounded-2xl border border-white/[0.1] bg-[#08090D]">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#D4AF37]/10 border border-[#D4AF37]/30 flex items-center justify-center text-[#D4AF37]">
                <QrCode className="w-4 h-4" />
              </div>
              <h2 className="font-heading text-lg font-bold text-white">Ligne WhatsApp</h2>
            </div>

            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-xs font-semibold ${
                waha.isOnline
                  ? 'bg-[#00E599]/10 text-[#00E599] border border-[#00E599]/25'
                  : 'bg-amber-400/10 text-amber-300 border border-amber-400/25'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${waha.isOnline ? 'bg-[#00E599] animate-pulse' : 'bg-amber-400'}`} />
              <span>{waha.isOnline ? 'Connecté' : 'À Scanner'}</span>
            </span>
          </div>

          {waha.isOnline ? (
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-[#00E599]/5 border border-[#00E599]/20 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-[#00E599] shrink-0" />
                <div>
                  <div className="text-xs text-[#8E94A3] font-mono">Numéro WhatsApp actif</div>
                  <div className="text-sm sm:text-base font-mono font-bold text-white mt-0.5">
                    {connectedPhone || 'Session connectée'}
                  </div>
                </div>
              </div>

              <p className="text-xs text-[#8E94A3] leading-relaxed">
                Votre WhatsApp est connecté en direct à la passerelle. Dès qu'un prospect vous écrit, votre agent IA prend le relais selon vos réglages ci-contre.
              </p>

              <button
                type="button"
                onClick={() => waha.restart()}
                className="w-full py-2.5 px-4 rounded-xl border border-white/[0.1] bg-white/[0.04] hover:bg-white/[0.08] text-xs font-mono text-[#C7CAD4] hover:text-white transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Tester la connexion / Rafraîchir</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="text-xs text-[#C7CAD4] space-y-1.5 bg-black/40 p-3 rounded-xl border border-white/[0.06]">
                <div className="font-semibold text-white">Pour connecter votre WhatsApp :</div>
                <ol className="list-decimal list-inside space-y-1 text-[#8E94A3]">
                  <li>Ouvrez WhatsApp sur votre smartphone</li>
                  <li>Allez dans <strong>Paramètres &gt; Appareils connectés</strong></li>
                  <li>Scannez le QR Code ci-dessous</li>
                </ol>
              </div>

              {/* QR Code Canvas / Image */}
              <div className="p-4 rounded-2xl bg-white flex items-center justify-center min-h-[220px]">
                {waha.qrUrl ? (
                  <img
                    src={waha.qrUrl}
                    alt="QR Code WhatsApp"
                    className="w-48 h-48 object-contain"
                  />
                ) : (
                  <div className="text-center text-black/60 font-mono text-xs space-y-2 py-8">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto text-black/40" />
                    <p>Génération du QR Code en cours…</p>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => waha.restart()}
                className="w-full py-2.5 px-4 rounded-xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 hover:bg-[#D4AF37]/20 text-xs font-mono text-[#E0C583] transition cursor-pointer flex items-center justify-center gap-2"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Régénérer un nouveau QR Code</span>
              </button>
            </div>
          )}
        </div>

        {/* CARTE 2 : AUTOMATISATIONS SIMPLES & ENCAISSEMENT */}
        <div className="spotlight-card p-6 sm:p-7 space-y-5 rounded-2xl border border-white/[0.1] bg-[#08090D]">
          <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-[#00E599]/10 border border-[#00E599]/30 flex items-center justify-center text-[#00E599]">
                <Zap className="w-4 h-4" />
              </div>
              <h2 className="font-heading text-lg font-bold text-white">Automatisations</h2>
            </div>

            {/* Toggle Autopilot */}
            <button
              type="button"
              onClick={() => setAutopilot(!autopilot)}
              className={`px-3 py-1 rounded-full font-mono text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer ${
                autopilot
                  ? 'bg-[#00E599]/15 text-[#00E599] border border-[#00E599]/30'
                  : 'bg-white/10 text-[#8E94A3] border border-white/10'
              }`}
            >
              <Power className="w-3.5 h-3.5" />
              <span>{autopilot ? 'Pilote Activé' : 'En Pause'}</span>
            </button>
          </div>

          <div className="space-y-4 text-xs">
            {/* Message d'accueil */}
            <div>
              <label className="block text-[#C7CAD4] font-medium mb-1.5">
                Message d'accueil automatique
              </label>
              <textarea
                rows={3}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder="Message envoyé au client lorsqu'il vous écrit pour la première fois..."
                className="w-full bg-[#040507] border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#D4AF37] font-sans text-xs leading-relaxed"
              />
            </div>

            {/* Coordonnées de paiement */}
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              <div className="text-[#C7CAD4] font-medium">Coordonnées d'encaissement (Wave / Orange Money)</div>
              <p className="text-[11px] text-[#8E94A3]">
                Ces informations sont transmises automatiquement au client pour qu'il effectue le paiement sur votre numéro.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8E94A3] text-[11px] mb-1">Numéro Mobile Money</label>
                  <input
                    type="text"
                    value={paymentPhone}
                    onChange={(e) => setPaymentPhone(e.target.value)}
                    placeholder="Ex: +225 07 00 00 00 00"
                    className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
                <div>
                  <label className="block text-[#8E94A3] text-[11px] mb-1">Nom du titulaire Wave/OM</label>
                  <input
                    type="text"
                    value={paymentName}
                    onChange={(e) => setPaymentName(e.target.value)}
                    placeholder="Ex: Awa Diallo"
                    className="w-full bg-[#040507] border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>
              </div>
            </div>

            {/* Vocal de démonstration automatique */}
            <div className="pt-2 border-t border-white/[0.06] flex items-center justify-between">
              <div className="pr-4">
                <div className="text-[#C7CAD4] font-medium">Envoyer le vocal de procédure</div>
                <div className="text-[11px] text-[#8E94A3]">
                  Envoie automatiquement un vocal expliquant comment se déroule la création.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAutoVoice(!autoVoice)}
                className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer shrink-0 ${
                  autoVoice ? 'bg-[#D4AF37]' : 'bg-white/10'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform ${
                    autoVoice ? 'left-5.5' : 'left-0.5'
                  }`}
                />
              </button>
            </div>

            {/* Bouton d'enregistrement */}
            <div className="pt-3">
              <button
                type="button"
                onClick={handleSaveSettings}
                className="w-full py-3 rounded-xl btn-apple-pro text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSaved ? (
                  <>
                    <Check className="w-4 h-4 text-[#00E599]" />
                    <span>Réglages Enregistrés !</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Enregistrer les Automatisations</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
};
