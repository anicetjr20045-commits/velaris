import { useState, type FC, type FormEvent } from 'react';
import {
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Send,
  Radio,
  ShieldCheck,
  Terminal,
  Lock,
  Power,
  Activity,
  QrCode,
  Smartphone
} from 'lucide-react';
import { useWahaHeartbeat, useWahaSession } from '../hooks/useWaha';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdmin';
import { WAHA_CONFIG, wahaSessionNameFor } from '../services/waha';

const panel = 'rounded-3xl border border-white/[0.08] bg-[#0E1015] shadow-[0_20px_50px_rgba(0,0,0,0.5)]';

const LINK_LABEL: Record<string, { label: string; tone: string; dot: string }> = {
  online: { label: 'En ligne', tone: 'text-emerald-400', dot: 'bg-emerald-400' },
  scan: { label: 'QR à scanner', tone: 'text-amber-300', dot: 'bg-amber-400' },
  reconnecting: { label: 'Initialisation', tone: 'text-sky-300', dot: 'bg-sky-400' },
  connecting: { label: 'Connexion', tone: 'text-neutral-400', dot: 'bg-neutral-500' },
  offline: { label: 'En veille', tone: 'text-neutral-400', dot: 'bg-neutral-500' },
};

const formatPhone = (id?: string | null) => {
  const d = (id || '').split('@')[0].replace(/\D/g, '');
  if (!d) return null;
  return `+${d.slice(0, 3)} ${d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`.trim();
};

/* ------------------------------------------------------------------ */
/* Carte d'une ligne WhatsApp (Une seule ligne isolée et nette)       */
/* ------------------------------------------------------------------ */

