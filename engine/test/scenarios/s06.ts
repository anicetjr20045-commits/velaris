/**
 * Brief complet → vocal de procédure → le client acquiesce → les offres sont
 * présentées, et le vocal N'EST PAS renvoyé (garde anti-doublon).
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'vocal-non-renvoye',
  title: "Vocal envoyé une seule fois, offres après acquiescement",
  llm: scripted({
    understand: [
      U('order_song', {
        occasion: { value: 'anniversaire' },
        recipient_name: { value: 'Awa' },
      }),
      U('give_brief_info', {
        sender_name: { value: 'Ibrahim' },
        memories: [{ value: "dites-lui qu'on l'aime fort" }],
      }),
      U('acknowledgement'),
    ],
    sales: [
      S(["C'est bien noté pour Awa. C'est de la part de qui, et y a-t-il un message particulier ?"]),
      S(["C'est bien noté."], { procedure_voice: true }),
      S(['Parfait.']),
    ],
  }),
  steps: [
    { client: "Bonjour, chanson pour l'anniversaire de Awa" },
    { pump: true },
    { client: "C'est de la part d'Ibrahim, dites-lui qu'on l'aime fort" },
    { pump: true },
    { expect: { voiceNotes: 1 } },
    {
      // le sender a livré le vocal sur WhatsApp (sans ça, le client ne pourrait pas acquiescer)
      exec: async (db) => {
        await db.exec(
          `UPDATE outbound_messages SET status = 'sent', sent_at = now(), sending_at = now()
            WHERE purpose = 'procedure_voice' AND status = 'pending'`,
        );
      },
    },
    { client: "D'accord" },
    { pump: true },
    { expect: [{ aiSaid: 'Découverte à 1 200 F' }, { voiceNotes: 1 }] },
  ],
};
