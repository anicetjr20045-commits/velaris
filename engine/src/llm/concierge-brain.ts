/**
 * Concierge IA Djélia 24/7 (Support & Orientation Web-First).
 *
 * Rôle : Accueillir, orienter et débloquer les clients vers le studio web (https://djelia.store).
 * Contrat d'ingénierie :
 *  - Zéro empilement de règles ad-hoc (prompt sobre, max 50-60 lignes).
 *  - Zéro émoji dans les réponses.
 *  - 1 à 2 phrases courtes maximum, ton digne et chaleureux (Afrique de l'Ouest & Cameroun).
 *  - Détection automatique du pays et des moyens de paiement disponibles via Chariow (MTN MoMo, Wave, Orange Money, etc.).
 *  - Compression roulante du contexte pour les discussions longues.
 *  - Analyse visuelle des captures d'écran de clients bloqués (via Kie.ai Gemini Flash).
 */

import type { LlmProvider, LlmMessage } from './provider.js';

export interface CountryPaymentInfo {
  code: string;
  name: string;
  currency: string;
  methods: string;
}

export const COUNTRY_PAYMENT_MAP: Record<string, CountryPaymentInfo> = {
  '237': { code: 'CM', name: 'Cameroun', currency: 'FCFA', methods: 'MTN Mobile Money et Orange Money Cameroun (ou Carte bancaire Visa/Mastercard)' },
  '225': { code: 'CI', name: 'Côte d\'Ivoire', currency: 'FCFA', methods: 'Wave, Orange Money et MTN Mobile Money (ou Carte bancaire)' },
  '226': { code: 'BF', name: 'Burkina Faso', currency: 'FCFA', methods: 'Orange Money et Moov Money (ou Carte bancaire)' },
  '221': { code: 'SN', name: 'Sénégal', currency: 'FCFA', methods: 'Wave et Orange Money (ou Carte bancaire)' },
  '241': { code: 'GA', name: 'Gabon', currency: 'FCFA', methods: 'Airtel Money et Moov Money (ou Carte bancaire)' },
  '242': { code: 'CG', name: 'Congo-Brazzaville', currency: 'FCFA', methods: 'MTN et Airtel (ou Carte bancaire)' },
  '243': { code: 'CD', name: 'RD Congo', currency: 'USD / Franc Congolais', methods: 'Vodacom M-Pesa, Orange Money et Airtel Money' },
  '229': { code: 'BJ', name: 'Bénin', currency: 'FCFA', methods: 'MTN Mobile Money et Moov Money (ou Carte bancaire)' },
  '228': { code: 'TG', name: 'Togo', currency: 'FCFA', methods: 'T-Money et Moov Money (ou Carte bancaire)' },
  '223': { code: 'ML', name: 'Mali', currency: 'FCFA', methods: 'Orange Money et Moov Money (ou Carte bancaire)' },
  '227': { code: 'NE', name: 'Niger', currency: 'FCFA', methods: 'Airtel Money et Moov Money (ou Carte bancaire)' },
  '224': { code: 'GN', name: 'Guinée', currency: 'Franc Guinéen', methods: 'Orange Money et MTN' },
  '235': { code: 'TD', name: 'Tchad', currency: 'FCFA', methods: 'Airtel Money et Moov Money' },
  '236': { code: 'CF', name: 'Centrafrique', currency: 'FCFA', methods: 'Orange Money et Telecel' },
  '33':  { code: 'FR', name: 'France (Diaspora)', currency: 'EUR / FCFA', methods: 'Carte bancaire Visa et Mastercard sécurisée' },
  '32':  { code: 'BE', name: 'Belgique (Diaspora)', currency: 'EUR / FCFA', methods: 'Carte bancaire Visa et Mastercard' },
  '41':  { code: 'CH', name: 'Suisse (Diaspora)', currency: 'CHF / EUR', methods: 'Carte bancaire Visa et Mastercard' },
  '1':   { code: 'US_CA', name: 'États-Unis / Canada (Diaspora)', currency: 'USD / CAD', methods: 'Carte bancaire Visa, Mastercard et Amex' },
};

