/**
 * CONV_18 : « Chez nous ici ya pas Wave » — le client ne peut pas utiliser le
 * moyen proposé. Avec 2+ moyens configurés, l'IA liste les alternatives au lieu
 * de renvoyer les numéros en boucle (l'ancienne IA restait bloquée ici).
 * Le mock sales renvoie des bulles vides : ce sont les gabarits qui parlent.
 */
import type { Scenario } from './types.js';
import { U, S, scripted } from './types.js';

export const scenario: Scenario = {
  name: 'pas-de-wave-alternatives',
  title: '« Ya pas Wave » → liste les autres moyens de paiement',
  llm: scripted({
    understand: [U('no_payment_method')],
    sales: [S([])],
  }),
  steps: [
    {
      exec: async (db) => {
        await db.exec(
          `UPDATE studio_personas SET payment_methods = '[{"provider":"wave","number":"+226 05 77 73 08","holder":"Anicet"},{"provider":"orange_money","number":"+226 06 00 00 00","holder":"Anicet"}]'::jsonb`,
        );
      },
    },
    { client: 'Chez nous ici ya pas Wave' },
    { pump: true },
    { expect: { aiSaid: ['Lequel vous arrange', 'ORANGE MONEY'] } },
  ],
};
