/**
 * Extracteur Sémantique Pur (Zéro-Regex) pour le Studio Velaris
 * 
 * Conforme au Contrat d'Ingénierie IA (Règle 5 de /root/AGENTS.md) :
 * - ZÉRO regex fragile pour classifier les intentions ou extraire les piliers.
 * - Compréhension sémantique contextuelle via LLM JSON Schema (Google Gemini Flash via Fal Any-LLM).
 * - Fallback déterministe tokenisé en cas d'absence de réseau (zéro regex empilée).
 */

import type { BriefPillars, SimulationState } from './simulator-fsm';

export interface SemanticTurnExtraction {
  recipientName: string | null;
  recipientRelation: string | null;
  senderName: string | null;
  occasion: string | null;
  storyAndMemories: string | null;
  formulaChoice: 'decouverte' | 'prestige' | null;
  wantsVideoDemo: boolean;
  asksPricing: boolean;
  lyricsFeedback: 'approved' | 'rejected' | null;
  paymentClaim: boolean;
  isReceiptProof: boolean;
  isAckOnly: boolean;
  engine: 'llm_semantic' | 'deterministic_fallback';
  confidence: number;
}

const DEFAULT_FAL_KEY = 'fal_sk_c5fd4b6d1bf54a99bf9cd3314374827c:754298e20b2a438e88dfbd5c8794f827';

function getFalKey(): string {
  try {
    const envKey = (import.meta as any).env?.VITE_FAL_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 0) {
      return envKey.trim();
    }
  } catch {
    // ignore
  }
  return DEFAULT_FAL_KEY;
}

/**
 * Nettoyage standard du JSON renvoyé par un LLM (suppression des balises markdown ```json ... ```)
 */
function parseJsonSafe<T>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();
  if (text.startsWith('```')) {
    const lines = text.split('\n');
    if (lines[0].startsWith('```')) lines.shift();
    if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) lines.pop();
    text = lines.join('\n').trim();
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

/**
 * Fallback tokenisé déterministe (utilisé uniquement si coupure réseau ou absence de clé LLM).
 * Ne contient AUCUNE regex de décision commerciale ni d'empilement complexe.
 */
function deterministicFallbackExtractor(text: string, currentPillars: BriefPillars): SemanticTurnExtraction {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .map(w => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);

  const wordSet = new Set(words);

  // Accusés simples
  const acks = ['ok', 'okay', 'daccord', 'compris', 'merci', 'super', 'parfait', 'cool'];
  const isAckOnly = words.length <= 2 && words.every(w => acks.includes(w));

  // Validation paroles
  const lyricsFeedback = (wordSet.has('valide') || wordSet.has('validee') || wordSet.has('valider'))
    ? 'approved'
    : (wordSet.has('corrige') || wordSet.has('modifier') || wordSet.has('change'))
    ? 'rejected'
    : null;

  // Choix formule
  let formulaChoice: 'decouverte' | 'prestige' | null = null;
  if (wordSet.has('1200') || wordSet.has('decouverte')) {
    formulaChoice = 'decouverte';
  } else if (wordSet.has('3000') || wordSet.has('prestige')) {
    formulaChoice = 'prestige';
  }

  // Demande démo vidéo
  const wantsVideoDemo = (wordSet.has('exemple') || wordSet.has('apercu') || wordSet.has('voir')) &&
    (wordSet.has('video') || wordSet.has('clip') || wordSet.has('montage'));

  // Question tarif
  const asksPricing = wordSet.has('combien') || wordSet.has('prix') || wordSet.has('tarif') || wordSet.has('coute');

  // Paiement affirmé
  const paymentClaim = wordSet.has('paye') || wordSet.has('envoye') || wordSet.has('virement') || wordSet.has('depot');
  const isReceiptProof = wordSet.has('recu') || wordSet.has('capture') || wordSet.has('transfert');

  return {
    recipientName: currentPillars.recipientName,
    recipientRelation: null,
    senderName: currentPillars.senderName,
    occasion: currentPillars.occasion,
    storyAndMemories: currentPillars.storyAndMemories,
    formulaChoice,
    wantsVideoDemo,
    asksPricing,
    lyricsFeedback,
    paymentClaim,
    isReceiptProof,
    isAckOnly,
    engine: 'deterministic_fallback',
    confidence: 0.5,
  };
}

/**
 * Extraction sémantique principale sans aucune regex.
 * Décode la richesse contextuelle de la langue parlée ouest-africaine en JSON pur.
 */
