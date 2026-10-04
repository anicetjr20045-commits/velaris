/**
 * Accès à Postgres par PostgREST (clé secrète du projet, rôle service_role).
 * Le moteur n'appelle que des fonctions SQL (§ 6.8, migration 20261005) : chaque opération
 * est atomique côté base. Aucun SQL n'est construit ici.
 */

export interface Db {
  rpc<T>(fn: string, args: Record<string, unknown>): Promise<T>;
  queryTable?<T>(table: string, queryParams?: string): Promise<T>;
  insertRow?<T>(table: string, row: Record<string, unknown>): Promise<T>;
  updateRows?<T>(table: string, matchQuery: string, data: Record<string, unknown>): Promise<T>;
}

export class DbError extends Error {
  constructor(message: string, readonly status: number | null, readonly retryable: boolean) {
    super(message);
  }
}

export interface RestDbOptions {
  url: string;
  secretKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export class RestDb implements Db {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(private readonly opts: RestDbOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.timeoutMs = opts.timeoutMs ?? 8_000;
  }

  async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.url}/rest/v1/rpc/${fn}`, {
        method: 'POST',
        headers: {
          apikey: this.opts.secretKey,
          Authorization: `Bearer ${this.opts.secretKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(args),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new DbError(`rpc ${fn} : réseau (${(err as Error).name})`, null, true);
    }
    const text = await res.text();
    if (!res.ok) {
      // 5xx / 429 : la base ou le réseau ; 4xx : erreur de contrat (ne pas réessayer en boucle)
      const retryable = res.status >= 500 || res.status === 429;
      throw new DbError(`rpc ${fn} : HTTP ${res.status} ${text.slice(0, 300)}`, res.status, retryable);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async queryTable<T>(table: string, queryParams = ''): Promise<T> {
    const q = queryParams ? `?${queryParams}` : '';
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.url}/rest/v1/${table}${q}`, {
        method: 'GET',
        headers: {
          apikey: this.opts.secretKey,
          Authorization: `Bearer ${this.opts.secretKey}`,
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new DbError(`query ${table} : réseau (${(err as Error).name})`, null, true);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DbError(`query ${table} : HTTP ${res.status} ${text.slice(0, 300)}`, res.status, res.status >= 500);
    }
    return (text ? JSON.parse(text) : null) as T;
  }

  async insertRow<T>(table: string, row: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.url}/rest/v1/${table}`, {
        method: 'POST',
        headers: {
          apikey: this.opts.secretKey,
          Authorization: `Bearer ${this.opts.secretKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          Accept: 'application/json',
        },
        body: JSON.stringify(row),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new DbError(`insert ${table} : réseau (${(err as Error).name})`, null, true);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DbError(`insert ${table} : HTTP ${res.status} ${text.slice(0, 300)}`, res.status, res.status >= 500);
    }
    const data = text ? JSON.parse(text) : null;
    return (Array.isArray(data) ? data[0] : data) as T;
  }

  async updateRows<T>(table: string, matchQuery: string, data: Record<string, unknown>): Promise<T> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.opts.url}/rest/v1/${table}?${matchQuery}`, {
        method: 'PATCH',
        headers: {
          apikey: this.opts.secretKey,
          Authorization: `Bearer ${this.opts.secretKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          Accept: 'application/json',
        },
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      throw new DbError(`update ${table} : réseau (${(err as Error).name})`, null, true);
    }
    const text = await res.text();
    if (!res.ok) {
      throw new DbError(`update ${table} : HTTP ${res.status} ${text.slice(0, 300)}`, res.status, res.status >= 500);
    }
    return (text ? JSON.parse(text) : null) as T;
  }
}
