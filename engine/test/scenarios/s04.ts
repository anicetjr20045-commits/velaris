/**
 * Hors-sujet en plein brief : la directive anti-digression doit être injectée
 * au sales brain (répondre en 1 phrase, puis recadrer). C'est LE test du
 * correctif « répondre puis recadrer ».
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'hors-sujet',
  title: "Digression en plein brief → recadrage forcé",
  llm: scripted({
    understand: [
      U('give_brief_info', { occasion: { value: 'mariage' } }),
      U('off_topic', {}, 0.9),
    ],
    sales: [
      S(["C'est bien noté pour le mariage. Quel est le prénom du marié ?"]),
      S(["Je n'ai pas suivi le match. Pour revenir à votre chanson, quel est le prénom du marié ?"]),
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
        { llmSaw: { kind: 'sales', contains: 'DIRECTIVE ANTI-DIGRESSION' } },
        { aiSaid: 'prénom' },
      ],
    },
  ],
};
