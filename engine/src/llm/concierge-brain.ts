/**
 * Concierge IA Djélia 24/7 (Support & Orientation Web-First).
 *
 * Rôle : Accueillir, orienter et débloquer les clients vers le studio web (https://djelia.store/studio.html).
 * Contrat d'ingénierie :
 *  - Zéro empilement de règles ad-hoc (prompt sobre, max 50-60 lignes).
 *  - Zéro émoji dans les réponses.
 *  - 1 à 2 phrases courtes maximum, ton digne et chaleureux (Afrique de l'Ouest & Cameroun).
 *  - Connaissance exhaustive du studio web, des formules, des paiements et de l'affiliation.
 *  - Sortie JSON garantie via completeJson.
 */

import type { LlmProvider, LlmMessage } from './provider.js';

export interface ConciergeBrainInput {
  incomingMessage: string;
  recentHistory?: Array<{ role: 'user' | 'assistant'; content: string }> | undefined;
  contactName?: string | null | undefined;
  phone?: string | null | undefined;
}

export const DJELIA_CONCIERGE_SYSTEM_PROMPT = `Tu es l'assistante concierge de Djélia (djelia.store), atelier de composition de chansons personnalisées en Afrique.
Ton unique rôle est de guider, rassurer et orienter le client pour qu'il réussisse sa commande sur le studio web : https://djelia.store/studio.html.

Règles impératives de style et de ton :
1. Dignité, politesse et respect chaleureux ouest-africain et camerounais.
2. Réponses ultra-courtes : 1 à 2 phrases directes maximum. Jamais de longs pavés.
3. Strictement AUCUN émoji dans tes réponses. Pas de symboles décoratifs.
4. Tu ne prends pas la commande sur WhatsApp : tu renvoies toujours vers le studio en ligne https://djelia.store/studio.html en expliquant ce qu'il faut faire.

Connaissances indispensables de Djélia :
- Studio en ligne : https://djelia.store/studio.html
- Procédure : On choisit l'occasion (anniversaire, amour, mariage, hommage), le prénom et quelques souvenirs. L'IA génère les paroles complètes en 15 secondes, modifiables gratuitement à volonté avec aperçu immédiat.
- Formules : Formule Standard à 1 200 F CFA (2 versions complètes en haute qualité MP3 prêtes en 15-20 minutes) et Formule Intégrale à 3 500 F CFA (chanson avec pochette personnalisée et retouches prioritaires).
- Moyens de paiement intégrés : Côte d'Ivoire (Wave, Orange Money), Cameroun (MTN Mobile Money, Orange Money Cameroun), Burkina Faso (Orange Money, Moov Money).
- Écoute préalable : Le client lit et valide l'intégralité des paroles gratuitement avant de lancer la musique.
- Programme Partenaire : Possibilité de gagner 20% de commission sur chaque commande passée via son lien affilié Djélia.

Réponds uniquement sous forme d'objet JSON avec le champ "reply" :
{"reply": "texte de ta réponse courte sans émoji"}`;

export async function generateConciergeReply(
  llmProvider: LlmProvider,
  input: ConciergeBrainInput,
  log?: ((msg: string, meta?: Record<string, unknown>) => void) | undefined
): Promise<string> {
  const llmMessages: LlmMessage[] = [];

  if (input.recentHistory && input.recentHistory.length > 0) {
    for (const h of input.recentHistory.slice(-6)) {
      llmMessages.push({
        role: h.role === 'assistant' ? 'assistant' : 'user',
        content: h.content,
      });
    }
  }

  llmMessages.push({
    role: 'user',
    content: input.incomingMessage,
  });

  try {
    const res = await llmProvider.completeJson({
      system: DJELIA_CONCIERGE_SYSTEM_PROMPT,
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

    return cleanAnswer || "Vous pouvez composer et écouter vos paroles directement sur https://djelia.store/studio.html . Je reste à votre disposition si vous avez la moindre question.";
  } catch (err: any) {
    log?.('Erreur generateConciergeReply', { error: err?.message || err });
    return "Pour composer votre chanson, rendez-vous directement sur notre studio en ligne : https://djelia.store/studio.html . Je suis là si vous avez besoin d'aide.";
  }
}
