import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyWahaHmac } from '../src/ingest/hmac.js';
import { normalizeWahaEvent } from '../src/ingest/normalize.js';
import { bodyHash, normalizeEmoji, waMessageIdKey } from '../src/ingest/wa-ids.js';

const inbound = (over: Record<string, unknown> = {}, event = 'message') => ({
  event,
  session: 'studio_ab0274c0',
  payload: {
    id: 'false_22670000000@c.us_3EB0AABBCCDD',
    from: '22670000000@c.us',
    to: '22656240533@c.us',
    fromMe: false,
    body: 'Le dépôt c’est sur quelle numéro ?',
    timestamp: 1791100000,
    _data: { notifyName: 'Djalilou' },
    ...over,
  },
});

describe('normalisation WAHA', () => {
  test('message entrant', () => {
    const r = normalizeWahaEvent(inbound());
    assert.ok(r.ok && r.event.kind === 'message');
    assert.equal(r.event.fromMe, false);
    assert.equal(r.event.chatId, '22670000000@c.us');
    assert.equal(r.event.waKey, '3EB0AABBCCDD');
    assert.equal(r.event.pushName, 'Djalilou');
    assert.equal(r.event.waTimestamp, new Date(1791100000 * 1000).toISOString());
  });

  test('message et message.any : même clé de déduplication', () => {
    const a = normalizeWahaEvent(inbound({}, 'message'));
    const b = normalizeWahaEvent(inbound({}, 'message.any'));
    assert.ok(a.ok && b.ok);
    assert.equal(a.event.dedupKey, b.event.dedupKey);
  });

  test('identifiant court et long → même clé', () => {
    assert.equal(waMessageIdKey('3eb0aabbccdd'), waMessageIdKey('true_22670000000@c.us_3EB0AABBCCDD'));
  });

  test('message du gérant : la discussion est le destinataire', () => {
    const r = normalizeWahaEvent(inbound({ fromMe: true, from: '22656240533@c.us', to: '22670000000@c.us' }));
    assert.ok(r.ok && r.event.kind === 'message');
    assert.equal(r.event.chatId, '22670000000@c.us');
  });

  test('groupes, statuts et chaînes ignorés', () => {
    assert.deepEqual(normalizeWahaEvent(inbound({ from: '1203630@g.us' })), { ok: false, reason: 'group_or_broadcast' });
    assert.deepEqual(normalizeWahaEvent(inbound({ from: 'status@broadcast' })), { ok: false, reason: 'group_or_broadcast' });
  });

  test('vocal sans texte : média audio', () => {
    const r = normalizeWahaEvent(inbound({ body: '', hasMedia: true, media: { url: 'http://waha/files/x.oga', mimetype: 'audio/ogg; codecs=opus' } }));
    assert.ok(r.ok && r.event.kind === 'message');
    assert.equal(r.event.mediaKind, 'audio');
    assert.equal(r.event.body, null);
  });

  test('réaction sans fromMe → rejetée (un client ne déclenche jamais 🎵)', () => {
    const r = normalizeWahaEvent({ event: 'message.reaction', session: 's', payload: { from: '226@c.us', reaction: { text: '🎵', messageId: 'true_226@c.us_ABC' } } });
    assert.deepEqual(r, { ok: false, reason: 'reaction_not_from_merchant' });
  });

  test('réaction du gérant → commande normalisée', () => {
    const r = normalizeWahaEvent({ event: 'message.reaction', session: 's', payload: { fromMe: true, to: '226@c.us', reaction: { text: '✨️', messageId: 'true_226@c.us_ABC' } } });
    assert.ok(r.ok && r.event.kind === 'reaction');
    assert.equal(r.event.emoji, '✨');
    assert.equal(r.event.reactedKey, 'ABC');
  });

  test('statut de session', () => {
    const r = normalizeWahaEvent({ event: 'session.status', session: 's', timestamp: 1, payload: { status: 'WORKING', me: { id: '22656240533@c.us' } } });
    assert.ok(r.ok && r.event.kind === 'session_status');
    assert.equal(r.event.phone, '22656240533');
  });
});

describe('outils', () => {
  test('emoji : variantes et teintes ignorées', () => {
    assert.equal(normalizeEmoji('❤️'), normalizeEmoji('❤'));
    assert.equal(normalizeEmoji('👍🏾'), '👍');
  });

  test('empreinte du corps insensible aux espaces', () => {
    assert.equal(bodyHash('  Bonjour   Awa '), bodyHash('Bonjour Awa'));
    assert.notEqual(bodyHash('Bonjour Awa'), bodyHash('Bonjour Fadila'));
    assert.equal(bodyHash('   '), null);
  });
});

describe('signature HMAC', () => {
  const key = 'k'.repeat(40);
  const raw = Buffer.from(JSON.stringify(inbound()));
  const sig = createHmac('sha512', key).update(raw).digest('hex');

  test('signature valide acceptée', () => assert.equal(verifyWahaHmac(raw, sig, 'sha512', key), true));
  test('signature absente refusée', () => assert.equal(verifyWahaHmac(raw, undefined, undefined, key), false));
  test('corps modifié refusé', () => assert.equal(verifyWahaHmac(Buffer.concat([raw, Buffer.from(' ')]), sig, 'sha512', key), false));
  test('algorithme inconnu refusé', () => assert.equal(verifyWahaHmac(raw, sig, 'md5', key), false));
});
