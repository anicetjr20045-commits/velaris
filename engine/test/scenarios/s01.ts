/** Le client demande le prix avant tout : réponse prix, puis le brief continue. */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'prix-dabord',
  title: "Le client demande le prix avant tout",
  llm: scripted({
    understand: [
      U('ask_price'),
      U('give_brief_info', { occasion: { value: 'anniversaire' } }),
    ],
    sales: [
      S(["Nos formules : Découverte à 1 200 F CFA, Prestige à 3 000 F CFA. C'est pour quelle occasion, votre chanson ?"]),
      S(["C'est bien noté pour l'anniversaire. Quel est le prénom de la personne à célébrer ?"]),
    ],
  }),
  steps: [
    { client: "Bonjour, c'est combien ?" },
    { pump: true },
    { expect: { aiSaid: ['1 200', 'occasion'] } },
    { client: "C'est pour un anniversaire" },
    { pump: true },
    { expect: { aiSaid: 'prénom', orderStage: 'collecting_brief' } },
  ],
};
