/**
 * Runner du bac à sable à scénarios.
 *
 * Chaque scénario rejoue une conversation contre le vrai moteur :
 * agent_ingest_message (ou agent_ingest_reaction) puis runTurn, avec un LLM
 * simulé fourni par le scénario. Le debounce de 20 s est sauté par le pump
 * (ready_at forcé), pour des tests rapides.
 */
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { bodyHash } from '../../src/ingest/wa-ids.js';
import { runTurn, type RunTurnDeps, type TurnRef } from '../../src/queue/run-turn.js';
import type { LlmProvider, JsonCompletion, JsonCompletionRequest } from '../../src/llm/provider.js';
import type {
  Scenario, Expectation, LlmCall, LlmKind,
} from './types.js';

const USER = '11111111-1111-1111-1111-111111111111';
const SESSION = 'studio_scenario';

function kindOf(system: string): LlmKind {
  if (system.startsWith('Tu analyses les messages WhatsApp')) return 'understand';
  if (system.includes('IDENTITÉ & RÔLE')) return 'sales';
  return 'other';
}

class PGliteDbAdapter {
  constructor(private readonly pg: PGlite) {}
  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const keys = Object.keys(args);
    const argsList = keys.map((k, i) => `${k} => $${i + 1}`).join(',');
    const values = keys.map((k) => args[k]);
    const res = await this.pg.query<Record<string, unknown>>(`SELECT * FROM ${fn}(${argsList})`, values);
    if (res.rows.length === 0) return null as T;
    const firstRow = res.rows[0]!;
    const colKeys = Object.keys(firstRow);
    if (colKeys.length === 1 && colKeys[0] === fn) return firstRow[fn] as T;
    return res.rows as T;
  }
  /**
   * Traduit le sous-ensemble PostgREST utilisé par runTurn
   * (col=eq.val, col=in.(a,b), select=, limit=) en SQL.
   */
  private translate(table: string, filter: string): { sql: string; params: unknown[] } {
    const conds: string[] = [];
    const params: unknown[] = [];
    let limit = '';
    for (const p of (filter ?? '').split('&')) {
      if (!p) continue;
      if (p.startsWith('select=')) continue; // géré par l'appelant
      if (p.startsWith('limit=')) {
        const n = parseInt(p.slice(6), 10);
        if (Number.isFinite(n)) limit = `LIMIT ${n}`;
        continue;
      }
      if (p.startsWith('order=')) continue;
      const eq = p.match(/^([^=]+)=eq\.(.*)$/);
      if (eq?.[1] && eq[2] !== undefined) {
        params.push(decodeURIComponent(eq[2]));
        conds.push(`"${eq[1]}" = $${params.length}`);
        continue;
      }
      const inn = p.match(/^([^=]+)=in\.\((.*)\)$/);
      if (inn?.[1] && inn[2] !== undefined) {
        const col = inn[1];
        const placeholders = inn[2].split(',').map((v) => {
          params.push(decodeURIComponent(v));
          return `$${params.length}`;
        });
        conds.push(`"${col}" IN (${placeholders.join(', ')})`);
        continue;
      }
      throw new Error(`runner: filtre PostgREST non supporté : ${p}`);
    }
    const where = conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : '';
    return { sql: `FROM "${table}" ${where} ${limit}`.replace(/\s+/g, ' ').trim(), params };
  }
  async queryTable<T>(table: string, filter = ''): Promise<T> {
    const t = this.translate(table, filter);
    const selectMatch = (filter ?? '').match(/(?:^|&)select=([^&]*)/);
    const cols = selectMatch?.[1]
      ? decodeURIComponent(selectMatch[1]).split(',').map((s) => `"${s}"`).join(', ')
      : '*';
    const res = await this.pg.query(`SELECT ${cols} ${t.sql}`, t.params);
    return res.rows as T;
  }
  async updateRows<T>(table: string, filter: string, patch: Record<string, unknown>): Promise<T> {
    const t = this.translate(table, filter);
    const keys = Object.keys(patch);
    const set = keys.map((k) => {
      t.params.push(patch[k]);
      return `"${k}" = $${t.params.length}`;
    }).join(', ');
    const where = t.sql.replace(/^FROM "[^"]+"\s*/, '').replace(/\s+LIMIT \d+\s*$/, '');
    await this.pg.query(`UPDATE "${table}" SET ${set} ${where}`, t.params);
    return undefined as T;
  }
}

