/** Le gérant écrit : l'IA se tait, même si le client relance. */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'gerant-intervient',
  title: "Le gérant prend la main → l'IA se tait",
  llm: scripted({
    understand: [U('greeting'), U('greeting')],
    sales: [S(['Bonjour ! Pour qui est la chanson ?'])],
  }),
  steps: [
    { client: 'Bonjour' },
    { pump: true },
    { expect: { aiSaid: 'chanson' } },
    { merchant: 'Bonjour, je prends le relais personnellement' },
    { pump: true },
    { expect: [{ aiSilent: true }, { control: 'human' }] },
    { client: 'Vous êtes toujours là ?' },
    { pump: true },
    { expect: [{ aiSilent: true }, { control: 'human' }] },
  ],
};
