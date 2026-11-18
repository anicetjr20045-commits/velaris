/**
 * Concierge IA Djélia 24/7 (Support & Orientation Web-First).
 *
 * Rôle : Accueillir, orienter et débloquer les clients vers le studio web (https://djelia.store/studio.html).
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
      "Tu es l'assistant visuel de l'atelier Djélia (djelia.store), atelier de création de chansons personnalisées. " +
      "Analyse cette capture d'écran envoyée par un client sur WhatsApp. " +
      "Décris en 1 ou 2 phrases courtes et précises : " +
      "1) Sur quelle page ou étape du studio le client se trouve (ex: accueil, choix occasion, prénom/souvenirs, génération paroles IA, choix de style, choix formule 1200F/3500F, ou paiement Chariow). " +
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

export interface ConciergeBrainInput {
  incomingMessage: string;
  recentHistory?: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
  contactName?: string | null | undefined;
  phone?: string | null | undefined;
  videoAlreadySent?: boolean | undefined;
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

export function buildConciergeSystemPrompt(country: CountryPaymentInfo, videoAlreadySent: boolean = true): string {
  return `Tu es l'assistante concierge de Djélia (djelia.store), atelier de composition de chansons personnalisées en Afrique.
Ton unique rôle est de guider, rassurer et orienter le client pour qu'il réussisse sa commande sur le studio web : https://djelia.store/studio.html.

Règles impératives de style et de ton :
1. Dignité, politesse et respect chaleureux ouest-africain et camerounais.
2. Réponses ultra-courtes : 1 à 2 phrases directes maximum. Jamais de longs pavés.
3. Strictement AUCUN émoji dans tes réponses. Pas de symboles décoratifs.
4. Tu ne prends pas la commande sur WhatsApp : tu renvoies toujours vers le studio en ligne https://djelia.store/studio.html en expliquant ce qu'il faut faire.
5. Si le client indique son occasion (anniversaire, mariage, déclaration, hommage), félicite-le chaleureusement, mentionne que la formule complète débute à 1 200 F CFA avec 2 versions MP3 prêtes en 15-20 min, et invite-le à composer ses paroles sur https://djelia.store/studio.html.
${videoAlreadySent
  ? '6. Si le client demande la procédure ou comment commander, rappelle-lui de regarder la courte vidéo de 2 minutes partagée plus haut, et donne le lien du site.'
  : '6. Si le client demande la procédure ou comment commander, explique brièvement les étapes et donne le lien https://djelia.store/studio.html.'}

Contexte géographique et paiements du client :
- Pays détecté : ${country.name} (monnaie : ${country.currency}).
- Moyens de paiement disponibles pour son pays sur le site : ${country.methods}.

Connaissances indispensables de Djélia :
- Studio en ligne : https://djelia.store/studio.html
- Procédure : On choisit l'occasion (anniversaire, amour, mariage, hommage), le prénom et quelques souvenirs. L'IA génère les paroles complètes en 15 secondes, modifiables gratuitement à volonté avec aperçu immédiat.
- Formules : Formule Standard à 1 200 F CFA (2 versions complètes en haute qualité MP3 prêtes en 15-20 minutes) et Formule Intégrale à 3 500 F CFA (chanson avec pochette personnalisée et retouches prioritaires).
- Écoute préalable : Le client lit et valide l'intégralité des paroles gratuitement avant de lancer la musique.
- Programme Partenaire : Possibilité de gagner 20% de commission sur chaque commande passée via son lien affilié Djélia (https://djelia.store/partenaire.html).

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
  const systemPrompt = buildConciergeSystemPrompt(country, input.videoAlreadySent ?? true);

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

    // Nettoyage strict anti-émoji (Règle #4 & #5)
    const cleanAnswer = rawAnswer
      .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1FA00}-\u{1FAFF}]/gu, '')
      .replace(/\s{2,}/g, ' ')
      .trim();

    return cleanAnswer || `Vous pouvez composer et écouter vos paroles directement sur https://djelia.store/studio.html . Je reste à votre disposition si vous avez la moindre question.`;
  } catch (err: any) {
    log?.('Erreur generateConciergeReply', { error: err?.message || err });
    return `Pour composer votre chanson, rendez-vous directement sur notre studio en ligne : https://djelia.store/studio.html . Je suis là si vous avez besoin d'aide.`;
  }
}