/** Base partagée : applique les migrations une seule fois pour tous les scénarios. */
export async function setupScenarioDb(
  db: PGlite,
  read: (p: string) => string,
): Promise<void> {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
    CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    CREATE FUNCTION auth.role() RETURNS TEXT LANGUAGE sql STABLE AS $$ SELECT 'service_role'::text $$;
  `);
  await db.exec(read('supabase_schema_init.sql').split('\n').filter((l) => !l.startsWith('CREATE EXTENSION')).join('\n'));
  await db.exec(read('supabase/migrations/20261004_agent_core.sql'));
  await db.exec(read('supabase/migrations/20261005_agent_ingest.sql'));
  // La master consolide tout (tours, transitions, contraintes) : c'est elle que le moteur attend.
  await db.exec(read('supabase/migrations/20261006_master_agent_production.sql'));
  await db.exec(read('supabase/migrations/20261009_delivery_sent_audio.sql'));
  await db.exec(read('supabase/migrations/20261009_lyrics_source_reaction.sql'));
  await db.exec(read('supabase/migrations/20261009_outbox_purpose_reaction.sql'));
  await db.exec(read('supabase/migrations/20261010_brief_champs_reels.sql'));
  await db.exec(`
    INSERT INTO auth.users (id) VALUES ('${USER}');
    INSERT INTO wa_sessions (user_id, session_name, status, engine_owner)
      VALUES ('${USER}', '${SESSION}', 'connected', 'velaris_engine');
    INSERT INTO studio_personas (
      user_id, studio_name, agent_name, manager_first_name, tone, formal_address, emoji_policy,
      cap_reception, cap_procedure_voice, cap_payment, delivery_mode, alert_phone
    ) VALUES (
      '${USER}', 'Velaris Studio', 'Alex', 'Anicet', 'sobre', true, 'none',
      true, true, true, 'live', '22507000000'
    );
    INSERT INTO studio_catalogues (user_id, code, label, description, price_xof, deliverable, payment_policy)
      VALUES
        ('${USER}', 'decouverte', 'Découverte', 'Chanson personnalisée complète', 1200, 'audio', 'after_lyrics_validation'),
        ('${USER}', 'prestige', 'Prestige', 'Chanson + vidéo souvenir', 3000, 'audio_video', 'after_lyrics_validation');
    INSERT INTO studio_assets (user_id, kind, purpose, storage_path, duration_s)
      VALUES ('${USER}', 'voice', 'procedure', 'assets/procedure_voice.ogg', 60);
  `);
}

export class ScenarioRunner {
  private adapter: PGliteDbAdapter;
  private deps: RunTurnDeps;
  private convId = '';
  private chatId = '';
  private seq = 0;
  private lastKey: Record<'client' | 'merchant', string> = { client: '', merchant: '' };
  private seenOutboxIds = new Set<string>();
  private captured: LlmCall[] = [];
  private lastTraces: string[][] = [];

  constructor(private db: PGlite, private scenario: Scenario, chatSuffix: number) {
    this.adapter = new PGliteDbAdapter(db);
    this.chatId = `2267000${String(chatSuffix).padStart(4, '0')}@c.us`;
    const llm: LlmProvider = {
      name: 'scenario-mock',
      completeJson: async (req: JsonCompletionRequest): Promise<JsonCompletion> => {
        const call: LlmCall = { kind: kindOf(req.system), system: req.system, req };
        this.captured.push(call);
        const data = this.scenario.llm(call);
        return {
          data: data as Record<string, unknown>,
          model: 'mock',
          usage: { promptTokens: 10, completionTokens: 10, cacheHitTokens: 0 },
          latencyMs: 1,
          attempts: 1,
          reasoningDiscarded: false,
        };
      },
    };
    this.deps = { db: this.adapter as never, llmProvider: llm, workerId: 'scenario', log: () => {} };
  }

  private key(): string {
    this.seq += 1;
    return `scn_${this.scenario.name}_${this.seq}`;
  }

  private async ingest(fromMe: boolean, body: string): Promise<void> {
    const key = this.key();
    const res = await this.adapter.rpc<{ outcome: string; conversation_id: string }>('agent_ingest_message', {
      p_session: SESSION,
      p_chat_id: this.chatId,
      p_from_me: fromMe,
      p_wa_message_id: `wa_${key}`,
      p_wa_key: key,
      p_wa_timestamp: new Date().toISOString(),
      p_body: body,
      p_media_kind: null,
      p_media_path: null,
      p_push_name: fromMe ? 'Gérant' : 'Client Test',
      p_body_hash: bodyHash(body),
    });
    this.convId = res.conversation_id;
    this.lastKey[fromMe ? 'merchant' : 'client'] = key;
  }

  /** Exécute tous les tours prêts (ready_at forcé : saute les 20 s du debounce). */
  async pump(): Promise<void> {
    await this.db.exec(
      `UPDATE conversation_turns SET ready_at = now() WHERE conversation_id = '${this.convId}' AND status = 'collecting'`,
    );
    for (let i = 0; i < 12; i++) {
      const claimed = await this.adapter.rpc<
        Array<{ turn_id: string; conversation_id: string; user_id: string; lock_token: number; trigger: string }>
      >('agent_claim_turn', { p_worker: 'scenario', p_lease_seconds: 90 });
      const mine = (claimed ?? []).filter((c) => c.conversation_id === this.convId);
      if (mine.length === 0) break;
      for (const c of mine) {
        const turnRef: TurnRef = {
          turnId: c.turn_id,
          conversationId: c.conversation_id,
          userId: c.user_id,
          lockToken: Number(c.lock_token),
          trigger: c.trigger,
        };
        const outcome = await runTurn(this.deps, turnRef);
        this.lastTraces.push(outcome.trace);
      }
    }
  }

  /** Bulles agent non annulées, non encore « vues » par une expectation précédente. */
  private async agentBodies(): Promise<string[]> {
    const r = await this.db.query<{ id: string; body: string }>(
      `SELECT id, body FROM outbound_messages
        WHERE conversation_id = $1 AND origin = 'agent' AND status <> 'cancelled'
        ORDER BY created_at`,
      [this.convId],
    );
    return r.rows.filter((x) => !this.seenOutboxIds.has(x.id)).map((x) => x.body ?? '');
  }

  private async check(exp: Expectation): Promise<void> {
    const asArr = <T>(v: T | T[]): T[] => (Array.isArray(v) ? v : [v]);
    if (exp.aiSaid !== undefined) {
      const bodies = await this.agentBodies();
      for (const s of asArr(exp.aiSaid)) {
        assert.ok(
          bodies.some((b) => b.includes(s)),
          `«${this.scenario.name}» : l'IA n'a pas dit «${s}» — bulles : ${JSON.stringify(bodies)}`,
        );
      }
    }
    if (exp.aiSilent) {
      const bodies = await this.agentBodies();
      assert.equal(bodies.length, 0, `«${this.scenario.name}» : l'IA aurait dû se taire, bulles : ${JSON.stringify(bodies)}`);
    }
    if (exp.orderStage !== undefined) {
      const r = await this.db.query<{ stage: string }>(
        `SELECT stage FROM orders WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [this.convId],
      );
      assert.ok(r.rows.length > 0, `«${this.scenario.name}» : aucune commande créée`);
      assert.equal(r.rows[0]!.stage, exp.orderStage, `«${this.scenario.name}» : étape commande`);
    }
    if (exp.control !== undefined) {
      const r = await this.db.query<{ control_mode: string }>(
        `SELECT control_mode FROM conversations WHERE id = $1`, [this.convId],
      );
      assert.equal(r.rows[0]!.control_mode, exp.control, `«${this.scenario.name}» : contrôle`);
    }
    if (exp.voiceNotes !== undefined) {
      const r = await this.db.query<{ n: number }>(
        `SELECT count(*)::int AS n FROM outbound_messages
          WHERE conversation_id = $1 AND origin = 'agent' AND kind = 'voice'
            AND purpose = 'procedure_voice' AND status <> 'cancelled'`,
        [this.convId],
      );
      assert.equal(r.rows[0]!.n, exp.voiceNotes, `«${this.scenario.name}» : vocaux de procédure`);
    }
    if (exp.traceHas !== undefined) {
      const trace = (this.lastTraces.at(-1) ?? []).join('\n');
      for (const s of asArr(exp.traceHas)) {
        assert.ok(trace.includes(s), `«${this.scenario.name}» : trace sans «${s}» — trace : ${trace.slice(-600)}`);
      }
    }
    if (exp.llmSaw !== undefined) {
      const found = this.captured.some((c) => c.kind === exp.llmSaw!.kind && c.system.includes(exp.llmSaw!.contains));
      assert.ok(found, `«${this.scenario.name}» : aucun appel LLM ${exp.llmSaw.kind} contenant «${exp.llmSaw.contains}»`);
    }
    if (exp.alertSent !== undefined) {
      const r = await this.db.query<{ body: string }>(
        `SELECT body FROM outbound_messages
          WHERE conversation_id = $1 AND origin = 'system_alert' AND status <> 'cancelled'
          ORDER BY created_at`,
        [this.convId],
      );
      const bodies = r.rows.map((x) => x.body ?? '');
      assert.ok(
        bodies.some((b) => b.includes(exp.alertSent!)),
        `«${this.scenario.name}» : aucune alerte gérant contenant «${exp.alertSent}» — alertes : ${JSON.stringify(bodies)}`,
      );
    }
    if (exp.lyricsHave !== undefined) {
      const r = await this.db.query<{ txt: string | null }>(
        `SELECT COALESCE(lyrics, '') || ' ' || COALESCE(client_own_lyrics, '') AS txt
           FROM orders WHERE conversation_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [this.convId],
      );
      assert.ok(
        (r.rows[0]?.txt ?? '').includes(exp.lyricsHave),
        `«${this.scenario.name}» : paroles sans «${exp.lyricsHave}»`,
      );
    }
    if (exp.batched !== undefined) {
      const r = await this.db.query<{ ids: string[] }>(
        `SELECT inbound_message_ids AS ids FROM conversation_turns
          WHERE conversation_id = $1 AND status = 'done' AND trigger = 'client_message'
          ORDER BY finished_at DESC LIMIT 1`,
        [this.convId],
      );
      assert.ok(r.rows.length > 0, `«${this.scenario.name}» : aucun tour client terminé`);
      assert.equal(r.rows[0]!.ids.length, exp.batched, `«${this.scenario.name}» : messages regroupés`);
    }
  }

  /** Marque comme « vues » toutes les bulles agent présentes après un groupe d'expectations. */
  private async advanceWatermark(): Promise<void> {
    const r = await this.db.query<{ id: string }>(
      `SELECT id FROM outbound_messages WHERE conversation_id = $1 AND origin = 'agent'`,
      [this.convId],
    );
    for (const x of r.rows) this.seenOutboxIds.add(x.id);
  }

  async run(): Promise<void> {
    for (const step of this.scenario.steps) {
      if ('client' in step) {
        const texts = Array.isArray(step.client) ? step.client : [step.client];
        for (const t of texts) await this.ingest(false, t);
      } else if ('merchant' in step) {
        await this.ingest(true, step.merchant);
      } else if ('react' in step) {
        const target = step.react.on === 'last_client' ? this.lastKey.client : this.lastKey.merchant;
        assert.ok(target, `«${this.scenario.name}» : réaction sans message cible`);
        await this.adapter.rpc('agent_ingest_reaction', {
          p_session: SESSION,
          p_chat_id: this.chatId,
          p_reacted_key: target,
          p_emoji: step.react.emoji,
        });
      } else if ('pump' in step) {
        await this.pump();
      } else if ('exec' in step) {
        await step.exec(
          {
            query: <T>(sql: string, params: unknown[] = []) => this.db.query<T>(sql, params),
            exec: async (sql: string): Promise<void> => {
              await this.db.exec(sql);
            },
          },
          { convId: this.convId },
        );
      } else if ('expect' in step) {
        const exps = Array.isArray(step.expect) ? step.expect : [step.expect];
        for (const e of exps) await this.check(e);
        await this.advanceWatermark();
      }
    }
  }
}
