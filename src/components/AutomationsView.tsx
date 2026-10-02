import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type FC, type FormEvent } from 'react';
import {
  Check,
  ExternalLink,
  FileText,
  Loader2,
  Mic,
  Paperclip,
  Pencil,
  Plus,
  Trash2,
  Type,
  Upload,
  Video,
  X,
  type LucideIcon
} from 'lucide-react';
import type { AutomationLog, AutomationMediaKind, AutomationRule } from '../types';
import { REAL_AUTOMATION_RULES, REAL_AUTOMATION_LOGS } from '../data/realProductionData';
import { useAuth } from '../hooks/useAuth';
import { useStudioLive } from '../hooks/useStudioLive';
import {
  AUTOMATION_MEDIA_MAX_BYTES,
  deleteAutomationRule,
  getAutomationMediaUrl,
  getLiveAutomationRules,
  removeAutomationMedia,
  saveAutomationRule,
  setAllAutomationRulesEnabled,
  setAutomationRuleEnabled,
  uploadAutomationMedia
} from '../services/supabase';
import { WaveformPlayer } from './WaveformPlayer';
import { VoiceNoteRecorder, type VoiceRecording } from './VoiceNoteRecorder';

const MAX_LOGS = 50;

const stamp = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const STATUS_STYLE: Record<AutomationLog['status'], string> = {
  Envoyé: 'bg-[#E5B54F] text-[#0C0A09]',
  Activée: 'bg-[#E5B54F]/[0.14] text-[#F3CA75] border border-[#E5B54F]/40',
  Coupée: 'bg-white/[0.05] text-[#A8A29E] border border-[#3A3022]',
  Échoué: 'bg-[#E11D48]/15 text-[#FDA4AF] border border-[#E11D48]/40',
};

const inputClass =
  'w-full rounded-xl border border-[#3A3022] bg-[#0E0C0A] px-3.5 py-2.5 text-[15px] text-white placeholder:text-[#78716C] outline-none focus:border-[#E5B54F]/60 transition-colors';

const MEDIA_KINDS: { id: AutomationMediaKind; label: string; pill: string; icon: LucideIcon; accept?: string; hint: string }[] = [
  { id: 'text', label: 'Texte', pill: 'Envoyer un texte', icon: Type, hint: 'Message écrit personnalisé.' },
  {
    id: 'voice',
    label: 'Note vocale',
    pill: 'Envoyer une note vocale',
    icon: Mic,
    accept: 'audio/ogg,audio/opus,audio/mpeg,audio/mp4,audio/x-m4a,audio/webm,.ogg,.opus,.mp3,.m4a',
    hint: 'Arrive comme un vocal WhatsApp natif (PTT), micro vert et forme d’onde.',
  },
  {
    id: 'document',
    label: 'Document',
    pill: 'Envoyer un document',
    icon: FileText,
    accept: 'application/pdf,image/png,image/jpeg,.pdf,.png,.jpg,.jpeg',
    hint: 'Grille tarifaire, reçu ou visuel : PDF ou image.',
  },
  { id: 'video', label: 'Vidéo', pill: 'Envoyer une vidéo', icon: Video, accept: 'video/mp4,video/quicktime,.mp4,.mov', hint: 'Démo ou extrait de clip, MP4 de préférence.' },
];
const KIND_META = Object.fromEntries(MEDIA_KINDS.map(k => [k.id, k])) as Record<AutomationMediaKind, (typeof MEDIA_KINDS)[number]>;

