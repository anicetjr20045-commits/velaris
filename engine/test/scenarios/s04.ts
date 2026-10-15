/**
 * Échange spontané en plein brief : le sales brain garde le fil sans recadrage
 * brutal et sans transformer la conversation en interrogatoire.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'hors-sujet',
  title: "Digression en plein brief → transition douce, sans pression",
  llm: scripted({
    understand: [
      U('give_brief_info', { occasion: { value: 'mariage' } }),
      U('off_topic', {}, 0.9),
    ],
    sales: [
      S(["C'est bien noté pour le mariage. Quel est le prénom du marié ?"]),
      S(["Je n'ai pas suivi le match, mais on pourra reprendre tranquillement les détails de la chanson de mariage de votre frère quand vous serez prêt."]),
    ],
  }),
  steps: [
    { client: "C'est pour le mariage de mon frère" },
    { pump: true },
    { expect: { aiSaid: 'prénom' } },
    { client: 'Au fait vous avez vu le match hier soir ?' },
    { pump: true },
    {
      expect: [
        { llmSaw: { kind: 'sales', contains: 'Fais ensuite une transition douce' } },
        { aiSaid: 'reprendre tranquillement' },
      ],
    },
  ],
};
