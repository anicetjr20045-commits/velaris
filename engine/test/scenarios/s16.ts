/**
 * Brief séquentiel complet : le preneur de brief pose les 4 champs dans l'ordre
 * de la vraie procédure (occasion → prénom → confirmation → expéditeur →
 * message → offre), sans jamais reposer une question répondue.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'brief-sequentiel-4-champs',
  title: 'Brief séquentiel : les 4 champs dans l\u2019ordre, puis vocal',
  llm: scripted({
    understand: [
      U('order_song'),
      U('give_brief_info', { occasion: { value: 'anniversaire' } }),
      U('give_brief_info', { recipient_name: { value: 'Awa' } }),
      U('confirm_yes'),
      U('give_brief_info', { sender_name: { value: 'Ibrahim' } }),
      U('give_brief_info', { memories: [{ value: "dites-lui qu'on l'aime fort" }] }),
      U('choose_offer', { offer_code: { value: 'decouverte', quote: 'Découverte' } }),
    ],
    sales: [
      S(["Avec plaisir ! C'est pour quelle occasion ?"]),
      S(["C'est noté pour l'anniversaire. Quel est le prénom de la personne ?"]),
      S(["Pour bien chanter son prénom : c'est bien Awa ?"]),
      S(['Très bien. De la part de qui sera la chanson ?']),
      S(['Y a-t-il un message particulier à transmettre à travers la chanson ?']),
      S(['Voici nos formules : Découverte à 1 200 F, Prestige à 3 000 F. Laquelle vous intéresse ?']),
      S(['Parfait, je lance votre commande.']),
    ],
  }),
  steps: [
    { client: 'Bonjour, je veux une chanson' },
    { pump: true },
    { expect: { traceHas: 'brief: next slot occasion' } },
    { client: "C'est pour un anniversaire" },
    { pump: true },
    { expect: { traceHas: 'brief: next slot recipient_name' } },
    { client: 'Awa' },
    { pump: true },
    { expect: { traceHas: 'brief: next slot confirm_recipient_name' } },
    { client: 'Oui' },
    { pump: true },
    { expect: { traceHas: 'brief: next slot sender_name' } },
    { client: 'De ma part, Ibrahim' },
    { pump: true },
    { expect: { traceHas: 'brief: next slot memories' } },
    { client: "Dites-lui qu'on l'aime fort" },
    { pump: true },
    { expect: { traceHas: 'brief: next slot offer' } },
    { client: 'Je prends la Découverte' },
    { pump: true },
    { expect: [{ traceHas: 'brief complete → procedure voice alone' }, { voiceNotes: 1 }] },
  ],
};
