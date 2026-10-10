/** Le client donne occasion + prénom en vrac : pas de question reposée. */
import assert from 'node:assert/strict';
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'vrac-sans-repetition',
  title: "Occasion et prénom en vrac, sans répétition",
  llm: scripted({
    understand: [
      U('order_song', {
        occasion: { value: 'anniversaire' },
        recipient_name: { value: 'Awa' },
        recipient_relation: { value: 'femme' },
      }),
    ],
    sales: [S(["C'est bien noté pour Awa. C'est prévu pour quelle date ?"])],
  }),
  steps: [
    { client: "Bonjour, je veux une chanson pour l'anniversaire de ma femme Awa" },
    { pump: true },
    { expect: { aiSaid: 'date' } },
    {
      exec: async (db, ctx) => {
        const r = await db.query<{ recipient_name: string }>(
          `SELECT recipient_name FROM orders WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
          [ctx.convId],
        );
        assert.equal(r.rows[0]?.recipient_name, 'Awa', 'le prénom a été retenu du message en vrac');
      },
    },
  ],
};
