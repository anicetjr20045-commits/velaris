/**
 * Balayeur de secours (§ 7.5 et § 14.3) :
 *  - Récupère les tours interrompus ou bloqués (agent_recover_stale_turns)
 *  - Rétablit le contrôle IA des passations expirées
 *  - Annule les envois obsolètes.
 */

import type { Db } from '../db/rest.js';

export interface SweeperDeps {
  db: Db;
  log: (line: string, data?: Record<string, unknown>) => void;
}

export class TurnSweeper {
  constructor(private readonly deps: SweeperDeps) {}

  async tick(): Promise<number> {
    try {
      const recovered = await this.deps.db.rpc<number>('agent_recover_stale_turns', {});
      if (typeof recovered === 'number' && recovered > 0) {
        this.deps.log('sweeper recovered turns', { count: recovered });
        return recovered;
      }
      return 0;
    } catch (err) {
      this.deps.log('sweeper tick failed', { error: (err as Error).message });
      return 0;
    }
  }
}
