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
  recordOutboundMessage
} from './supabase';
import { sendWahaTextMessage } from './waha';
import {
  REAL_CONVERSATIONS,
  REAL_CONVERSATION_MESSAGES,
  REAL_PIPELINE_LEADS,
  REAL_STUDIO_METRICS
} from '../data/realProductionData';
import { ACADEMY_MODULES } from '../data/mockData';
import type { Order, StudioMetrics } from '../types';

export interface ActionCardData {
  type: 'lyrics' | 'reply' | 'stats' | 'client_brief';
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
const isVoiceNote = (s: string) => s.includes('🎙');
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

type Intent = 'phone' | 'sales' | 'lyrics' | 'reply' | 'knowledge' | 'search' | 'help';

const has = (n: string, list: string[]) => list.some(k => n.includes(k));

const SALES_WORDS = ['chiffre', 'encaiss', 'revenu', 'stat', 'vente', 'vendu', 'performance', 'taux de conversion', 'closing', 'caisse', 'tresorerie', 'argent', 'gagne', 'benefice', 'marge', 'wave', 'orange money', 'panier', 'livree', 'commandes'];
const LYRICS_WORDS = ['parole', 'ecris la chanson', 'ecris une chanson', 'redige la chanson', 'compose', 'texte de la chanson', 'chanson pour', 'couplet', 'refrain', 'lyrics'];
const REPLY_WORDS = ['relance', 'relancer', 'redige un message', 'redige-moi un message', 'redige moi un message', 'ecris un message', 'message whatsapp', 'reponds', 'repondre', 'reponse', 'message pour', 'texte pour', 'convaincre', 'hesite'];
const RECALL_WORDS = ['rappelle', 'resume', 'discute', 'dit', 'parle', 'historique', 'conversation', 'discussion', 'retrouve', 'cherche', 'trouve', 'qui a', 'quel client', 'dossier', 'fiche'];

function detectIntent(prompt: string): Intent {
  const n = normalize(prompt);
  const phone = extractPhoneFragment(prompt);
  if (phone && !has(n, LYRICS_WORDS) && !has(n, REPLY_WORDS)) return 'phone';
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
  const occasion = OCCASIONS.find(([k]) => has(n, k))?.[1] || d.occasion;
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
    keys: ['marge', 'cout', 'depense', 'rentab', 'suno', 'abonnement'],
    title: 'Coûts & marges',
    body:
      `- **Marge brute moyenne** : 92,4 %\n- **Coût IA** : environ 150 F CFA par composition\n- **Suno Pro** : 12 000 F / mois\n- **VPS WAHA** : 3 500 F / mois\n- **Retraits Mobile Money** : 1 % fixe\n\nDétail complet dans l’onglet *Coûts & marges*.`,
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
    body: `Une règle = un emoji posé sur un message client qui déclenche l’envoi d’un texte préparé. Les toggles dorés activent ou coupent chaque règle ; le journal garde les 50 derniers déclenchements (60 envois automatiques maximum par heure).`,
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
    const score = k.keys.filter(key => n.includes(key)).length;
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

function composeLyrics(name: string, occasion: string, style: string): string {
  const o = normalize(occasion);
  if (o.includes('hommage') || o.includes('deuil')) {
    return `[Titre : "${name}, la lumière demeure"]
[Style : Gospel doux • 72 BPM • voix chaude]

(Couplet 1)
Le silence est tombé sur la maison ce soir,
Mais ta voix reste là, dans chaque souvenir.
${name}, tu nous as appris à croire,
Que l'amour ne sait pas mourir.

(Refrain)
Repose en paix, la lumière demeure,
Ton nom chante encore au fond de nos cœurs.
Si les larmes coulent, c'est qu'on t'a tant aimé,
Le ciel a gagné ce que la terre a donné.

(Couplet 2)
On garde ton sourire comme on garde une prière,
Tes conseils nous guident à travers nos hivers.

(Outro)
${name}, dors en paix… nous marchons dans tes pas.`;
  }
  if (o.includes('publicit') || o.includes('entreprise')) {
    return `[Titre : "${name}, c'est la bonne adresse"]
[Style : Coupé-décalé publicitaire • 118 BPM • chœurs]

(Couplet 1)
Tu cherches la qualité au meilleur prix ?
Pas besoin de chercher loin, mon ami, c'est ici !
${name} t'accueille avec le sourire,
Des produits garantis, rien à redire.

(Refrain)
${name}, ${name}, la bonne adresse !
On te sert vite, on te sert avec tendresse.
Passe nous voir ou appelle tout de suite,
${name}, la confiance qui t'invite !

(Outro)
${name}… on t'attend !`;
  }
  if (o.includes('mariage') || o.includes('amour')) {
    return `[Titre : "${name}, pour la vie"]
[Style : ${style} • 92 BPM • duo voix]

(Couplet 1)
Le jour où nos regards se sont trouvés,
J'ai su que mon cœur avait enfin sa maison.
${name}, chaque matin à tes côtés,
Ressemble à une nouvelle saison.

(Refrain)
Pour la vie, je te dis oui,
Dans la joie, dans la pluie, jusqu'à l'infini.
Nos deux familles chantent notre union,
${name}, tu es ma plus belle chanson.

(Outro)
Pour la vie… ${name}, pour la vie.`;
  }
  if (o.includes('bapteme') || o.includes('naissance')) {
    return `[Titre : "Bienvenue ${name}"]
[Style : Acoustique joyeux • 100 BPM • voix douce]

(Couplet 1)
Petit cœur tombé du ciel un matin,
Tu as mis du soleil dans nos mains.
${name}, ton prénom est une promesse,
Une bénédiction, une tendresse.

(Refrain)
Bienvenue, bienvenue parmi nous,
Toute la famille danse autour de toi, mon bijou.
Que Dieu te garde, te guide et te bénisse,
${name}, grandis dans la joie et la justice.

(Outro)
Bienvenue ${name}… notre plus beau cadeau.`;
  }
  if (o.includes('gospel') || o.includes('grace')) {
    return `[Titre : "${name}, merci Seigneur"]
[Style : Gospel & célébration • 96 BPM • chœur]

(Couplet 1)
Quand la route était longue, Tu as tenu ma main,
Tu as ouvert des portes que je croyais sans lendemain.

(Refrain)
Merci Seigneur, pour ${name},
Ta grâce nous porte, Ton amour nous fait chanter.
Gloire, gloire, nos voix s'élèvent,
Ta fidélité est plus grande que nos rêves.

(Outro)
Alléluia… merci pour ${name}.`;
  }
  return `[Titre : "${name}, joyeux anniversaire"]
[Style : ${style} • 95 BPM • voix chaleureuse]

(Couplet 1)
Aujourd'hui le soleil s'est levé pour toi,
Chaque année à tes côtés est une vraie joie.
${name}, tu as traversé les hauts et les bas,
Avec ce sourire qui ne s'éteint pas.

(Refrain)
Joyeux anniversaire ${name},
Que la vie te comble de ses plus belles pages.
On lève nos voix, on chante ton nom,
Tu mérites le ciel et toutes ses chansons.

(Couplet 2)
Merci pour ta force, merci pour ton cœur,
Tu transformes les jours ordinaires en bonheur.

(Outro)
Joyeux anniversaire… ${name}, on t'aime.`;
}

/* ------------------------------------------------------------------ */
/* Moteur principal                                                   */
/* ------------------------------------------------------------------ */

/* Dernier client évoqué dans la conversation (« relance-le », « écris ses paroles ») */
function clientFromHistory(history: CopilotMessage[]): { name?: string; phone?: string } | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const card = history[i].actionCard;
    if (card?.phone || (card?.recipient && card.type !== 'lyrics')) return { name: card.recipient, phone: card.phone };
  }
  return null;
}

