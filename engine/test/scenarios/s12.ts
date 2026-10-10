/**
 * Client en colère : la machine accuse réception, passe le relais au gérant
 * (contrôle humain) et l'alerte. Comportement de sécurité verrouillé.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'colere-relais',
  title: 'Client en colère → relais humain + alerte',
  llm: scripted({
    understand: [U('complaint', {}, 0.95)],
    sales: [S(['Je comprends votre mécontentement, je transmets au responsable.'])],
  }),
  steps: [
    { client: "C'est nul votre service, je suis très mécontent !" },
    { pump: true },
    {
      expect: [
        { control: 'human' },
        { alertSent: 'complaint' },
        { traceHas: 'P4 complaint' },
      ],
    },
  ],
};
