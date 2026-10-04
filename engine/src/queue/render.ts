/**
 * Rendu des messages sortants (§ 12 et § 13) :
 *  - Gabarits déterministes (DEFAULT_TEMPLATES + surcharges studio_templates)
 *  - Vocaux préenregistrés du gérant (studio_assets)
 *  - Rédaction par le modèle (canal ai_text) validée par les garde-fous G1-G18
 *  - Repli systématique sur le gabarit en cas d'échec ou d'indisponibilité du LLM.
 */

import { managerBackPhrase, type Hours } from '../domain/clock.js';
import type { OutputItem } from '../domain/step-policy.js';
import {
  type CatalogueItem,
  type OrderRef,
  type OrderSnapshot,
  type ReplyGoal,
  type Step,
  type Utterance,
} from '../domain/types.js';
import { checkGenerated, type GuardContext, type GuardViolation } from '../guards/index.js';
import type { LlmProvider } from '../llm/provider.js';
import { DEFAULT_TEMPLATES, FIELD_QUESTIONS, fillTemplate } from '../output/templates.js';

export interface PaymentMethodConfig {
  provider: string;
  number: string;
  holder: string;
  country?: string;
}

export interface AssetSnapshot {
  id: string;
  kind: 'voice' | 'sample_audio' | 'sample_video' | 'image';
  purpose: string;
  occasion?: string | null;
  storagePath: string;
  caption?: string | null;
}

export interface RenderContext {
  studioName: string;
  agentName: string;
  managerFirstName: string;
  clientFirstName: string | null;
  tone: 'chaleureux' | 'sobre' | 'enjoue';
  formalAddress: boolean;
  emojiPolicy: 'none' | 'sparing';
  orders: readonly OrderSnapshot[];
  catalogue: readonly CatalogueItem[];
  paymentMethods: readonly PaymentMethodConfig[];
  templates: Readonly<Record<string, string>>;
  assets: readonly AssetSnapshot[];
  managerHours: Hours;
  timezone: string;
  nowMs: number;
  managerAvailable: boolean;
  sensitiveTopic?: string;
  storyElements?: readonly string[];
  recentMessages?: readonly { who: 'client' | 'studio' | 'gérant'; text: string }[];
  recentAgentBodies?: readonly string[];
  llmProvider?: LlmProvider;
}

export interface RenderedMessage {
  kind: 'text' | 'voice' | 'file' | 'image' | 'video';
  purpose: string;
  body?: string;
  mediaPath?: string;
  caption?: string;
  orderId?: string | null;
  isRelay: boolean;
  guardViolations?: GuardViolation[];
}

export interface RenderResult {
  messages: RenderedMessage[];
  usedAiText: boolean;
  notes: string[];
}

function formatAmount(n: number): string {
  return n.toLocaleString('fr-FR').replace(/\s/g, ' ');
}

