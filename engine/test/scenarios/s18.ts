/**
 * Le client fournit directement son texte : le preneur de brief ne repose
 * AUCUNE question (occasion, prénom, expéditeur, message) — le texte contient
 * déjà tout. Seul le choix d'offre reste.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'paroles-propres-sans-brief',
  title: 'Paroles du client → aucune question de brief reposée',
  llm: scripted({
    understand: [
      U('provides_own_lyrics', {
        own_lyrics: { value: "Joyeux anniversaire Awa, de la part d'Ibrahim, on t'aime fort" },
      }),
      U('acknowledgement'),
    ],
    sales: [
      S(["C'est bien noté, nous avons bien reçu votre texte. On le garde tel quel ou on l'adapte légèrement ?"]),
      S(['Très bien.']),
    ],
  }),
  steps: [
    { client: "Voici mon texte : Joyeux anniversaire Awa, de la part d'Ibrahim, on t'aime fort" },
    { pump: true },
    { expect: { aiSaid: 'bien reçu votre texte' } },
    { client: 'Gardez-le tel quel' },
    { pump: true },
    {
      expect: [
        // Le brief est sauté : la seule chose demandée est l'offre.
        { traceHas: 'brief: next slot offer' },
        { aiSaid: 'Très bien.' },
      ],
    },
  ],
};
