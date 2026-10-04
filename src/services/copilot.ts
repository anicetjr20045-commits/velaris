/**
 * Service Copilot IA & Analyste Studio Velaris
 * Moteur d'intelligence décisionnelle et opérationnelle pour chaque studio.
 * Recherche par numéro ou par contexte, résumé des échanges WhatsApp, suivi des ventes,
 * connaissance du site et rédaction (paroles, relances).
 */

import {
  getLiveStudioMetrics,
  getLiveOrders,
  getLiveConversations,
  searchStudioData,
  getLiveMessages,
  findConversationByPhone,
  phoneMatches,
  recordOutboundMessage,
  createOrUpdateLiveOrder
} from './supabase';
import {
  detectOccasion,
  generateHouseStyleSong,
  GOLDEN_PATRON_CORPUS,
  getHouseStyleDnaNote,
  type SongOccasion
} from './lyricsCorpus';
import { sendWahaTextMessage } from './waha';
import {
  REAL_CONVERSATIONS,
  REAL_CONVERSATION_MESSAGES,
  REAL_PIPELINE_LEADS,
  REAL_STUDIO_METRICS
} from '../data/realProductionData';
import { ACADEMY_MODULES } from '../data/mockData';
import type { Order, StudioMetrics } from '../types';
import { debitAiPromptCredit, getStudioCredits } from './billing';
import { KIE_CONFIG } from './kie';

export interface ActionCardData {
  type: 'lyrics' | 'reply' | 'stats' | 'client_brief' | 'song_generation';
  title: string;
  phone?: string;
  recipient?: string;
  occasion?: string;
  style?: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolsExecuted?: string[];
  actionCard?: ActionCardData;
}

export interface CopilotContext {
  /** Commandes du studio (mêmes données que la Caisse) */
  orders?: Order[];
  metrics?: StudioMetrics;
}

/* ------------------------------------------------------------------ */
/* Outils texte                                                       */
/* ------------------------------------------------------------------ */

