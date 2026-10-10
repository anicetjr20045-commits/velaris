/**
 * Réaction 🎵 du gérant sur un texte : les paroles sont enregistrées sur la
 * commande, la voix et le style extraits sont mis en avant dans la conversation.
 */
import type { Scenario } from './types.js';
import { U, S, V, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'musical-chanson',
  title: "🎵 : le texte part en chanson, voix/style mis en avant",
  llm: scripted({
    understand: [U('order_song', { recipient_name: { value: 'Awa' } })],
    sales: [S(["C'est bien noté pour Awa."])],
    other: () => V('voix douce et chaleureuse', 'afro-pop moderne'),
  }),
  steps: [
    { client: "Bonjour, une chanson pour Awa" },
    { pump: true },
    {
      exec: async (db, ctx) => {
        await db.exec(
          `UPDATE conversations SET focus_order_id = (
             SELECT id FROM orders WHERE conversation_id = '${ctx.convId}' ORDER BY created_at DESC LIMIT 1
           ) WHERE id = '${ctx.convId}'`,
        );
      },
    },
    { merchant: 'Paroles validées : au clair de la lune, mon ami Pierrot' },
    { pump: true },
    { react: { emoji: '🎵', on: 'last_merchant' } },
    { pump: true },
    {
      expect: [
        { lyricsHave: 'au clair de la lune' },
        { aiSaid: ['production', 'Voix :'] },
      ],
    },
  ],
};
