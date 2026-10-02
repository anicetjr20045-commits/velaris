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
  Activity
} from 'lucide-react';
import { useWahaHeartbeat, useWahaSession } from '../hooks/useWaha';
import { useAuth } from '../hooks/useAuth';
import { useAdminAccess } from '../hooks/useAdmin';
import { WAHA_CONFIG, wahaSessionNameFor } from '../services/waha';

const panel = 'rounded-2xl border border-white/[0.08] bg-[#0E1015]';

const LINK_LABEL: Record<string, { label: string; tone: string; dot: string }> = {
  online: { label: 'En ligne', tone: 'text-emerald-400', dot: 'bg-emerald-400' },
  scan: { label: 'QR à scanner', tone: 'text-amber-300', dot: 'bg-amber-400' },
  reconnecting: { label: 'Reconnexion', tone: 'text-sky-300', dot: 'bg-sky-400' },
  connecting: { label: 'Connexion', tone: 'text-neutral-400', dot: 'bg-neutral-500' },
  offline: { label: 'Hors ligne', tone: 'text-rose-400', dot: 'bg-rose-500' },
};

const formatPhone = (id?: string | null) => {
  const d = (id || '').split('@')[0].replace(/\D/g, '');
  if (!d) return null;
  return `+${d.slice(0, 3)} ${d.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ')}`.trim();
};

/* ------------------------------------------------------------------ */
/* Carte d'une ligne WhatsApp                                         */
/* ------------------------------------------------------------------ */

