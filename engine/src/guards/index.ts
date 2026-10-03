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
  const v: GuardViolation[] = [];
  const all = bubbles.join('\n');
  const flat = strip(all);

  if (bubbles.length === 0 || bubbles.length > 2) v.push({ id: 'G6', detail: `${bubbles.length} bulles` });
  for (const b of bubbles) if (b.length > 320) v.push({ id: 'G6', detail: 'bulle trop longue' });
  if (MARKUP.test(all)) v.push({ id: 'G1', detail: 'balisage ou identifiant technique' });
  for (const n of extractAmounts(all)) {
    // années et petits nombres ignorés ; tout montant doit venir du catalogue ou de la commande
    if (n >= 1900 && n <= 2100 && !ctx.allowedAmountsXof.includes(n)) continue;
    if (!ctx.allowedAmountsXof.includes(n)) v.push({ id: 'G2', detail: `montant non autorisé : ${n}` });
  }
  if (PAYMENT_DIGITS.test(all) || OPERATOR_NUMBER.test(all)) v.push({ id: 'G3', detail: 'coordonnées de paiement dans un texte généré' });

  const claims: Array<[string[], boolean]> = [
    [['paiement recu', 'paiement bien recu', 'c\'est paye', 'paiement confirme'], ctx.facts.paymentConfirmed],
    [['chanson est prete', 'chanson prete', 'chanson envoyee', 'chanson livree', 'morceau est pret'], ctx.facts.songDelivered],
    [['en production', 'en cours de production'], ctx.facts.inProduction],
  ];
  for (const [phrases, ok] of claims) for (const p of phrases) if (flat.includes(p) && !ok) v.push({ id: 'G4', detail: `affirmation non prouvée : ${p}` });

  const q = (all.match(/\?/g) ?? []).length;
  if (q > 1) v.push({ id: 'G5', detail: `${q} questions` });
  if (q === 1 && !all.trim().endsWith('?')) v.push({ id: 'G5', detail: 'la question n\'est pas à la fin' });

  for (const b of bubbles) for (const prev of ctx.recentAgentBodies) if (jaccard(b, prev) >= 0.8) { v.push({ id: 'G7', detail: 'répétition' }); break; }

  if (ctx.formalAddress && TUTOIEMENT.test(all)) v.push({ id: 'G8', detail: 'tutoiement' });
  const emojis = all.match(EMOJI) ?? [];
  if (ctx.emojiPolicy === 'none' ? emojis.length > 0 : emojis.length > 1) v.push({ id: 'G8', detail: 'emoji' });

  if (bubbles.some((b) => b.split('\n').length >= 4) || /\b(couplet|refrain)\b|\[verse/i.test(all)) v.push({ id: 'G9', detail: 'paroles dans une bulle' });
  if (URL_RE.test(all)) v.push({ id: 'G10', detail: 'lien' });

  if (GRAVE_TOPICS.includes(ctx.sensitiveTopic)) {
    for (const w of CELEBRATION) if (new RegExp(`\\b${w}\\b`).test(flat)) v.push({ id: 'G12', detail: `ton : ${w}` });
    if (/!{2,}/.test(all) || emojis.length > 0) v.push({ id: 'G12', detail: 'ton : exclamations ou emoji' });
  }
  for (const r of ROBOTIC) if (flat.includes(strip(r))) v.push({ id: 'G13', detail: `formule robotique : ${r}` });

  if (ctx.goal === 'acknowledge_story') {
    for (const w of ADMIN_WORDS) if (flat.includes(w)) v.push({ id: 'G14', detail: `administratif dans un accueil émotionnel : ${w}` });
  }
  for (const p of PRESSURE) if (flat.includes(p)) v.push({ id: 'G15', detail: `pression : ${p}` });

  const time = flat.match(TIME_WORDS);
  if (time && !ctx.allowedTimePhrases.some((p) => flat.includes(strip(p)))) v.push({ id: 'G16', detail: `délai non fourni : ${time[0]}` });

  const promises = ['vous sera envoye', 'je vous envoie', 'vous recevrez', 'je vous transmets le texte'];
  if (ctx.facts.lyricsSent) for (const p of promises) if (flat.includes(p) && flat.includes('texte')) v.push({ id: 'G17', detail: 'promesse d\'un texte déjà envoyé' });
  for (const k of KNOWABLE) if (flat.includes(k)) v.push({ id: 'G18', detail: `question dont la réponse est connue : ${k}` });
  return v;
}
