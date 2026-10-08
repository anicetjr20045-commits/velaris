/**
 * Configuration du moteur, lue une seule fois au démarrage et validée.
 * Un réglage manquant ou dangereux empêche le démarrage : mieux vaut un moteur arrêté
 * qu'un moteur qui accepte des webhooks non signés ou appelle un modèle « reasoner ».
 */

export interface EngineConfig {
  port: number;
  workerId: string;
  supabaseUrl: string;
  supabaseSecretKey: string;
  wahaUrl: string;
  wahaApiKey: string;
  wahaWebhookHmacKey: string;
  protectedSessions: readonly string[];
  deepseek: { apiKey: string; baseUrl: string; model: string; timeoutMs: number };
  spoolDir: string;
  senderConcurrencyPerSession: number;
}

export class ConfigError extends Error {}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const v = env[name]?.trim();
  if (!v) throw new ConfigError(`variable d'environnement manquante : ${name}`);
  return v;
}

/** Les modèles à raisonnement exposent un flot de « pensée » qui a cassé le JSON par le passé. */
export function assertNonReasoningModel(model: string): void {
  const m = model.toLowerCase();
  if (m.includes('reasoner') || m.includes('-r1') || m.startsWith('r1')) {
    throw new ConfigError(`modèle refusé : ${model} (modèle à raisonnement ; utiliser deepseek-flash ou deepseek-chat)`);
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): EngineConfig {
  const model = env.DEEPSEEK_MODEL?.trim() || 'deepseek-flash';
  assertNonReasoningModel(model);
  const hmac = required(env, 'WAHA_WEBHOOK_HMAC_KEY');
  if (hmac.length < 32) throw new ConfigError('WAHA_WEBHOOK_HMAC_KEY trop courte (32 caractères minimum)');

  return {
    port: Number(env.PORT ?? 3002),
    workerId: env.WORKER_ID?.trim() || `engine-${process.pid}`,
    supabaseUrl: required(env, 'SUPABASE_URL').replace(/\/$/, ''),
    supabaseSecretKey: required(env, 'SUPABASE_SECRET_KEY'),
    wahaUrl: required(env, 'WAHA_URL').replace(/\/$/, ''),
    wahaApiKey: required(env, 'WAHA_API_KEY'),
    wahaWebhookHmacKey: hmac,
    protectedSessions: (env.WAHA_PROTECTED_SESSIONS ?? 'anicet2').split(',').map((s) => s.trim()).filter(Boolean),
    deepseek: {
      apiKey: required(env, 'DEEPSEEK_API_KEY'),
      baseUrl: (env.DEEPSEEK_BASE_URL?.trim() || 'https://api.deepseek.com/v1').replace(/\/$/, ''),
      model,
      timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS ?? 12_000),
    },
    spoolDir: env.SPOOL_DIR?.trim() || './spool',
    senderConcurrencyPerSession: Number(env.SENDER_CONCURRENCY_PER_SESSION ?? 2),
  };
}
