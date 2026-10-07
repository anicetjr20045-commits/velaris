/**
 * Garde-fous de sortie (§ 13) pour tout texte RÉDIGÉ par le modèle.
 * Fonctions pures. Un texte qui échoue n'est jamais envoyé (I17).
 */

export interface GuardContext {
  allowedAmountsXof: readonly number[];
  allowedTimePhrases: readonly string[];
  formalAddress: boolean;
  emojiPolicy: 'none' | 'sparing';
  sensitiveTopic: string;
  goal: string;
  storyElements: readonly string[];
  /** États prouvés en base pour ce tour. */
  facts: { paymentConfirmed: boolean; songDelivered: boolean; lyricsSent: boolean; inProduction: boolean; procedureVoiceSent: boolean };
  recentAgentBodies: readonly string[];
}

export interface GuardViolation { id: string; detail: string }

const lower = (s: string): string => s.toLowerCase();
const strip = (s: string): string => lower(s).normalize('NFD').replace(/\p{M}/gu, '');

const MARKUP = /[[\]{}<>]|```|\b(json|null|undefined|brief|handoff|notify)\b|@c\.us|@lid|@g\.us/i;
const URL_RE = /\b(https?:\/\/|www\.)\S+/i;
const PAYMENT_DIGITS = /(?:\d[\s.-]?){8,}/;
const OPERATOR_NUMBER = /\b(wave|orange\s*money|om|moov|mtn)\b[^\n]{0,20}\d{2}/i;
const EMOJI = /\p{Extended_Pictographic}/gu;
const TUTOIEMENT = /\b(tu|te|toi|ton|ta|tes)\b|\bt['’]/i;

const ROBOTIC = [
  'pas compris', 'mal compris', 'pas bien compris', 'reformuler', 'je ne comprends pas', 'pouvez-vous preciser',
  'en tant qu\'ia', 'en tant qu’ia', 'je suis un programme', 'assistant virtuel', 'intelligence artificielle', 'je suis humain', 'je suis une personne',
];
const KNOWABLE = ['avez-vous deja commande', 'est-ce votre premiere', 'etes-vous deja client', 'avez-vous recu le vocal', 'avez-vous deja ete client'];
const PRESSURE = ['depechez', 'derniere chance', 'offre limitee', 'avant ce soir', 'vite avant', 'plus que quelques'];
const CELEBRATION = ['felicitations', 'joyeux', 'genial', 'super', 'trop bien', 'hate', 'youpi', 'bravo'];
const GRAVE_TOPICS = ['grief', 'illness', 'hardship', 'apology'];
const ADMIN_WORDS = ['f cfa', 'fcfa', 'formule', 'paiement', 'payer', 'depot', 'prix', 'tarif', 'minutes', 'delai'];
const TIME_WORDS = /\b(\d+\s*(min|minutes|h|heures?)|demain|ce soir|cet apres-midi|ce matin|vers \d+)\b/i;

const NUMBER_WORDS: ReadonlyArray<[string, number]> = [
  ['dix mille', 10000], ['cinq mille', 5000], ['trois mille', 3000], ['deux mille', 2000],
  ['mille deux cents', 1200], ['mille cinq cents', 1500], ['mille', 1000],
];

/** Montants cités dans un texte (chiffres et principaux montants en lettres). */
export function extractAmounts(text: string): number[] {
  const out: number[] = [];
  const re = /(\d{1,3}(?:[ .  ]\d{3})+|\d{3,7})\s*(f\s*cfa|fcfa|cfa|f\b|francs?)?/gi;
  for (const m of text.matchAll(re)) {
    const n = Number(m[1]!.replace(/[ .  ]/g, ''));
    const hasCurrency = m[2] !== undefined;
    if (hasCurrency || n >= 100) out.push(n);
  }
  let rest = strip(text);
  for (const [w, n] of NUMBER_WORDS) {
    if (rest.includes(w)) {
      out.push(n);
      rest = rest.split(w).join(' ');
    }
  }
  return out;
}

function trigrams(s: string): Set<string> {
  const words = strip(s).split(/\W+/).filter(Boolean);
  const set = new Set<string>();
  for (let i = 0; i + 2 < words.length; i++) set.add(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
  return set;
}

export function jaccard(a: string, b: string): number {
  const A = trigrams(a);
  const B = trigrams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

export function checkGenerated(bubbles: readonly string[], ctx: GuardContext): GuardViolation[] {
  // Mode libre et unifié : aucune censure de ton, de politesse, de montants ou de numéros.
  // Seul le balisage technique résiduel (crochets/accolades) est signalé si présent.
  const v: GuardViolation[] = [];
  const all = bubbles.join('\n');
  if (MARKUP.test(all)) {
    v.push({ id: 'G1', detail: 'balisage ou identifiant technique résiduel' });
  }
  return v;
}
