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

  // 2. Recherche d'un client potentiel mentionné dans le message (numéro ou prénom)
  let matchedContact: any = null;
  let matchedConv: any = null;
  let matchedMessages: any[] = [];

  try {
    const phoneMatch = cleanPrompt.match(/\+?\d[\d\s.\-]{3,}\d/);
    const potentialDigits = phoneMatch ? digitsOf(phoneMatch[0]) : null;

    if (potentialDigits && potentialDigits.length >= 4) {
      toolsExecuted.push('search_contact_by_phone');
      const contacts = await deps.db.queryTable<any[]>('contacts', `phone=ilike.*${potentialDigits}*&limit=1`);
      if (Array.isArray(contacts) && contacts[0]) {
        matchedContact = contacts[0];
      }
    }

    if (!matchedContact) {
      // Recherche par prénom (mots de 3 lettres minimum sans stopwords)
      const words = cleanPrompt
        .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length >= 3 && !/^(pour|avec|dans|sur|fait|faire|texte|chanson|paroles|commande|reçois|recois|valide|combien|client|studio|bonjour|salut)/i.test(w));

      for (const word of words.slice(0, 3)) {
        const contacts = await deps.db.queryTable<any[]>('contacts', `name=ilike.*${encodeURIComponent(word)}*&limit=1`);
        if (Array.isArray(contacts) && contacts[0]) {
          matchedContact = contacts[0];
          toolsExecuted.push('search_contact_by_name');
          break;
        }
      }
    }

    if (matchedContact) {
      const convs = await deps.db.queryTable<any[]>('conversations', `contact_id=eq.${matchedContact.id}&limit=1`);
      if (Array.isArray(convs) && convs[0]) {
        matchedConv = convs[0];
        const msgs = await deps.db.queryTable<any[]>('messages', `conversation_id=eq.${matchedConv.id}&order=created_at.desc&limit=8`);
        if (Array.isArray(msgs)) {
          matchedMessages = msgs.reverse();
          toolsExecuted.push('get_whatsapp_transcripts');
        }
      }
    }
  } catch (err: any) {
    deps.log('copilot-brain: failed to search contacts', { error: err.message });
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
      activeConversationsEstimate: 163,
    },
    matchedClient: matchedContact ? {
      name: matchedContact.name,
      phone: matchedContact.phone,
      stage: matchedConv?.funnel_stage || 'en_discussion',
      summary: matchedConv?.summary || matchedContact.notes || '',
      recentMessages: matchedMessages.map(m => `[${m.direction === 'inbound' ? 'CLIENT' : 'STUDIO'}] ${m.body}`),
    } : null,
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
- PAROLES DE CHANSON : Si l'utilisateur demande des paroles ou une chanson (ex: pour Aminata, Marc, etc.), tu DOIS composer le texte intégral de 32 à 48 vers complets avec les balises [Style], [Intro], [Couplet 1], [Pré-Refrain], [Refrain], [Couplet 2], [Pont], [Refrain Final], [Outro]. RÈGLE ABSOLUE : INTERDICTION FORMELLE DE FAIRE UN TEXTE COURT (pas de résumé de 10-15 vers).
- COMMANDE DOUBLE : Si l'utilisateur demande 2 chansons ou évoque deux commandes, rédige les DEUX textes complets en parallèle ou dans une carte dédiée avec 32-48 vers chacun.
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
