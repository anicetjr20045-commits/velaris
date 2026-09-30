import { useState, type FC } from 'react';
import { 
  Zap, 
  Plus, 
  PowerOff, 
  Pencil, 
  Trash2
} from 'lucide-react';
import type { AutomationRule, AutomationLog } from '../types';
import { MOCK_AUTOMATIONS, MOCK_AUTOMATION_LOGS } from '../data/mockData';

export const AutomationsView: FC = () => {
  const [rules, setRules] = useState<AutomationRule[]>(MOCK_AUTOMATIONS);
  const [logs] = useState<AutomationLog[]>(MOCK_AUTOMATION_LOGS);
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleEmoji, setNewRuleEmoji] = useState('🎵');
  const [newRuleAction, setNewRuleAction] = useState('Lancer Suno & Envoyer audio');

  const handleToggleRule = (ruleId: string) => {
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, active: !r.active } : r));
  };

  const handleCutAll = () => {
    setRules(prev => prev.map(r => ({ ...r, active: false })));
  };

  const handleAddRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRuleName.trim()) return;
    const rule: AutomationRule = {
      id: `auto-${Date.now()}`,
      name: newRuleName,
      emoji: newRuleEmoji,
      action: newRuleAction,
      active: true,
    };
    setRules(prev => [rule, ...prev]);
    setNewRuleName('');
    setIsNewRuleOpen(false);
  };

  const handleDeleteRule = (id: string) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* 1. En-tête Automatisations */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <Zap className="h-6 w-6 text-[#c5a059]" />
            <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-[#f3f4f6]">
              Automatisations
            </h1>
          </div>
          <p className="text-sm text-stone-400 max-w-xl">
            Un déclencheur, une action préparée à l'avance. Rien n'est improvisé.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            onClick={handleCutAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#14120f] hover:bg-[#1f1c16] text-stone-300 border border-white/[0.08] text-xs font-semibold transition-all cursor-pointer"
          >
            <PowerOff className="h-3.5 w-3.5 text-stone-400" />
            <span>Tout couper</span>
          </button>

          <button
            onClick={() => setIsNewRuleOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c5a059] hover:bg-[#d4af37] text-black text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nouvelle règle</span>
          </button>
        </div>
      </div>

      {/* Modal d'ajout de règle */}
      {isNewRuleOpen && (
        <form onSubmit={handleAddRule} className="rounded-2xl border border-[#c5a059]/40 bg-[#14120e] p-5 shadow-2xl space-y-4">
          <div className="font-serif text-lg font-bold text-white">Créer un déclencheur WhatsApp</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-stone-400 block mb-1">Nom de la règle</label>
              <input
                type="text"
                placeholder="Ex: Studio Suno"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Emoji déclencheur</label>
              <select
                value={newRuleEmoji}
                onChange={e => setNewRuleEmoji(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
              >
                <option value="🎵">🎵 Musique Studio</option>
                <option value="🙏">🙏 Prière / Bénédiction</option>
                <option value="🖐️">🖐️ Salutation</option>
                <option value="😊">😊 Vocal Chaleureux</option>
                <option value="✨">✨ Reprise IA</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-stone-400 block mb-1">Action à déclencher</label>
              <input
                type="text"
                value={newRuleAction}
                onChange={e => setNewRuleAction(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-white"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewRuleOpen(false)}
              className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-[#c5a059] text-black text-xs font-bold"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* 2. Liste des Règles Actives */}
      <div className="space-y-4">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-2xl border border-white/[0.08] bg-[#12110e] p-5 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="font-serif text-lg font-bold text-[#f3f4f6] mb-2">
                {rule.name}
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/40 border border-white/[0.06] text-xs text-stone-300 font-medium">
                <span>Je réagis avec un emoji {rule.emoji}</span>
                <span className="text-stone-500">→</span>
                <span className="text-[#c5a059]">{rule.action}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              {/* Toggle switch stylisé */}
              <button
                type="button"
                onClick={() => handleToggleRule(rule.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rule.active ? 'bg-[#c5a059]' : 'bg-stone-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    rule.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>

              <button
                type="button"
                className="p-2 text-stone-400 hover:text-white rounded-lg hover:bg-white/[0.05] transition-colors"
                title="Modifier"
              >
                <Pencil className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                className="p-2 text-stone-400 hover:text-rose-400 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Journal des déclenchements */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0e0d0b] p-6 shadow-xl space-y-4">
        <div>
          <h2 className="font-serif text-xl font-bold text-[#f3f4f6]">
            Journal des déclenchements
          </h2>
          <p className="text-xs text-stone-400 mt-1">
            Les 50 derniers. Maximum 60 envois automatiques par heure.
          </p>
        </div>

        <div className="divide-y divide-white/[0.05] -mx-6 px-6">
          {logs.map((log) => (
            <div key={log.id} className="py-3.5 flex items-center justify-between gap-4">
              <div className="text-xs font-medium text-stone-200">
                <span className="font-bold text-white">{log.ruleName}</span>
                <span className="text-stone-500 mx-2">·</span>
                <span>{log.recipient}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#c5a059]/20 text-[#e5c158] border border-[#c5a059]/30">
                  {log.status}
                </span>
                <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
                  {log.date}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