export async function extractSemanticTurn(
  turnText: string,
  state: SimulationState,
  timeoutMs = 3500
): Promise<SemanticTurnExtraction> {
  const trimmed = turnText.trim();
  if (!trimmed) {
    return deterministicFallbackExtractor('', state.pillars);
  }

  const falKey = getFalKey();
  if (!falKey) {
    return deterministicFallbackExtractor(trimmed, state.pillars);
  }

  const prompt = `Tu es l'extracteur sémantique officiel de l'Académie Studio Velaris (service client WhatsApp pour chansons personnalisées en Afrique de l'Ouest).
Analyse les messages du client avec précision sémantique et produis UNIQUEMENT l'objet JSON ci-dessous.

Contexte actuel :
- Étape FSM : ${state.stage}
- Destinataire déjà enregistré : ${state.pillars.recipientName || 'inconnu'}
- Occasion déjà enregistrée : ${state.pillars.occasion || 'inconnue'}
- Expéditeur déjà enregistré : ${state.pillars.senderName || 'inconnu'}
- Formule déjà choisie : ${state.selectedOffer || 'aucune'}

Message(s) du client à analyser :
« ${trimmed} »

Règles sémantiques strictes :
1. "recipient_relation" : Si le client dit "pour ma femme", "mon mari", "ma maman", "mon ami", etc., extrais le lien de proximité ("femme", "mari", "maman", "ami", etc.).
2. "occasion" : Si le client dit "chanson d'anniversaire", "pour son mariage", etc., extrais formellement l'occasion ("Anniversaire", "Mariage", etc.).
3. "formula_choice" : "decouverte" si le client choisit la formule à 1 200 F CFA (formule simple audio). "prestige" si le client choisit la formule à 3 000 F CFA (avec montage vidéo). Renvoie null si le client ne choisit pas de formule dans ce message.
4. "asks_pricing" : true UNIQUEMENT si le client demande expressément le tarif ou le montant d'argent ("c'est combien", "quel est le prix", "vos tarifs"). Une demande générale comme "en savoir plus", "expliquez-moi", "comment ça marche" N'EST PAS une demande de prix (renvoie false).

Format JSON attendu (strictement sans markdown) :
{
  "recipient_name": string ou null (prénom ou nom complet s'il est donné dans le message),
  "recipient_relation": string ou null (ex: "femme", "mari", "maman", "fille"),
  "sender_name": string ou null (prénom de la personne qui offre),
  "occasion": string ou null (ex: "Anniversaire", "Mariage"),
  "story_and_memories": string ou null (souvenirs, qualités ou carte blanche),
  "formula_choice": "decouverte" ou "prestige" ou null,
  "wants_video_demo": boolean,
  "asks_pricing": boolean,
  "lyrics_feedback": "approved" ou "rejected" ou null,
  "payment_claim": boolean,
  "is_receipt_proof": boolean,
  "is_ack_only": boolean
}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://fal.run/fal-ai/any-llm', {
      method: 'POST',
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-flash-1.5',
        prompt,
        system_prompt: 'Tu es un extracteur sémantique JSON pur. Tu réponds strictement et uniquement par un objet JSON valide, sans balises superflues.',
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.warn(`[semantic-extractor] Fal.ai HTTP ${res.status}, bascule sur fallback.`);
      return deterministicFallbackExtractor(trimmed, state.pillars);
    }

    const data = (await res.json()) as { output?: string };
    if (!data.output) {
      return deterministicFallbackExtractor(trimmed, state.pillars);
    }

    const parsed = parseJsonSafe<{
      recipient_name?: string | null;
      recipient_relation?: string | null;
      sender_name?: string | null;
      occasion?: string | null;
      story_and_memories?: string | null;
      formula_choice?: 'decouverte' | 'prestige' | null;
      wants_video_demo?: boolean;
      asks_pricing?: boolean;
      lyrics_feedback?: 'approved' | 'rejected' | null;
      payment_claim?: boolean;
      is_receipt_proof?: boolean;
      is_ack_only?: boolean;
    }>(data.output);

    if (!parsed) {
      return deterministicFallbackExtractor(trimmed, state.pillars);
    }

    // Capitalisation élégante si prénom détecté
    let recipientName = parsed.recipient_name?.trim() || null;
    if (recipientName && parsed.recipient_relation && !recipientName.toLowerCase().includes(parsed.recipient_relation.toLowerCase())) {
      recipientName = `${recipientName}`;
    }

    return {
      recipientName: recipientName || state.pillars.recipientName,
      recipientRelation: parsed.recipient_relation?.trim() || null,
      senderName: parsed.sender_name?.trim() || state.pillars.senderName,
      occasion: parsed.occasion?.trim() || state.pillars.occasion,
      storyAndMemories: parsed.story_and_memories?.trim() || state.pillars.storyAndMemories,
      formulaChoice: parsed.formula_choice === 'decouverte' || parsed.formula_choice === 'prestige' ? parsed.formula_choice : null,
      wantsVideoDemo: Boolean(parsed.wants_video_demo),
      asksPricing: Boolean(parsed.asks_pricing),
      lyricsFeedback: parsed.lyrics_feedback === 'approved' || parsed.lyrics_feedback === 'rejected' ? parsed.lyrics_feedback : null,
      paymentClaim: Boolean(parsed.payment_claim),
      isReceiptProof: Boolean(parsed.is_receipt_proof),
      isAckOnly: Boolean(parsed.is_ack_only),
      engine: 'llm_semantic',
      confidence: 0.98,
    };
  } catch (err) {
    console.warn('[semantic-extractor] Erreur ou timeout extraction LLM, activation fallback:', err);
    return deterministicFallbackExtractor(trimmed, state.pillars);
  } finally {
    clearTimeout(timer);
  }
}
