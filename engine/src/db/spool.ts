/**
 * Journal de secours sur disque (§ 5.3, couche base de données).
 * Si la base est injoignable à la réception d'un webhook, l'événement brut est ajouté ici
 * (une ligne JSON, fsync) et WAHA reçoit quand même 200. Il est rejoué dans l'ordre au retour
 * de la base ; la déduplication de inbound_events rend le rejeu sans risque.
 */

import { appendFile, mkdir, open, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface SpoolEntry {
  receivedAt: string;
  body: unknown;
}

export class Spool {
  private readonly file: string;
  private chain: Promise<unknown> = Promise.resolve();

  constructor(dir: string) {
    this.file = join(dir, 'inbound.jsonl');
    void mkdir(dir, { recursive: true });
  }

  /** Ajout durable (écritures sérialisées dans le processus). */
  append(entry: SpoolEntry): Promise<void> {
    const run = async (): Promise<void> => {
      await appendFile(this.file, `${JSON.stringify(entry)}\n`, 'utf8');
      const fh = await open(this.file, 'r');
      try { await fh.sync(); } finally { await fh.close(); }
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }

  /**
   * Rejoue les entrées dans l'ordre. S'arrête à la première qui échoue et conserve
   * celle-ci et les suivantes. Retourne le nombre d'entrées rejouées.
   */
  replay(handler: (entry: SpoolEntry) => Promise<void>): Promise<number> {
    const run = async (): Promise<number> => {
      let content: string;
      try { content = await readFile(this.file, 'utf8'); } catch { return 0; }
      const lines = content.split('\n').filter(Boolean);
      let done = 0;
      for (const line of lines) {
        let entry: SpoolEntry;
        try { entry = JSON.parse(line) as SpoolEntry; } catch { done++; continue; }
        try { await handler(entry); done++; } catch { break; }
      }
      if (done > 0) {
        const tmp = `${this.file}.tmp`;
        await writeFile(tmp, lines.slice(done).map((l) => `${l}\n`).join(''), 'utf8');
        await rename(tmp, this.file);
      }
      return done;
    };
    const next = this.chain.then(run, run);
    this.chain = next.catch(() => undefined);
    return next;
  }
}
