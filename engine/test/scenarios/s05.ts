/** Le client apporte ses propres paroles : brief sauté, vocal de procédure envoyé. */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'paroles-propres',
  title: "Paroles apportées par le client → vocal direct",
  llm: scripted({
    understand: [U('greeting'), U('provides_own_lyrics')],
    sales: [
      S(['Bonjour ! Que puis-je pour vous ?']),
      S(["C'est bien noté, nous avons bien reçu vos paroles."], { procedure_voice: true }),
    ],
  }),
  steps: [
    { client: 'Bonjour' },
    { pump: true },
    { client: 'Voici mes paroles : au clair de la lune, mon ami Pierrot' },
    { pump: true },
    { expect: [{ voiceNotes: 1 }, { lyricsHave: 'au clair de la lune' }] },
  ],
};
