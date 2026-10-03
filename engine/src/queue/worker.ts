/**
 * Travailleur autonome d'exécution des tours de conversation (§ 7.4).
 *  - Scrute les tours prêts via agent_claim_turn (verrou exclusif atomique)
 *  - Renouvelle le bail si le traitement prend du temps
 *  - Exécute runTurn
 *  - Enregistre et gère les erreurs sans bloquer la file.
 */

import type { Db } from '../db/rest.js';
import type { LlmProvider } from '../llm/provider.js';
import { runTurn, type RunTurnDeps, type TurnRef } from './run-turn.js';

export interface TurnWorkerDeps {
  db: Db;
  llmProvider: LlmProvider;
  workerId: string;
  concurrency?: number;
  log: (line: string, data?: Record<string, unknown>) => void;
}

interface ClaimedTurn {
  turn_id: string;
  conversation_id: string;
  user_id: string;
  lock_token: number;
  trigger: string;
}

export class TurnWorker {
  private readonly concurrency: number;
  private activeCount = 0;
  private running = false;

  constructor(private readonly deps: TurnWorkerDeps) {
    this.concurrency = deps.concurrency ?? 3;
  }

  async tick(): Promise<number> {
    if (this.activeCount >= this.concurrency) return 0;

    let claimed: ClaimedTurn[] | null = null;
    try {
      claimed = await this.deps.db.rpc<ClaimedTurn[]>('agent_claim_turn', {
        p_worker: this.deps.workerId,
        p_lease_seconds: 90,
      });
    } catch (err) {
      this.deps.log('turn tick claim failed', { error: (err as Error).message });
      return 0;
    }

    if (!claimed || claimed.length === 0) return 0;

    const row = claimed[0]!;
    const turnRef: TurnRef = {
      turnId: row.turn_id,
      conversationId: row.conversation_id,
      userId: row.user_id,
      lockToken: Number(row.lock_token),
      trigger: row.trigger,
    };

    this.activeCount++;
    void this.processWithLease(turnRef).finally(() => {
      this.activeCount--;
    });

    return 1;
  }

  private async processWithLease(turnRef: TurnRef): Promise<void> {
    // Renouvellement de bail toutes les 30s pendant l'exécution
    const renewInterval = setInterval(async () => {
      try {
        await this.deps.db.rpc('agent_renew_lease', {
          p_conversation: turnRef.conversationId,
          p_token: turnRef.lockToken,
          p_lease_seconds: 90,
        });
      } catch {
        // Ignoré : si le verrou a sauté, agent_finish_turn ou outbox refusera
      }
    }, 30_000);

    const runDeps: RunTurnDeps = {
      db: this.deps.db,
      llmProvider: this.deps.llmProvider,
      workerId: this.deps.workerId,
      log: this.deps.log,
    };

    try {
      const outcome = await runTurn(runDeps, turnRef);
      this.deps.log('turn completed', {
        turnId: turnRef.turnId,
        conversationId: turnRef.conversationId,
        outcome: outcome.outcome,
        enqueued: outcome.enqueuedIds.length,
        latencyMs: outcome.latencyMs,
      });
    } catch (err) {
      this.deps.log('turn crashed', {
        turnId: turnRef.turnId,
        conversationId: turnRef.conversationId,
        error: (err as Error).message,
      });
      try {
        await this.deps.db.rpc('agent_finish_turn', {
          p_turn: turnRef.turnId,
          p_conversation: turnRef.conversationId,
          p_token: turnRef.lockToken,
          p_status: 'failed',
          p_outcome: 'crashed',
          p_error: (err as Error).message,
        });
      } catch (finishErr) {
        this.deps.log('failed to mark turn failed', { error: (finishErr as Error).message });
      }
    } finally {
      clearInterval(renewInterval);
    }
  }

  async runLoop(everyMs = 500): Promise<void> {
    this.running = true;
    while (this.running) {
      try {
        await this.tick();
      } catch (err) {
        this.deps.log('worker loop error', { error: (err as Error).message });
      }
      await new Promise((r) => setTimeout(r, everyMs));
    }
  }

  stop(): void {
    this.running = false;
  }
}
