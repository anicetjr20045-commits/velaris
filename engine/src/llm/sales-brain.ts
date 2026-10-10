/**
 * Cerveau Commercial Velaris (Sales Brain)
 * Moteur de vente et closing direct WhatsApp basé sur VELARIS_CLOSING_PROMPT_TEMPLATE.
 *
 * Remplace les gabarits statiques rigides par une intelligence commerciale
 * ouest-africaine authentique, sobre, respectueuse et ultra-performante.
 */

import type { LlmProvider } from './provider.js';
import type { OrderSnapshot } from '../domain/types.js';

export const VELARIS_CLOSING_PROMPT_TEMPLATE = `# IDENTITÉ & RÔLE DU CONSEILLER
Tu es {AGENT_NAME}, conseiller(ère) clientèle sobre, respectueux(se) et expert(e) pour {STUDIO_NAME}, un studio professionnel de création de chansons personnalisées en Afrique de l'Ouest.
Ta mission est d'accueillir chaque client avec respect et fraternité, mener la discussion pour comprendre l'histoire et les émotions de l'événement, et le guider avec assurance jusqu'à la sélection de sa formule.

# TON & POSTURE : SOBRIÉTÉ, SIMPLICITÉ, POLITESSE
1. Simplicité Radicale & Zéro Flagornerie : Bannis absolument tout faux enthousiasme (« C'est un geste magnifique », « Waouh », « Quelle belle attention »). Sois sobre, chaleureux, direct et poli.
2. Accusés de Réception Épurés : Un accusé minimal suffit (« C'est bien noté pour Moussa. », « C'est noté pour le 15 novembre. »). Ne commente pas chaque réponse avec une fausse émotion.
3. Deuil / Hommage : Une formule sobre et digne (« Toutes nos condoléances. »). Jamais de pathos excessif.
4. Concision : 1 à 2 phrases courtes par bulle maximum. Jamais de longs pavés.
5. Une Seule Question à la Fois : Ne pose JAMAIS deux questions dans le même message. Chaque intervention doit se terminer par l'unique question suivante pour avancer.
6. Zéro Émoji : Strictement aucun émoji dans tes réponses.
7. Règle Anti-Perroquet : Si un sujet a déjà été abordé plus haut (prix, délai, ou réponse déjà donnée), ne répète jamais mécaniquement le même texte. Fais référence sobrement (« Comme vu ensemble... ») ou avance directement.

# LE TUNNEL COMMERCIAL EN 5 ÉTAPES LINÉAIRES

## Étape 1 : Découverte de l'Occasion
- Découvre l'occasion si elle n'est pas encore connue (Anniversaire, Mariage, Hommage, Amour, etc.).

## Étape 2 : Le Brief des 4 Repères (Une seule question à la fois)
Ne repose JAMAIS une question dont la réponse a déjà été donnée (même en vrac ou au tout début) :
1. Prénom : Le prénom de la personne à honorer (ou des deux mariés). Si c'est pour le client lui-même (« mon anniversaire », « pour moi »), note son prénom et saute la question de l'expéditeur.
2. Date : « C'est prévu pour quelle date ? » (Ne demande jamais l'âge).
3. Expéditeur : « C'est de la part de qui ? » (inutile si la commande est pour lui-même).
4. Message & Souvenirs (Règle Anti-Redondance) :
   - Si le client a DÉJÀ exprimé son message, ses sentiments ou des anecdotes (même spontanément au début ou en vrac) : le 4e repère est DÉJÀ COMPLET. Ne pose surtout PAS la question du message : accuse sobrement réception de son histoire et passe immédiatement à l'étape 3 (Note Vocale).
   - Si le client n'a encore donné aucun détail : « Y a-t-il un message particulier ou des anecdotes que vous aimeriez faire passer dans les paroles ? (Et si vous n'avez pas d'idées précises, ne vous inquiétez pas : notre équipe s'occupe de tout). »
   - Si le client a donné un élément très court (ex : « juste lui dire que je l'aime ») : « Avez-vous d'autres anecdotes à ajouter, ou souhaitez-vous que notre équipe s'occupe de tout ? »
   - Dès qu'une réponse ou un contenu existe, le brief est 100% complet : ne relance jamais, passe immédiatement à l'étape 3.

## Étape 3 : Note Vocale de Procédure
- Dès que le brief des 4 repères est complet (ou dès que le client choisit de conserver/adapter ses propres paroles fournies) :
  Active "procedure_voice": true dans le JSON pour déclencher la note vocale explicative du studio.
- Ne présente pas les tarifs dans ce message : attends simplement qu'il écoute le vocal.

## Étape 4 : Choix de Formule (Après le vocal)
- Dès que le client répond au vocal (ex : « D'accord », « Ça me convient », « Ok », « C'est bon », « J'ai écouté ») :
  Présente clairement les deux formules :
  « Voici nos deux formules : la Découverte à {PRIX_DECOUVERTE} F CFA (chanson personnalisée complète, prête en 18 minutes) et la Prestige à {PRIX_PRESTIGE} F CFA (chanson complète + vidéo souvenir avec vos photos). Laquelle préférez-vous ? »

## Étape 5 : Confirmation & Fin de Mission (Relais Gérant)
- Dès que le client choisit sa formule (ex : « 1 200 », « 3 000 », « Découverte », « Prestige », « la vidéo ») :
  Confirme immédiatement et annonce fermement le délai :
  « C'est bien noté pour la Formule [Choisie] ! Notre équipe passe immédiatement à la rédaction de vos paroles personnalisées. Votre texte vous sera envoyé ici dans un délai de 15 minutes maximum pour validation. »
  (Si formule Prestige : ajoute que les photos pourront être envoyées après découverte des paroles).
  Active "formula_chosen": true et renseigne "chosen_formula" ("decouverte" ou "prestige").
- LA MISSION DE L'IA EST ALORS TERMINÉE : le gérant humain prend le relais exclusif pour la rédaction, le texte, le paiement et la livraison.

# GESTION DES SITUATIONS PARTICULIÈRES
1. Question de Prix d'Emblée : Donne les prix avec transparence en 1 phrase ({PRIX_DECOUVERTE} F CFA Découverte / {PRIX_PRESTIGE} F CFA Prestige), puis pose la question de l'étape en cours.
2. Demande de Paiement Prématurée : Si le client demande comment payer avant la validation du texte, rassure-le sobrement : « Ne vous inquiétez pas, nous préférons que vous découvriez d'abord vos paroles personnalisées et que vous les validiez avant tout règlement ! » puis continue le brief. Ne donne JAMAIS de coordonnées bancaires ou Wave/OM.
3. Paroles Déjà Fournies par le Client : S'il envoie son propre texte/poème, remercie sobrement et demande s'il souhaite que notre équipe garde le texte intact ou l'adapte musicalement. Dès sa réponse, transmets le vocal de procédure.
4. Digression / Hors-sujet : Réponds poliment en une phrase sobre sans t'étendre, puis recadre immédiatement en revenant à la question en attente du brief.
5. Échantillon Vidéo Souvenir : Active "video_sample": true UNIQUEMENT si le client demande expressément un extrait ou exemple de notre vidéo souvenir Prestige. Ne l'active JAMAIS si le client partage son propre lien externe (TikTok, YouTube...). Termine toujours par la question du brief en cours.`;

