import { useState, type FC } from 'react';
import { 
  RotateCw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send, 
  Radio, 
  ShieldCheck, 
  Terminal 
} from 'lucide-react';
import { useWahaSession } from '../hooks/useWaha';

export const WhatsAppLinesView: FC = () => {
  const wahaAlex = useWahaSession('Test');
  const wahaAnicet = useWahaSession('anicet2');

  const [showToast, setShowToast] = useState(true);
  const [testPhone, setTestPhone] = useState('+22656240533');
  const [testMessage, setTestMessage] = useState('Bonjour depuis Velaris Studio OS');
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
          text: `Message transmis avec succès via WAHA (ID: ${res.messageId || 'confirmé'})`,
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
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#0E0C0A] border border-[#2D261E] text-neutral-300 text-[13px] shadow-sm">
          <div className="flex items-center gap-2.5">
            <Radio className="h-3.5 w-3.5 text-emerald-400 animate-pulse shrink-0" />
            <span className="font-mono text-[12.5px]">
              Passerelle WAHA connectée à <span className="text-white font-semibold">waha.velarisagent.life</span>. Nœuds actifs.
            </span>
          </div>
          <button
            onClick={() => setShowToast(false)}
            className="text-neutral-500 hover:text-white cursor-pointer ml-4 font-mono text-[13px]"
          >
            Fermer
          </button>
        </div>
      )}

      {/* 1. En-tête Lignes WhatsApp */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11.5px] font-mono tracking-wider text-neutral-300 uppercase">
              TÉLÉCOM STUDIO
            </span>
            <span className="text-[13px] font-mono text-neutral-500">Passerelle WAHA VPS</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight mt-1">
            Lignes WhatsApp & Passerelles
          </h1>
          <p className="text-[13px] text-[#A8A29E] mt-1 max-w-xl">
            Sessions WhatsApp reliées au serveur VPS. Réponses, commandes et notifications 100% étanches.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-neutral-300 hover:text-white border border-[#2D261E] text-[13px] font-mono transition-all cursor-pointer shrink-0 self-start sm:self-auto"
        >
          <RotateCw className={`h-3.5 w-3.5 ${wahaAlex.isLoading ? 'animate-spin' : ''}`} />
          <span>Actualiser</span>
        </button>
      </div>

      {/* Sous-titre */}
      <div className="flex items-center justify-between pt-1">
        <h2 className="text-[11.5px] font-mono uppercase tracking-widest text-neutral-500">
          SESSIONS MATÉRIELLES WAHA
        </h2>
        <div className="flex items-center gap-2 text-[11.5px] text-[#A8A29E] font-mono">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Stream Baileys Actif</span>
        </div>
      </div>

      {/* 2. Liste des cartes d'agents WhatsApp */}
      <div className="space-y-4">
        {/* Agent 1 : Ligne Principale Alex (+226 56 24 05 33 - Session 'Test') */}
        <div className={`rounded-2xl border p-6 space-y-4 transition-all ${
          wahaAlex.isOnline 
            ? 'border-emerald-500/20 bg-[#0E0C0A]' 
            : 'border-[#2D261E] bg-[#0E0C0A]'
        }`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-[#2D261E] text-white font-mono font-bold flex items-center justify-center text-[13px] shadow-inner">
                AL
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white tracking-tight">Alex</span>
                  <span className="text-[10.5px] px-2 py-0.5 rounded font-mono bg-white/[0.04] text-neutral-300 border border-[#2D261E]">
                    Ligne Principale Studio
                  </span>
                </div>
                <p className="text-[13px] text-[#A8A29E] mt-0.5 font-mono text-[12.5px]">
                  Réceptionniste commercial • Briefs vocaux & Offres • Session : <span className="text-white">Test</span>
                </p>
              </div>
            </div>

            <div className={`inline-flex items-center gap-1.5 text-[13px] font-mono shrink-0 ${
              wahaAlex.isOnline ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${
                wahaAlex.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'
              }`} />
              <span>
                {wahaAlex.isOnline ? 'Connecté & En ligne' : wahaAlex.status === 'STARTING' ? 'Démarrage...' : 'Scan QR Requis'}
              </span>
            </div>
          </div>

          {/* Si la session est en ligne */}
          {wahaAlex.isOnline ? (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="font-mono text-sm font-bold text-white tracking-wider">
                    +226 56 24 05 33
                  </div>
                  <div className="text-[12.5px] text-[#A8A29E] mt-0.5">
                    Ligne WhatsApp active • Réception des briefs vocaux et transmission instantanée.
                  </div>
                </div>
              </div>

              <button
                onClick={() => wahaAlex.stop()}
                className="px-3.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-rose-500/20 hover:text-rose-300 text-[#A8A29E] border border-[#2D261E] text-[13px] font-mono transition-all cursor-pointer self-start sm:self-auto shrink-0"
              >
                Déconnecter
              </button>
            </div>
          ) : (
            /* Si scan QR requis ou session arrêtée */
            <div className="rounded-xl border border-[#2D261E] bg-[#1A1713] p-6 text-center space-y-4">
              <div>
                <h3 className="text-sm font-bold text-white mb-1">
                  Scannez ce QR Code pour activer la ligne Alex (+226 56 24 05 33)
                </h3>
                <p className="text-[13px] text-[#A8A29E] max-w-md mx-auto">
                  WhatsApp sur téléphone (+22656240533) → Paramètres → Appareils connectés → Connecter un appareil.
                </p>
              </div>

              <div className="inline-block p-4 rounded-xl bg-white shadow-2xl relative overflow-hidden">
                {wahaAlex.status === 'SCAN_QR_CODE' ? (
                  <img
                    src={wahaAlex.qrUrl}
                    alt="QR Code WAHA WhatsApp"
                    className="h-44 w-44 object-contain"
                  />
                ) : (
                  <div className="h-44 w-44 flex flex-col items-center justify-center bg-[#14120E] text-white text-xs p-4 text-center rounded-lg space-y-2">
                    <Loader2 className="h-6 w-6 text-[#E5B54F] animate-spin" />
                    <span className="font-semibold text-neutral-200">
                      {wahaAlex.status === 'FAILED' ? 'Session à relancer' : 'Génération du QR Code...'}
                    </span>
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Statut : {wahaAlex.status}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
                <div className="flex items-center gap-2 text-[13px] text-[#A8A29E] font-mono">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-white" />
                  <span>Statut WAHA : {wahaAlex.status}</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => wahaAlex.restart()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white hover:bg-neutral-200 text-[13px] font-semibold text-black cursor-pointer shadow-sm"
                  >
                    <RotateCw className="h-3 w-3" />
                    <span>Relancer la session</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agent 2 : Superviseur Velaris Digital (+226 58 35 77 72 - Session 'anicet2') */}
        <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-white/[0.04] border border-[#2D261E] text-white font-mono font-bold flex items-center justify-center text-[13px] shadow-inner">
                VD
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white tracking-tight">Velaris Digital</span>
                  <span className="text-[10.5px] px-2 py-0.5 rounded font-mono bg-white/[0.04] text-neutral-300 border border-[#2D261E]">
                    Supervision & Alertes Caisse
                  </span>
                </div>
                <p className="text-[13px] text-[#A8A29E] mt-0.5 font-mono text-[12.5px]">
                  Alertes de nouveaux briefs & récapitulatifs comptables • Session : <span className="text-white">anicet2</span>
                </p>
              </div>
            </div>

            <div className="inline-flex items-center gap-1.5 text-[13px] text-emerald-400 font-mono shrink-0">
              <span className={`h-1.5 w-1.5 rounded-full ${wahaAnicet.isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-neutral-500'}`} />
              <span>{wahaAnicet.isOnline ? 'Connecté (WORKING)' : 'Déconnecté'}</span>
            </div>
          </div>

          <div className="rounded-xl border border-[#2D261E]/60 bg-[#1A1713] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div>
                <div className="font-mono text-sm font-bold text-white tracking-wider">
                  +226 58 35 77 72
                </div>
                <div className="text-[12.5px] text-[#A8A29E] mt-0.5">
                  Ligne de gouvernance • Reçoit les alertes de nouveaux briefs complets et récapitulatifs comptables.
                </div>
              </div>
            </div>

            <span className="text-[13px] font-mono text-[#A8A29E] bg-white/[0.02] px-3 py-1.5 rounded-md border border-[#2D261E]">
              Session Préservée
            </span>
          </div>
        </div>

        {/* 3. Module Interactif : Test d'envoi WhatsApp en direct */}
        <div className="rounded-2xl border border-[#2D261E] bg-[#0E0C0A] p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 border-b border-[#2D261E] pb-3">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-white" />
              <h3 className="text-sm font-bold text-white tracking-tight">
                Console de Test d'Envoi WhatsApp (API WAHA)
              </h3>
            </div>
            <span className="text-[11.5px] text-neutral-500 font-mono uppercase tracking-wider">
              Envoi Direct Nœud
            </span>
          </div>

          <form onSubmit={handleSendTest} className="space-y-3 font-mono">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="text-[11.5px] uppercase tracking-wider text-[#A8A29E] block mb-1">Destinataire</label>
                <input
                  type="text"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  placeholder="+226..."
                  className="w-full bg-[#1A1713] border border-[#2D261E] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-white/20"
                  required
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[11.5px] uppercase tracking-wider text-[#A8A29E] block mb-1">Message Test</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    placeholder="Message..."
                    className="flex-1 bg-[#1A1713] border border-[#2D261E] rounded-lg px-3 py-2 text-[13px] text-white focus:outline-none focus:border-white/20 font-sans"
                    required
                  />
                  <button
                    type="submit"
                    disabled={isSendingTest}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-[13px] font-semibold transition-all disabled:opacity-50 cursor-pointer shrink-0 font-sans shadow-sm"
                  >
                    {isSendingTest ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                    <span>Tester</span>
                  </button>
                </div>
              </div>
            </div>

            {testResult && (
              <div className={`p-3 rounded-lg text-[13px] flex items-center gap-2 ${
                testResult.success 
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' 
                  : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
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
