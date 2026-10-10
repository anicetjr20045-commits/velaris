/**
 * CONV_23 : « Combien d'avance ? » — politique déterministe : 100 % avant
 * production, jamais d'acompte. L'IA répond, elle ne négocie pas.
 * Le mock sales renvoie des bulles vides : ce sont les gabarits qui parlent.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'demande-acompte',
  title: '« Combien d\'avance ? » → politique 100 % avant production',
  llm: scripted({
    understand: [U('ask_deposit')],
    sales: [S([])],
  }),
  steps: [
    { client: "Combien d'avance ?" },
    { pump: true },
    { expect: { aiSaid: 'une fois' } },
  ],
};