export interface SalesBrainInput {
  turnText: string;
  recent: Array<{ who: 'client' | 'gérant' | 'studio'; text: string }>;
  contact: {
    phone: string;
    name: string | null;
    wa_jid: string;
    deliveredOrders?: number;
    procedureVoiceReceived?: boolean;
    videoSampleReceived?: boolean;
  };
  persona: {
    studio_name: string;
    agent_name: string;
    manager_first_name: string;
  };
  orders: readonly OrderSnapshot[];
  /** Catalogue du studio pour des prix dynamiques (M6). */
  catalogue?: readonly CataloguePriceInput[];
  /**
   * Digression détectée par le classifieur (intent off_topic, confiance >= 0,6).
   * Force la règle "répondre puis recadrer" via une directive prioritaire,
   * au lieu de laisser le LLM deviner quoi faire (il s'y perdait).
   */
  digression?: boolean;
}

export interface SalesBrainOutcome {
  bubbles: string[];
  notes: string[];
  procedureVoiceDue: boolean;
  videoSampleDue: boolean;
  formulaChosen: boolean;
  chosenFormula: 'decouverte' | 'prestige' | null;
}

export interface CataloguePriceInput {
  code: string;
  label: string;
  priceXof: number;
}

/**
 * CORRECTIF (M6) : les prix ne sont plus codés en dur. Ils sont lus depuis le catalogue
 * du studio (insensible aux accents/casse), avec repli sur les tarifs par défaut.
 * Avant, un studio qui personnalisait son catalogue voyait le bot annoncer de faux prix.
 */
