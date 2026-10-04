/**
 * Extraction stricte d'un objet JSON depuis la sortie d'un modèle.
 *
 * Piège historique (DeepSeek reasoner / R1) : des blocs « <think>…</think> » ou un champ
 * reasoning_content mêlés à la réponse faisaient échouer le parsing ou fuitaient vers le client.
 * Avec deepseek-chat en mode JSON, la sortie doit déjà être un objet pur ; ce garde-fou reste
 * en place par défense en profondeur et ne « répare » jamais un JSON invalide.
 */

import { LlmError } from './provider.js';

const THINK_BLOCK = /<think>[\s\S]*?<\/think>/gi;
const FENCE = /^```(?:json)?\s*([\s\S]*?)\s*```$/i;

export interface GuardedJson {
  data: Record<string, unknown>;
  strippedThinking: boolean;
}

export function parseStrictJsonObject(content: string | null | undefined): GuardedJson {
  if (content === null || content === undefined) throw new LlmError('invalid_output', 'contenu vide', true);
  let text = content.trim();
  const before = text;
  text = text.replace(THINK_BLOCK, '').trim();
  const strippedThinking = text !== before;
  if (/<\/?think>/i.test(text)) throw new LlmError('invalid_output', 'balise <think> non fermée', true);

  const fenced = FENCE.exec(text);
  if (fenced && fenced[1]) {
    text = fenced[1].trim();
  } else {
    const jsonFenceMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/i);
    if (jsonFenceMatch && jsonFenceMatch[1]) {
      text = jsonFenceMatch[1].trim();
    } else {
      const firstBrace = text.indexOf('{');
      const lastBrace = text.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        text = text.slice(firstBrace, lastBrace + 1).trim();
      }
    }
  }

  if (!text) throw new LlmError('invalid_output', 'contenu vide', true);
  if (!text.startsWith('{') || !text.endsWith('}')) {
    throw new LlmError('invalid_output', 'la sortie n\'est pas un objet JSON seul', true);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    throw new LlmError('invalid_output', `JSON invalide : ${(err as Error).message}`, true);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new LlmError('invalid_output', 'la sortie JSON n\'est pas un objet', true);
  }
  return { data: parsed as Record<string, unknown>, strippedThinking };
}
