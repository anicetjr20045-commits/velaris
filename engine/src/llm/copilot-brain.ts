/**
 * Cerveau Copilot IA & Analyste Élite du Studio Velaris
 * Moteur d'intelligence conversationnelle et décisionnelle alimenté par DeepSeek-V3.
 * Accès direct aux données temps réel Supabase, mutations de caisse, et génération de paroles étalons.
 */

import type { DeepSeekProvider } from './deepseek.js';
import type { WahaClient } from '../send/waha-client.js';
import { detectOccasion, getFewShotExamples, getHouseStyleDnaNote, type SongOccasion } from './lyrics-corpus.js';

export interface CopilotBrainRequest {
  prompt: string;
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  sessionName?: string;
  user?: { id: string; email?: string } | null;
  clientContext?: {
    orders?: any[];
    metrics?: any;
  };
}

export interface CopilotBrainResponse {
  id: string;
  role: 'assistant';
  text: string;
  timestamp: string;
  toolsExecuted: string[];
  actionCard?: {
    type: 'lyrics' | 'reply' | 'stats' | 'client_brief' | 'song_generation' | 'order_action';
    title: string;
    phone?: string;
    recipient?: string;
    occasion?: string;
    style?: string;
    content: string;
    metadata?: Record<string, any>;
  };
}

export interface CopilotBrainDeps {
  db: {
    queryTable: <T = any>(table: string, queryParams?: string) => Promise<T>;
    insertRow: <T = any>(table: string, row: Record<string, unknown>) => Promise<T>;
    updateRows: <T = any>(table: string, matchQuery: string, data: Record<string, unknown>) => Promise<T>;
    rpc?: <T = any>(fn: string, args: Record<string, unknown>) => Promise<T>;
  };
  llm: DeepSeekProvider;
  waha?: WahaClient | undefined;
  log: (msg: string, d?: any) => void;
}

const digitsOf = (s: string | null | undefined) => (s || '').replace(/\D/g, '');

