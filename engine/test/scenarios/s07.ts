/**
 * Choix de formule : l'IA annonce le texte sous 15 minutes puis passe le
 * relais au gérant (contrôle humain). Elle ne gère pas la suite.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'choix-formule-relais',
  title: "Choix de formule → annonce 15 min → relais gérant",
  llm: scripted({
    understand: [
      U('order_song', {
        occasion: { value: 'anniversaire' },
        recipient_name: { value: 'Awa' },
      }),
      U('give_brief_info', {
        sender_name: { value: 'Ibrahim' },
        memories: [{ value: "on l'aime fort" }],
      }),
      U('acknowledgement'),
      U('choose_offer', { offer_code: { value: 'decouverte', quote: 'Découverte' } }),
    ],
    sales: [
      S(['C’est noté.']),
      S(["C'est bien noté."], { procedure_voice: true }),
      S(['Parfait.']),
      S(
        ["C'est bien noté pour la Formule Découverte ! Votre texte vous sera envoyé ici dans un délai de 15 minutes maximum."],
        { formula_chosen: true, chosen_formula: 'decouverte' },
      ),
    ],
  }),
  steps: [
    { client: "Bonjour, chanson pour l'anniversaire de Awa" },
    { pump: true },
    { client: "De la part d'Ibrahim, dites-lui qu'on l'aime fort" },
    { pump: true },
    {
      exec: async (db) => {
        await db.exec(
          `UPDATE outbound_messages SET status = 'sent', sent_at = now(), sending_at = now()
            WHERE purpose = 'procedure_voice' AND status = 'pending'`,
        );
      },
    },
    { client: "D'accord" },
    { pump: true },
    { expect: { aiSaid: 'Découverte' } },
    { client: 'Je prends la Découverte' },
    { pump: true },
    { expect: [{ aiSaid: '15 minutes' }, { control: 'human' }] },
  ],
};