export function extractCleanPhone(phoneOrJid?: string | null): string {
  if (!phoneOrJid) return '';
  const base = phoneOrJid.split('@')[0]?.split(':')[0] || phoneOrJid;
  let digits = base.replace(/\D/g, '');
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  return digits;
}

export function isBurkinaFasoNumber(phoneOrJid?: string | null): boolean {
  const digits = extractCleanPhone(phoneOrJid);
  if (!digits) return false;
  if (digits.startsWith('226')) return true;
  if (digits.length === 8 && /^(0[1-7]|5[0-8]|6[0-9]|7[0-9]|20|25)/.test(digits)) {
    return true;
  }
  return false;
}

export function resolveCountryFromPhone(phoneOrJid?: string | null): CountryPaymentInfo {
  const digits = extractCleanPhone(phoneOrJid);
  if (!digits) {
    return {
      code: 'ALL',
      name: 'International',
      currency: 'FCFA / Carte bancaire',
      methods: 'Mobile Money selon le pays sélectionné sur le site ou Carte bancaire Visa/Mastercard',
    };
  }
  const sortedPrefixes = Object.keys(COUNTRY_PAYMENT_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of sortedPrefixes) {
    if (digits.startsWith(prefix) && digits.length >= prefix.length + 6) {
      return COUNTRY_PAYMENT_MAP[prefix]!;
    }
  }
  return {
    code: 'ALL',
    name: 'International',
    currency: 'FCFA / Carte bancaire',
    methods: 'Mobile Money (Wave, Orange, MTN, Moov...) ou Carte bancaire Visa/Mastercard',
  };
}

