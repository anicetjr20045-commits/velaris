
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resetTestClient } from '../src/services/reset-client.js';

describe('Service de Purge et Réinitialisation Client de Test', () => {
  test('resetTestClient effectue les suppressions dans le bon ordre sur les tables cibles', async () => {
    const deletedTables: string[] = [];

    const mockDb: any = {
      async queryTable(table: string, query: string) {
        if (table === 'contacts') {
          return [{ id: 'contact-uuid-1', name: 'Test User', phone: '22605777308', wa_jid: '22605777308@c.us' }];
        }
        if (table === 'conversations') {
          return [{ id: 'conv-uuid-1', chat_id: '22605777308@c.us' }];
        }
        return [];
      },
      async deleteRows(table: string, query: string) {
        deletedTables.push(table);
        return [{ id: 'deleted-1' }];
      },
    };

    const res = await resetTestClient(mockDb, '22605777308@c.us');
    assert.equal(res.ok, true);
    assert.equal(res.cleanPhone, '22605777308');
    assert.equal(res.deletedContacts, 1);
    assert.equal(res.deletedConversations, 1);
    assert.equal(res.deletedOrders, 1);
    assert.equal(res.deletedMessages, 1);
    assert.equal(res.deletedTurns, 1);
    assert.equal(res.deletedEvents, 1);

    // Vérifie l'ordre de suppression pour respecter l'intégrité référentielle
    assert.ok(deletedTables.indexOf('orders') < deletedTables.indexOf('conversations'));
    assert.ok(deletedTables.indexOf('messages') < deletedTables.indexOf('conversations'));
    assert.ok(deletedTables.indexOf('conversations') < deletedTables.indexOf('contacts'));
  });

  test('resetTestClient gère gracieusement un numéro inexistant', async () => {
    const mockDb: any = {
      async queryTable() { return []; },
      async deleteRows() { return []; },
    };

    const res = await resetTestClient(mockDb, '22699999999@c.us');
    assert.equal(res.ok, true);
    assert.equal(res.deletedContacts, 0);
    assert.equal(res.deletedConversations, 0);
  });
});