function normalize(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

const fcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F CFA`;
const digitsOf = (s: string | null | undefined) => (s || '').replace(/\D/g, '');
const stripPictos = (s: string) => s.replace(/\p{Extended_Pictographic}|️|‍/gu, '').replace(/\s{2,}/g, ' ').trim();
const isVoiceNote = (s: string) => s.includes('\u{1F399}');
const waLink = (phone?: string) => (digitsOf(phone) ? `https://wa.me/${digitsOf(phone)}` : undefined);

const STOP_WORDS = new Set(
  'le la les un une des de du d l a au aux et ou en pour par sur avec dans ce cet cette ces mon ma mes ton ta tes son sa ses notre votre vos leur leurs qui que quoi est sont ai as a avons avez ont moi toi lui elle il ils elles je tu nous vous me te se ne pas plus tres bien fait faire dit dire quel quelle quels quelles comment combien rappelle rappel resume resumer retrouve retrouver cherche chercher trouve trouver montre affiche donne client cliente clients discussion discussions conversation conversations whatsapp numero tel telephone message messages historique tout toute tous ce ca cela ici la-bas parle parler discute discuter bonjour bonsoir salut merci svp stp aide veux voudrais besoin chanson chansons peux pourrais demande demandee demander veut voulait souhaite cherchait'.split(' ')
);

const keywords = (text: string) =>
  normalize(text)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

/**
 * Détecte un numéro de téléphone ou un fragment (+226…, 07…, 5835…) dans le texte.
 * Ignore les montants (« 3 000 F », « 1200 FCFA »), les pourcentages et les années.
 */
export function extractPhoneFragment(text: string): string | null {
  const re = /\+?\d[\d\s.\-]*\d/g;
  let m: RegExpExecArray | null;
  let best: string | null = null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const after = text.slice(m.index + raw.length, m.index + raw.length + 8);
    if (/^\s*(f\b|fcfa|f\s?cfa|francs?|xof|%|ans?\b|min|h\b|bpm|chansons?|commandes?)/i.test(after)) continue;
    const digits = digitsOf(raw);
    if (digits.length < 4) continue;
    if (digits.length === 4 && /^(19|20)\d{2}$/.test(digits) && !raw.startsWith('+')) continue;
    if (!best || digits.length > best.length) best = digits;
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Intentions                                                         */
/* ------------------------------------------------------------------ */

type Intent = 'phone' | 'sales' | 'lyrics' | 'reply' | 'song_generate' | 'order_action' | 'billing' | 'knowledge' | 'search' | 'help';

/*
 * Correspondance en début de mot : « cout » ne doit pas matcher « écoute »,
 * ni « dit » matcher « crédit ». Les expressions multi-mots restent des sous-chaînes.
 */
const termCache = new Map<string, RegExp>();
const termRe = (k: string) => {
  let re = termCache.get(k);
  if (!re) {
    re = new RegExp(`(^|[^a-z0-9])${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    termCache.set(k, re);
  }
  return re;
};
const has = (n: string, list: string[]) => list.some(k => termRe(k).test(n));

/* « ne lance pas la chanson », « sans générer » : l'action demandée est niée */
const isNegated = (n: string) => /(^|\s)(ne|n)\s?\S*\s+(pas|plus|jamais)(\s|$)|(^|\s)(sans|surtout pas|annule|stop)(\s|$)/.test(n);

const SALES_WORDS = ['chiffre', 'encaiss', 'revenu', 'statistique', 'vente', 'vendu', 'performance', 'taux de conversion', 'closing', 'caisse', 'tresorerie', 'argent', 'gagne', 'benefice', 'marge', 'wave', 'orange money', 'panier', 'livree', 'commandes'];
const SONG_GEN_WORDS = ['genere la chanson', 'generer la chanson', 'lance la chanson', 'produis la chanson', 'produire la chanson', 'creation chanson', 'generation kie', 'kie.ai', 'kie ai', 'creer chanson suno', 'lance la production'];
const ORDER_ACTION_WORDS = [
  'reçois la commande', 'recois la commande', 'enregistre la commande', 'nouvelle commande',
  'creer une commande', 'cree une commande', 'valide la commande', 'valider la commande',
  'paiement recu', 'paiement reçu', 'a paye', 'a payé', 'encaisser', 'encaisse', 'enregistrer la vente',
  'prendre la commande', 'confirme la commande', 'confirmer la commande', 'marque comme paye', 'marque comme payé',
  'reception commande', 'recevoir la commande', 'enregistrer commande', 'valider commande', 'commande recue', 'commande reçue'
];
/* Facturation de la plateforme (crédits, pass) : les tarifs clients relèvent de la base de connaissance */
const BILLING_WORDS = ['credit', 'abonnement', 'recharge', 'saspay', 'facturation', 'pass studio', 'mon solde', 'solde de credit'];
const LYRICS_WORDS = [
  'parole', 'ecris la chanson', 'ecris une chanson', 'redige la chanson', 'compose', 'texte de la chanson',
  'chanson pour', 'couplet', 'refrain', 'lyrics', 'generer le texte', 'genere le texte', 'fais le texte',
  'fais les paroles', 'deux textes', '2 textes', 'deux chansons', '2 chansons', 'double commande', 'les deux paroles',
  'les deux textes', 'deux versions', '2 versions', 'tous les textes'
];
const REPLY_WORDS = ['relance', 'relancer', 'redige un message', 'redige-moi un message', 'redige moi un message', 'ecris un message', 'message whatsapp', 'reponds', 'repondre', 'reponse', 'message pour', 'texte pour', 'convaincre', 'hesite'];
const RECALL_WORDS = ['rappelle', 'resume', 'discute', 'a dit', 'parle', 'historique', 'conversation', 'discussion', 'retrouve', 'cherche', 'trouve', 'qui a', 'quel client', 'dossier', 'fiche'];

function detectIntent(prompt: string): Intent {
  const n = normalize(prompt);
  if (has(n, ORDER_ACTION_WORDS) && !isNegated(n)) return 'order_action';
  if (has(n, SONG_GEN_WORDS) && !isNegated(n)) return 'song_generate';
  if (has(n, BILLING_WORDS)) return 'billing';
  const phone = extractPhoneFragment(prompt);
  if (phone && !has(n, LYRICS_WORDS) && !has(n, REPLY_WORDS) && !has(n, ORDER_ACTION_WORDS)) return 'phone';
  if (has(n, LYRICS_WORDS)) return 'lyrics';
  if (has(n, REPLY_WORDS)) return 'reply';
  if (has(n, SALES_WORDS) || (n.includes('combien') && has(n, ['gagne', 'fait', 'encaisse', 'livre', 'vendu']))) return 'sales';
  if (phone) return 'phone';
  if (has(n, RECALL_WORDS) || n.includes('client')) return 'search';
  if (findKnowledge(n)) return 'knowledge';
  if (keywords(prompt).length > 0) return 'search';
  return 'help';
}

const INTENT_TOOLS: Record<Intent, string[]> = {
  phone: ['detect_phone_number', 'lookup_contact_by_phone', 'get_whatsapp_transcripts', 'summarize_conversation'],
  search: ['search_studio_conversations', 'get_whatsapp_transcripts', 'summarize_conversation'],
  sales: ['get_studio_metrics', 'track_live_sales', 'get_live_orders'],
  lyrics: ['search_client_context', 'generate_lyric_score'],
  song_generate: ['lookup_client_dossier', 'extract_client_memories', 'generate_lyric_score', 'check_studio_credits'],
  order_action: ['lookup_client_dossier', 'validate_order_details', 'sync_studio_database'],
  billing: ['get_studio_credits', 'get_subscription_status', 'check_saspay_gateway'],
  reply: ['search_client_context', 'compose_whatsapp_reply'],
  knowledge: ['query_velaris_knowledge_base'],
  help: ['query_velaris_knowledge_base'],
};

/** Outils annoncés pendant le calcul (même aiguillage que askCopilot) */
export function planCopilotTools(prompt: string): string[] {
  return INTENT_TOOLS[detectIntent(prompt)];
}

/* ------------------------------------------------------------------ */
/* Dossiers clients unifiés (Supabase ou données de démonstration)    */
/* ------------------------------------------------------------------ */

interface ClientMessage {
  inbound: boolean;
  body: string;
  at: string;
}

interface ClientDossier {
  name: string;
  phone?: string;
  stage: string;
  lastExchange: string;
  occasion?: string;
  facts?: string;
  messages: ClientMessage[];
  orders: { amount: number; method: string; status: string }[];
  convId?: string;
}

const STAGE_LABEL: Record<string, string> = {
  nouveau: 'Nouveau prospect',
  new: 'Nouveau prospect',
  en_discussion: 'En discussion',
  qualifying: 'En discussion',
  devis: 'Devis & paiement',
  paiement: 'Devis & paiement',
  paid: 'Paiement reçu',
  presenting: 'Devis & paiement',
  livre: 'Livré',
  delivered: 'Livré',
};

function demoDossiers(): ClientDossier[] {
  const byPhone = new Map<string, ClientDossier>();
  for (const c of REAL_CONVERSATIONS) {
    const msgs = REAL_CONVERSATION_MESSAGES[c.id] || [];
    byPhone.set(digitsOf(c.phone), {
      name: c.name,
      phone: c.phone,
      stage: c.status,
      lastExchange: c.lastExchange,
      facts: c.facts,
      messages: msgs.length
        ? msgs.map(m => ({ inbound: m.direction === 'inbound', body: m.body, at: m.createdAt }))
        : c.fullMessage
          ? [{ inbound: true, body: c.fullMessage, at: c.lastExchange }]
          : [],
      orders: [],
      convId: c.id,
    });
  }
  for (const l of REAL_PIPELINE_LEADS) {
    const key = digitsOf(l.phone);
    const existing = byPhone.get(key);
    if (existing) {
      existing.occasion = existing.occasion || l.tag;
      existing.facts = existing.facts || l.summary;
    } else {
      byPhone.set(key, {
        name: l.name,
        phone: l.phone,
        stage: l.stage,
        lastExchange: l.lastExchange,
        occasion: l.tag,
        facts: l.summary,
        messages: [],
        orders: [],
      });
    }
  }
  return [...byPhone.values()];
}

async function liveDossierByPhone(fragment: string): Promise<ClientDossier | null> {
  const res = await findConversationByPhone(fragment);
  if (!res.contact) return null;
  return {
    name: res.contact.name || res.contact.phone || 'Client WhatsApp',
    phone: res.contact.phone,
    stage: res.conversation?.funnel_stage || 'nouveau',
    lastExchange: res.conversation?.last_message_at
      ? new Date(res.conversation.last_message_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
      : 'Récent',
    occasion: res.contact.occasion || undefined,
    facts: res.conversation?.summary || res.contact.notes || undefined,
    messages: res.messages.map((m: any) => ({
      inbound: m.direction === 'inbound',
      body: m.body || '',
      at: m.created_at ? new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
    })),
    orders: res.orders.map((o: any) => ({
      amount: Number(o.amount_cents || 0) / 100,
      method: o.payment_method || 'Wave',
      status: o.status,
    })),
    convId: res.conversation?.id,
  };
}

async function liveDossiersBySearch(prompt: string): Promise<ClientDossier[]> {
  const words = keywords(prompt);
  const terms = words.length ? words : [prompt.trim()];
  const seen = new Map<string, ClientDossier>();
  for (const term of terms.slice(0, 4)) {
    const res = await searchStudioData(term);
    for (const conv of res.conversations.slice(0, 5)) {
      const ct = Array.isArray(conv.contacts) ? conv.contacts[0] : conv.contacts;
      const key = conv.id;
      if (seen.has(key)) continue;
      seen.set(key, {
        name: ct?.name || ct?.phone || 'Client WhatsApp',
        phone: ct?.phone,
        stage: conv.funnel_stage || 'nouveau',
        lastExchange: conv.last_message_at ? new Date(conv.last_message_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent',
        occasion: ct?.occasion,
        facts: conv.summary,
        messages: [],
        orders: [],
        convId: conv.id,
      });
    }
    for (const c of res.contacts.slice(0, 5)) {
      if ([...seen.values()].some(d => digitsOf(d.phone) === digitsOf(c.phone))) continue;
      seen.set(`c-${c.id}`, {
        name: c.name || c.phone,
        phone: c.phone,
        stage: 'nouveau',
        lastExchange: c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : 'Récent',
        occasion: c.occasion,
        facts: c.notes,
        messages: [],
        orders: [],
      });
    }
  }
  const list = [...seen.values()];
  // Charge le fil complet du meilleur résultat
  if (list[0]?.convId) {
    const msgs = await getLiveMessages(list[0].convId);
    list[0].messages = msgs.map((m: any) => ({
      inbound: m.direction === 'inbound',
      body: m.body || '',
      at: m.created_at ? new Date(m.created_at).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '',
    }));
  }
  return list;
}

/* Score de pertinence d'un dossier pour une recherche par contexte */
function scoreDossier(d: ClientDossier, prompt: string): number {
  const n = normalize(prompt);
  const name = normalize(d.name);
  let score = 0;
  if (name.length >= 3 && n.includes(name)) score += 10;
  const hay = normalize([d.name, d.occasion, d.facts, ...d.messages.map(m => m.body)].filter(Boolean).join(' '));
  for (const w of keywords(prompt)) {
    if (name.includes(w)) score += 4;
    else if (hay.includes(w)) score += 2;
  }
  return score;
}

/* ------------------------------------------------------------------ */
/* Résumé extractif d'une discussion                                  */
/* ------------------------------------------------------------------ */

const OCCASIONS: [string[], string][] = [
  [['anniversaire', 'anniv', 'birthday'], 'Anniversaire'],
  [['mariage', 'fiancailles', 'dot', 'noces', 'ans de mariage'], 'Mariage & amour'],
  [['hommage', 'defunt', 'deces', 'condoleance', 'deuil', 'repose'], 'Hommage & deuil'],
  [['bapteme', 'naissance', 'bebe'], 'Baptême & naissance'],
  [['publicit', 'entreprise', 'boutique', 'vente', 'superette', 'inauguration'], 'Chanson publicitaire'],
  [['action de grace', 'priere', 'gloire', 'gospel', 'dieu'], 'Gospel & action de grâce'],
  [['sensibilisation', 'ong'], 'Sensibilisation'],
];

export const OCCASION_LABELS: Record<SongOccasion, string> = {
  anniversaire: 'Anniversaire',
  mariage: 'Mariage & amour',
  amour: 'Amour & déclaration',
  hommage: 'Hommage & deuil',
  naissance: 'Baptême & naissance',
  fete: 'Fête & célébration',
  institution: 'Chanson publicitaire',
  autre: 'Célébration sur mesure',
};

const STYLES: [string[], string][] = [
  [['afro love', 'afro-love', 'afrolove'], 'Afro-Love'],
  [['gospel'], 'Gospel'],
  [['zouk'], 'Zouk'],
  [['rumba'], 'Rumba'],
  [['mandingue'], 'Mandingue'],
  [['acoustique', 'guitare'], 'Acoustique'],
  [['coupe-decale', 'coupe decale'], 'Coupé-décalé'],
];

function analyse(d: ClientDossier) {
  const corpus = [d.occasion, d.facts, ...d.messages.map(m => m.body)].filter(Boolean).join(' ');
  const n = normalize(corpus);
  const occasion = OCCASIONS.find(([k]) => has(n, k))?.[1] || d.occasion || (corpus ? OCCASION_LABELS[detectOccasion(corpus)] : undefined);
  const style = STYLES.find(([k]) => has(n, k))?.[1];
  const amounts = [...corpus.matchAll(/(\d[\d\s .]{2,})\s?(?:f\b|fcfa|f cfa)/gi)]
    .map(m => Number(digitsOf(m[1])))
    .filter(v => v >= 500 && v <= 100000);
  const method = /wave/i.test(corpus) ? 'Wave' : /orange/i.test(corpus) ? 'Orange Money' : /moov/i.test(corpus) ? 'Moov Money' : undefined;
  const urgency = /(samedi|dimanche|demain|ce soir|urgent|aujourd'hui|vite)/i.exec(corpus)?.[1];
  const recipient =
    /destinataire\s*:?\s*([A-ZÀ-Ý][\p{L}-]+(?:\s[A-ZÀ-Ý][\p{L}-]+)?)/u.exec(corpus)?.[1] ||
    /(?:pour|de)\s+(?:ma|mon|sa|son)?\s*(?:bestie|soeur|sœur|frere|frère|femme|mari|fille|fils|maman|papa|mere|mère|pere|père|cherie|chérie|amie?)?\s*([A-ZÀ-Ý][\p{L}-]{2,})/u.exec(corpus)?.[1];
  const voiceNotes = d.messages.filter(m => m.inbound && isVoiceNote(m.body)).length;
  const paid = d.orders.some(o => ['delivered', 'validated', 'paid'].includes(o.status)) || /(bien recu|paye et confirme|depot de|transfert effectue)/.test(n);
  return { occasion, style, amount: amounts.length ? Math.max(...amounts) : undefined, method, urgency, recipient, voiceNotes, paid };
}

function nextStep(stage: string, a: ReturnType<typeof analyse>): string {
  const s = STAGE_LABEL[stage] || stage;
  if (s === 'Livré') return 'Commande livrée. Demandez un témoignage vocal et proposez la version vidéo à 3 000 F.';
  if (s === 'Paiement reçu' || (s === 'Devis & paiement' && a.paid)) return 'Paiement confirmé : lancez la production dans l’Atelier et annoncez l’heure de livraison.';
  if (s === 'Devis & paiement') return `Le client a validé le principe. Envoyez le numéro ${a.method || 'Wave'} et confirmez le montant${a.amount ? ` (${fcfa(a.amount)})` : ''}.`;
  if (s === 'En discussion') return 'Le brief est en cours : faites valider les paroles avant de demander le paiement (technique du texte d’abord).';
  return 'Nouveau contact : posez les 3 questions du brief (occasion, prénom du destinataire, souvenirs forts) et annoncez la grille 1 200 F / 3 000 F / 5 000 F.';
}

function draftReply(d: ClientDossier, a: ReturnType<typeof analyse>): string {
  const first = d.name.split(/\s+/)[0];
  const s = STAGE_LABEL[d.stage] || d.stage;
  if (s === 'Livré') return `Bonjour ${first}, merci encore pour votre confiance. Votre chanson vous a plu ? Nous proposons aussi la version vidéo avec vos photos à 3 000 F, livrée en 18 minutes.`;
  if (s === 'Paiement reçu' || (s === 'Devis & paiement' && a.paid)) return `Bonjour ${first}, paiement bien reçu, merci. Votre chanson${a.recipient ? ` pour ${a.recipient}` : ''} est en production : vous la recevez ici même dans moins de 20 minutes.`;
  if (s === 'Devis & paiement') return `Bonjour ${first}, tout est prêt pour lancer votre chanson${a.recipient ? ` pour ${a.recipient}` : ''}. Vous pouvez envoyer ${a.amount ? fcfa(a.amount) : 'le montant'} sur notre numéro ${a.method || 'Wave'} ; la livraison suit dans les 18 minutes.`;
  if (s === 'En discussion') return `Bonjour ${first}, voici où nous en sommes pour votre chanson${a.occasion ? ` (${a.occasion.toLowerCase()})` : ''}. Je vous envoie les paroles à valider ; dès votre accord, on passe au studio.`;
  return `Bonjour ${first}, merci pour votre message. Pour composer votre chanson, dites-moi : l’occasion, le prénom de la personne et un souvenir fort avec elle. Formules : 1 200 F, 3 000 F (vidéo avec photos) ou 5 000 F (prestige).`;
}

function dossierReport(d: ClientDossier, intro: string): { text: string; card: ActionCardData } {
  const a = analyse(d);
  const stage = STAGE_LABEL[d.stage] || d.stage;
  const inbound = d.messages.filter(m => m.inbound);
  const total = d.orders.reduce((s, o) => s + o.amount, 0);

  let text = `### ${d.name}\n\n${intro}\n\n`;
  text += `| Champ | Valeur | Source |\n| :--- | :--- | :--- |\n`;
  text += `| Téléphone | ${d.phone || 'Inconnu'} | Contact WhatsApp |\n`;
  text += `| Étape | ${stage} | Pipeline |\n`;
  text += `| Dernier échange | ${d.lastExchange} | Passerelle WAHA |\n`;
  if (a.occasion) text += `| Occasion | ${a.occasion} | Brief |\n`;
  if (total > 0) text += `| Encaissé | ${fcfa(total)} | ${d.orders.length} commande(s) |\n`;
  text += `\n#### Ce que le client a dit\n`;
  if (inbound.length) {
    text += inbound
      .slice(-6)
      .map(m => `- *${m.at}*${isVoiceNote(m.body) ? ' (note vocale)' : ''} : « ${stripPictos(m.body)} »`)
      .join('\n');
  } else {
    text += `- ${d.facts ? stripPictos(d.facts) : 'Aucun message entrant synchronisé pour ce contact.'}`;
  }

  const points: string[] = [];
  if (a.recipient) points.push(`**Destinataire** : ${a.recipient}`);
  if (a.occasion) points.push(`**Occasion** : ${a.occasion}`);
  if (a.style) points.push(`**Style demandé** : ${a.style}`);
  if (a.amount) points.push(`**Montant évoqué** : ${fcfa(a.amount)}${a.method ? ` via ${a.method}` : ''}`);
  else if (a.method) points.push(`**Paiement** : ${a.method}`);
  if (a.urgency) points.push(`**Échéance** : ${a.urgency}`);
  if (a.voiceNotes) points.push(`**Notes vocales** : ${a.voiceNotes} transcrite(s)`);
  if (d.facts && !points.length) points.push(`**Faits retenus** : ${stripPictos(d.facts)}`);
  if (points.length) text += `\n\n#### Résumé\n${points.map(p => `- ${p}`).join('\n')}`;

  text += `\n\n**Prochaine action** : ${nextStep(d.stage, a)}`;

  return {
    text,
    card: {
      type: 'client_brief',
      title: `Relance prête : ${d.name}`,
      phone: d.phone,
      recipient: d.name,
      occasion: a.occasion,
      content: draftReply(d, a),
      metadata: { convId: d.convId, waLink: waLink(d.phone) },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Connaissance du site & de la méthode Velaris                       */
/* ------------------------------------------------------------------ */

interface KnowledgeEntry {
  keys: string[];
  title: string;
  body: string;
}

const KNOWLEDGE: KnowledgeEntry[] = [
  {
    keys: ['tarif', 'prix', 'formule', 'grille', 'combien coute', 'offre'],
    title: 'Grille tarifaire Velaris',
    body:
      `| Formule | Prix | Contenu |\n| :--- | :--- | :--- |\n` +
      `| Découverte | 1 200 F | 1 chanson personnalisée, 1 voix studio, master audio |\n` +
      `| Complète | 3 000 F | Paroles sur mesure, 2 versions, vidéo avec photos |\n` +
      `| Prestige / Mariage | 5 000 F | Duo de voix, arrangements, livret HD |\n\n` +
      `La Complète à 3 000 F est le best-seller : proposez-la dès l’écoute de la maquette.`,
  },
  {
    keys: ['delai', 'combien de temps', 'livraison', '18 min', 'rapide'],
    title: 'Délais de production',
    body: `Brief vocal transcrit, paroles générées, production musicale puis livraison sur WhatsApp : **18 minutes en moyenne** (15 min Découverte, 25 min Prestige).`,
  },
  {
    keys: ['marge', 'cout', 'depense', 'rentab', 'suno'],
    title: 'Coûts & marges',
    body:
      `- **Marge brute moyenne** : 92,4 %\n- **Coût IA** : environ 150 F CFA par composition\n- **Suno Pro** : 12 000 F / mois\n- **VPS WAHA** : 3 500 F / mois\n- **Retraits Mobile Money** : 1 % fixe\n\nSuivi détaillé dans l’onglet *Ventes & Caisse*.`,
  },
  {
    keys: ['qr', 'scanner', 'connecter whatsapp', 'ligne', 'waha', 'deconnex', 'session'],
    title: 'Lignes WhatsApp (WAHA multi-studio)',
    body:
      `Chaque studio possède sa propre session WAHA (\`studio_<identifiant>\`). Ouvrez *Lignes WhatsApp*, scannez le QR code depuis WhatsApp > Appareils connectés : vos discussions arrivent uniquement dans votre espace (isolation RLS). ` +
      `La session est configurée anti-déconnexion (redémarrage automatique, *markOnline* désactivé) : vous pouvez continuer à utiliser WhatsApp sur votre téléphone.`,
  },
  {
    keys: ['automatisation', 'emoji', 'regle', 'declencheur', 'reaction'],
    title: 'Automatisations',
    body: `Une règle = une réaction posée sur un message client qui déclenche l’envoi d’un texte, d’un vocal, d’un document ou d’une vidéo. Une même réaction ne peut servir qu’à une seule règle active (sinon le client recevrait deux réponses). Les interrupteurs activent ou coupent chaque règle ; le journal garde les 50 derniers déclenchements (60 envois automatiques maximum par heure).`,
  },
  {
    keys: ['pipeline', 'suivi client', 'etape', 'kanban', 'prospect'],
    title: 'Suivi clients',
    body: `Le pipeline suit 4 étapes : *Nouveau prospect*, *En discussion*, *Devis & paiement*, *En studio / livré*. Les fiches avancent automatiquement selon la conversation ; filtres Aujourd’hui / 7 jours / 30 jours / Tout / Dates.`,
  },
  {
    keys: ['paiement', 'mobile money', 'encaisser', 'payer', 'moov'],
    title: 'Encaissement',
    body: `Vos clients paient directement sur **votre** numéro Wave, Orange Money ou Moov. Velaris ne prélève rien sur les ventes ; la caisse ventile automatiquement les encaissements par opérateur.`,
  },
  {
    keys: ['academie', 'formation', 'module', 'cours', 'apprendre', 'publicite facebook', 'facebook', 'tiktok'],
    title: 'Académie Studio',
    body: ACADEMY_MODULES.map((m, i) => `${i + 1}. **${m.title}** (${m.duration}, ${m.lessonsCount} leçons) : ${m.description}`).join('\n'),
  },
  {
    keys: ['corpus', 'bibliotheque', 'texte patron', 'modele', 'texte fait main', 'style maison', 'plume', 'hits', 'golden'],
    title: 'Bibliothèque Poétique & Plume du Patron (Golden Corpus)',
    body:
      `Le studio s'appuie sur la bibliothèque étalon des œuvres rédigées par le patron pour former et guider l'IA :\n` +
      `- **Hits de référence** : ${GOLDEN_PATRON_CORPUS.map(c => `*« ${c.title} »* (${c.lineCount} vers, ${c.style})`).join(', ')}.\n` +
      `- **Règle absolue** : Aucun texte court (32 à 48 vers complets avec intro, couplets narratifs, refrains rythmés avec prénom, pont d'émotion et outro).\n` +
      `- **Flexibilité Copilot** : Demandez *« Paroles pour Marc »*, *« Fais les 2 textes pour Aminata »* ou *« Reçois la commande de 3 000 F »*.\n\n` +
      `**ADN de style maison** :\n${getHouseStyleDnaNote()}`,
  },
  {
    keys: ['velaris', 'c est quoi', 'plateforme', 'site', 'fonctionne', 'comment marche'],
    title: 'Velaris en bref',
    body:
      `Velaris est l’académie et la suite logicielle pour lancer son studio de chansons personnalisées sur WhatsApp :\n` +
      `- **Mes revenus / Ventes & Caisse** : chiffre d’affaires, ventilation Wave / Orange Money\n` +
      `- **Discussions WhatsApp** : boîte de réception connectée à votre ligne\n- **Suivi clients** : pipeline de closing\n` +
      `- **Automatisations** : réponses par emoji\n- **Atelier Studio IA** : paroles et production en 18 minutes\n- **Académie** : 4 modules pour vendre`,
  },
];

function findKnowledge(n: string): KnowledgeEntry | null {
  let best: KnowledgeEntry | null = null;
  let bestScore = 0;
  for (const k of KNOWLEDGE) {
    const score = k.keys.filter(key => termRe(key).test(n)).length;
    if (score > bestScore) {
      best = k;
      bestScore = score;
    }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Paroles                                                            */
/* ------------------------------------------------------------------ */

/*
 * Souvenirs du client repris mot pour mot dans un pont : ce qui rend la chanson unique.
 * On retient les phrases entrantes qui racontent (toujours, souvenir, ensemble…),
 * nettoyées des pictogrammes, sans montants ni numéros.
 */
const MEMORY_CUES = ['toujours', 'souvenir', 'ensemble', 'depuis', 'jamais', 'merci', 'soutenu', 'aime', 'fier', 'courage', 'premiere fois', 'quand on', 'elle m', 'il m', 'ma vie', 'mon coeur', 'traverse'];

function memoryLines(d: ClientDossier | null): string[] {
  if (!d) return [];
  const sentences = d.messages
    .filter(m => m.inbound)
    .flatMap(m => stripPictos(m.body).split(/(?<=[.!?])\s+/))
    .concat(d.facts ? stripPictos(d.facts).split(/(?<=[.!?])\s+/) : [])
    .map(x => x.trim().replace(/[.!?]+$/, ''))
    .filter(x => x.length >= 18 && x.length <= 90 && !/\d{3,}|f\s?cfa|wave|orange|moov|numero|transf/i.test(x));
  const scored = sentences
    .map(x => ({ x, score: MEMORY_CUES.filter(c => normalize(x).includes(c)).length }))
    .filter(e => e.score > 0)
    .sort((a, b) => b.score - a.score);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const { x } of scored) {
    const key = normalize(x).slice(0, 30);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(x.charAt(0).toUpperCase() + x.slice(1));
    if (out.length === 2) break;
  }
  return out;
}

function extractRecipients(corpus: string, fallbackName: string): string[] {
  const matches = [...corpus.matchAll(/(?:pour|de)\s+(?:ma|mon|sa|son)?\s*(?:bestie|soeur|sœur|frere|frère|femme|mari|fille|fils|maman|papa|mere|mère|pere|père|cherie|chérie|amie?)?\s*([A-ZÀ-Ýa-zà-ÿ][\p{L}-]{2,})/gu)]
    .map(m => m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase())
    .filter(name => !STOPWORDS.has(name.toLowerCase()));
  const unique = Array.from(new Set(matches));
  return unique.length >= 2 ? unique : [fallbackName, 'Mon amour'];
}

function composeLyrics(
  name: string,
  occasion: string,
  style: string,
  dossier: ClientDossier | null = null,
  senderName?: string | null
): { title: string; lyrics: string; lineCount: number } {
  const memories = memoryLines(dossier);
  return generateHouseStyleSong({
    recipient: name,
    occasion,
    style,
    memories,
    senderName: senderName || dossier?.name,
  });
}

/* ------------------------------------------------------------------ */
/* Moteur principal                                                   */
/* ------------------------------------------------------------------ */

const STOPWORDS = new Set([
  'pour', 'avec', 'dans', 'sur', 'sous', 'par', 'chez', 'vers', 'sans', 'faire', 'fais', 'fait',
  'texte', 'textes', 'chanson', 'chansons', 'parole', 'paroles', 'commande', 'commandes',
  'generer', 'genere', 'ecris', 'ecrire', 'compose', 'recois', 'reçois', 'recevoir', 'enregistre',
  'enregistrer', 'valide', 'valider', 'deux', 'les', 'des', 'une', 'son', 'ses', 'client',
  'cliente', 'dossier', 'fiche', 'tout', 'tous', 'svp', 'merci', 'suno', 'studio', 'velaris'
]);

function extractSearchTerms(prompt: string): string[] {
  return prompt
    .split(/[\s,.;:!?'’()]+/)
    .map(w => w.trim())
    .filter(w => w.length >= 3 && !STOPWORDS.has(w.toLowerCase()) && !/^\d+$/.test(w));
}

/* Dernier client évoqué dans la conversation (« relance-le », « écris ses paroles ») */
function clientFromHistory(history: CopilotMessage[]): { name?: string; phone?: string } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const card = history[i].actionCard;
    if (card?.phone || (card?.recipient && card.type !== 'lyrics')) return { name: card.recipient, phone: card.phone };
  }
  return null;
}

/* Noms propres du message : recherche stricte des paroles et relances */
const properNouns = (prompt: string) =>
  prompt
    .split(/[\s,.;:!?'’()]+/)
    .filter(w => /^[A-ZÀ-Ý][\p{L}-]{2,}$/u.test(w) && !['WhatsApp', 'Wave', 'Orange', 'Moov', 'Velaris', 'Sonar', 'Studio', 'Pour'].includes(w));

async function resolveDossier(
  prompt: string,
  user: any,
  history: CopilotMessage[],
  strict = false
): Promise<{ best: ClientDossier | null; others: ClientDossier[] }> {
  const phone = extractPhoneFragment(prompt);
  const n = normalize(prompt);

  if (phone) {
    if (user) {
      const live = await liveDossierByPhone(phone);
      if (live) return { best: live, others: [] };
    }
    const matches = demoDossiers().filter(d => phoneMatches(d.phone, phone));
    if (user && !matches.length) return { best: null, others: [] };
    return { best: matches[0] || null, others: matches.slice(1) };
  }

  // « le dernier client », « la discussion la plus récente »
  if (!strict && /(dernier|derniere|plus recent|recemment)/.test(n)) {
    if (user) {
      const latest = (await getLiveConversations())[0];
      if (latest?.phone) {
        const live = await liveDossierByPhone(latest.phone);
        if (live) return { best: live, others: [] };
      }
    } else {
      const latest = demoDossiers()[0];
      if (latest) return { best: latest, others: [] };
    }
  }

  const terms = extractSearchTerms(prompt);
  const query = strict
    ? (properNouns(prompt).join(' ') || terms.join(' '))
    : (terms.length ? terms.join(' ') : prompt);
  if (query.trim()) {
    if (user) {
      const list = await liveDossiersBySearch(query);
      if (list.length) return { best: list[0], others: list.slice(1, 5) };
    } else {
      const ranked = demoDossiers()
        .map(d => ({ d, s: scoreDossier(d, query) }))
        .filter(x => x.s >= (strict ? 4 : 2))
        .sort((a, b) => b.s - a.s);
      if (ranked.length) return { best: ranked[0].d, others: ranked.slice(1, 5).map(x => x.d) };
    }
  }

  // Pronoms : reprend le client de l'échange précédent
  const prev = clientFromHistory(history);
  if (prev?.phone) return resolveDossier(prev.phone, user, []);
  return { best: null, others: [] };
}

function salesReport(ctx: CopilotContext, metrics: StudioMetrics, liveOrders: Order[]) {
  const orders = liveOrders.length ? liveOrders : ctx.orders || [];
  const sum = (list: Order[]) => list.reduce((s, o) => s + (Number(o.amount) || 0), 0);
  const wave = orders.filter(o => /wave/i.test(o.paymentMethod));
  const om = orders.filter(o => /orange|moov|mtn/i.test(o.paymentMethod));
  const delivered = orders.filter(o => o.status === 'livre');
  const inProgress = orders.filter(o => o.status !== 'livre');
  const ledger = sum(orders);
  const avg = orders.length ? ledger / orders.length : 0;
  const waveShare = ledger ? Math.round((sum(wave) / ledger) * 100) : 0;
  const total = Math.max(metrics.totalRevenue || 0, ledger);
  const syncedAt = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let text = `### Ventes en temps réel\n\nSynchronisé à ${syncedAt} sur votre caisse et vos commandes.\n\n`;
  text += `| Indicateur | Valeur | Détail |\n| :--- | :--- | :--- |\n`;
  text += `| **Chiffre d'affaires cumulé** | **${fcfa(total)}** | Solde d’ouverture et commandes encaissées |\n`;
  text += `| **Marge brute** | **92,4 %** | Coût IA ~150 F par chanson |\n`;
  text += `| **Chansons livrées** | **${Math.max(metrics.ordersDelivered || 0, delivered.length)}** | Clients servis |\n`;
  text += `| **En production** | **${Math.max(metrics.ordersActive || 0, inProgress.length)}** | Brief, paroles ou paiement |\n`;
  if (orders.length) {
    text += `| **Wave** | **${fcfa(sum(wave))}** | ${wave.length} vente(s), ${waveShare} % |\n`;
    text += `| **Orange Money & Moov** | **${fcfa(sum(om))}** | ${om.length} vente(s), ${ledger ? 100 - waveShare : 0} % |\n`;
    text += `| **Panier moyen** | **${fcfa(avg)}** | Sur ${orders.length} commande(s) |\n`;
  }
  text += `| **Taux de closing** | **${String(metrics.conversionRate || 0).replace('.', ',')} %** | Briefs reçus vs commandes payées |\n`;

  if (orders.length) {
    text += `\n#### Dernières ventes\n`;
    text += orders
      .slice(0, 4)
      .map((o, i) => `${i + 1}. **${o.clientName}** : ${o.occasion}, ${fcfa(o.amount)} via ${o.paymentMethod} (${o.createdAt})`)
      .join('\n');
  }
  const upsell = avg && avg < 3000
    ? `Votre panier moyen (${fcfa(avg)}) reste sous la formule Complète : proposez systématiquement la vidéo avec photos à 3 000 F après l’écoute de la maquette.`
    : `Gardez le cap : la formule Complète à 3 000 F reste votre meilleur levier de marge.`;
  text += `\n\n**Recommandation** : ${upsell}`;

  return {
    text,
    card: {
      type: 'stats' as const,
      title: 'Ventes en direct',
      content: `CA ${fcfa(total)} • ${Math.max(metrics.ordersDelivered || 0, delivered.length)} livrées • Wave ${waveShare} %`,
      metadata: {
        totalRevenue: Math.round(total).toLocaleString('fr-FR'),
        delivered: Math.max(metrics.ordersDelivered || 0, delivered.length),
        active: Math.max(metrics.ordersActive || 0, inProgress.length),
        convRate: metrics.conversionRate || 0,
        wave: sum(wave),
        om: sum(om),
        syncedAt,
      },
    },
  };
}

export async function askCopilot(
  prompt: string,
  history: CopilotMessage[],
  sessionName: string,
  user: any,
  context: CopilotContext = {}
): Promise<CopilotMessage> {
  // 1. Tenter l'appel au cerveau d'élite DeepSeek-V3 en temps réel (API live waha.velarisagent.life/api/copilot)
  try {
    const res = await fetch('https://waha.velarisagent.life/api/copilot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt,
        history: history.map(h => ({ role: h.role, text: h.text })),
        sessionName,
        user: user ? { id: user.id, email: user.email } : null,
        context: {
          orders: context.orders,
          metrics: context.metrics,
        },
      }),
      signal: AbortSignal.timeout(18_000),
    });

    if (res.ok) {
      const json = await res.json();
      if (json.ok && json.data) {
        debitAiPromptCredit(`Copilot IA (DeepSeek V3) : ${prompt.trim().slice(0, 40)}`);
        return {
          id: json.data.id || `copilot_${Date.now()}`,
          role: 'assistant',
          text: json.data.text,
          timestamp: json.data.timestamp || new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          toolsExecuted: json.data.toolsExecuted || ['deepseek_chat_v3_reasoning'],
          actionCard: json.data.actionCard || undefined,
        };
      }
    }
  } catch (err) {
    console.warn('Copilot live API unreachable, falling back to local engine:', err);
  }

  // 2. Repli instantané sur le moteur local déterministe
  const answer = await answerCopilot(prompt, history, sessionName, user, context);
  debitAiPromptCredit(`Copilot IA : ${prompt.trim().slice(0, 40)}`);
  return answer;
}

async function answerCopilot(
  prompt: string,
  history: CopilotMessage[],
  _sessionName: string,
  user: any,
  context: CopilotContext
): Promise<CopilotMessage> {
  const cleanPrompt = prompt.trim();
  const norm = normalize(cleanPrompt);
  const timeStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  const msgId = `copilot_${Date.now()}`;
  const intent = detectIntent(cleanPrompt);
  const tools = INTENT_TOOLS[intent];
  const reply = (text: string, actionCard?: ActionCardData): CopilotMessage => ({
    id: msgId,
    role: 'assistant',
    text,
    timestamp: timeStr,
    toolsExecuted: tools,
    actionCard,
  });


  // ---------------------------------------------------------------------
  // Facturation, crédits & abonnements SasPay
  // ---------------------------------------------------------------------
  if (intent === 'billing') {
    const credits = getStudioCredits();
    return reply(
      `### Facturation & Tarification Studio Velaris\n\n` +
      `Votre solde actuel est de **${credits.balance.toFixed(2)} crédit(s)**.\n\n` +
      `#### Grille tarifaire transparente :\n` +
      `- **1 crédit chanson = 85 F CFA** : Génération complète Suno via Kie.ai (débité uniquement au lancement).\n` +
      `- **Micro-crédits IA (0.05 crédit = ~4.25 F CFA)** : Utilisation de l'assistant Copilot au quotidien.\n` +
      `- **Validité permanente** : Vos crédits **n'expirent jamais** (valables à vie).\n\n` +
      `#### Formules d’Abonnement (Accès Studio complet) via SasPay :\n` +
      `1. **Pass Mensuel** : **3 000 F CFA / mois** (accès complet au Studio + WAHA WhatsApp + Pipeline CRM).\n` +
      `2. **Pass Trimestriel** : **7 000 F CFA pour 3 mois** (économie de 2 000 F CFA offerte).\n\n` +
      `*Rechargez vos crédits ou gérez votre abonnement directement depuis votre onglet « Profil Studio ».*`,
      {
        type: 'stats',
        title: 'Solde & Abonnements',
        content: `Solde : ${credits.balance.toFixed(2)} crédits disponibles | Taux : 1 crédit = 85 F CFA`
      }
    );
  }

  // ---------------------------------------------------------------------
  // Génération automatique de chanson avec Kie.ai
  // ---------------------------------------------------------------------
  if (intent === 'song_generate') {
    const { best } = await resolveDossier(cleanPrompt, user, history, true);
    if (!best) {
      return reply(
        `### Pour quel client ?\n\n` +
        `Je lance une production seulement pour un client identifié, afin de livrer le bon morceau au bon numéro.\n\n` +
        `Précisez un **numéro** (même partiel) ou un **prénom** : *« Lance la chanson pour 5835 »*.`
      );
    }
    const a = analyse(best);
    const recipient = a.recipient || best.name.split(/\s+/)[0];
    const occasion = OCCASIONS.find(([k]) => has(norm, k))?.[1] || a.occasion || 'Anniversaire';
    const style = STYLES.find(([k]) => has(norm, k))?.[1] || a.style || 'Afro-Love acoustique';
    const { title: songTitle, lyrics } = composeLyrics(recipient, occasion, style, best);
    const credits = getStudioCredits();
    const enough = credits.source === 'pending' || credits.balance >= credits.songCostCredits;

    // Validation humaine avant toute action irréversible : le texte est proposé,
    // la production (1 crédit) ne part qu'au clic sur « Lancer la production ».
    return reply(
      `### Production prête pour ${best.name}\n\n` +
      `| Paramètre | Valeur |\n| :--- | :--- |\n` +
      `| Destinataire | ${recipient} |\n| Occasion | ${occasion} |\n| Style | ${style} |\n` +
      `| Titre | ${songTitle} |\n` +
      `| Coût | 1 crédit (85 F CFA), remboursé si la production échoue |\n` +
      `| Solde | ${credits.source === 'pending' ? 'synchronisation…' : `${credits.balance.toFixed(2)} crédit(s)`} |\n\n` +
      (enough
        ? `Relisez les paroles ci-dessous (${lyrics.split('\n').filter(l => l.trim()).length} vers, limite Suno : ${KIE_CONFIG.maxLyrics} caractères), puis lancez la production depuis la carte.`
        : `Solde insuffisant : rechargez vos crédits depuis votre **Profil Studio** (SasPay : Wave, Orange Money, MTN, Moov), puis relancez.`),
      {
        type: 'lyrics',
        title: songTitle,
        phone: best.phone,
        recipient,
        occasion,
        style,
        content: lyrics,
        metadata: { convId: best.convId, waLink: waLink(best.phone), readyForProduction: enough },
      }
    );
  }

  // ---------------------------------------------------------------------
  // Ventes & métriques
  // ---------------------------------------------------------------------
  if (intent === 'sales') {
    const metrics = user ? await getLiveStudioMetrics() : context.metrics || REAL_STUDIO_METRICS;
    const liveOrders: Order[] = user ? await getLiveOrders() : [];
    const { text, card } = salesReport(context, metrics, liveOrders);
    return reply(text, card);
  }

  // ---------------------------------------------------------------------
  // Numéro de téléphone, recherche par contexte, rappel de discussion
  // ---------------------------------------------------------------------
  if (intent === 'phone' || intent === 'search') {
    const phone = extractPhoneFragment(cleanPrompt);
    const { best, others } = await resolveDossier(cleanPrompt, user, history);

    if (!best) {
      if (phone) {
        return reply(
          `### Aucun contact pour « ${phone} »\n\n` +
          `Je n’ai trouvé aucune discussion WhatsApp dont le numéro contient **${phone}** dans ${user ? 'votre studio' : 'les données de démonstration'}.\n\n` +
          `- Vérifiez l’indicatif (+225, +226) ou tapez seulement les 4 à 8 derniers chiffres.\n- Si le client vient d’écrire, sa fiche apparaît dès que la passerelle WAHA a synchronisé le message.`
        );
      }
      if (intent === 'search' && !has(norm, RECALL_WORDS) && !norm.includes('client')) {
        return helpMessage(reply);
      }
      const recent = user ? (await getLiveConversations()).slice(0, 5) : REAL_CONVERSATIONS.slice(0, 5);
      return reply(
        `### Aucun client ne correspond\n\nVoici les dernières discussions pour vous aider à retrouver le bon contact :\n\n` +
        recent.map((c, i) => `${i + 1}. **${c.name}** (${c.phone || 'numéro inconnu'}), ${c.lastExchange}`).join('\n') +
        `\n\nTapez un **numéro** (même partiel, ex. *5835*) ou un **prénom** pour ouvrir le dossier complet.`
      );
    }

    const intro = phone
      ? `Numéro **${phone}** reconnu : voici la discussion complète et ce qu’il faut retenir.`
      : `Dossier retrouvé à partir de votre recherche.`;
    const report = dossierReport(best, intro);
    let text = report.text;
    const card = report.card;
    if (others.length) {
      text += `\n\n#### Autres correspondances\n` + others.map(o => `- **${o.name}** (${o.phone || 'sans numéro'}), ${STAGE_LABEL[o.stage] || o.stage}`).join('\n');
    }
    return reply(text, card);
  }

  // ---------------------------------------------------------------------
  // Message de relance / réponse WhatsApp
  // ---------------------------------------------------------------------
  if (intent === 'reply') {
    const { best } = await resolveDossier(cleanPrompt, user, history, true);
    if (best) {
      const a = analyse(best);
      const draft = draftReply(best, a);
      return reply(
        `### Message prêt pour ${best.name}\n\n` +
        `Rédigé à partir de l’étape **${STAGE_LABEL[best.stage] || best.stage}**${a.occasion ? ` et de l’occasion **${a.occasion}**` : ''}. Relisez, puis envoyez en un clic.`,
        {
          type: 'reply',
          title: `Message pour ${best.name}`,
          phone: best.phone,
          recipient: best.name,
          content: draft,
          metadata: { convId: best.convId, waLink: waLink(best.phone) },
        }
      );
    }
    const generic = norm.includes('paye') || norm.includes('paiement')
      ? `Bonjour, votre chanson est prête à partir en studio. Il ne manque que votre paiement (Wave ou Orange Money) pour lancer la production : vous la recevez ensuite en 18 minutes.`
      : `Bonjour, je reviens vers vous pour votre chanson personnalisée. Je peux vous envoyer un extrait des paroles dès maintenant : vous ne payez qu’une fois satisfait. On commence ?`;
    return reply(
      `### Message de relance\n\nAucun client précis n’a été identifié : voici une relance universelle. Donnez-moi un **numéro** ou un **prénom** pour la personnaliser.`,
      { type: 'reply', title: 'Relance prête à copier', content: generic }
    );
  }

  // ---------------------------------------------------------------------
  // Paroles & Multi-commandes (Double texte patron)
  // ---------------------------------------------------------------------
  if (intent === 'lyrics') {
    const { best } = await resolveDossier(cleanPrompt, user, history, false);
    const a = best ? analyse(best) : null;
    const corpus = [cleanPrompt, best?.occasion, best?.facts, ...(best?.messages || []).map(m => m.body)].filter(Boolean).join(' ');

    // Détection multi-commandes / double texte demandé
    const wantsMulti = /(les\s+deux|les\s+2|deux\s+textes|deux\s+chansons|tous\s+les\s+textes|deux\s+commandes|deux\s+versions|double\s+commande)/i.test(cleanPrompt);

    if (wantsMulti) {
      // Cas de la double commande : générer simultanément les 2 textes complets
      const fallback = best?.name.split(/\s+/)[0] || 'Destinataire';
      const recipients = extractRecipients(corpus, fallback);
      const name1 = recipients[0] || fallback;
      const name2 = recipients[1] || (name1.toLowerCase() === 'mon amour' ? 'Ma chérie' : 'Mon amour');

      const occasion1 = OCCASIONS.find(([k]) => has(norm, k))?.[1] || a?.occasion || OCCASION_LABELS[detectOccasion(corpus)] || 'Anniversaire';
      const occasion2 = a?.occasion && a.occasion !== occasion1 ? a.occasion : 'Amour & célébration';
      const style = STYLES.find(([k]) => has(norm, k))?.[1] || a?.style || 'Afro-Love acoustique';

      const song1 = composeLyrics(name1, occasion1, style, best, best?.name);
      const song2 = composeLyrics(name2, occasion2, style, best, best?.name);

      const fullCombined = `=== CHANSON 1 / 2 : ${song1.title.toUpperCase()} ===\n\n${song1.lyrics}\n\n` +
        `==================================================\n\n` +
        `=== CHANSON 2 / 2 : ${song2.title.toUpperCase()} ===\n\n${song2.lyrics}`;

      return reply(
        `### Double commande prise en charge pour ${best?.name || name1}\n\n` +
        `Voici les **2 textes intégraux** rédigés simultanément selon l'ADN poétique du studio (calibre patron, 32 à 48 vers Suno chacun, aucune version courte) :\n\n` +
        `---\n\n` +
        `#### 1️⃣ Première œuvre : ${song1.title} (${name1} — ${occasion1})\n` +
        `*${song1.lineCount} vers utiles, balises Suno complètes, intégration des souvenirs.*\n\n` +
        `---\n\n` +
        `#### 2️⃣ Seconde œuvre : ${song2.title} (${name2} — ${occasion2})\n` +
        `*${song2.lineCount} vers utiles, mélodie contrastée, dédicace émouvante.*\n\n` +
        `*Les deux œuvres sont prêtes pour l'envoi WhatsApp au client ou pour la mise en production dans l'Atelier Studio.*`,
        {
          type: 'lyrics',
          title: `Double commande : ${name1} & ${name2}`,
          phone: best?.phone,
          recipient: `${name1} & ${name2}`,
          occasion: `${occasion1} / ${occasion2}`,
          style,
          content: fullCombined,
          metadata: {
            convId: best?.convId,
            waLink: waLink(best?.phone),
            isMulti: true,
            song1Title: song1.title,
            song2Title: song2.title,
          },
        }
      );
    }

    // Cas standard : 1 texte de haute volée
    const explicit = /(?:pour|de|d')\s*(?:ma|mon|sa|son)?\s*(?:bestie|femme|mari|maman|papa|soeur|sœur|frere|frère|fille|fils|amie?|cherie|chérie)?\s*([A-ZÀ-Ýa-zà-ÿ][\p{L}-]{2,})/u.exec(cleanPrompt)?.[1];
    const occasionFromPrompt = OCCASIONS.find(([k]) => has(norm, k))?.[1] || OCCASION_LABELS[detectOccasion(cleanPrompt)];
    const name = (explicit && !STOPWORDS.has(explicit.toLowerCase()))
      ? explicit.charAt(0).toUpperCase() + explicit.slice(1).toLowerCase()
      : a?.recipient || best?.name.split(/\s+/)[0] || 'Mon amour';
    const occasion = occasionFromPrompt || a?.occasion || (corpus ? OCCASION_LABELS[detectOccasion(corpus)] : 'Anniversaire');
    const style = STYLES.find(([k]) => has(norm, k))?.[1] || a?.style || 'Afro-Love acoustique';
    const song = composeLyrics(name, occasion, style, best, best?.name);
    const personal = memoryLines(best).length > 0;

    return reply(
      `### Paroles composées pour ${name}\n\n` +
      (best ? `Construites à partir de la discussion avec **${best.name}**${a?.occasion ? ` (${a.occasion.toLowerCase()})` : ''}.` : `Occasion retenue : **${occasion}**.`) +
      ` Structure Velaris calibre patron (${song.lineCount} vers utiles, format Suno complet) : accroche poétique, refrain mémorable avec le prénom, couplets narratifs` +
      (personal ? ` et intégration fidèle des souvenirs du client.\n\n` : `.\n\n`) +
      `*Copiez-les ou envoyez-les directement à l’Atelier pour la production.*`,
      {
        type: 'lyrics',
        title: song.title,
        phone: best?.phone,
        recipient: name,
        occasion,
        style,
        content: song.lyrics,
        metadata: { convId: best?.convId, waLink: waLink(best?.phone) },
      }
    );
  }

  // ---------------------------------------------------------------------
  // Actions Commerciales & Réception de Commande en direct
  // ---------------------------------------------------------------------
  if (intent === 'order_action') {
    const { best } = await resolveDossier(cleanPrompt, user, history, false);
    const a = best ? analyse(best) : null;

    // Extraction du montant en F CFA
    const amountMatch = /(?:de\s+)?(\d[\d\s .]{2,})\s?(?:f\b|fcfa|f cfa)/i.exec(cleanPrompt) ||
      /\b(1200|3000|5000|10000)\b/.exec(cleanPrompt);
    const rawDigits = amountMatch ? digitsOf(amountMatch[1]) : '';
    const amount = rawDigits && Number(rawDigits) >= 500 && Number(rawDigits) <= 100000
      ? Number(rawDigits)
      : a?.amount || 3000;

    // Moyen de paiement
    const method = /wave/i.test(cleanPrompt) ? 'Wave'
      : /orange/i.test(cleanPrompt) ? 'Orange Money'
      : /moov/i.test(cleanPrompt) ? 'Moov Money'
      : a?.method || 'Wave';

    // Statut : réception/encaissement confirmé vs nouveau devis
    const isPaid = /(recois|reçois|recu|reçu|paye|payé|encaisse|encaisser|valide|valider|confirme|confirmé)/i.test(cleanPrompt);
    const status = isPaid ? 'validated' : 'pending';

    const clientName = best?.name || (a?.recipient ? `Client (${a.recipient})` : 'Client WhatsApp');
    const clientPhone = best?.phone || '';
    const occasion = a?.occasion || 'Chanson personnalisée';

    let orderId: string | undefined;
    if (user || best?.convId) {
      const res = await createOrUpdateLiveOrder({
        conversationId: best?.convId,
        amountCents: amount * 100,
        paymentMethod: method,
        status,
        notes: `Enregistré par Copilot IA : ${occasion} pour ${clientName} (${method})`,
      });
      if (res.success) {
        orderId = res.orderId;
      }
    }

    const titleAction = isPaid ? 'Commande encaissée avec succès' : 'Commande enregistrée dans le pipeline';
    const reportText = `### ${titleAction}\n\n` +
      `L'action commerciale a été traitée et synchronisée avec la caisse du studio :\n\n` +
      `| Paramètre | Valeur | Statut |\n| :--- | :--- | :--- |\n` +
      `| **Client** | **${clientName}** | ${clientPhone ? `WhatsApp: ${clientPhone}` : 'Direct'} |\n` +
      `| **Montant** | **${fcfa(amount)}** | ${isPaid ? 'Encaissé' : 'En attente'} |\n` +
      `| **Moyen** | **${method}** | Opérateur Mobile Money |\n` +
      `| **Occasion** | ${occasion} | Brief client |\n` +
      `| **Pipeline** | **${isPaid ? 'Paiement reçu (En studio)' : 'Devis & paiement'}** | Étape mise à jour |\n\n` +
      (isPaid
        ? `Le dossier de **${clientName}** avance immédiatement en production. Vous pouvez générer ses paroles ou lancer la musique dans l'Atelier Studio.`
        : `Le devis de **${fcfa(amount)}** est en attente du règlement ${method}.`);

    return reply(
      reportText,
      {
        type: 'stats',
        title: `${isPaid ? 'Encaissement' : 'Devis'} : ${fcfa(amount)} — ${clientName}`,
        content: `Commande ${fcfa(amount)} enregistrée via ${method} • Pipeline mis à jour`,
        metadata: {
          clientName,
          phone: clientPhone,
          amount: fcfa(amount),
          paymentMethod: method,
          status: isPaid ? 'Paiement reçu' : 'Devis en cours',
          orderId,
          convId: best?.convId,
          waLink: waLink(clientPhone),
        },
      }
    );
  }

  // ---------------------------------------------------------------------
  // Connaissance du site
  // ---------------------------------------------------------------------
  if (intent === 'knowledge') {
    const k = findKnowledge(norm)!;
    return reply(`### ${k.title}\n\n${k.body}`);
  }

  return helpMessage(reply);
}

function helpMessage(reply: (text: string) => CopilotMessage): CopilotMessage {
  return reply(
    `### Ce que je sais faire en tant qu’Agent Copilot Studio\n\n` +
    `1. **Retrouver un client par son numéro ou son prénom** : *+226 79 29…*, *5835*, ou *« Aminata »* / *« Marc »*.\n` +
    `2. **Composer 1 ou 2 textes d'un coup (Calibre Patron)** : *« Écris les paroles pour Marc »*, *« Fais les 2 textes pour Aminata »* (aucune version courte, 32-48 vers complets Suno).\n` +
    `3. **Prendre & Encaisser les commandes en direct** : *« Reçois la commande de 3 000 F pour Marc »*, *« Enregistre le paiement Wave de 5 000 F »* (mise à jour immédiate de la caisse et du pipeline).\n` +
    `4. **Suivre vos finances en direct** : *« Combien ai-je encaissé aujourd'hui ? »*, *« Répartition Wave / Orange Money »*.\n` +
    `5. **Rédiger des relances chirurgicales** : *« Relance le 5835 »* (reprenant l'étape et les mots précis du client).\n` +
    `6. **Bibliothèque de style & Académie** : *« Montre la bibliothèque du patron »*, *« Tarifs Velaris »*, *« Délais de production »*.`
  );
}

/**
 * Envoi direct d'un message préparé par le Copilot vers le client WhatsApp
 */
export async function sendCopilotWhatsAppMessage(
  phone: string,
  text: string,
  sessionName: string,
  convId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await sendWahaTextMessage(phone, text, sessionName);
    if (res.success && convId) {
      await recordOutboundMessage(convId, text);
    }
    return res;
  } catch (err: any) {
    return { success: false, error: err.message || 'Échec de transmission WAHA' };
  }
}
