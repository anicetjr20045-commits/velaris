import { useState, useEffect, type FC } from 'react';
import { 
  Plus, 
  PowerOff, 
  Trash2,
  ArrowRight
} from 'lucide-react';
import type { AutomationRule, AutomationLog } from '../types';
import { 
  REAL_AUTOMATION_RULES, 
  REAL_AUTOMATION_LOGS 
} from '../data/realProductionData';
import { useAuth } from '../hooks/useAuth';
import { getLiveAutomationRules } from '../services/supabase';

export const AutomationsView: FC = () => {
  const { user } = useAuth();
  const [rules, setRules] = useState<AutomationRule[]>(() => {
    return user ? [] : REAL_AUTOMATION_RULES;
  });
  const [logs] = useState<AutomationLog[]>(REAL_AUTOMATION_LOGS);
  const [isNewRuleOpen, setIsNewRuleOpen] = useState(false);
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleTrigger, setNewRuleTrigger] = useState('DÉCLENCHEUR_STUDIO');
  const [newRuleAction, setNewRuleAction] = useState('Lancer Suno & Envoyer audio');

  useEffect(() => {
    getLiveAutomationRules().then((live) => {
      setRules(live);
    });
  }, [user]);

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
      emoji: '⚡', // Kept for type compatibility
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
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-mono tracking-wider text-neutral-300 uppercase">
              WORKFLOWS STUDIO
            </span>
            <span className="text-xs font-mono text-neutral-500">Règles Déclencheur ➔ Action</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mt-1">
            Automatisations WhatsApp
          </h1>
          <p className="text-xs text-neutral-400 mt-1 max-w-xl">
            Déclencheurs configurés pour qualifier les briefs, envoyer les grilles tarifaires et expédier les masters.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
          <button
            onClick={handleCutAll}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.08] text-neutral-400 hover:text-white border border-white/[0.08] text-xs font-mono transition-all cursor-pointer"
          >
            <PowerOff className="h-3.5 w-3.5" />
            <span>Tout couper</span>
          </button>

          <button
            onClick={() => setIsNewRuleOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-all shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Nouvelle règle</span>
          </button>
        </div>
      </div>

      {/* Formulaire d'ajout de règle */}
      {isNewRuleOpen && (
        <form onSubmit={handleAddRule} className="rounded-2xl border border-white/20 bg-[#0D0F14] p-5 shadow-2xl space-y-4">
          <div className="text-base font-bold text-white tracking-tight">Configurer un Déclencheur Automatique</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">Nom de la règle</label>
              <input
                type="text"
                placeholder="Ex: Production Suno Immédiate"
                value={newRuleName}
                onChange={e => setNewRuleName(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">Condition Déclencheur</label>
              <select
                value={newRuleTrigger}
                onChange={e => setNewRuleTrigger(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30 font-mono"
              >
                <option value="PAIEMENT_VALIDE">Paiement Mobile Money Reçu</option>
                <option value="BRIEF_VOCAL_RECU">Note Vocale Reçue</option>
                <option value="MOT_CLE_TARIF">Mot-clé Demande Tarifaire</option>
                <option value="VALIDATION_PAROLES">Paroles Validées par Client</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-mono uppercase tracking-wider text-neutral-400 block mb-1">Action Exécutée</label>
              <input
                type="text"
                value={newRuleAction}
                onChange={e => setNewRuleAction(e.target.value)}
                className="w-full bg-[#07080B] border border-white/[0.08] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-white/30"
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsNewRuleOpen(false)}
              className="px-3.5 py-1.5 rounded-lg text-xs font-mono text-neutral-400 hover:text-white"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-neutral-200"
            >
              Enregistrer
            </button>
          </div>
        </form>
      )}

      {/* 2. Liste des Règles Actives */}
      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="rounded-xl border border-white/[0.06] bg-[#07080B] p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <div className="text-sm font-bold text-white tracking-tight mb-2">
                {rule.name}
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.02] border border-white/[0.06] text-xs font-mono">
                <span className="text-neutral-400">DÉCLENCHEUR : TAG WHATSAPP</span>
                <ArrowRight className="h-3 w-3 text-neutral-600" />
                <span className="text-white font-medium">{rule.action}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 self-end sm:self-center">
              {/* Toggle switch stylisé */}
              <button
                type="button"
                onClick={() => handleToggleRule(rule.id)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  rule.active ? 'bg-white' : 'bg-neutral-800'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow ring-0 transition duration-200 ease-in-out ${
                    rule.active ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>

              <button
                type="button"
                onClick={() => handleDeleteRule(rule.id)}
                className="p-2 text-neutral-500 hover:text-rose-400 rounded-lg hover:bg-white/[0.05] transition-colors cursor-pointer"
                title="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 3. Journal des déclenchements */}
      <div className="rounded-xl border border-white/[0.06] bg-[#07080B] p-6 shadow-sm space-y-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-neutral-400">HISTORIQUE D'EXÉCUTION</div>
          <h2 className="text-lg font-bold text-white tracking-tight mt-0.5">
            Journal des Déclenchements Automatiques
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Flux des exécutions récentes. Cadence maximale : 60 messages automatiques par heure.
          </p>
        </div>

        <div className="divide-y divide-white/[0.04] -mx-6 px-6">
          {logs.map((log) => (
            <div key={log.id} className="py-3 flex items-center justify-between gap-4">
              <div className="text-xs text-neutral-300">
                <span className="font-semibold text-white">{log.ruleName}</span>
                <span className="text-neutral-600 mx-2">·</span>
                <span className="font-mono text-neutral-400">{log.recipient}</span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.04] text-neutral-300 border border-white/[0.06]">
                  {log.status}
                </span>
                <span className="text-[10px] text-neutral-500 font-mono hidden sm:inline">
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
