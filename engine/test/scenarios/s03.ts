/** Rafale de 4 messages : un seul tour, une seule réponse cohérente. */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'rafale',
  title: "Rafale de 4 messages regroupés en un seul tour",
  llm: scripted({
    understand: [U('order_song', { recipient_name: { value: 'Awa' } })],
    sales: [S(["C'est bien noté pour Awa. C'est pour quelle occasion ?"])],
  }),
  steps: [
    { client: ['Bonjour', 'je veux une chanson', "pour ma femme", "elle s'appelle Awa"] },
    { pump: true },
    { expect: [{ batched: 4 }, { aiSaid: 'occasion' }] },
  ],
};
