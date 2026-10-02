import type { Order, PipelineLead } from '../types';
import { phoneMatches } from './supabase';

type Stage = PipelineLead['stage'];

export const STAGE_ORDER: Stage[] = ['nouveau', 'en_discussion', 'devis', 'studio', 'livre'];
export const stageRank = (s: Stage) => STAGE_ORDER.indexOf(s);

export interface StageInference {
  stage: Stage;
  reason: string;
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/* Statut de commande -> étape du suivi (la commande fait foi) */
const ORDER_SIGNAL: Record<Order['status'], StageInference> = {
  brief_recu: { stage: 'en_discussion', reason: 'Brief reçu sur la commande' },
  paroles_pretes: { stage: 'devis', reason: 'Paroles prêtes, devis envoyé' },
  paiement_valide: { stage: 'studio', reason: 'Paiement validé' },
  production_suno: { stage: 'studio', reason: 'Production studio lancée' },
  livre: { stage: 'livre', reason: 'Chanson livrée' },
};

/* Signaux lus dans le résumé de l'IA et l'étiquette d'occasion, du plus avancé au moins avancé */
const TEXT_SIGNALS: { stage: Stage; pattern: RegExp; reason: string }[] = [
  { stage: 'livre', pattern: /\blivree?s?\b|\bdelivree?\b|chanson envoyee|master envoye/, reason: 'Livraison détectée dans la discussion' },
  {
    stage: 'studio',
    pattern: /paiement (wave |orange money |om |moov |mtn )?(bien )?(recu|valide|confirme)|\bpayee?\b|depot recu|montage[^.]* en cours|en production|generation (lancee|en cours)/,
    reason: 'Paiement confirmé dans la discussion',
  },
  {
    stage: 'devis',
    pattern: /\bdevis\b|facture|\btarifs?\b|\bprix\b|\baccord\b|\d[\s.]?\d{3}\s?f(cfa)?\b|attente (du |de )?(depot|paiement|numero|recu)|\bformule\b/,
    reason: 'Prix évoqué dans la discussion',
  },
  { stage: 'en_discussion', pattern: /brief (complet|recu|valide)|paroles|note vocale|souvenirs/, reason: 'Brief en cours de collecte' },
];

const findOrder = (lead: PipelineLead, orders: Order[]) => {
  const digits = (lead.phone || '').replace(/\D/g, '');
  const name = normalize(lead.name).trim();
  return orders.find(o =>
    (digits.length >= 6 && phoneMatches(o.clientPhone, digits)) ||
    (name.length > 2 && normalize(o.clientName).trim() === name)
  );
};

/**
 * Étape justifiée par les interactions du client.
 * Ne propose qu'une avancée : jamais de retour en arrière automatique.
 */
export function inferLeadStage(lead: PipelineLead, orders: Order[]): StageInference | null {
  const candidates: StageInference[] = [];
  const order = findOrder(lead, orders);
  if (order && ORDER_SIGNAL[order.status]) candidates.push(ORDER_SIGNAL[order.status]);

  const text = normalize(`${lead.summary ?? ''} ${lead.tag ?? ''}`);
  const signal = TEXT_SIGNALS.find(s => s.pattern.test(text));
  if (signal) candidates.push({ stage: signal.stage, reason: signal.reason });

  const best = candidates.sort((a, b) => stageRank(b.stage) - stageRank(a.stage))[0];
  return best && stageRank(best.stage) > stageRank(lead.stage) ? best : null;
}