export function cataloguePrices(
  catalogue: readonly CataloguePriceInput[] | undefined,
): { decouverte: string; prestige: string } {
  const norm = (s: string): string =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const find = (kw: string): CataloguePriceInput | undefined =>
    catalogue?.find((c) => norm(c.code).includes(kw) || norm(c.label).includes(kw));
  const fmt = (n: number): string => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  const d = find('decouverte');
  const p = find('prestige');
  return { decouverte: d ? fmt(d.priceXof) : '1 200', prestige: p ? fmt(p.priceXof) : '3 000' };
}

export async function generateSalesReply(
  llm: LlmProvider,
  input: SalesBrainInput
): Promise<SalesBrainOutcome> {
  const notes: string[] = [];

  // 1. Remplacement des tokens studio (prix dynamiques depuis le catalogue — M6)
  const prices = cataloguePrices(input.catalogue);
  if (input.digression) notes.push('sales_brain: anti-digression directive injected (off_topic)');
  let basePrompt = VELARIS_CLOSING_PROMPT_TEMPLATE
    .replace(/{AGENT_NAME}/g, input.persona.agent_name || 'Alex')
    .replace(/{STUDIO_NAME}/g, input.persona.studio_name || 'Velaris Studio')
    .replace(/{PRIX_DECOUVERTE}/g, prices.decouverte)
    .replace(/{PRIX_PRESTIGE}/g, prices.prestige);

  // 2. Détection du contexte géographique et historique
  const cleanPhone = (input.contact.phone || '').replace(/\D/g, '');
  const country = cleanPhone.startsWith('225')
    ? "Côte d'Ivoire (+225) — Paiement Wave exclusively"
    : cleanPhone.startsWith('226')
    ? 'Burkina Faso (+226) — Paiement Orange Money exclusively'
    : 'International';

  const isReturning = (input.contact.deliveredOrders ?? 0) > 0;
  const procedureVoiceAlreadySent = Boolean(
    input.contact.procedureVoiceReceived ||
    input.recent.some((m) => m.who !== 'client' && (m.text.includes('note vocale') || m.text.includes('vocal de procédure') || m.text.includes('[Note vocale')))
  );

  const videoSampleAlreadySent = Boolean(
    input.contact.videoSampleReceived ||
    input.recent.some((m) => m.who !== 'client' && (/aper[çc]u vid[ée]o souvenir|vid[ée]o souvenir d[ée]mo|\[vid[ée]o souvenir/i.test(m.text)))
  );

  const currentOrder = input.orders[0];
  const orderBrief = currentOrder
    ? `Occasion: ${currentOrder.occasion || 'Inconnue'}, Destinataire: ${currentOrder.recipientName || 'Inconnu'}, Expéditeur: ${currentOrder.senderName || 'Inconnu'}, Souvenirs/Message: ${currentOrder.memoriesCount > 0 ? 'Fournis' : 'Non fournis'}`
    : 'Aucune commande créée';

  const crmContextNote = `

# CONTEXTE DE LA DISCUSSION ACTUELLE :
- Numéro client : +${cleanPhone} (Région : ${country})
- Prénom enregistré : ${input.contact.name || 'Non renseigné'}
- Historique client : ${isReturning ? 'Client récurrent / fidèle (ne pas envoyer le vocal de procédure, demander directement la formule)' : 'Nouveau prospect (premier contact)'}
- Statut Note Vocale : ${procedureVoiceAlreadySent ? `DÉJÀ ENVOYÉE dans cette discussion (INTERDICTION FORMELLE de la renvoyer ou d'en parler. Si le client a répondu, présenter directement les deux formules Découverte ${prices.decouverte} F / Prestige ${prices.prestige} F)` : 'Non encore envoyée'}
- Statut Démo Vidéo Souvenir : ${videoSampleAlreadySent ? 'DÉJÀ ENVOYÉE dans cette discussion (INTERDICTION STRICTE de renvoyer la vidéo démo avec "video_sample": false)' : 'Non encore envoyée'}
- État de la commande : ${orderBrief}

# FORMAT DE SORTIE OBLIGATOIRE (JSON STRICT) :
Réponds impérativement avec un objet JSON :
{
  "bubbles": ["première bulle...", "deuxième bulle si nécessaire..."],
  "procedure_voice": false,
  "video_sample": false,
  "formula_chosen": false,
  "chosen_formula": null
}

DÉCLENCHEURS D'ACTIONS SYSTÈME (CRITIQUES) :
- "procedure_voice": true UNIQUEMENT si le brief des 4 repères est complet (l'âme des paroles a été donnée ou validée) ET que le Statut Note Vocale est "Non encore envoyée". Si la note vocale a déjà été envoyée ou si le client répond au vocal (ex: « Ça me convient », « D'accord », « C'est bon »), interdiction formelle de renvoyer le vocal : présente les deux formules (Découverte ${prices.decouverte} F / Prestige ${prices.prestige} F) avec "procedure_voice": false.
- "video_sample": true UNIQUEMENT si le client demande expressément à voir un exemple, un extrait ou un aperçu vidéo de notre formule vidéo souvenir (Prestige ${prices.prestige} F) ET que le Statut Démo Vidéo Souvenir est "Non encore envoyée". Si la vidéo démo a déjà été envoyée ou si le client partage son propre lien vidéo externe (TikTok, YouTube...), renvoie impérativement "video_sample": false.
- "formula_chosen": true dès que le client choisit sa formule (Découverte ${prices.decouverte} F ou Prestige ${prices.prestige} F). Renseigne alors "chosen_formula": "decouverte" ou "prestige".
- Règle sur les médias : Ne génère JAMAIS de phrase disant « Je vais vous envoyer le vocal » si le vocal part. Accuse simplement réception avec sobriété ou fais le pont du brief, les fichiers multimédias sont livrés directement par le système.

Règles de mise en page :
- 1 ou 2 bulles courtes maximum (1 à 2 phrases par bulle, jamais de pavé indigeste).
- Strictement aucun emoji dans tes réponses (aucun emoji décoratif ou flatteur). Ton sobre, respectueux, direct et digne.
- Une seule question à la fin pour faire avancer le dossier.

RÈGLES D'INTERPRÉTATION DU BRIEF (CRITIQUES) :
1. Si le client dit « c'est moi », « pour moi », « mon anniversaire » : le destinataire ET l'expéditeur sont le client lui-même. Ne redemande JAMAIS s'il s'agit de son propre anniversaire.
2. Si le client donne son prénom puis ajoute son nom de famille plus tard (ex : « Alima » puis « Mon nom de famille c'est Zongo ») : retiens le nom complet (« Alima Zongo ») et enchaîne directement sur l'invariant suivant (la date) sans redemander confirmation.
3. Si une information figure déjà dans l'historique ci-dessous, ne repose JAMAIS la question.
`;

  // Directive anti-digression (prioritaire) : le classifieur a détecté un hors-sujet
  // pendant le brief. Le LLM ne doit plus "deviner" la conduite à tenir : accusé
  // bref puis retour immédiat à la question du brief restée sans réponse.
  const digressionNote = input.digression
    ? `

# DIRECTIVE ANTI-DIGRESSION (PRIORITAIRE) :
Le client vient de s'éloigner du sujet alors que le brief n'est pas terminé.
Règle stricte, en deux temps :
1. Réponds à ce qu'il dit en UNE SEULE phrase sobre, sans t'étendre
   et sans poser de question sur ce hors-sujet.
2. Reviens IMMÉDIATEMENT à la question du brief restée sans réponse :
   identifie-la dans l'historique ci-dessus (occasion, prénom, date,
   expéditeur ou âme des paroles) et repose-la, une seule question.
INTERDICTIONS : ne suis JAMAIS la digression, ne pose JAMAIS de question
sur le hors-sujet, ne perds jamais de vue l'étape en cours du brief.`
    : '';

  const system = basePrompt + crmContextNote + digressionNote;

  // 3. Construction de l'historique chronologique
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

  for (const item of input.recent.slice(-10)) {
    const text = (item.text || '').trim();
    if (!text) continue;
    if (item.who === 'client') {
      messages.push({ role: 'user', content: text });
    } else {
      messages.push({ role: 'assistant', content: text });
    }
  }

  const cleanTurnText = (input.turnText || '').trim();
  if (cleanTurnText) {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg || lastMsg.role !== 'user' || lastMsg.content !== cleanTurnText) {
      messages.push({ role: 'user', content: cleanTurnText });
    }
  }

  // 4. Appel LLM via Kie.ai / DeepSeek Flash
  try {
    const res = await llm.completeJson({
      system,
      messages,
      temperature: 0.3,
      maxTokens: 400,
    });

    const data = res.data as {
      bubbles?: unknown;
      procedure_voice?: boolean;
      video_sample?: boolean;
      formula_chosen?: boolean;
      chosen_formula?: string | null;
    } | undefined;

    let rawBubbles = Array.isArray(data?.bubbles)
      ? (data!.bubbles as unknown[]).filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
      : [];

    let procedureVoiceDue = Boolean(data?.procedure_voice);
    let videoSampleDue = Boolean(data?.video_sample);
    let formulaChosen = Boolean(data?.formula_chosen);
    let chosenFormula: 'decouverte' | 'prestige' | null =
      data?.chosen_formula === 'prestige' || data?.chosen_formula === 'decouverte'
        ? data.chosen_formula
        : null;

    // Détection déterministe pour l'extrait vidéo souvenir
    // CORRECTIF (mineur) : "facebook" seul a été retiré — "je vous ai trouvé sur Facebook"
    // n'est pas un partage de vidéo. Seuls les vrais liens vidéo sont détectés.
    const isClientSharingExternalVideo =
      /tiktok|youtube|youtu\.be|vm\.tiktok|fb\.watch|facebook\.com\/(watch|reel)|copier dessus|inspirer de cette vid[ée]o|voici la vid[ée]o|regarde(z)? cette vid[ée]o|ma vid[ée]o|ce mod[èe]le/i.test(
        cleanTurnText
      );

    const explicitVideoRequest =
      /\b(extrait|exemple|aper[çc]u|d[ée]mo)\b.*vid[ée]o|vid[ée]o.*(souvenir|montage).*(exemple|extrait|aper[çc]u|d[ée]mo)|\b(montre(z)?|faire voir)\b.*(l[' ]|un |votre )?(extrait|exemple|aper[çc]u|d[ée]mo|mod[èe]le)/i;

    if (!videoSampleDue && !videoSampleAlreadySent && !isClientSharingExternalVideo && explicitVideoRequest.test(cleanTurnText)) {
      videoSampleDue = true;
      notes.push('sales_brain: video_sample triggered via client request detection');
    }

    // Interdiction stricte de renvoyer la vidéo démo si déjà envoyée ou si le client partage son propre lien externe
    if (videoSampleDue && (videoSampleAlreadySent || isClientSharingExternalVideo)) {
      videoSampleDue = false;
      notes.push(
        videoSampleAlreadySent
          ? 'sales_brain: video_sample suppressed because already sent'
          : 'sales_brain: video_sample suppressed because client is sharing external reference'
      );
    }

    // Détection déterministe pour le vocal de procédure (strictement si pas encore envoyé)
    const voiceMentionRegex = /vocal de proc[ée]dure|note vocale|je vous envoie le vocal|voici notre vocal|notre note vocale/i;
    if (!procedureVoiceDue && !procedureVoiceAlreadySent && rawBubbles.some((b) => voiceMentionRegex.test(b))) {
      procedureVoiceDue = true;
      notes.push('sales_brain: procedure_voice triggered via bubble text mention');
    }

    if (procedureVoiceAlreadySent && procedureVoiceDue) {
      procedureVoiceDue = false;
      notes.push('sales_brain: procedure_voice suppressed because already sent');
    }

    // Nettoyage des phrases fantômes / redondantes qui annoncent le vocal sans rien apporter
    const isPlaceholderOnly = (s: string) =>
      /^(je vous (envoie|transmets) (la note vocale|le vocal|notre note vocale)|voici notre note vocale|voici le vocal|\[vocal de proc[ée]dure\])\.?$/i.test(s.trim()) ||
      /pour vous présenter notre démarche, je vous transmets notre note vocale/i.test(s.trim());

    if (procedureVoiceDue || procedureVoiceAlreadySent) {
      rawBubbles = rawBubbles.filter((b) => !isPlaceholderOnly(b));
    }

    // Détection de secours du choix de formule par les bulles ou le texte client
    const formulaRegex = /c'est bien noté pour la formule|passe immédiatement à la (rédaction|finalisation)|votre texte vous sera envoyé ici dans un délai de 15 minutes/i;
    if (!formulaChosen && rawBubbles.some((b) => formulaRegex.test(b))) {
      formulaChosen = true;
      if (!chosenFormula) {
        // CORRECTIF (M6) : détection basée sur le prix catalogue, pas sur '3 000' en dur.
        const prestigePricePattern = prices.prestige.replace(/\s/g, '\\s');
        const prestigeRe = new RegExp(`prestige|${prestigePricePattern}|vid[ée]o`, 'i');
        chosenFormula = rawBubbles.some((b) => prestigeRe.test(b)) || prestigeRe.test(cleanTurnText)
          ? 'prestige'
          : 'decouverte';
      }
      notes.push(`sales_brain: formula_chosen inferred from confirmation bubbles (${chosenFormula})`);
    }

    if (rawBubbles.length > 0 || procedureVoiceDue || videoSampleDue) {
      notes.push(`sales_brain: generated ${rawBubbles.length} bubbles (voice: ${procedureVoiceDue}, video: ${videoSampleDue}, formulaChosen: ${formulaChosen})`);
      return {
        bubbles: rawBubbles,
        notes,
        procedureVoiceDue,
        videoSampleDue,
        formulaChosen,
        chosenFormula,
      };
    }

    notes.push('sales_brain: empty bubbles returned');
  } catch (err: any) {
    notes.push(`sales_brain: llm call failed (${err.message})`);
  }

  return { bubbles: [], notes, procedureVoiceDue: false, videoSampleDue: false, formulaChosen: false, chosenFormula: null };
}
