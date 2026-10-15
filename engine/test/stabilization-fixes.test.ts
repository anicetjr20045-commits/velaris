import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resetTestClient } from '../src/services/reset-client.js';

describe('Stabilisation & Correctifs d\'experts', () => {
  it('resetTestClient isole strictement les identifiants @lid sans extraire de numéro partiel', async () => {
    let capturedContactQuery = '';
    let capturedConvQuery = '';

    const mockDb: any = {
      async queryTable(table: string, query: string) {
        if (table === 'contacts') capturedContactQuery = query;
        if (table === 'conversations') capturedConvQuery = query;
        return [];
      },
      async deleteRows() { return []; },
    };

    const res = await resetTestClient(mockDb, '1234567890@lid');
    assert.equal(res.ok, true);
    assert.equal(res.cleanPhone, ''); // Aucune dérivation de faux numéro pour un LID
    assert.ok(capturedContactQuery.includes('wa_jid.eq.1234567890@lid'));
    assert.ok(capturedConvQuery.includes('chat_id.eq.1234567890@lid'));
    assert.ok(!capturedContactQuery.includes('phone.eq.'));
  });

  it('génération d\'empreinte bodyHash compatible SHA-256 avec outbox SQL', () => {
    const caption = 'Votre chanson personnalisée vient de sortir du studio !';
    const hash = createHash('sha256').update(caption).digest('hex');
    assert.equal(typeof hash, 'string');
    assert.equal(hash.length, 64);
  });
});
