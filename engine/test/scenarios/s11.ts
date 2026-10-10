/**
 * Réaction 🎉 du gérant sur la chanson envoyée : la commande passe en
 * `delivered`, même depuis l'étape `audio_delivered` (transition ajoutée).
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'tada-livraison',
  title: "🎉 : la livraison de la chanson est enregistrée",
  llm: scripted({
    understand: [U('greeting')],
    sales: [S(['Bonjour !'])],
  }),
  steps: [
    { client: 'Bonjour' },
    { pump: true },
    {
      exec: async (db, ctx) => {
        const o = await db.query<{ id: string }>(`SELECT agent_open_order($1) AS id`, [ctx.convId]);
        const oid = o.rows[0]!.id;
        await db.exec(
          `UPDATE orders SET stage = 'audio_delivered', deliverable = 'audio' WHERE id = '${oid}'`,
        );
        await db.exec(
          `UPDATE conversations SET focus_order_id = '${oid}' WHERE id = '${ctx.convId}'`,
        );
      },
    },
    { merchant: '[le gérant envoie la chanson audio]' },
    { pump: true },
    { react: { emoji: '🎉', on: 'last_merchant' } },
    { pump: true },
    { expect: [{ orderStage: 'delivered' }, { traceHas: 'delivery transition -> ok' }] },
  ],
};