export function compressRecentHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>
): LlmMessage[] {
  if (history.length <= 6) {
    return history.map((h) => ({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: h.content,
    }));
  }

  // Pour les discussions longues (> 6 messages) :
  // On résume les échanges antérieurs en 1 bloc condensé et on conserve les 4 derniers messages récents
  const olderMessages = history.slice(0, -4);
  const recentMessages = history.slice(-4);

  const keyPoints: string[] = [];
  for (const m of olderMessages) {
    const text = m.content.replace(/\s+/g, ' ').trim();
    if (text.length > 0 && !text.includes('Voici le lien de notre studio')) {
      keyPoints.push(`${m.role === 'assistant' ? 'Djélia' : 'Client'}: ${text.slice(0, 100)}`);
    }
  }

  const condensedSummary = `[Historique condensé des premiers échanges : ${keyPoints.slice(-4).join(' | ')}]`;

  return [
    { role: 'user', content: condensedSummary },
    ...recentMessages.map((h) => ({
      role: (h.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: h.content,
    })),
  ];
}

export async function describeScreenshotWithVision(
  kieApiKey: string,
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg',
  timeoutMs: number = 20_000
): Promise<string | null> {
  try {
    const base64 = imageBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;
    const endpoint = 'https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions';

    const prompt =
      "Tu es l'assistant visuel de l'atelier Djélia (https://djelia.store), atelier de création de chansons personnalisées. " +
      "Analyse cette capture d'écran envoyée par un client sur WhatsApp. " +
      "Décris en 1 ou 2 phrases courtes et précises : " +
      "1) Sur quelle page ou étape du site le client se trouve (ex: accueil, choix occasion, prénom/souvenirs, génération paroles IA, choix de style, formule 1 200 francs, ou paiement Chariow). " +
      "2) Le blocage visible, message d'erreur, ou ce qui est rempli/sélectionné à l'écran. " +
      "Réponds uniquement par ta description factuelle concise en français, sans formule d'introduction.";

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3-6-flash',
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch {
    return null;
  }
}

export interface PaymentReceiptAnalysis {
  isPaymentReceipt: boolean;
  operator?: string | null;
  amount?: number | null;
  currency?: string | null;
  transactionRef?: string | null;
  sender?: string | null;
  recipient?: string | null;
  confidence: number;
  rawSummary?: string | null;
}

/**
 * Analyse visuelle spécialisée des preuves et reçus de paiement Mobile Money et bancaires
 * (Wave, Orange Money, MTN MoMo, Moov Money, Chariow, Carte bancaire).
 * Utilise Gemini Flash Vision via le proxy Kie.ai.
 */
export async function analyzePaymentReceiptWithVision(
  kieApiKey: string,
  imageBuffer: Buffer,
  mimeType: string = 'image/jpeg',
  timeoutMs: number = 20_000
): Promise<PaymentReceiptAnalysis | null> {
  try {
    const base64 = imageBuffer.toString('base64');
    const dataUri = `data:${mimeType};base64,${base64}`;
    const endpoint = 'https://api.kie.ai/gemini-3-6-flash-openai/v1/chat/completions';

    const prompt =
      "Tu es un expert d'analyse de reçus et preuves de transfert Mobile Money et bancaires en Afrique (Wave, Orange Money, MTN Mobile Money, Moov Money, Chariow, Cartes Visa/Mastercard). " +
      "Analyse cette image envoyée par un client sur WhatsApp. Détermine s'il s'agit d'une capture de preuve ou reçu de paiement/transfert d'argent effectif. " +
      "Réponds STRICTEMENT par un objet JSON valide avec les clés suivantes :\n" +
      "{\n" +
      '  "isPaymentReceipt": boolean,\n' +
      '  "operator": "Wave" | "Orange Money" | "MTN MoMo" | "Moov" | "Chariow" | "Carte Bancaire" | "Autre" | null,\n' +
      '  "amount": number | null,\n' +
      '  "currency": "FCFA" | "EUR" | "USD" | string | null,\n' +
      '  "transactionRef": string | null,\n' +
      '  "sender": string | null,\n' +
      '  "recipient": string | null,\n' +
      '  "confidence": number,\n' +
      '  "rawSummary": string\n' +
      "}\n" +
      "Si ce n'est PAS un reçu de paiement (par exemple une simple capture d'écran du site web ou une photo sans rapport), mets isPaymentReceipt: false, confidence: 0.9, et décris brièvement l'image dans rawSummary.";

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${kieApiKey}`,
      },
      body: JSON.stringify({
        model: 'gemini-3-6-flash',
        stream: false,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUri } },
            ],
          },
        ],
        response_format: { type: 'json_object' },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (!res.ok) return null;
    const data = (await res.json()) as any;
    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;

    const jsonStr = content.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
    const parsed = JSON.parse(jsonStr) as PaymentReceiptAnalysis;
    return parsed;
  } catch {
    return null;
  }
}

export interface StudioConfigInfo {
  name?: string | undefined;
  slug?: string | undefined;
  priceQuoted?: number | undefined;
  paymentMethods?: string[] | undefined;
}

export interface ConciergeBrainInput {
  incomingMessage: string;
  recentHistory?: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
  contactName?: string | null | undefined;
  phone?: string | null | undefined;
  videoAlreadySent?: boolean | undefined;
  studioConfig?: StudioConfigInfo | undefined;
}

export function isPriceQuestion(text?: string | null): boolean {
  if (!text) return false;
  const clean = text.toLowerCase();
  const pricePatterns = [
    /\b(prix|tarif|tarifs|coût|cout|combien|combien.*coûte|combien.*coute|c'est combien|c combien|payer combien|quel.*prix|quels.*prix)\b/,
    /\b(1200|3500|fcfa|f cfa)\b/,
  ];
  return pricePatterns.some((pattern) => pattern.test(clean));
}

export function isDirectSpecificQuestion(text?: string | null): boolean {
  if (!text) return false;
  const clean = text.trim().toLowerCase();

  // Salutations pures ou messages génériques des publicités
  const genericGreetings = [
    'bonjour', 'bonjour !', 'bonsoir', 'bonsoir !', 'salut', 'salut !', 'hello',
    'je veux une chanson', 'je souhaite une chanson', 'commander une chanson',
    'je veux une chanson personnalisée', 'je souhaite commander une chanson personnalisée',
    'je veux des informations', 'infos', 'info', 'infos svp', 'plus d\'infos',
    'je suis intéressé', 'intéressé', 'je veux commander', 'comment vous allez',
    'coucou', 'allô', 'allo', 'cc', 'bjr', 'bsr'
  ];
  if (genericGreetings.includes(clean)) return false;

  // Si le message contient un point d'interrogation et fait plus de 2-3 mots
  if (clean.includes('?') && clean.split(/\s+/).length >= 3) {
    return true;
  }

  // Mots-clés de questions directes nécessitant une réponse ciblée
  const specificQuestionPatterns = [
    /\boù\b/, /situé/, /localisation/, /bureau/, /adresse/, /quel pays/,
    /orange money/, /mtn/, /wave/, /moov/, /carte bancaire/, /visa/, /virement/,
    /combien de temps/, /en combien/, /ce soir/, /demain/, /délai/,
    /j'ai payé/, /déjà payé/, /ma commande/, /reçu/,
    /responsable/, /parler à/, /vrai humain/, /appeler/, /au téléphone/,
    /réduction/, /rabais/, /geste/, /diminuer/, /moins cher/, /1000f/
  ];

  return specificQuestionPatterns.some((pattern) => pattern.test(clean));
}

export function isAskingForProcedureOrTutorial(text?: string | null): boolean {
  if (!text) return false;
  const clean = text.toLowerCase();
  const procedurePatterns = [
    /comment.*(faire|commander|procéder|composer|marcher|marche|utiliser)/,
    /c'est quoi.*(procédure|étapes|démarche)/,
    /quelles sont les étapes/,
    /montre.*(moi|comment)/,
    /expliqu.*(moi|comment)/,
    /tuto/,
    /vidéo.*tuto/,
    /je (fais|mets) quoi/,
    /je ne (sais pas|comprends pas).*comment/,
    /comment ça se passe/,
  ];
  return procedurePatterns.some((p) => p.test(clean));
}

export function isAskingForDemoOrSample(text?: string | null): boolean {
  if (!text) return false;
  const clean = text.toLowerCase();
  const demoPatterns = [
    /\b(exemple|exemples|démo|demos|demo|extrait|extraits|échantillon|échantillons)\b/,
    /voir.*(ce que ça donne|le résultat|à quoi ça ressemble|un exemple)/,
    /écouter.*(quelque chose|chanson|morceau|extrait)/,
    /montre.*(moi|un rendu|un travail)/,
  ];
  return demoPatterns.some((p) => p.test(clean));
}

export function buildConciergeSystemPrompt(
  country: CountryPaymentInfo,
  _videoAlreadySent: boolean = true,
  studioConfig?: StudioConfigInfo | undefined
): string {
  const brandName = studioConfig?.name || "l'atelier Djélia";
  const brandUrl = studioConfig?.slug ? `https://djelia.store/s/${studioConfig.slug}` : "https://djelia.store";
  const standardPrice = studioConfig?.priceQuoted ? `${studioConfig.priceQuoted} francs` : "1 200 francs";

  return `Tu es la conseillère clientèle de ${brandName} (${brandUrl}), service de chansons personnalisées en Afrique.
Ton rôle est de conseiller avec chaleur, clarté et bienveillance chaque client, comme une vraie conseillère humaine attentive.

Règles impératives de style et de ton :
1. Dignité, politesse et respect chaleureux (Afrique de l'Ouest et Cameroun).
2. Réponses concises et aérées : 1 à 2 phrases directes. Tu peux séparer 2 idées en 2 bulles distinctes avec "---".
3. Strictement AUCUN émoji dans tes réponses. Pas de symboles décoratifs.
4. Réponds toujours avec précision à la question posée, puis propose ton aide avec bienveillance.
5. NE FORCE JAMAIS le lien du site dans chaque réponse. Le client a déjà reçu le lien au tout début. Tu donnes le lien ${brandUrl} UNIQUEMENT s'il demande expressément le lien ou où aller pour commander.
6. Ne renvoie jamais de vidéo : le tutoriel a déjà été envoyé plus haut. S'il a un doute, invite-le simplement à revoir la courte vidéo reçue plus haut.
7. RÈGLE D'HONNÊTETÉ & GARDE-FOU DOUTE : Si la question concerne un litige financier, un problème technique inconnu ou un cas complexe dont tu n'es pas absolument certaine, NE DEVINE RIEN. Réponds exactement :
"J'ai bien reçu votre message. Je transmets directement votre demande au responsable de l'atelier qui va regarder cela pour vous tout de suite." ou renvoie {"reply": "SILENCE"}.
8. REÇU DE PAIEMENT : Si le message indique qu'un reçu de paiement a été détecté par l'IA, remercie poliment et chaleureusement le client, confirme que le paiement a bien été reçu et rassure-le que la création de sa chanson démarre dans l'atelier.

Connaissances indispensables de ${brandName} :
- Site officiel : ${brandUrl}
- Formule unique : Chanson personnalisée complète avec 2 versions MP3 différentes pour ${standardPrice}.
- Dis toujours "${standardPrice}" (sans mentionner CFA). Il n'y a aucune autre formule ni option vidéo.
- Délais : Les 2 versions MP3 complètes sont prêtes en 15 à 20 minutes après validation de la commande.
- Étapes sur ${brandUrl} : 1) Choix de l'occasion et relation 2) Prénom et souvenirs 3) L'IA écrit les paroles en 15 secondes, modifiables gratuitement à volonté 4) Choix du style musical 5) Paiement sécurisé ${standardPrice} 6) Réception sur WhatsApp.
- Occasions : Anniversaire, mariage, amour, hommage aux parents, remerciement, réconciliation.
- Moyens de paiement pour son pays (${country.name}) : ${country.methods}.
- Programme Partenaire : Inscription gratuite sur https://djelia.store/partenaire.html avec son numéro WhatsApp. On reçoit son lien d'affiliation unique et on gagne 25% de commission nette sur chaque commande générée. Retrait instantané dès 1 500 francs sur Wave, Orange Money ou MTN.

Réponds uniquement sous forme d'objet JSON avec le champ "reply" :
{"reply": "texte de ta réponse courte sans émoji"}`;
}

export const DJELIA_CONCIERGE_SYSTEM_PROMPT = buildConciergeSystemPrompt(resolveCountryFromPhone(null), true);

export async function generateConciergeReply(
  llmProvider: LlmProvider,
  input: ConciergeBrainInput,
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined
): Promise<string> {
  const country = resolveCountryFromPhone(input.phone);
  const systemPrompt = buildConciergeSystemPrompt(country, input.videoAlreadySent ?? true, input.studioConfig);

  const llmMessages: LlmMessage[] = input.recentHistory && input.recentHistory.length > 0
    ? compressRecentHistory(input.recentHistory)
    : [];

  llmMessages.push({
    role: 'user',
    content: input.incomingMessage,
  });

  try {
    const res = await llmProvider.completeJson({
      system: systemPrompt,
      messages: llmMessages,
      temperature: 0.3,
      maxTokens: 180,
    });

    const data = res.data as { reply?: unknown; message?: unknown; response?: unknown } | undefined;
    const rawAnswer = String(data?.reply || data?.message || data?.response || '').trim();

    // Nettoyage strict anti-émoji (Règle #4 & #5) en préservant les sauts de lignes pour les bulles
    const cleanAnswer = rawAnswer
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return cleanAnswer || `Vous pouvez composer et écouter vos paroles directement sur https://djelia.store . Je reste à votre disposition si vous avez la moindre question.`;
  } catch (err: any) {
    log?.('Erreur generateConciergeReply', { error: err?.message || err });
    return `Pour composer votre chanson, rendez-vous directement sur notre site : https://djelia.store . Je suis là si vous avez besoin d'aide.`;
  }
}
