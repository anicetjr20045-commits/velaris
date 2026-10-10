/**
 * Double digression pendant le brief (le cas « robotique ») : le 2ème recadrage
 * doit savoir que c'est la 2ème fois — ton gradué, formulation différente,
 * jamais deux fois pareil. Vérifié via le prompt système du sales brain.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'double-digression',
  title: 'Double digression → le 2ème recadrage est gradué, jamais identique',
  llm: scripted({
    understand: [
      U('give_brief_info', { occasion: { value: 'anniversaire' } }),
      U('off_topic'),
      U('off_topic'),
    ],
    sales: [
      S(["C'est noté pour l'anniversaire. Quel est le prénom de la personne à célébrer ?"]),
      S(['Bien noté pour la vidéo. Pour revenir à votre chanson, quel est le prénom ?']),
      S(["D'accord, c'est noté pour les prix vidéo. Pour bien avancer, il me manque encore le prénom de la personne à célébrer."]),
    ],
  }),
  steps: [
    { client: "C'est pour l'anniversaire de ma femme" },
    { pump: true },
    { expect: { aiSaid: 'prénom' } },
    { client: 'Au fait vous faites aussi des montages vidéo ?' },
    { pump: true },
    {
      expect: [
        { aiSaid: 'Pour revenir à votre chanson' },
        { llmSaw: { kind: 'sales', contains: '1ème fois' } },
      ],
    },
    { client: 'Et les prix des vidéos c’est combien ?' },
    { pump: true },
    {
      expect: [
        { aiSaid: 'il me manque encore le prénom' },
        { llmSaw: { kind: 'sales', contains: '2ème fois' } },
      ],
    },
  ],
};