/* Noms propres du message (hors premier mot) : sert à la recherche stricte des paroles et relances */
const properNouns = (prompt: string) =>
  prompt
    .split(/[\s,.;:!?'’()]+/)
    .slice(1)
    .filter(w => /^[A-ZÀ-Ý][\p{L}-]{2,}$/u.test(w) && !['WhatsApp', 'Wave', 'Orange', 'Moov', 'Velaris', 'Sonar'].includes(w));

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

  const query = strict ? properNouns(prompt).join(' ') : prompt;
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
  _sessionName: string,
  user: any,
  context: CopilotContext = {}
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
  // Paroles
  // ---------------------------------------------------------------------
  if (intent === 'lyrics') {
    const { best } = await resolveDossier(cleanPrompt, user, history, true);
    const a = best ? analyse(best) : null;
    const explicit = /(?:pour|de|d')\s*(?:ma|mon|sa|son)?\s*(?:femme|mari|maman|papa|soeur|sœur|frere|frère|fille|fils|amie?|cherie|chérie)?\s*([A-ZÀ-Ý][\p{L}-]{2,})/u.exec(cleanPrompt)?.[1];
    const occasionFromPrompt = OCCASIONS.find(([k]) => has(norm, k))?.[1];
    const name = explicit || a?.recipient || best?.name.split(/\s+/)[0] || 'Mon amour';
    const occasion = occasionFromPrompt || a?.occasion || 'Anniversaire';
    const style = STYLES.find(([k]) => has(norm, k))?.[1] || a?.style || 'Afro-Love acoustique';
    const lyrics = composeLyrics(name, occasion, style);

    return reply(
      `### Paroles composées pour ${name}\n\n` +
      (best ? `Construites à partir de la discussion avec **${best.name}**${a?.occasion ? ` (${a.occasion.toLowerCase()})` : ''}.` : `Occasion retenue : **${occasion}**.`) +
      ` Structure Velaris : accroche émotionnelle, refrain mémorable avec le prénom, chute intime.\n\n` +
      `*Copiez-les ou envoyez-les directement à l’Atelier pour la production.*`,
      {
        type: 'lyrics',
        title: `Paroles : ${name}`,
        phone: best?.phone,
        recipient: name,
        occasion,
        style,
        content: lyrics,
        metadata: { convId: best?.convId, waLink: waLink(best?.phone) },
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
    `### Ce que je sais faire\n\n` +
    `1. **Retrouver un client par son numéro** : tapez *+226 79 29…*, *07 88…* ou juste *5835*.\n` +
    `2. **Rechercher par contexte** : *« le client de la chanson publicitaire à Nouna »*, *« la cliente gospel »*\n` +
    `3. **Suivre les ventes en direct** : *« Combien ai-je encaissé ? »*, *« Répartition Wave / Orange Money »*\n` +
    `4. **Composer des paroles** : *« Écris les paroles pour l’anniversaire d’Ibrahim »*\n` +
    `5. **Rédiger une relance** : *« Relance le 05 44 91 20 »*\n` +
    `6. **Répondre sur Velaris** : tarifs, délais, QR code WhatsApp, automatisations, académie.`
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