const LineCard: FC<{
  sessionName: string;
  title: string;
  role: string;
  readOnly?: boolean;
  manageable?: boolean;
  syncToStudio?: boolean;
}> = ({ sessionName, title, role, readOnly = false, manageable = true, syncToStudio = false }) => {
  const waha = useWahaSession(sessionName, { readOnly, syncToStudio });
  const link = useWahaHeartbeat(sessionName, { autoReconnect: manageable && !readOnly });
  const [confirmStop, setConfirmStop] = useState(false);
  const [busy, setBusy] = useState(false);
  const meta = LINK_LABEL[link.state] ?? LINK_LABEL.connecting;
  const phone = formatPhone(waha.session?.me?.id);
  const canAct = manageable && !waha.readOnly;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
    setConfirmStop(false);
  };

  const isScanning = waha.isScanning && !!waha.qrUrl;

  return (
    <article className={`${panel} p-6 sm:p-8 space-y-6`}>
      {/* En-tête de la ligne */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] pb-5">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-12 w-12 shrink-0 rounded-2xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center font-mono text-sm font-bold text-white shadow-inner">
            {title.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold tracking-tight text-white">{title}</h3>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-300">
                {role}
              </span>
              {waha.readOnly && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-300">
                  <Lock className="h-2.5 w-2.5" />
                  Préservée
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-xs text-neutral-500 truncate">
              Identifiant de session · <span className="text-neutral-300">{sessionName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start">
          <span className={`inline-flex shrink-0 items-center gap-2 rounded-full border border-white/[0.08] bg-[#08090C] px-3 py-1 font-mono text-xs ${meta.tone}`}>
            <span className={`h-2 w-2 rounded-full ${meta.dot} ${link.state === 'online' ? 'animate-pulse' : ''}`} />
            {meta.label}
          </span>
        </div>
      </header>

      {/* Barre de télémétrie */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/[0.06] bg-white/[0.06]">
        {[
          { k: 'Numéro WhatsApp', v: phone ?? 'Non connecté' },
          { k: 'Latence Passerelle', v: link.latencyMs !== null ? `${link.latencyMs} ms` : '—' },
          { k: 'État Session', v: waha.status || 'STARTING' },
        ].map(({ k, v }) => (
          <div key={k} className="bg-[#08090C] px-4 py-3.5">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{k}</dt>
            <dd className="mt-1 truncate font-mono text-sm tabular-nums text-white font-medium">{v}</dd>
          </div>
        ))}
      </dl>

      {/* État 1 : La ligne est EN LIGNE */}
      {waha.isOnline ? (
        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] p-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 className="h-7 w-7" strokeWidth={1.75} />
          </div>
          <div>
            <h4 className="font-mono text-xl font-bold tabular-nums text-white">{phone ?? 'Ligne connectée'}</h4>
            <p className="text-xs text-emerald-300/90 mt-1 font-mono">Passerelle WhatsApp active · Messages entrants & sortants opérationnels</p>
          </div>

          {canAct && (
            <div className="pt-2 max-w-xs mx-auto">
              {confirmStop ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(waha.stop)}
                    className="flex-1 rounded-full border border-rose-500/40 bg-rose-500/20 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30 cursor-pointer transition-colors"
                  >
                    Confirmer la déconnexion
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmStop(false)}
                    className="flex-1 rounded-full border border-white/[0.08] bg-white/[0.04] py-2.5 text-xs text-neutral-300 hover:text-white cursor-pointer"
                  >
                    Annuler
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="w-full flex items-center justify-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 py-2.5 text-xs font-semibold text-rose-300 hover:bg-rose-500/20 cursor-pointer transition-colors"
                >
                  <Power className="h-3.5 w-3.5" />
                  Déconnecter cette ligne
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        /* État 2 : La ligne est EN ATTENTE DE SCAN ou EN VEILLE */
        <div className="rounded-2xl border border-white/[0.08] bg-[#08090C] p-6 space-y-6">
          {isScanning ? (
            <div className="flex flex-col md:flex-row items-center justify-center gap-8">
              {/* Conteneur QR Code Blanc Pur Haute Netteté */}
              <div className="relative h-60 w-60 shrink-0 rounded-2xl bg-white p-3.5 flex items-center justify-center shadow-[0_10px_40px_rgba(255,255,255,0.05)] border border-white/20">
                <img
                  src={waha.qrUrl!}
                  alt="QR code d'appairage WhatsApp"
                  className="h-full w-full object-contain"
                />
              </div>

              {/* Instructions de connexion claires */}
              <div className="space-y-4 max-w-sm text-left">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-emerald-400" />
                    Scannez pour connecter votre WhatsApp
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    La passerelle écoute en direct. Le QR code se rafraîchit automatiquement.
                  </p>
                </div>

                <ol className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-xs text-neutral-300 space-y-2">
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-[11px] tabular-nums text-emerald-400 font-bold">01</span>
                    <span>Ouvrez WhatsApp sur le smartphone de votre studio.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-[11px] tabular-nums text-emerald-400 font-bold">02</span>
                    <span>Allez dans <strong>Réglages</strong> ou <strong>Menu ⋮</strong> &gt; <strong>Appareils connectés</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="font-mono text-[11px] tabular-nums text-emerald-400 font-bold">03</span>
                    <span>Touchez <strong>Connecter un appareil</strong> et pointez la caméra vers ce code.</span>
                  </li>
                </ol>

                {canAct && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => run(waha.restart)}
                    className="inline-flex items-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.04] px-4 py-2 text-xs font-medium text-neutral-200 hover:bg-white/[0.08] hover:text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
                    <span>Rafraîchir le code QR</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Session arrêtée / en veille : bouton d'activation 1-clic direct */
            <div className="flex flex-col items-center justify-center text-center p-8 space-y-4 max-w-md mx-auto">
              <div className="flex h-16 w-16 items-center justify-center rounded-3xl border border-white/[0.08] bg-white/[0.03] text-white/80 shadow-inner">
                <QrCode className="h-8 w-8" strokeWidth={1.5} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-white">La passerelle WhatsApp est prête</h4>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Cliquez sur le bouton pour initialiser la session et afficher instantanément votre code QR d'appairage.
                </p>
              </div>

              {canAct ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(waha.restart)}
                  className="inline-flex items-center gap-2.5 rounded-full bg-white hover:bg-neutral-200 px-6 py-3 text-xs font-bold text-black transition-all cursor-pointer disabled:opacity-50 shadow-[0_10px_30px_rgba(255,255,255,0.15)]"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : <QrCode className="h-4 w-4 text-black" />}
                  <span>{busy ? 'Initialisation en cours…' : 'Activer et afficher le Code QR'}</span>
                </button>
              ) : (
                <p className="text-xs text-neutral-500 font-mono">Ligne en lecture seule</p>
              )}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

/* ------------------------------------------------------------------ */
/* Console de test d'envoi en direct                                  */
/* ------------------------------------------------------------------ */

const SendConsole: FC<{ sessionName: string }> = ({ sessionName }) => {
  const { sendText } = useWahaSession(sessionName, { enabled: false });
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('Bonjour depuis Velaris Studio');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; text: string } | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!message.trim() || phone.replace(/\D/g, '').length < 8 || sending) return;
    setSending(true);
    setResult(null);
    const res = await sendText(phone, message);
    setSending(false);
    setResult(res.success
      ? { success: true, text: `Transmis par WAHA${res.messageId ? ` · ID ${res.messageId.slice(-12)}` : ''}` }
      : { success: false, text: res.error || 'Envoi refusé : vérifiez que la ligne est connectée.' });
  };

  return (
    <section className={`${panel} p-6 sm:p-7 space-y-4`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="h-4 w-4 text-neutral-300" strokeWidth={1.6} />
          Tester un envoi direct depuis {sessionName}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Test en direct</span>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3">
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+226 70 00 00 00"
          aria-label="Numéro destinataire"
          className="rounded-xl border border-white/[0.08] bg-[#08090C] px-3.5 py-2.5 font-mono text-xs text-white outline-none focus:border-white/30"
          required
        />
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          aria-label="Message de test"
          className="rounded-xl border border-white/[0.08] bg-[#08090C] px-3.5 py-2.5 text-xs text-white outline-none focus:border-white/30"
          required
        />
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer
        </button>
      </form>
      {result && (
        <div role="status" className={`flex items-center gap-2 rounded-xl border p-3.5 text-xs ${
          result.success ? 'border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-300' : 'border-rose-500/20 bg-rose-500/[0.06] text-rose-300'
        }`}>
          {result.success ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {result.text}
        </div>
      )}
    </section>
  );
};

/* ------------------------------------------------------------------ */
/* Vue Principale avec Onglets Dédiés (Zéro Double Code, Zéro Slop)   */
/* ------------------------------------------------------------------ */

export const WhatsAppLinesView: FC = () => {
  const { user, openAuthModal } = useAuth();
  const access = useAdminAccess();
  const ownSession = wahaSessionNameFor(user?.id);
  // Seul l'administrateur formel a accès aux autres lignes
  const isRealAdmin = access === 'admin';

  // Gestion des onglets pour éviter toute superposition
  const [activeTab, setActiveTab] = useState<'studio' | 'test' | 'supervision'>('studio');

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* En-tête de page */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
            <Radio className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.6} />
            Passerelle WAHA · {new URL(WAHA_CONFIG.baseUrl).host}
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-white">Lignes WhatsApp</h1>
          <p className="mt-1.5 max-w-xl text-sm text-neutral-400">
            Chaque studio dispose de sa propre ligne WhatsApp dédiée et isolée pour recevoir les briefs et livrer les chansons.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-xs text-neutral-400">
          <Activity className="h-3 w-3 text-emerald-400" />
          Multi-tenant étanche
        </span>
      </div>

      {/* Si l'utilisateur est connecté et administrateur : Onglets de sélection */}
      {user && isRealAdmin && (
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.06] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'studio'
                ? 'bg-white text-black font-bold'
                : 'border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Ma ligne studio ({ownSession})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('test')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'test'
                ? 'bg-white text-black font-bold'
                : 'border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Ligne principale de démonstration (+226 56 24 05 33)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supervision')}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors cursor-pointer ${
              activeTab === 'supervision'
                ? 'bg-white text-black font-bold'
                : 'border border-white/[0.08] text-neutral-400 hover:text-white hover:bg-white/[0.04]'
            }`}
          >
            Ligne superviseur (+226 58 35 77 72)
          </button>
        </div>
      )}

      {/* Rendu selon l'état de connexion */}
      {!user ? (
        /* Visiteur non connecté : affichage de la ligne de test en découverte */
        <div className="space-y-6">
          <section className={`${panel} p-6 border-amber-500/20 bg-amber-500/[0.02]`}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-6 w-6 text-amber-400 shrink-0" />
                <div>
                  <h3 className="text-sm font-bold text-white">Mode découverte · Ligne principale</h3>
                  <p className="text-xs text-neutral-400">
                    Vous visualisez la ligne de test officielle (+226 56 24 05 33). Pour avoir votre propre ligne privée étanche, créez votre studio.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openAuthModal()}
                className="shrink-0 rounded-full bg-white px-5 py-2 text-xs font-bold text-black hover:bg-neutral-200 transition-colors cursor-pointer"
              >
                Créer mon studio privé
              </button>
            </div>
          </section>

          <LineCard
            sessionName={WAHA_CONFIG.defaultSession}
            title="Ligne principale Studio"
            role="Démonstration officielle"
            manageable={true}
          />
          <SendConsole sessionName={WAHA_CONFIG.defaultSession} />
        </div>
      ) : (
        /* Utilisateur connecté : affichage d'une SEULE ligne à la fois */
        <div className="space-y-6">
          {activeTab === 'studio' && (
            <>
              <LineCard
                sessionName={ownSession}
                title="Ma ligne studio"
                role="Réception & Livraison"
                manageable={true}
                syncToStudio={true}
              />
              <SendConsole sessionName={ownSession} />
            </>
          )}

          {activeTab === 'test' && isRealAdmin && (
            <>
              <LineCard
                sessionName={WAHA_CONFIG.defaultSession}
                title="Ligne principale Studio"
                role="Démonstration officielle"
                manageable={true}
              />
              <SendConsole sessionName={WAHA_CONFIG.defaultSession} />
            </>
          )}

          {activeTab === 'supervision' && isRealAdmin && (
            <LineCard
              sessionName={WAHA_CONFIG.secondarySession}
              title="Velaris Digital"
              role="Supervision direction"
              readOnly={true}
              manageable={false}
            />
          )}
        </div>
      )}
    </div>
  );
};
