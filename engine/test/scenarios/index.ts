/**
 * Point d'entrée du bac à sable à scénarios : `npm run test:scenarios`.
 *
 * Rejoue chaque scénario contre le vrai moteur (PGlite + runTurn) avec un LLM
 * simulé. Rapide (< 2 min pour tout le bac), déterministe.
 */
import { describe, test, before } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { setupScenarioDb, ScenarioRunner } from './runner.js';
import type { Scenario } from './types.js';

import { scenario as s01 } from './s01.js';
import { scenario as s02 } from './s02.js';
import { scenario as s03 } from './s03.js';
import { scenario as s04 } from './s04.js';
import { scenario as s05 } from './s05.js';
import { scenario as s06 } from './s06.js';
import { scenario as s07 } from './s07.js';
import { scenario as s08 } from './s08.js';
import { scenario as s09 } from './s09.js';
import { scenario as s10 } from './s10.js';
import { scenario as s11 } from './s11.js';
import { scenario as s12 } from './s12.js';
import { scenario as s16 } from './s16.js';
import { scenario as s17 } from './s17.js';
import { scenario as s18 } from './s18.js';

// NOTE : les tests tournent compilés depuis dist/test/scenarios/ → racine = ../../../..
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');
const read = (p: string): string => readFileSync(resolve(root, p), 'utf8');

const db = new PGlite();
const scenarios: Scenario[] = [s01, s02, s03, s04, s05, s06, s07, s08, s09, s10, s11, s12, s16, s17, s18];

before(async () => {
  await setupScenarioDb(db, read);
});

describe('bac à sable : scénarios clients', () => {
  scenarios.forEach((sc, i) => {
    test(`${sc.name} — ${sc.title}`, async () => {
      const runner = new ScenarioRunner(db, sc, i + 1);
      await runner.run();
    });
  });
});
