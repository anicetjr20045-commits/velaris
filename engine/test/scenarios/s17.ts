/**
 * Brief en vrac : le client donne les 4 champs en un seul message.
 * Le preneur de brief remplit tout d'un coup, ne repose RIEN,
 * et enchaîne directement sur le choix d'offre.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'brief-vrac-complet',
  title: 'Brief donné en vrac : tout rempli, aucune question reposée',
  llm: scripted({
    understand: [
      U('order_song', {
        occasion: { value: 'anniversaire' },
        recipient_name: { value: 'Awa' },
        sender_name: { value: 'Ibrahim' },
        memories: [{ value: "dites-lui qu'on l'aime très fort" }],
      }),
      U('confirm_yes'),
      U('choose_offer', { offer_code: { value: 'decouverte', quote: 'Découverte' } }),
    ],
    sales: [
      S(["C'est bien noté. Pour bien chanter son prénom : c'est bien Awa ?"]),
      S(['Parfait. Voici nos formules : Découverte à 1 200 F, Prestige à 3 000 F. Laquelle vous intéresse ?']),
      S(['Très bien, je lance votre commande.']),
    ],
  }),
  steps: [
    { client: "Bonjour, chanson pour l'anniversaire de ma femme Awa, de ma part Ibrahim, dites-lui qu'on l'aime très fort" },
    { pump: true },
    {
      // Un seul champ reste à valider : la confirmation du prénom sacré.
      // Occasion, expéditeur et message ne sont JAMAIS redemandés.
      expect: { traceHas: 'brief: next slot confirm_recipient_name' },
    },
    { client: 'Oui' },
    { pump: true },
    { expect: { traceHas: 'brief: next slot offer' } },
    { client: 'La Découverte' },
    { pump: true },
    { expect: [{ traceHas: 'brief complete → procedure voice alone' }, { voiceNotes: 1 }] },
  ],
};