export function buildTemplateVars(
  u: Utterance,
  ctx: RenderContext,
  targetOrder: OrderSnapshot | null,
): Record<string, string> {
  const vars: Record<string, string> = {
    studio_name: ctx.studioName,
    agent_name: ctx.agentName,
    manager: ctx.managerFirstName,
    client_first_name: ctx.clientFirstName ?? '',
    client_first_name_sp: ctx.clientFirstName ? ` ${ctx.clientFirstName}` : '',
    recipient: targetOrder?.recipientName ?? 'votre proche',
    for_recipient_sp: targetOrder?.recipientName ? ` pour ${targetOrder.recipientName}` : '',
    occasion: targetOrder?.occasion ?? 'votre événement',
    lyrics: targetOrder?.lyrics ?? '',
    offer_label: '',
    price: '',
    total: '',
    orders_list: '',
    payment_lines: '',
    holder: ctx.paymentMethods[0]?.holder ?? ctx.managerFirstName,
    eta_phrase: 'dans quelques minutes',
    eta_sp: '',
    manager_back_phrase: managerBackPhrase(ctx.managerHours, ctx.timezone, ctx.nowMs),
    field_question: '',
    field_question_sp: '',
    forward_question: 'Pour commencer, c\'est pour quelle occasion ?',
    offers_list: '',
    trust_policy: 'Le paiement intervient après la lecture des paroles. ',
    trust_sample: '',
    candidates: '',
  };

  // Catalogue
  if (ctx.catalogue.length > 0) {
    vars.offers_list = ctx.catalogue
      .map((c) => `- Formule ${c.label} : ${formatAmount(c.priceXof)} F CFA`)
      .join('\n');
  }

  // Target order offer & price
  if (targetOrder?.catalogueCode) {
    const item = ctx.catalogue.find((c) => c.code === targetOrder.catalogueCode);
    if (item) {
      vars.offer_label = item.label;
      vars.price = formatAmount(targetOrder.priceXof ?? item.priceXof);
    }
  }

  // Unpaid orders & total
  const unpaid = ctx.orders.filter((o) => o.paymentStatus !== 'confirmed' && o.stage !== 'cancelled' && o.stage !== 'closed');
  if (unpaid.length > 0) {
    const totalAmount = unpaid.reduce((sum, o) => {
      const price = o.priceXof ?? ctx.catalogue.find((c) => c.code === o.catalogueCode)?.priceXof ?? 0;
      return sum + price;
    }, 0);
    vars.total = formatAmount(totalAmount);
    vars.orders_list = unpaid
      .map((o) => {
        const cat = ctx.catalogue.find((c) => c.code === o.catalogueCode);
        const name = o.recipientName ?? 'votre chanson';
        const price = o.priceXof ?? cat?.priceXof ?? 0;
        return `la chanson pour ${name} (${formatAmount(price)} F CFA)`;
      })
      .join(' et ');
  } else {
    vars.total = vars.price || '3 000';
    vars.orders_list = 'votre chanson';
  }

  // Payment lines
  if (ctx.paymentMethods.length > 0) {
    vars.payment_lines = ctx.paymentMethods
      .map((p) => {
        const op = p.provider.replace(/_/g, ' ').toUpperCase();
        return `• ${op} : ${p.number} (au nom de ${p.holder})`;
      })
      .join('\n');
  } else {
    vars.payment_lines = `• Mobile Money : contactez ${ctx.managerFirstName}`;
  }

  // Field question
  if (u.asks) {
    if (u.asks === 'confirm') {
      vars.field_question = `Pour bien chanter son prénom : c'est bien ${vars.recipient} ?`;
    } else if (u.asks === 'validate') {
      vars.field_question = 'On garde ce texte tel quel ?';
    } else if (u.asks === 'which_order') {
      vars.field_question = 'C\'est pour quelle chanson ?';
    } else {
      vars.field_question = FIELD_QUESTIONS[u.asks] ?? '';
    }
    vars.field_question_sp = vars.field_question ? ` ${vars.field_question}` : '';
  }

  // Facts extraction for eta or specifics
  for (const f of u.facts) {
    if (f.key === 'eta_phrase' && typeof f.value === 'string') {
      vars.eta_phrase = f.value;
      vars.eta_sp = ` ${f.value}`;
    }
    if (f.key === 'candidates' && typeof f.value === 'string') {
      vars.candidates = f.value;
    }
  }

  // Sample availability for trust
  const hasSample = ctx.assets.some((a) => a.kind === 'sample_audio');
  if (hasSample) {
    vars.trust_sample = '\nUn exemple audio est disponible si vous souhaitez écouter.';
  }

  return vars;
}

function resolveTargetOrderId(ref: OrderRef | null, orders: readonly OrderSnapshot[]): string | null {
  if (!ref) return null;
  if (ref.kind === 'existing') return ref.id;
  return orders[0]?.id ?? null;
}

function selectTemplate(goal: ReplyGoal, step: Step, customKey: string | undefined, templates: Readonly<Record<string, string>>, managerAvailable: boolean): string {
  // If offhours variant exists and manager is not available
  if (!managerAvailable) {
    const offKey = `${goal}.offhours`;
    if (templates[offKey]) return templates[offKey]!;
    if (DEFAULT_TEMPLATES[offKey]) return DEFAULT_TEMPLATES[offKey]!;
    const offStepKey = `${step}.offhours`;
    if (templates[offStepKey]) return templates[offStepKey]!;
    if (DEFAULT_TEMPLATES[offStepKey]) return DEFAULT_TEMPLATES[offStepKey]!;
  }

  // Specific custom key
  if (customKey && templates[customKey]) return templates[customKey]!;
  if (customKey && DEFAULT_TEMPLATES[customKey]) return DEFAULT_TEMPLATES[customKey]!;

  // Match by goal
  if (templates[goal]) return templates[goal]!;
  if (DEFAULT_TEMPLATES[goal]) return DEFAULT_TEMPLATES[goal]!;

  // Match by step
  if (templates[step]) return templates[step]!;
  if (DEFAULT_TEMPLATES[step]) return DEFAULT_TEMPLATES[step]!;

  // Fallback to welcome
  return DEFAULT_TEMPLATES.welcome!;
}

