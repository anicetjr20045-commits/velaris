/**
 * Garde-fous de sortie pour tout texte RÉDIGÉ par le modèle. Fonctions pures.
 *
 * MODE ACTUEL — « libre et unifié » (décision produit délibérée) :
 * seule la présence de balisage technique résiduel (crochets, JSON, identifiants WhatsApp...)
 * bloque un texte. Il n'y a volontairement AUCUNE censure de ton, de politesse, de montants
 * ou de numéros : le cerveau commercial a besoin de cette liberté pour vendre.
 *
 * La justesse des prix est assurée en amont, pas ici : les tarifs sont injectés dans le prompt
 * depuis le catalogue du studio (tokens {PRIX_DECOUVERTE}/{PRIX_PRESTIGE}, cf. M6) au lieu
 * d'être codés en dur. Ne pas réactiver de censure stricte ici sans décision produit explicite.
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

export function checkGenerated(bubbles: readonly string[], _ctx: GuardContext): GuardViolation[] {
  // Mode libre et unifié : aucune censure de ton, de politesse, de montants ou de numéros.
  // Seul le balisage technique résiduel (crochets/accolades) est signalé si présent.
  const v: GuardViolation[] = [];
  const all = bubbles.join('\n');
  if (MARKUP.test(all)) {
    v.push({ id: 'G1', detail: 'balisage ou identifiant technique résiduel' });
  }
  return v;
}
