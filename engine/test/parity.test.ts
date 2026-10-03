/**
 * Parité : la table order_transitions de la migration SQL et TRANSITIONS (TypeScript)
 * doivent être strictement identiques (§ 20.1). Toute divergence casse le build.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { TRANSITIONS, creativeTransition, paymentTransition } from '../src/domain/orders.js';
import { CREATIVE_EVENTS, CREATIVE_STAGES, PAYMENT_EVENTS, PAYMENT_STATES, type Actor } from '../src/domain/types.js';

const here = dirname(fileURLToPath(import.meta.url));
// dist/test → racine du dépôt velaris
const migration = resolve(here, '../../../supabase/migrations/20261004_agent_core.sql');

function sqlRows(): string[] {
  const sql = readFileSync(migration, 'utf8');
  const start = sql.indexOf('INSERT INTO public.order_transitions');
  const end = sql.indexOf(';', start);
  assert.ok(start > 0 && end > start, 'INSERT INTO public.order_transitions introuvable');
  const block = sql.slice(start, end);
  const rows: string[] = [];
  const re = /\('(creative|payment)',\s*'(\w+)',\s*'(\w+)',\s*'(\w+)',\s*ARRAY\[([^\]]*)\]\)/g;
  for (const m of block.matchAll(re)) {
    const actors = m[5]!.split(',').map((s) => s.trim().replaceAll("'", '')).sort().join('|');
    rows.push(`${m[1]}:${m[2]}:${m[3]}:${m[4]}:${actors}`);
  }
  return rows.sort();
}

test('order_transitions SQL ≡ TRANSITIONS TypeScript', () => {
  const ts = TRANSITIONS.map((t) => `${t.track}:${t.from}:${t.event}:${t.to}:${[...t.actors].sort().join('|')}`).sort();
  const sql = sqlRows();
  assert.equal(sql.length, TRANSITIONS.length, 'nombre de lignes différent');
  assert.deepEqual(sql, ts);
});

test('toutes les transitions référencent des états et événements connus', () => {
  for (const t of TRANSITIONS) {
    if (t.track === 'creative') {
      assert.ok((CREATIVE_STAGES as readonly string[]).includes(t.from), t.from);
      assert.ok((CREATIVE_STAGES as readonly string[]).includes(t.to), t.to);
      assert.ok((CREATIVE_EVENTS as readonly string[]).includes(t.event), t.event);
    } else {
      assert.ok((PAYMENT_STATES as readonly string[]).includes(t.from), t.from);
      assert.ok((PAYMENT_STATES as readonly string[]).includes(t.to), t.to);
      assert.ok((PAYMENT_EVENTS as readonly string[]).includes(t.event), t.event);
    }
  }
});

test('I8 : seul le gérant ou SasPay confirment un paiement (produit cartésien)', () => {
  const actors: Actor[] = ['agent', 'merchant', 'system', 'saspay'];
  for (const from of PAYMENT_STATES) {
    for (const actor of actors) {
      const r = paymentTransition({ paymentStatus: from }, 'payment_confirmed', actor);
      if (r.ok) assert.ok(actor === 'merchant' || actor === 'saspay', `${actor} a confirmé depuis ${from}`);
    }
  }
});

test('portes croisées : aucune production ni livraison sans paiement confirmé (hors gérant)', () => {
  for (const event of ['production_started', 'delivery_sent', 'audio_delivered', 'video_started'] as const) {
    for (const stage of CREATIVE_STAGES) {
      for (const paymentStatus of PAYMENT_STATES) {
        if (paymentStatus === 'confirmed') continue;
        for (const actor of ['agent', 'system'] as const) {
          const r = creativeTransition({ stage, paymentStatus, deliverable: 'audio' }, event, actor);
          assert.equal(r.ok, false, `${actor} ${event} depuis ${stage}/${paymentStatus}`);
        }
      }
    }
  }
});

test("l'agent ne peut pas annuler une commande dont le paiement est déclaré ou confirmé", () => {
  for (const paymentStatus of ['claimed', 'confirmed'] as const) {
    const r = creativeTransition({ stage: 'lyrics_sent', paymentStatus, deliverable: 'audio' }, 'order_cancelled', 'agent');
    assert.deepEqual(r, { ok: false, reason: 'payment_lock' });
  }
});

test('formule audio + vidéo : pas de livraison finale avant la vidéo (hors gérant)', () => {
  const r = creativeTransition({ stage: 'in_production', paymentStatus: 'confirmed', deliverable: 'audio_video' }, 'delivery_sent', 'system');
  assert.deepEqual(r, { ok: false, reason: 'video_pending' });
  const m = creativeTransition({ stage: 'in_production', paymentStatus: 'confirmed', deliverable: 'audio_video' }, 'delivery_sent', 'merchant');
  assert.equal(m.ok, true);
});