function buildAiPrompt(u: Utterance, ctx: RenderContext, targetOrder: OrderSnapshot | null): string {
  const vars = buildTemplateVars(u, ctx, targetOrder);
  const recent = ctx.recentMessages?.slice(-6).map((m) => `${m.who} : ${m.text}`).join('\n') || '';
  const factsLines = u.facts.map((f) => `- ${f.key}: ${String(f.value)}`).join('\n');

  return `Tu rédiges la réponse WhatsApp au nom de ${ctx.agentName}, assistant de ${ctx.managerFirstName} au studio ${ctx.studioName}.
Ton interlocuteur est un client en Afrique de l'Ouest.
Consignes strictes :
- Ton : ${ctx.tone}, simple, poli, ${ctx.formalAddress ? 'vouvoiement obligatoire' : 'tutoiement'}.
- Style : ${ctx.emojiPolicy === 'none' ? 'AUCUN emoji' : 'au maximum 1 emoji'}.
- Structure : 1 ou 2 bulles courtes (au maximum 320 caractères par bulle).
- Questions : Au maximum 1 seule question, obligatoirement placée tout à la fin.
- Vérité : N'invente aucun prix, aucun délai, aucun compte de paiement non présent dans les faits.
- Objectif de ce tour : ${u.goal}
- Question à poser si applicable : ${vars.field_question || 'aucune'}
${vars.field_question ? `Pose impérativement cette question : « ${vars.field_question} »` : ''}

Faits vérifiés pour ce message :
${factsLines || '(aucun fait particulier)'}

Derniers messages échangés :
${recent}

Réponds obligatoirement avec un objet JSON :
{"bubbles": ["première bulle...", "deuxième bulle facultative..."]}`;
}

export function mapStepToPurpose(step: Step): string {
  switch (step) {
    case 'procedure': return 'procedure_voice';
    case 'sample': return 'sample';
    case 'lyrics_delivery': return 'lyrics';
    case 'delivery': return 'song';
    case 'video_photos': return 'video';
    case 'identity': return 'identity';
    case 'handoff_ack': return 'handoff_ack';
    case 'stop_ack': return 'stop_ack';
    case 'payment': return 'payment_instructions';
    case 'payment_ack': return 'payment_claim_ack';
    case 'lyrics_wait':
    case 'production': return 'status_eta';
    case 'offers': return 'offers_voice';
    default: return 'reply';
  }
}