const LineCard: FC<{
  sessionName: string;
  title: string;
  role: string;
  /** Ligne préservée : aucune action d'écriture possible depuis le web */
  readOnly?: boolean;
  /** Le studio connecté peut relancer / déconnecter sa ligne */
  manageable?: boolean;
}> = ({ sessionName, title, role, readOnly = false, manageable = true }) => {
  const waha = useWahaSession(sessionName, { readOnly });
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

  return (
    <article className={`${panel} p-5 sm:p-6 space-y-4`}>
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.03] flex items-center justify-center font-mono text-[12px] font-bold text-white">
            {title.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold tracking-tight text-white">{title}</h3>
              <span className="rounded-md border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{role}</span>
              {waha.readOnly && (
                <span className="inline-flex items-center gap-1 rounded-md border border-white/[0.08] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-400">
                  <Lock className="h-2.5 w-2.5" />
                  Préservée
                </span>
              )}
            </div>
            <p className="mt-0.5 font-mono text-[12px] text-neutral-500 truncate">session · {sessionName}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 font-mono text-[12px] ${meta.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${link.state === 'online' ? 'vx-breathe' : ''}`} />
          {meta.label}
        </span>
      </header>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06]">
        {[
          { k: 'Numéro', v: phone ?? '—' },
          { k: 'Latence', v: link.latencyMs !== null ? `${link.latencyMs} ms` : '—' },
          { k: 'Statut WAHA', v: waha.status },
        ].map(({ k, v }) => (
          <div key={k} className="bg-[#08090C] px-3.5 py-3">
            <dt className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{k}</dt>
            <dd className="mt-1 truncate font-mono text-[13px] tabular-nums text-white">{v}</dd>
          </div>
        ))}
      </dl>

      {!waha.isOnline && canAct && (
        <div className="rounded-xl border border-white/[0.06] bg-[#08090C] p-5 flex flex-col sm:flex-row items-center gap-5">
          <div className="h-44 w-44 shrink-0 rounded-xl bg-white p-2.5 flex items-center justify-center">
            {waha.qrUrl ? (
              <img src={waha.qrUrl} alt="QR code d'appairage WhatsApp" className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 rounded-lg bg-[#0E1015] p-3 text-center">
                <Loader2 className="h-5 w-5 animate-spin text-neutral-400" />
                <span className="text-[11px] text-neutral-400">{waha.status === 'FAILED' ? 'Session à relancer' : 'Préparation du QR'}</span>
              </div>
            )}
          </div>
          <div className="space-y-3 text-sm text-neutral-300">
            <p>WhatsApp sur le téléphone du studio, puis <strong className="text-white">Appareils connectés</strong> et <strong className="text-white">Connecter un appareil</strong>.</p>
            <p className="text-[12px] text-neutral-500">Le QR se renouvelle seul toutes les 18 secondes. Une session en échec est relancée automatiquement (3 tentatives).</p>
            <button
              type="button"
              disabled={busy}
              onClick={() => run(waha.restart)}
              className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
              Relancer la session
            </button>
          </div>
        </div>
      )}

      {(waha.isOnline || !canAct) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-neutral-400">
            {waha.readOnly
              ? 'Ligne de gouvernance : surveillée en lecture seule, aucune action possible depuis le web.'
              : waha.isOnline
                ? 'Réception des briefs et envois actifs. Reconnexion automatique en cas de coupure.'
                : 'Ligne surveillée.'}
          </p>
          {canAct && waha.isOnline && (
            confirmStop ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => run(waha.stop)}
                  className="rounded-full border border-rose-500/40 bg-rose-500/15 px-3.5 py-1.5 text-[13px] font-semibold text-rose-200 hover:bg-rose-500/25 cursor-pointer"
                >
                  Confirmer
                </button>
                <button type="button" onClick={() => setConfirmStop(false)} className="rounded-full border border-white/[0.08] px-3.5 py-1.5 text-[13px] text-neutral-300 cursor-pointer">
                  Annuler
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmStop(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] px-3.5 py-1.5 text-[13px] text-neutral-300 hover:border-rose-500/40 hover:text-rose-300 transition-colors cursor-pointer"
              >
                <Power className="h-3.5 w-3.5" />
                Déconnecter
              </button>
            )
          )}
          {link.state === 'offline' && canAct && (
            <button type="button" onClick={() => link.reconnect()} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.12] px-3.5 py-1.5 text-[13px] text-white cursor-pointer">
              <RotateCw className="h-3.5 w-3.5" />
              Reconnecter
            </button>
          )}
        </div>
      )}
    </article>
  );
};

/* ------------------------------------------------------------------ */
/* Console de test d'envoi                                            */
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
    <section className={`${panel} p-5 sm:p-6 space-y-4`}>
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] pb-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Terminal className="h-4 w-4 text-neutral-300" strokeWidth={1.6} />
          Test d'envoi depuis {sessionName}
        </h2>
        <span className="font-mono text-[11px] uppercase tracking-wider text-neutral-500">Envoi réel</span>
      </div>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-[200px_1fr_auto] gap-3">
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder="+226 70 00 00 00"
          aria-label="Numéro destinataire"
          className="rounded-lg border border-white/[0.08] bg-[#08090C] px-3 py-2 font-mono text-[13px] text-white outline-none focus:border-white/25"
          required
        />
        <input
          type="text"
          value={message}
          onChange={e => setMessage(e.target.value)}
          aria-label="Message de test"
          className="rounded-lg border border-white/[0.08] bg-[#08090C] px-3 py-2 text-[13px] text-white outline-none focus:border-white/25"
          required
        />
        <button
          type="submit"
          disabled={sending}
          className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-black hover:bg-neutral-200 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Envoyer
        </button>
      </form>
      {result && (
        <div role="status" className={`flex items-center gap-2 rounded-lg border p-3 text-[13px] ${
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
/* Vue                                                                */
/* ------------------------------------------------------------------ */

export const WhatsAppLinesView: FC = () => {
  const { user, openAuthModal } = useAuth();
  const access = useAdminAccess();
  const ownSession = wahaSessionNameFor(user?.id);
  const isDirection = access === 'admin' || access === 'unconfigured';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-neutral-500">
            <Radio className="h-3.5 w-3.5" strokeWidth={1.6} />
            Passerelle WAHA · {new URL(WAHA_CONFIG.baseUrl).host}
          </div>
          <h1 className="mt-1.5 text-3xl sm:text-4xl font-bold tracking-tight text-white">Lignes WhatsApp</h1>
          <p className="mt-1.5 max-w-xl text-sm text-neutral-400">
            Chaque studio pilote uniquement sa propre ligne. Sonde toutes les 20 s, reconnexion automatique et QR renouvelé en continu.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-white/[0.08] px-3 py-1 font-mono text-[11px] text-neutral-400">
          <Activity className="h-3 w-3" />
          Transport {WAHA_CONFIG.mode === 'proxy' ? 'proxy sécurisé' : 'direct'}
        </span>
      </div>

      {!user ? (
        <section className={`${panel} p-8 text-center space-y-4`}>
          <ShieldCheck className="mx-auto h-8 w-8 text-neutral-400" strokeWidth={1.4} />
          <div>
            <h2 className="text-lg font-semibold text-white">Connectez votre studio pour lier votre ligne</h2>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-neutral-400">
              En démonstration, aucune ligne réelle n'est sollicitée. Votre compte vous attribue une session WhatsApp privée et étanche.
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal()}
            className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Créer mon studio ou me connecter
          </button>
        </section>
      ) : (
        <>
          <LineCard sessionName={ownSession} title="Ma ligne studio" role="Réception des briefs" />
          <SendConsole sessionName={ownSession} />

          {isDirection && (
            <section className="space-y-4">
              <h2 className="font-mono text-[11px] uppercase tracking-widest text-neutral-500">Lignes de la direction</h2>
              <LineCard sessionName={WAHA_CONFIG.defaultSession} title="Ligne principale" role="Studio Velaris" />
              <LineCard sessionName={WAHA_CONFIG.secondarySession} title="Velaris Digital" role="Supervision" readOnly manageable={false} />
            </section>
          )}
        </>
      )}
    </div>
  );
};
