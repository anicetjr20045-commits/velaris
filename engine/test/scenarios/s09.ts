/** Réaction ✨ du gérant : l'IA reprend la main et continue la suite. */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'sparkles-reprise',
  title: "✨ rend la main → l'IA reprend et continue",
  llm: scripted({
    understand: [U('greeting'), U('acknowledgement')],
    sales: [
      S(['Bonjour ! Pour qui est la chanson ?']),
      S(["Me revoilà ! Pour qui est la chanson, déjà ?"]),
    ],
  }),
  steps: [
    { client: 'Bonjour' },
    { pump: true },
    { merchant: 'Je gère ce client moi-même, une minute' },
    { pump: true },
    { expect: { control: 'human' } },
    { react: { emoji: '✨', on: 'last_merchant' } },
    { pump: true },
    { expect: [{ control: 'ai' }, { aiSaid: 'revoilà' }] },
  ],
};