export async function renderOutputItem(
  item: OutputItem,
  ctx: RenderContext,
): Promise<RenderResult> {
  const { utterance, resolved } = item;
  const notes: string[] = [];
  const targetId = resolveTargetOrderId(utterance.order, ctx.orders);
  const targetOrder = ctx.orders.find((o) => o.id === targetId) ?? ctx.orders[0] ?? null;
  const purpose = mapStepToPurpose(utterance.step);

  // 1. Silent
  if (resolved.channel === 'silent') {
    return { messages: [], usedAiText: false, notes: ['channel silent'] };
  }

  // 2. Voice alone
  if (resolved.channel === 'voice') {
    const asset = ctx.assets.find(
      (a) => a.id === resolved.assetId || (a.kind === 'voice' && a.purpose === utterance.step),
    );
    if (asset) {
      const msg: RenderedMessage = {
        kind: 'voice',
        purpose,
        mediaPath: asset.storagePath,
        orderId: targetId,
        isRelay: utterance.relay,
      };
      if (asset.caption) msg.caption = asset.caption;
      return {
        messages: [msg],
        usedAiText: false,
        notes: [`voice asset ${asset.id}`],
      };
    }
    // Fallback to template if voice asset not found
    notes.push('voice asset not found -> fallback template');
  }

  // 3. Voice then template
  if (resolved.channel === 'voice_then_template') {
    const asset = ctx.assets.find(
      (a) => a.id === resolved.assetId || (a.kind === 'voice' && a.purpose === utterance.step),
    );
    const templateText = selectTemplate(utterance.goal, utterance.step, resolved.templateKey, ctx.templates, ctx.managerAvailable);
    const vars = buildTemplateVars(utterance, ctx, targetOrder);
    const textBody = fillTemplate(templateText, vars);

    const msgs: RenderedMessage[] = [];
    if (asset) {
      const voicePurpose = utterance.step === 'procedure' ? 'procedure_voice' : 'offers_voice';
      const voiceMsg: RenderedMessage = {
        kind: 'voice',
        purpose: voicePurpose,
        mediaPath: asset.storagePath,
        orderId: targetId,
        isRelay: utterance.relay,
      };
      if (asset.caption) voiceMsg.caption = asset.caption;
      msgs.push(voiceMsg);
    }
    msgs.push({
      kind: 'text',
      purpose,
      body: textBody,
      orderId: targetId,
      isRelay: utterance.relay,
    });
    return { messages: msgs, usedAiText: false, notes };
  }

  // 4. AI text
  if (resolved.channel === 'ai_text' && ctx.llmProvider && !utterance.relay) {
    try {
      const prompt = buildAiPrompt(utterance, ctx, targetOrder);
      const res = await ctx.llmProvider.completeJson({
        system: `Tu es un rédacteur pour le service WhatsApp d'un studio musical. Réponds uniquement par l'objet JSON {"bubbles": ["..."]}.`,
        messages: [{ role: 'user', content: prompt }],
        maxTokens: 400,
        temperature: 0.2,
      });

      const rawBubbles = Array.isArray(res.data?.bubbles)
        ? res.data.bubbles.filter((b): b is string => typeof b === 'string' && b.trim().length > 0)
        : [];

      if (rawBubbles.length > 0) {
        // Run guard checks
        const allowedAmounts = [
          ...ctx.catalogue.map((c) => c.priceXof),
          ...ctx.orders.map((o) => o.priceXof).filter((p): p is number => typeof p === 'number'),
        ];
        const lyricsSent = targetOrder !== null && targetOrder.stage !== 'collecting_brief' && targetOrder.stage !== 'brief_complete' && targetOrder.stage !== 'lyrics_in_progress';
        const guardCtx: GuardContext = {
          allowedAmountsXof: allowedAmounts,
          allowedTimePhrases: ['minutes', 'demain', 'ce matin', 'cet après-midi', 'ce soir', 'dans environ', 'vers'],
          formalAddress: ctx.formalAddress,
          emojiPolicy: ctx.emojiPolicy,
          sensitiveTopic: ctx.sensitiveTopic ?? 'none',
          goal: utterance.goal,
          storyElements: ctx.storyElements ?? [],
          facts: {
            paymentConfirmed: targetOrder?.paymentStatus === 'confirmed',
            songDelivered: targetOrder?.stage === 'delivered',
            lyricsSent,
            inProduction: targetOrder?.stage === 'in_production',
            procedureVoiceSent: false,
          },
          recentAgentBodies: ctx.recentAgentBodies ?? [],
        };

        const violations = checkGenerated(rawBubbles, guardCtx);
        if (violations.length === 0) {
          return {
            messages: rawBubbles.map((b) => ({
              kind: 'text',
              purpose,
              body: b.trim(),
              orderId: targetId,
              isRelay: utterance.relay,
            })),
            usedAiText: true,
            notes: ['ai_text generated and passed all guards'],
          };
        }
        notes.push(`ai_text guards failed: ${violations.map((v) => `${v.id}:${v.detail}`).join(', ')} -> fallback template`);
      } else {
        notes.push('ai_text returned empty bubbles -> fallback template');
      }
    } catch (err) {
      notes.push(`ai_text error (${(err as Error).message}) -> fallback template`);
    }
  }

  // 5. Template (default & fallback)
  const templateStr = selectTemplate(utterance.goal, utterance.step, resolved.templateKey, ctx.templates, ctx.managerAvailable);
  const vars = buildTemplateVars(utterance, ctx, targetOrder);
  const filled = fillTemplate(templateStr, vars);

  return {
    messages: [
      {
        kind: 'text',
        purpose,
        body: filled,
        orderId: targetId,
        isRelay: utterance.relay,
      },
    ],
    usedAiText: false,
    notes,
  };
}