const formatBytes = (n?: number) =>
  n === undefined ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} Ko` : `${(n / 1024 / 1024).toFixed(1)} Mo`;

interface DraftMedia {
  /** Fichier à téléverser à l'enregistrement (absent si le média est déjà en base) */
  blob?: Blob;
  url?: string;
  path?: string;
  name: string;
  size?: number;
  durationSec?: number;
  peaks?: number[];
}

interface Draft {
  id?: string;
  name: string;
  emoji: string;
  kind: AutomationMediaKind;
  action: string;
  media?: DraftMedia;
}

const EMPTY_DRAFT: Draft = { name: '', emoji: '', kind: 'text', action: '' };

/* ------------------------------------------------------------------ */
/* Aperçu du média tel que reçu par le client                         */
/* ------------------------------------------------------------------ */

const MediaPreview: FC<{ kind: AutomationMediaKind; url?: string; name?: string; size?: number; durationSec?: number; peaks?: number[]; seed: string }> = ({
  kind,
  url,
  name,
  size,
  durationSec,
  peaks,
  seed,
}) => {
  if (kind === 'voice') {
    return (
      <div className="max-w-sm rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 shadow-[0_8px_24px_-12px_rgba(255,255,255,0.25)]">
        <WaveformPlayer seed={seed} src={url} peaks={peaks} durationHint={durationSec} tone="light" />
        <div className="mt-1 flex items-center gap-1 font-mono text-[11px] text-[#8A6420]">
          <Mic className="h-2.5 w-2.5" />
          Note vocale
        </div>
      </div>
    );
  }
  if (kind === 'video') {
    return url ? (
      <video src={url} controls preload="metadata" playsInline className="w-full max-w-sm rounded-xl border border-[#2D261E] bg-black" />
    ) : (
      <div className="flex max-w-sm items-center gap-2.5 rounded-xl border border-[#2D261E] bg-[#0E0C0A] px-3.5 py-3 text-sm text-[#A8A29E]">
        <Video className="h-4 w-4 shrink-0 text-[#E5B54F]" strokeWidth={1.6} />
        <span className="truncate">{name || 'Vidéo'}</span>
      </div>
    );
  }
  return (
    <div className="flex max-w-sm items-center gap-3 rounded-xl border border-[#2D261E] bg-[#0E0C0A] px-3.5 py-3">
      <span className="flex h-10 w-9 shrink-0 items-center justify-center rounded-md border border-[#3A3022] bg-[#171512] font-mono text-[10px] uppercase text-[#F3CA75]">
        {(name?.split('.').pop() || 'doc').slice(0, 4)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-white">{name || 'Document'}</div>
        {size !== undefined && <div className="font-mono text-xs tabular-nums text-[#78716C]">{formatBytes(size)}</div>}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Ouvrir ${name || 'le document'}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#A8A29E] hover:text-[#F3CA75] hover:bg-[#E5B54F]/[0.08] transition-colors"
        >
          <ExternalLink className="h-4 w-4" strokeWidth={1.6} />
        </a>
      )}
    </div>
  );
};

export const AutomationsView: FC = () => {
  const { user } = useAuth();
  const { data: rules, setData: setRules, syncedAt } = useStudioLive<AutomationRule[]>(
    getLiveAutomationRules,
    user ? [] : REAL_AUTOMATION_RULES,
    ['automation_rules'],
    [user?.id],
    { enabled: !!user }
  );
  const [logs, setLogs] = useState<AutomationLog[]>(user ? [] : REAL_AUTOMATION_LOGS);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  /* URLs signées des médias en base (path -> url), valables une heure */
  const [signed, setSigned] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  /* URLs objet créées localement, libérées en quittant la vue */
  const localUrls = useRef<Set<string>>(new Set());

  useEffect(() => {
    const urls = localUrls.current;
    return () => urls.forEach(u => URL.revokeObjectURL(u));
  }, []);

  const mediaPaths = rules.map(r => r.mediaPath).filter((p): p is string => !!p);
  const missingKey = mediaPaths.filter(p => !signed[p]).join('|');
  useEffect(() => {
    if (!user || !missingKey) return;
    let cancelled = false;
    Promise.all(missingKey.split('|').map(async p => [p, await getAutomationMediaUrl(p)] as const)).then(entries => {
      if (cancelled) return;
      const found = entries.filter((e): e is readonly [string, string] => !!e[1]);
      if (found.length) setSigned(prev => ({ ...prev, ...Object.fromEntries(found) }));
    });
    return () => {
      cancelled = true;
    };
  }, [user, missingKey]);

  const urlOf = (rule: AutomationRule) => rule.mediaUrl || (rule.mediaPath ? signed[rule.mediaPath] : undefined);

  const pushLog = (ruleName: string, status: AutomationLog['status'], recipient = 'Studio') => {
    setLogs(prev => [{ id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, ruleName, recipient, status, date: stamp() }, ...prev].slice(0, MAX_LOGS));
  };

  /* Écriture optimiste : l'état local change tout de suite, Supabase suit (RLS) */
  const persist = async (op: () => Promise<boolean | string | null>, rollback: () => void) => {
    if (!user) return;
    const ok = await op();
    if (!ok) {
      rollback();
      setError("La base studio n'a pas accepté la modification. Vérifiez votre connexion.");
    }
  };

  const handleToggleRule = (rule: AutomationRule) => {
    const next = !rule.active;
    setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, active: next } : r)));
    pushLog(rule.name, next ? 'Activée' : 'Coupée');
    persist(
      () => setAutomationRuleEnabled(rule.id, next),
      () => setRules(prev => prev.map(r => (r.id === rule.id ? { ...r, active: rule.active } : r)))
    );
  };

  const allOff = rules.length > 0 && rules.every(r => !r.active);

  const handleCutAll = () => {
    const snapshot = rules;
    const next = allOff;
    setRules(prev => prev.map(r => ({ ...r, active: next })));
    pushLog('Toutes les règles', next ? 'Activée' : 'Coupée');
    persist(() => setAllAutomationRulesEnabled(next), () => setRules(snapshot));
  };

  const trackUrl = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    localUrls.current.add(url);
    return url;
  };

  const setDraftKind = (kind: AutomationMediaKind) => {
    if (!draft || draft.kind === kind) return;
    setRecording(false);
    setDraft({ ...draft, kind, media: undefined });
  };

  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !draft) return;
    if (file.size > AUTOMATION_MEDIA_MAX_BYTES) {
      setError('Fichier trop lourd : WhatsApp et le studio acceptent 16 Mo maximum.');
      return;
    }
    setError(null);
    setDraft({ ...draft, media: { blob: file, url: trackUrl(file), name: file.name, size: file.size } });
  };

  const onRecorded = (rec: VoiceRecording) => {
    localUrls.current.add(rec.url);
    const ext = rec.mimeType.includes('ogg') ? 'ogg' : rec.mimeType.includes('mp4') ? 'm4a' : 'webm';
    setDraft(d => d && { ...d, media: { blob: rec.blob, url: rec.url, name: `vocal-${Date.now()}.${ext}`, size: rec.blob.size, durationSec: rec.durationSec, peaks: rec.peaks } });
    setRecording(false);
  };

  const openEdit = (rule: AutomationRule) => {
    const kind = rule.kind ?? 'text';
    setRecording(false);
    setDraft({
      id: rule.id,
      name: rule.name,
      emoji: rule.emoji,
      kind,
      action: rule.action,
      media: kind !== 'text' && (rule.mediaPath || rule.mediaUrl)
        ? { path: rule.mediaPath, url: urlOf(rule), name: rule.mediaName || 'Média' }
        : undefined,
    });
  };

  const closeForm = () => {
    setDraft(null);
    setRecording(false);
  };

  const draftReady = !!draft && !!draft.name.trim() && !!draft.emoji.trim() && (draft.kind === 'text' ? !!draft.action.trim() : !!draft.media);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draftReady) return;
    setSaving(true);
    setError(null);
    const existing = draft.id ? rules.find(r => r.id === draft.id) : undefined;
    const media = draft.kind === 'text' ? undefined : draft.media;
    const rule: AutomationRule = {
      id: draft.id ?? `auto-${Date.now()}`,
      name: draft.name.trim(),
      emoji: draft.emoji.trim(),
      action: draft.action.trim(),
      active: existing?.active ?? true,
      kind: draft.kind,
      mediaPath: media?.path,
      mediaUrl: media?.blob ? media.url : undefined,
      mediaName: media?.name,
    };

    if (user) {
      if (media?.blob) {
        const up = await uploadAutomationMedia(media.blob, media.name);
        if ('error' in up) {
          setSaving(false);
          setError(`Le média n'a pas pu être téléversé : ${up.error}`);
          return;
        }
        rule.mediaPath = up.path;
      }
      const savedId = await saveAutomationRule({ ...rule, id: draft.id });
      if (!savedId) {
        if (media?.blob && rule.mediaPath) removeAutomationMedia(rule.mediaPath);
        setSaving(false);
        setError("Impossible d'enregistrer la règle dans votre studio.");
        return;
      }
      rule.id = savedId;
      if (rule.mediaPath && media?.url) setSigned(prev => ({ ...prev, [rule.mediaPath as string]: media.url as string }));
      // L'ancien média remplacé ne sert plus à aucune règle
      if (existing?.mediaPath && existing.mediaPath !== rule.mediaPath) removeAutomationMedia(existing.mediaPath);
    }

    setRules(prev => (existing ? prev.map(r => (r.id === rule.id ? rule : r)) : [rule, ...prev]));
    pushLog(rule.name, 'Activée');
    closeForm();
    setSaving(false);
  };

  const handleDeleteRule = (rule: AutomationRule) => {
    const snapshot = rules;
    setRules(prev => prev.filter(r => r.id !== rule.id));
    pushLog(rule.name, 'Coupée');
    persist(
      async () => {
        const ok = await deleteAutomationRule(rule.id);
        if (ok && rule.mediaPath) removeAutomationMedia(rule.mediaPath);
        return ok;
      },
      () => setRules(snapshot)
    );
  };

  const renderMediaField = (d: Draft) => {
    const meta = KIND_META[d.kind];
    if (d.kind === 'text') {
      return (
        <label className="block space-y-1.5">
          <span className="text-sm text-[#A8A29E]">Texte envoyé au client</span>
          <textarea
            rows={3}
            placeholder="Nous faisons la chanson à 1 200 F…"
            value={d.action}
            onChange={e => setDraft({ ...d, action: e.target.value })}
            className={`${inputClass} resize-none leading-relaxed`}
            required
          />
        </label>
      );
    }

    return (
      <div className="space-y-3">
        <div className="text-sm text-[#A8A29E]">{meta.hint}</div>

        {d.media ? (
          <div className="space-y-2.5">
            <div className="text-xs uppercase tracking-[0.08em] text-[#78716C]">Aperçu côté client</div>
            <MediaPreview kind={d.kind} url={d.media.url} name={d.media.name} size={d.media.size} durationSec={d.media.durationSec} peaks={d.media.peaks} seed={d.media.name} />
            <button
              type="button"
              onClick={() => setDraft({ ...d, media: undefined })}
              className="inline-flex items-center gap-1.5 text-[13px] text-[#A8A29E] hover:text-[#FB7185] transition-colors cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.6} />
              Retirer ce média
            </button>
          </div>
        ) : d.kind === 'voice' && recording ? (
          <VoiceNoteRecorder autoStart confirmLabel="Utiliser ce vocal" onComplete={onRecorded} onCancel={() => setRecording(false)} />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {d.kind === 'voice' && (
              <button
                type="button"
                onClick={() => setRecording(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E5B54F] px-4 py-2.5 text-sm font-semibold text-[#0C0A09] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer"
              >
                <Mic className="h-4 w-4" strokeWidth={2} />
                Enregistrer au micro
              </button>
            )}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-xl border border-[#3A3022] px-4 py-2.5 text-sm font-medium text-[#E7E5E4] hover:border-[#E5B54F]/40 transition-colors cursor-pointer"
            >
              <Upload className="h-4 w-4" strokeWidth={1.8} />
              {d.kind === 'voice' ? 'Importer un audio' : d.kind === 'video' ? 'Choisir une vidéo' : 'Choisir un fichier'}
            </button>
            <input ref={fileRef} type="file" accept={meta.accept} onChange={onPickFile} className="sr-only" tabIndex={-1} aria-hidden="true" />
          </div>
        )}

        {(d.kind === 'document' || d.kind === 'video') && (
          <label className="block space-y-1.5">
            <span className="text-sm text-[#A8A29E]">Légende (facultatif)</span>
            <input
              type="text"
              placeholder={d.kind === 'video' ? 'Voici un exemple de clip livré…' : 'Notre grille tarifaire'}
              value={d.action}
              onChange={e => setDraft({ ...d, action: e.target.value })}
              className={inputClass}
            />
          </label>
        )}

        {!user && <p className="text-xs text-[#78716C]">Mode démo : le média reste dans ce navigateur et n'est pas envoyé au studio.</p>}
      </div>
    );
  };

  const renderForm = (isEdit: boolean) =>
    draft && (
      <form
        onSubmit={handleSave}
        className="vx-view-enter rounded-[22px] border border-[#E5B54F]/40 bg-[#171512] p-6 space-y-5 shadow-[0_24px_60px_-24px_rgba(229,181,79,0.25)]"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-white">{isEdit ? 'Modifier la règle' : 'Nouvelle règle'}</h2>
          <button
            type="button"
            onClick={closeForm}
            aria-label="Fermer"
            className="flex h-9 w-9 items-center justify-center rounded-full text-[#A8A29E] hover:text-white hover:bg-white/[0.05] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-4">
          <label className="block space-y-1.5">
            <span className="text-sm text-[#A8A29E]">Nom de la règle</span>
            <input
              type="text"
              autoFocus
              placeholder="Ex. Grille tarifaire"
              value={draft.name}
              onChange={e => setDraft({ ...draft, name: e.target.value })}
              className={inputClass}
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm text-[#A8A29E]">Emoji déclencheur</span>
            <input
              type="text"
              maxLength={8}
              placeholder="Réaction"
              value={draft.emoji}
              onChange={e => setDraft({ ...draft, emoji: e.target.value })}
              className={`${inputClass} text-center text-xl`}
              required
            />
          </label>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm text-[#A8A29E] mb-1.5">Réponse envoyée</legend>
          <div role="radiogroup" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {MEDIA_KINDS.map(k => {
              const Icon = k.icon;
              const active = draft.kind === k.id;
              return (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setDraftKind(k.id)}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors duration-200 cursor-pointer ${
                    active
                      ? 'border-[#E5B54F] bg-[#E5B54F]/[0.1] text-[#F3CA75] font-semibold'
                      : 'border-[#2D261E] bg-[#0E0C0A] text-[#A8A29E] hover:text-white hover:border-[#3A3022]'
                  }`}
                >
                  <Icon className="h-4 w-4" strokeWidth={1.7} />
                  {k.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {renderMediaField(draft)}

        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={closeForm}
            className="rounded-xl border border-[#3A3022] px-4 py-2.5 text-sm font-medium text-[#E7E5E4] hover:border-[#E5B54F]/40 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving || !draftReady}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E5B54F] px-5 py-2.5 text-sm font-semibold text-[#0C0A09] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" strokeWidth={2.2} />}
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>
    );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* En-tête */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white leading-tight">Automatisations</h1>
          <p className="mt-2 max-w-md text-sm sm:text-base leading-relaxed text-[#A8A29E]">
            Un déclencheur, une réponse préparée à l'avance : texte, vocal, document ou vidéo.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={handleCutAll}
            disabled={rules.length === 0}
            className="rounded-xl border border-[#3A3022] bg-[#0E0C0A] px-4 py-2.5 text-[15px] font-medium text-white hover:border-[#E5B54F]/40 transition-colors cursor-pointer disabled:opacity-40"
          >
            {allOff ? 'Tout réactiver' : 'Tout couper'}
          </button>
          <button
            type="button"
            onClick={() => setDraft(EMPTY_DRAFT)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E5B54F] px-5 py-2.5 text-[15px] font-semibold text-[#0C0A09] shadow-[0_8px_30px_-10px_rgba(229,181,79,0.6)] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2.2} />
            Nouvelle règle
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E11D48]/40 bg-[#E11D48]/10 px-4 py-3 text-sm text-[#FDA4AF]">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Fermer" className="cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {draft && !draft.id && renderForm(false)}

      {/* Règles */}
      <div className="space-y-3.5">
        {rules.length === 0 && !draft && (
          <div className="rounded-[22px] border border-dashed border-[#3A3022] bg-[#171512]/60 p-8 text-center">
            <p className="text-base text-white font-medium">Aucune règle pour l'instant</p>
            <p className="mt-1.5 text-sm text-[#A8A29E]">
              Créez votre première réaction automatique : un emoji posé sur un message déclenche l'envoi d'un texte, d'un vocal, d'un document ou d'une vidéo.
            </p>
          </div>
        )}

        {rules.map((rule, i) => {
          const kind = rule.kind ?? 'text';
          const meta = KIND_META[kind];
          const KindIcon = meta.icon;
          return draft?.id === rule.id ? (
            <div key={rule.id}>{renderForm(true)}</div>
          ) : (
            <article
              key={rule.id}
              style={{ '--i': i } as CSSProperties}
              className={`vx-stagger rounded-[22px] border border-[#2D261E] bg-[#171512] px-6 py-5 flex items-start justify-between gap-4 transition-opacity duration-300 ${
                rule.active ? '' : 'opacity-60'
              }`}
            >
              <div className="min-w-0 flex-1 space-y-2.5">
                <h3 className="text-[17px] font-semibold text-white truncate">{rule.name}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#0E0C0A] border border-[#2D261E] px-3.5 py-1.5 text-sm font-medium text-white">
                    Je réagis avec un emoji
                  </span>
                  <span className="text-lg leading-none" aria-label="Emoji déclencheur">{rule.emoji}</span>
                  <span className="text-[#78716C]" aria-hidden="true">→</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-[#0E0C0A] border border-[#2D261E] px-3.5 py-1.5 text-sm font-medium text-white">
                    <KindIcon className="h-3.5 w-3.5 text-[#E5B54F]" strokeWidth={1.8} />
                    {meta.pill}
                  </span>
                </div>
                {kind === 'text' ? (
                  <p className="border-l-2 border-[#D4A347] pl-3 text-sm leading-relaxed text-[#A8A29E] line-clamp-2">{rule.action}</p>
                ) : (
                  <div className="space-y-2 pt-0.5">
                    <MediaPreview kind={kind} url={urlOf(rule)} name={rule.mediaName} seed={rule.id} />
                    {rule.action && (
                      <p className="flex items-start gap-2 text-sm leading-relaxed text-[#A8A29E] line-clamp-2">
                        <Paperclip className="h-3.5 w-3.5 mt-[3px] shrink-0" strokeWidth={1.6} />
                        {rule.action}
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                <button
                  type="button"
                  role="switch"
                  aria-checked={rule.active}
                  aria-label={rule.active ? `Couper ${rule.name}` : `Activer ${rule.name}`}
                  onClick={() => handleToggleRule(rule)}
                  className="vx-switch mr-2"
                />
                <button
                  type="button"
                  onClick={() => openEdit(rule)}
                  title="Modifier"
                  aria-label={`Modifier ${rule.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#E7E5E4] hover:text-[#F3CA75] hover:bg-[#E5B54F]/[0.08] transition-colors cursor-pointer"
                >
                  <Pencil className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteRule(rule)}
                  title="Supprimer"
                  aria-label={`Supprimer ${rule.name}`}
                  className="flex h-10 w-10 items-center justify-center rounded-full text-[#E7E5E4] hover:text-[#FB7185] hover:bg-[#E11D48]/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {/* Journal */}
      <section className="rounded-[22px] border border-[#2D261E] bg-[#171512] p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Journal des déclenchements</h2>
            <p className="mt-1.5 text-[15px] text-[#A8A29E]">
              Les {MAX_LOGS} derniers. Maximum 60 envois automatiques par heure.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[#2D261E] px-3 py-1 text-xs text-[#A8A29E]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#22C55E] vx-breathe" />
            {syncedAt ? `Synchro ${syncedAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Connexion…'}
          </span>
        </div>

        {logs.length === 0 ? (
          <p className="mt-6 text-sm text-[#78716C]">Aucun déclenchement enregistré pour le moment.</p>
        ) : (
          <ul className="mt-5 divide-y divide-[#2D261E]">
            {logs.map((log) => (
              <li key={log.id} className="vx-fade-in py-3.5 flex items-center justify-between gap-4">
                <div className="min-w-0 truncate text-base">
                  <span className="font-medium text-white">{log.ruleName}</span>
                  <span className="text-[#A8A29E]"> · {log.recipient}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`rounded-full px-3 py-1 text-[13px] font-semibold ${STATUS_STYLE[log.status]}`}>
                    {log.status}
                  </span>
                  <span className="hidden sm:inline text-sm tabular-nums text-[#A8A29E]">{log.date}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};
