import { useState, type FC } from 'react';
import { 
  Smartphone, 
  RotateCw, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Send,
  Radio,
  ShieldCheck
} from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';

export const WhatsAppLinesView: FC = () => {
  const wahaAlex = useWahaSession('Test');
  const wahaAnicet = useWahaSession('anicet2');

  const [showToast, setShowToast] = useState(true);
  const [testPhone, setTestPhone] = useState('+22656240533');
  const [testMessage, setTestMessage] = useState('Bonjour depuis Velaris Studio OS ! 🎵');
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; text: string } | null>(null);

  const handleManualRefresh = async () => {
    await Promise.all([wahaAlex.refresh(), wahaAnicet.refresh()]);
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testMessage.trim() || isSendingTest) return;
    setIsSendingTest(true);
    setTestResult(null);

    try {
      const res = await wahaAlex.sendText(testPhone, testMessage);
      if (res.success) {
        setTestResult({
          success: true,
          text: `Message envoyé avec succès via WAHA (ID: ${res.messageId || 'confirmé'})`,
        });
      } else {
        setTestResult({
          success: false,
          text: res.error || 'Erreur lors de l’envoi. Vérifiez le statut de la session.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        text: err.message || 'Impossible de contacter l’API WAHA',
      });
    } finally {
      setIsSendingTest(false);
      setTimeout(() => setTestResult(null), 6000);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Toast de notification en haut */}
      {showToast && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#14120e] border border-[#c5a059]/30 text-stone-200 text-xs shadow-lg animate-in fade-in duration-300">
          <div className="flex items-center gap-2.5">
            <Radio className="h-4 w-4 text-[#c5a059] animate-pulse shrink-0" />
            <span>
              Passerelle WAHA connectée à <span className="font-mono text-[#c5a059]">waha.velarisagent.life</span>. Statut synchronisé en temps réel.
            </span>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-stone-400 hover:text-white cursor-pointer ml-4 font-bold text-sm"
          >
            ×
          </button>
        </div>
      )}

      {/* 1. En-tête Lignes WhatsApp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Smartphone className="h-6 w-6 text-[#c5a059]" />
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6]">
              Lignes WhatsApp & Numéros
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xl">
            Sessions WhatsApp connectées en direct via la passerelle WAHA. Réponses, commandes et notifications 100 % étanches.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#141310] hover:bg-[#1e1c17] text-stone-200 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RotateCw className={`h-3.5 w-3.5 text-[#c5a059] ${wahaAlex.isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser les sessions</span>
        </button>
      </div>

      {/* Barre de sous-titre */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xs uppercase tracking-widest font-bold text-stone-400">
          Sessions WAHA Actives
        </h2>
        <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
          <span>API WAHA Live</span>
        </div>
      </div>

      {/* 2. Liste des cartes d'agents WhatsApp */}
      <div className="space-y-4">
        {/* Agent 1 : Ligne Principale Alex (+226 56 24 05 33 - Session 'Test') */}
        <div className={`rounded-2xl border p-6 shadow-xl space-y-4 transition-all ${
          wahaAlex.isOnline 
            ? 'border-emerald-500/30 bg-[#0e130f]' 
            : 'border-amber-500/30 bg-[#14120e]'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-[#e5c158] text-black font-bold flex items-center justify-center text-sm shadow-md relative">
                AL
                <span className="absolute -top-1 -right-1 h-3.5 w-3.5 rounded-full bg-amber-400 flex items-center justify-center text-[9px] text-black">
                  ★
                </span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold text-[#f3f4f6]">Alex</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/40 text-amber-300 font-semibold bg-amber-500/10">
                    Ligne Principale Studio
                  </span>
                </div>
                <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                  Réceptionniste commercial • Brief vocal & Offres • Session WAHA : <span className="font-mono text-white">Test</span>
                </p>
              </div>
            </div>

            <div className={`inline-flex items-center gap-1.5 text-xs font-medium shrink-0 ${
              wahaAlex.isOnline ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                wahaAlex.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
              }`} />
              <span>
                {wahaAlex.isOnline ? 'Connecté & En ligne' : wahaAlex.status === 'STARTING' ? 'Démarrage...' : 'Scan QR Requis'}
              </span>
            </div>
          </div>

          {/* Si la session est en ligne */}
          {wahaAlex.isOnline ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-sm font-bold text-white tracking-wider">
                    +226 56 24 05 33
                  </div>
                  <div className="text-[11px] text-stone-400 mt-0.5">
                    Ligne WhatsApp active • Sarah reçoit les notes vocales et valide les briefs automatiquement.
                  </div>
                </div>
              </div>

              <button
                onClick={() => wahaAlex.stop()}
                className="px-4 py-2 rounded-xl bg-[#1c1a15] hover:bg-[#28251e] text-stone-300 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                Déconnecter
              </button>
            </div>
          ) : (
            /* Si scan QR requis ou session arrêtée */
            <div className="rounded-xl border border-white/[0.06] bg-[#0c0b09] p-6 text-center space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Scannez ce QR Code pour activer la ligne Alex (+226 56 24 05 33)
                </h3>
                <p className="text-xs text-stone-400 max-w-md mx-auto">
                  Ouvrez WhatsApp sur votre téléphone (+22656240533) → Paramètres → Appareils connectés → Connecter un appareil.
                </p>
              </div>

              {/* Rendu du vrai QR code live WAHA */}
              <div className="inline-block p-4 rounded-2xl bg-white shadow-2xl relative">
                <img
                  src={wahaAlex.qrUrl}
                  alt="QR Code WAHA WhatsApp"
                  className="h-48 w-48 object-contain"
                  onError={(e) => {
                    // Si l'image n'est pas encore prête, fallback visuel élégant
                    e.currentTarget.style.display = 'none';
                    const parent = e.currentTarget.parentElement;
                    if (parent && !parent.querySelector('.qr-fallback')) {
                      const div = document.createElement('div');
                      div.className = 'qr-fallback h-48 w-48 flex flex-col items-center justify-center text-black text-xs gap-2 p-4 text-center';
                      div.innerHTML = '<span class="font-bold">Génération du QR Code...</span><span class="text-[10px] text-stone-600">Cliquez sur Relancer si nécessaire</span>';
                      parent.appendChild(div);
                    }
                  }}
                />
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <div className="flex items-center gap-2 text-xs text-stone-400 font-mono">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#c5a059]" />
                  <span>Statut WAHA : {wahaAlex.status}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => wahaAlex.restart()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#c5a059] hover:bg-[#d4af37] text-xs font-bold text-black cursor-pointer shadow"
                  >
                    <RotateCw className="h-3 w-3" />
                    <span>Relancer la session WAHA</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agent 2 : Superviseur Velaris Digital (+226 58 35 77 72 - Session 'anicet2') */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-6 shadow-xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center text-sm shadow-md">
                VD
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-lg font-bold text-[#f3f4f6]">Velaris Digital</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-emerald-500/40 text-emerald-300 font-semibold bg-emerald-500/10">
                    Supervision & Alertes Caisse
                  </span>
                </div>
                <p className="text-xs text-stone-400 line-clamp-1 mt-0.5">
                  Notification des paiements reçus • Session WAHA : <span className="font-mono text-white">anicet2</span>
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium shrink-0">
              <span className={`h-2 w-2 rounded-full ${wahaAnicet.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-stone-500'}`} />
              <span>{wahaAnicet.isOnline ? 'Connecté (WORKING)' : 'Déconnecté'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-white/[0.06] bg-[#0c0b09] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-mono text-sm font-bold text-white tracking-wider">
                  +226 58 35 77 72
                </div>
                <div className="text-[11px] text-stone-400 mt-0.5">
                  Ligne de gouvernance • Reçoit les alertes de nouveaux briefs complets et récapitulatifs comptables.
                </div>
              </div>
            </div>

            <span className="text-xs font-mono text-stone-400 bg-white/[0.04] px-3 py-1.5 rounded-lg border border-white/[0.06]">
              Session Préservée
            </span>
          </div>
        </div>

        {/* 3. Module Interactif : Test d'envoi WhatsApp en direct */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#14120e] p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-[#c5a059]" />
              <h3 className="font-serif text-base font-bold text-white">
                Tester l'envoi WhatsApp en direct (API WAHA)
              </h3>
            </div>
            <span className="text-[11px] text-stone-400 font-mono">
              Via session active
            </span>
          </div>

          <form onSubmit={handleSendTest} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-stone-400 block mb-1">Numéro destinataire</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+226..."
                  className="w-full bg-[#0c0b09] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#c5a059]"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs text-stone-400 block mb-1">Message à envoyer</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 bg-[#0c0b09] border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#c5a059]"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSendingTest}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#d4af37] text-black text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shrink-0"
                  >
                    {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Envoyer</span>
                  </button>
                </div>
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                testResult.success 
                  ? 'bg-emerald-950/40 text-emerald-300 border border-emerald-500/30' 
                  : 'bg-rose-950/40 text-rose-300 border border-rose-500/30'
              }`}>
                {testResult.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
                <span>{testResult.text}</span>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