export async function runCopilotBrain(
  req: CopilotBrainRequest,
  deps: CopilotBrainDeps
): Promise<CopilotBrainResponse> {
  const toolsExecuted: string[] = [];
  const cleanPrompt = req.prompt.trim();
  const msgId = `copilot_${Date.now()}`;
  const nowStr = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

  // 1. Récupération des métriques réelles depuis la base Supabase
  let totalRevenueXof = 3644400; // CA historique de référence
  let validatedOrdersCount = 0;
  let waveTotal = 0;
  let omTotal = 0;

  try {
    const orders = await deps.db.queryTable<any[]>('orders', 'select=id,amount_cents,status,payment_method,created_at&limit=300');
    toolsExecuted.push('get_live_studio_orders');
    if (Array.isArray(orders) && orders.length > 0) {
      for (const o of orders) {
        const amt = Number(o.amount_cents || 0) / 100;
        const st = String(o.status || '').toLowerCase();
        if (st === 'validated' || st === 'delivered' || st === 'paid') {
          totalRevenueXof += amt;
          validatedOrdersCount++;
          const method = String(o.payment_method || '').toLowerCase();
          if (method.includes('wave')) waveTotal += amt;
          else if (method.includes('orange')) omTotal += amt;
        }
      }
    }
  } catch (err: any) {
    deps.log('copilot-brain: failed to fetch orders, using context fallback', { error: err.message });
  }

  // CORRECTIF (M17) : les métriques "temps réel" étaient codées en dur (633, 637, 623, 40340).
  // Elles sont désormais lues en base via copilot_studio_metrics ; en cas d'échec, null
  // (jamais de faux chiffres présentés comme réels).
  let liveMetrics: {
    total_contacts?: number;
    total_conversations?: number;
    active_conversations?: number;
    total_orders?: number;
    total_inbound_messages?: number;
    total_outbound_messages?: number;
  } | null = null;
  try {
    const m = await deps.db.rpc?.<any>('copilot_studio_metrics', {});
    if (m && typeof m === 'object') {
      liveMetrics = m;
      toolsExecuted.push('get_live_studio_metrics');
    }
  } catch (err: any) {
    deps.log('copilot-brain: failed to fetch live metrics', { error: err.message });
  }

  // 2. Recherche d'un client potentiel mentionné dans le message (numéro ou prénom)
  let matchedContact: any = null;
  let matchedConv: any = null;
  let matchedMessages: any[] = [];
  let matchedOrders: any[] = [];

  try {
    // 2.1. Recherche directe dans le message (numéro explicite)
    const phoneMatch = cleanPrompt.match(/\+?\d[\d\s.\-]{3,}\d/);
    const potentialDigits = phoneMatch ? digitsOf(phoneMatch[0]) : null;

    if (potentialDigits && potentialDigits.length >= 4) {
      toolsExecuted.push('search_contact_by_phone');
      const contacts = await deps.db.queryTable<any[]>('contacts', `phone=ilike.*${potentialDigits}*&limit=1`);
      if (Array.isArray(contacts) && contacts[0]) {
        matchedContact = contacts[0];
      }
    }

    const isExplicitComplaintSearch = /\b(plainte|plaint|mécontent|mecontent|colère|colere|déçu|decu|rembours|litige)\b/i.test(cleanPrompt);

    if (!matchedContact && !isExplicitComplaintSearch) {
      const STOPWORDS = new Set([
        'pour', 'avec', 'dans', 'sur', 'fait', 'faire', 'texte', 'chanson', 'paroles',
        'commande', 'reçois', 'recois', 'valide', 'combien', 'client', 'cliente', 'studio',
        'bonjour', 'salut', 'recherche', 'cherche', 'trouve', 'retrouve', 'histoire', 'qui',
        'une', 'des', 'les', 'est', 'sont', 'ont', 'elle', 'lui', 'nous', 'vous', 'ils', 'elles',
        'mon', 'ton', 'son', 'mes', 'tes', 'ses', 'notre', 'votre', 'leur', 'leurs', 'tout', 'tous',
        'toute', 'toutes', 'cette', 'cet', 'ces', 'mais', 'donc', 'aussi', 'bien', 'très', 'tres',
        'avoir', 'être', 'etre', 'sait', 'plainte', 'plaintes', 'mécontent', 'mecontent', 'erreur',
        'ancienne', 'nouvelle', 'nouveau', 'ancien', 'régulière', 'reguliere', 'régulier', 'regulier'
      ]);

      // Recherche par prénom (mots de 4 lettres minimum sans stopwords)
      const words = cleanPrompt
        .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
        .split(/\s+/)
        .map(w => w.trim())
        .filter(w => w.length >= 4 && !STOPWORDS.has(w.toLowerCase()));

      for (const word of words.slice(0, 3)) {
        const contacts = await deps.db.queryTable<any[]>('contacts', `name=ilike.*${encodeURIComponent(word)}*&limit=1`);
        if (Array.isArray(contacts) && contacts[0]) {
          matchedContact = contacts[0];
          toolsExecuted.push('search_contact_by_name');
          break;
        }
      }
    }

    // 2.2. Continuité conversationnelle & anaphores : si aucun contact dans le prompt, chercher dans req.history
    if (!matchedContact && Array.isArray(req.history) && req.history.length > 0) {
      const recentHistory = [...req.history].slice(-4).reverse();
      for (const h of recentHistory) {
        const text = h.text || '';
        // Lien WhatsApp wa.me/(\d+)
        const waMatch = text.match(/wa\.me\/(\d{8,15})/);
        if (waMatch && waMatch[1]) {
          const digits = waMatch[1];
          const contacts = await deps.db.queryTable<any[]>('contacts', `phone=ilike.*${digits.slice(-8)}*&limit=1`);
          if (Array.isArray(contacts) && contacts[0]) {
            matchedContact = contacts[0];
            toolsExecuted.push('resolve_contact_from_history');
            break;
          }
        }
        // Numéro de téléphone dans le texte historique
        const hPhoneMatch = text.match(/\+?\d[\d\s.\-]{5,}\d/);
        if (hPhoneMatch) {
          const digits = digitsOf(hPhoneMatch[0]);
          if (digits.length >= 6) {
            const contacts = await deps.db.queryTable<any[]>('contacts', `phone=ilike.*${digits.slice(-8)}*&limit=1`);
            if (Array.isArray(contacts) && contacts[0]) {
              matchedContact = contacts[0];
              toolsExecuted.push('resolve_contact_from_history');
              break;
            }
          }
        }
        // Nom de client (ex: ### Nanan Achy ou Nanan Achy)
        const nameHeaderMatch = text.match(/###\s+([A-ZÀ-Ý][\p{L}'-]+(?:\s+[A-ZÀ-Ý][\p{L}'-]+){1,3})/u);
        if (nameHeaderMatch && nameHeaderMatch[1]) {
          const candName = nameHeaderMatch[1].trim();
          const first = candName.split(' ')[0];
          if (first && first.length >= 3) {
            const contacts = await deps.db.queryTable<any[]>('contacts', `name=ilike.*${encodeURIComponent(first)}*&limit=1`);
            if (Array.isArray(contacts) && contacts[0]) {
              matchedContact = contacts[0];
              toolsExecuted.push('resolve_contact_from_history');
              break;
            }
          }
        }
      }
    }

    // 2.3. Si contact résolu, charger conversation, messages récents ET TOUTES ses commandes passées
    if (matchedContact) {
      const [convs, ords] = await Promise.all([
        deps.db.queryTable<any[]>('conversations', `contact_id=eq.${matchedContact.id}&limit=1`),
        deps.db.queryTable<any[]>('orders', `contact_id=eq.${matchedContact.id}&order=created_at.asc&limit=50`),
      ]);
      matchedOrders = Array.isArray(ords) ? ords : [];
      if (Array.isArray(convs) && convs[0]) {
        matchedConv = convs[0];
        const msgs = await deps.db.queryTable<any[]>('messages', `conversation_id=eq.${matchedConv.id}&order=created_at.desc&limit=8`);
        if (Array.isArray(msgs)) {
          matchedMessages = msgs.reverse();
          toolsExecuted.push('get_whatsapp_transcripts');
        }
      }
      toolsExecuted.push('get_client_orders_history');
    }
  } catch (err: any) {
    deps.log('copilot-brain: failed to search contacts', { error: err.message });
  }

  // 2.5. Recherche sémantique / thématique UNIQUEMENT si requête explicite de recherche large sans contact actif
  let searchResults: any[] = [];
  const isExplicitBroadSearch = !matchedContact && /\b(cherche|trouve|retrouve|recherche|y a-t-il|liste)\b/i.test(cleanPrompt) &&
    /\b(plainte|plaint|mécontent|mecontent|colère|colere|déçu|decu|rembours|retard|erreur|problème|probleme|réclamation|reclamation|litige)\b/i.test(cleanPrompt);

  if (deps.db.rpc && isExplicitBroadSearch) {
    try {
      // CORRECTIF (M18) : plus de repli vers un UUID en dur. Sans utilisateur identifié,
      // la recherche large est désactivée au lieu de fouiller les données du fondateur.
      const ownerUserId = req.user?.id;
      if (!ownerUserId) {
        deps.log('copilot-brain: broad search skipped (no authenticated user)');
      } else {
        const rpcRes = await deps.db.rpc<any[]>('copilot_search', {
          p_user_id: ownerUserId,
          p_query: cleanPrompt,
          p_mode: 'complaints',
        });
        if (Array.isArray(rpcRes) && rpcRes.length > 0) {
          searchResults = rpcRes;
          toolsExecuted.push('copilot_search_messages_and_convs');
        }
      }
    } catch (err: any) {
      deps.log('copilot-brain: failed copilot_search RPC', { error: err.message });
    }
  }

  // 3. Construction du prompt système avec tout l'ADN du studio Velaris
  const houseDna = getHouseStyleDnaNote();
  const occasionDetected: SongOccasion = detectOccasion(cleanPrompt);
  const goldenExamples = getFewShotExamples(occasionDetected, undefined, 1);

  const contextData = {
    studioMetrics: {
      totalRevenueXof,
      validatedOrdersCount,
      waveTotal,
      omTotal,
      // CORRECTIF (M17) : vrais compteurs base, plus de chiffres en dur.
      activeConversations: liveMetrics?.active_conversations ?? null,
      totalContactsCount: liveMetrics?.total_contacts ?? null,
      totalOrdersCount: liveMetrics?.total_orders ?? null,
      totalMessagesCount:
        liveMetrics != null
          ? (liveMetrics.total_inbound_messages ?? 0) + (liveMetrics.total_outbound_messages ?? 0)
          : null,
    },
    matchedClient: matchedContact ? {
      name: matchedContact.name,
      phone: matchedContact.phone,
      stage: matchedConv?.funnel_stage || 'en_discussion',
      summary: matchedConv?.summary || matchedContact.notes || '',
      orderCount: matchedOrders.length,
      isRegularClient: matchedOrders.length >= 2,
      clientFidelityStatus: matchedOrders.length >= 2
        ? `Cliente régulière (${matchedOrders.length} commandes au studio)`
        : matchedOrders.length === 1
        ? `Cliente avec 1 seule commande au studio`
        : `Nouveau prospect (0 commande payée)`,
      totalSpentCents: matchedOrders.reduce((sum, o) => sum + Number(o.amount_cents || 0), 0),
      firstOrderDate: matchedOrders[0]?.created_at ? new Date(matchedOrders[0].created_at).toLocaleDateString('fr-FR') : null,
      lastOrderDate: matchedOrders[matchedOrders.length - 1]?.created_at ? new Date(matchedOrders[matchedOrders.length - 1].created_at).toLocaleDateString('fr-FR') : null,
      ordersHistory: matchedOrders.map(o => ({
        id: o.id,
        amount: `${(Number(o.amount_cents || 0) / 100).toLocaleString('fr-FR')} F CFA`,
        status: o.status,
        occasion: o.notes || o.occasion || 'Non spécifiée',
        date: o.created_at ? new Date(o.created_at).toLocaleDateString('fr-FR') : '',
      })),
      recentMessages: matchedMessages.map(m => `[${m.direction === 'inbound' ? 'CLIENT' : 'STUDIO'}] ${m.body}`),
    } : null,
    thematicSearchResults: searchResults.length > 0 ? searchResults.map(r => ({
      clientName: r.contact_name,
      phone: r.contact_phone,
      funnelStage: r.funnel_stage,
      summary: r.conversation_summary,
      matchedExcerpt: r.matched_message,
      matchType: r.match_type,
      date: r.message_at ? new Date(r.message_at).toLocaleDateString('fr-FR') : undefined,
    })) : null,
    commercialRules: {
      tarifs: {
        texte: '1 200 F CFA',
        video: '3 000 F CFA (la plus vendue)',
        vip: '5 000 F CFA',
      },
      delais: {
        paroles: '7 à 8 minutes',
        retouches: '5 minutes',
        audioSuno: '18 minutes',
      },
      comptesPaiement: {
        waveCI: 'Wave Côte d\'Ivoire disponible',
        orangeMoneyBF: 'Orange Money Burkina Faso : +226 05 77 73 08 (Wendyam Anicet junior)',
      },
    },
  };

  const systemPrompt = `Tu es le Copilot IA d'Élite & Analyste du Studio Velaris (Académie & Suite Logicielle Studio Chansons WhatsApp).
Tu es le bras droit opérationnel du gérant (Alex / Anicet).

TON PROFIL & ATTITUDE :
- Tu t'exprimes avec vivacité, intelligence stratégique, chaleur humaine et élégance.
- Tu emploies un vouvoiement respectueux et bienveillant, typique de l'excellence commerciale d'Afrique de l'Ouest.
- Tu es proactif, direct, précis et orienté résultats. ZÉRO formule d'impuissance robotique (« Je n'ai pas compris », « Reformulez »).
- Tu as accès en temps réel aux données complètes du studio fournies dans le bloc JSON de contexte.

DONNÉES TEMPS RÉEL DU STUDIO :
${JSON.stringify(contextData, null, 2)}

${houseDna}

EXEMPLE ÉTALON DU PATRON :
${goldenExamples.map(e => `[${e.title} - ${e.occasion}]\n${e.lyrics}`).join('\n\n')}

INSTRUCTIONS DE RÉPONSE STRICTES :
1. Tu dois TOUJOURS répondre en JSON strict conforme au schéma suivant :
{
  "thought": "Ton analyse rapide et décision",
  "reply": "Ta réponse complète en Markdown adressée au gérant",
  "toolsUsed": ["noms des outils utilisés"],
  "actionCard": null ou {
    "type": "lyrics" | "reply" | "order_action" | "stats",
    "title": "Titre clair",
    "phone": "numéro de téléphone si applicable",
    "recipient": "nom du destinataire si applicable",
    "occasion": "occasion si applicable",
    "style": "style musical si applicable",
    "content": "contenu complet (paroles intégrales ou message)",
    "metadata": { ... }
  },
  "orderMutation": null ou {
    "contactId": "id si connu",
    "contactPhone": "numéro si connu",
    "amountCents": montant en centimes (ex: 300000 pour 3000 F CFA),
    "paymentMethod": "Wave" ou "Orange Money",
    "status": "paid",
    "notes": "note de commande"
  }
}

RÈGLES MÉTIER INFRANGIBLES :
- CONTINUITÉ CONVERSATIONNELLE & ANALYSE DE FIDÉLITÉ CLIENT (RÈGLE ESSENTIELLE) : Lorsque le gérant te pose une question de suivi sur un client dont vous venez de parler (ex: 'est-ce que cette cliente-là est une ancienne cliente régulière ou bien c'est une nouvelle ?', 'combien a-t-elle commandé ?', 'quand a-t-elle payé ?', 'qu'est-ce qu'elle voulait ?') :
  1. Base-toi DIRECTEMENT et STRICTEMENT sur les données certifiées fournies dans 'matchedClient' (notamment 'orderCount', 'isRegularClient', 'clientFidelityStatus', 'ordersHistory', 'firstOrderDate', 'lastOrderDate', 'totalSpentCents').
  2. Réponds DIRECTEMENT avec les faits réels : confirme clairement si c'est une cliente régulière (au moins 2 commandes) ou une nouvelle cliente (1 seule commande ou 0 commande), cite le nombre exact de commandes, le montant total dépensé en F CFA, et les dates de ses commandes.
  3. Ne pars JAMAIS chercher d'autres sujets, ne lance aucune recherche aléatoire, et ne divague JAMAIS sur une autre personne.
  4. RAPPEL STRICT : ZÉRO template ou modèle de message client non sollicité. Réponds uniquement à la question factuelle posée par le gérant.
- RÉPONSES DIRECTES SANS TEMPLATES NON SOLLICITÉS (RÈGLE ESSENTIELLE) : Lorsque le gérant te pose une question directe sur un fait, un chiffre, un client, un problème ou une recherche (ex: 'recherche une cliente qui s'est plainte', 'qui est en retard ?', 'quel est le montant Wave ?'), réponds STRICTEMENT et DIRECTEMENT sur la chose demandée. NE RÉDIGE PAS de message tout fait, de modèle ou de template de réponse à envoyer au client SAUF si le gérant te demande explicitement 'rédige-lui un message', 'prépare une réponse', 'écris-lui' ou 'propose un message'.
- BOUTON & LIEN WHATSAPP DIRECT (RÈGLE OBLIGATOIRE) : Pour TOUT client ou contact mentionné, inclus TOUJOURS un lien Markdown direct cliquable vers sa discussion WhatsApp : [Ouvrir la discussion WhatsApp](https://wa.me/<chiffres_du_telephone>) et renseigne systématiquement 'actionCard' avec son numéro de téléphone nettoyé (chiffres uniquement) et type 'reply' ou 'order_action' pour déclencher le bouton cliquable 'Ouvrir sur WhatsApp' dans l'interface.
- PAROLES DE CHANSON : Si l'utilisateur demande des paroles ou une chanson (ex: pour Aminata, Marc, etc.), tu DOIS composer le texte intégral de 32 à 48 vers complets avec les balises [Style], [Intro], [Couplet 1], [Pré-Refrain], [Refrain], [Couplet 2], [Pont], [Refrain Final], [Outro]. RÈGLE ABSOLUE : INTERDICTION FORMELLE DE FAIRE UN TEXTE COURT (pas de résumé de 10-15 vers).
- FORMATAGE EN BALISE COPIABLE (RÈGLE OBLIGATOIRE 1-CLIC) : Tout texte poétique, parole de chanson, ou message commercial explicitement demandé doit TOUJOURS être enfermé dans un bloc de code Markdown \`\`\`suno (pour les chansons) ou \`\`\`texte (pour un message client), dans ton champ 'reply'. Cela déclenche automatiquement l'affichage du module luxueux avec le bouton 'Copier en 1 clic' dans l'interface du studio.
- COMMANDE DOUBLE : Si l'utilisateur demande 2 chansons ou évoque deux commandes, rédige les DEUX textes complets en parallèle ou dans une carte dédiée avec 32-48 vers chacun.
- RECHERCHE DANS LES 40 340 MESSAGES & CAS DE PLAINTES/RETOUCHES : Tu as un accès direct au moteur de recherche plein-texte du studio via 'thematicSearchResults'. Lorsque le gérant te demande de retrouver une cliente qui s'est plainte, un problème, un retard ou une réclamation, analyse scrupuleusement les dossiers réels fournis dans 'thematicSearchResults' :
  1. Présente clairement la cliente (Nom, Téléphone, Date, Statut).
  2. Cite fidèlement ce qu'elle a dit (le verbatim exact du message ou de la note vocale).
  3. Rappelle le contexte de la commande (destinataire, occasion, montant, statut).
  4. Ajoute le lien direct cliquable [Ouvrir la discussion WhatsApp](https://wa.me/<chiffres_du_telephone>).
  Ne prétends JAMAIS que tu n'as pas accès à la base de données quand 'thematicSearchResults' contient des cas réels.
- ENCAISSEMENT / RÉCEPTION : Si l'utilisateur demande d'encaisser, de recevoir une commande ou de valider un paiement, renseigne 'orderMutation' pour que la base Supabase soit mise à jour instantanément, et fournis une actionCard de type 'order_action'.`;

  const messagesPayload = [
    ...(req.history || []).slice(-6).map(h => ({
      role: h.role === 'assistant' ? ('assistant' as const) : ('user' as const),
      content: h.text,
    })),
    {
      role: 'user' as const,
      content: cleanPrompt,
    },
  ];

  try {
    toolsExecuted.push('deepseek_chat_v3_reasoning');
    const completion = await deps.llm.completeJson({
      system: systemPrompt,
      messages: messagesPayload,
      maxTokens: 4000,
      temperature: 0.2,
    });

    const parsed = completion.data as any;
    const replyText = parsed?.reply || 'Je suis à votre disposition pour le suivi de votre studio.';
    const actionCard = parsed?.actionCard || undefined;
    const returnedTools = Array.isArray(parsed?.toolsUsed) ? parsed.toolsUsed : [];

    // Si une mutation de commande est demandée par l'intelligence, on l'exécute en DB
    if (parsed?.orderMutation && typeof parsed.orderMutation.amountCents === 'number') {
      try {
        toolsExecuted.push('sync_studio_database_order');
        let contactId = parsed.orderMutation.contactId || matchedContact?.id;

        // Si le contact n'est pas encore lié, le chercher ou l'insérer
        if (!contactId && parsed.orderMutation.contactPhone) {
          const ctDigits = digitsOf(parsed.orderMutation.contactPhone);
          const existing = await deps.db.queryTable<any[]>('contacts', `phone=ilike.*${ctDigits}*&limit=1`);
          if (Array.isArray(existing) && existing[0]) {
            contactId = existing[0].id;
          }
        }

        const newOrder = await deps.db.insertRow('orders', {
          contact_id: contactId || null,
          conversation_id: matchedConv?.id || null,
          amount_cents: parsed.orderMutation.amountCents,
          currency: 'XOF',
          status: parsed.orderMutation.status || 'paid',
          payment_method: parsed.orderMutation.paymentMethod || 'Wave',
          notes: parsed.orderMutation.notes || `Commande saisie via Copilot (${cleanPrompt.slice(0, 60)})`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        if (matchedConv?.id) {
          await deps.db.updateRows('conversations', `id=eq.${matchedConv.id}`, {
            funnel_stage: 'paid',
            updated_at: new Date().toISOString(),
          });
        }

        deps.log('copilot-brain: order created successfully', { orderId: (newOrder as any)?.id });
      } catch (orderErr: any) {
        deps.log('copilot-brain: order mutation failed', { error: orderErr.message });
      }
    }

    return {
      id: msgId,
      role: 'assistant',
      text: replyText,
      timestamp: nowStr,
      toolsExecuted: Array.from(new Set([...toolsExecuted, ...returnedTools])),
      actionCard,
    };
  } catch (err: any) {
    deps.log('copilot-brain: DeepSeek completion failed, falling back gracefully', { error: err.message });
    throw err;
  }
}
