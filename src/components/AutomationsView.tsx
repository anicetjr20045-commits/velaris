import { useState, type CSSProperties, type FC, type FormEvent } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AutomationRule, AutomationLog } from '../types';
import { REAL_AUTOMATION_RULES, REAL_AUTOMATION_LOGS } from '../data/realProductionData';
import { useAuth } from '../hooks/useAuth';
import { useStudioLive } from '../hooks/useStudioLive';
import {
  deleteAutomationRule,
  getLiveAutomationRules,
  saveAutomationRule,
  setAllAutomationRulesEnabled,
  setAutomationRuleEnabled
} from '../services/supabase';

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

interface Draft {
  id?: string;
  name: string;
  emoji: string;
  action: string;
}

const EMPTY_DRAFT: Draft = { name: '', emoji: '', action: '' };

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

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.name.trim() || !draft.action.trim() || !draft.emoji.trim()) return;
    setSaving(true);
    setError(null);
    const existing = draft.id ? rules.find(r => r.id === draft.id) : undefined;
    const rule: AutomationRule = {
      id: draft.id ?? `auto-${Date.now()}`,
      name: draft.name.trim(),
      emoji: draft.emoji.trim(),
      action: draft.action.trim(),
      active: existing?.active ?? true,
    };

    if (user) {
      const savedId = await saveAutomationRule({ ...rule, id: draft.id });
      if (!savedId) {
        setSaving(false);
        setError("Impossible d'enregistrer la règle dans votre studio.");
        return;
      }
      rule.id = savedId;
    }

    setRules(prev => (existing ? prev.map(r => (r.id === rule.id ? rule : r)) : [rule, ...prev]));
    pushLog(rule.name, 'Activée');
    setDraft(null);
    setSaving(false);
  };

  const handleDeleteRule = (rule: AutomationRule) => {
    const snapshot = rules;
    setRules(prev => prev.filter(r => r.id !== rule.id));
    pushLog(rule.name, 'Coupée');
    persist(() => deleteAutomationRule(rule.id), () => setRules(snapshot));
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
            onClick={() => setDraft(null)}
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
        <label className="block space-y-1.5">
          <span className="text-sm text-[#A8A29E]">Texte envoyé au client</span>
          <textarea
            rows={3}
            placeholder="Nous faisons la chanson à 1 200 F…"
            value={draft.action}
            onChange={e => setDraft({ ...draft, action: e.target.value })}
            className={`${inputClass} resize-none leading-relaxed`}
            required
          />
        </label>
        <div className="flex justify-end gap-2.5">
          <button
            type="button"
            onClick={() => setDraft(null)}
            className="rounded-xl border border-[#3A3022] px-4 py-2.5 text-sm font-medium text-[#E7E5E4] hover:border-[#E5B54F]/40 transition-colors cursor-pointer"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E5B54F] px-5 py-2.5 text-sm font-semibold text-[#0C0A09] hover:bg-[#F0C068] active:scale-[0.98] transition-all duration-150 ease-press cursor-pointer disabled:opacity-60"
          >
            <Check className="h-4 w-4" strokeWidth={2.2} />
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
            Un déclencheur, une action préparée à l'avance. Rien n'est improvisé.
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
              Créez votre première réaction automatique : un emoji posé sur un message déclenche l'envoi d'un texte prêt.
            </p>
          </div>
        )}

        {rules.map((rule, i) =>
          draft?.id === rule.id ? (
            <div key={rule.id}>{renderForm(true)}</div>
          ) : (
            <article
              key={rule.id}
              style={{ '--i': i } as CSSProperties}
              className={`vx-stagger rounded-[22px] border border-[#2D261E] bg-[#171512] px-6 py-5 flex items-start justify-between gap-4 transition-opacity duration-300 ${
                rule.active ? '' : 'opacity-60'
              }`}
            >
              <div className="min-w-0 space-y-2.5">
                <h3 className="text-[17px] font-semibold text-white truncate">{rule.name}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#0E0C0A] border border-[#2D261E] px-3.5 py-1.5 text-sm font-medium text-white">
                    Je réagis avec un emoji
                  </span>
                  <span className="text-lg leading-none" aria-label="Emoji déclencheur">{rule.emoji}</span>
                  <span className="text-[#78716C]" aria-hidden="true">→</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-[#0E0C0A] border border-[#2D261E] px-3.5 py-1.5 text-sm font-medium text-white">
                    Envoyer un texte
                  </span>
                </div>
                <p className="border-l-2 border-[#D4A347] pl-3 text-sm leading-relaxed text-[#A8A29E] line-clamp-2">
                  {rule.action}
                </p>
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
                  onClick={() => setDraft({ id: rule.id, name: rule.name, emoji: rule.emoji, action: rule.action })}
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
          )
        )}
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
