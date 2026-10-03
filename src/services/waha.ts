/**
 * Service Client WAHA (WhatsApp HTTP API) pour Velaris Studio OS
 *
 * Deux transports :
 * - `proxy` (production) : chaque appel passe par l'Edge Function `waha-proxy`
 *   avec le JWT du studio ; la clé WAHA reste sur le serveur et un studio ne
 *   peut agir que sur sa propre session.
 * - `direct` (transition / développement) : appel direct avec `VITE_WAHA_API_KEY`.
 *   Activé seulement si cette variable est définie (jamais en dur dans le code).
 */

import { supabase, SUPABASE_CONFIG } from './supabase';

const env = import.meta.env;
const directKey: string = env.VITE_WAHA_API_KEY || '';

export const WAHA_CONFIG = {
  baseUrl: env.VITE_WAHA_BASE_URL || 'https://waha.velarisagent.life',
  mode: (env.VITE_WAHA_MODE === 'proxy' || !directKey ? 'proxy' : 'direct') as 'proxy' | 'direct',
  proxyUrl: `${SUPABASE_CONFIG.url}/functions/v1/waha-proxy`,
  defaultSession: 'Test', // Session principale liée au +22656240533
  secondarySession: 'anicet2', // Session préservée +22658357772 : lecture seule depuis le web
  protectedSessions: ['anicet2'] as readonly string[],
  webhookHmacKey: 'f50ca6dc4b9626c26d95ff0d4b3155076cc5c7b57c70621524ac9a4d00ff6066',
};

export const isProtectedSession = (name: string) => WAHA_CONFIG.protectedSessions.includes(name);

export interface WahaSession {
  name: string;
  status: 'WORKING' | 'STARTING' | 'SCAN_QR_CODE' | 'FAILED' | 'STOPPED' | string;
  me?: {
    id: string;
    pushName?: string;
  } | null;
  timestamps?: {
    activity?: number | null;
  };
  config?: unknown;
}

export interface WahaSendTextResponse {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Nom de session WAHA isolé par studio (multi-tenant) ; 'Test' en démo
 */
export function wahaSessionNameFor(userId?: string | null): string {
  return userId ? `studio_${userId.slice(0, 8)}` : WAHA_CONFIG.defaultSession;
}

/**
 * Normalisation du chatId WhatsApp (ex: 22656240533@c.us)
 */
export function toChatId(phoneOrChatId: string): string {
  return phoneOrChatId.includes('@') ? phoneOrChatId : `${phoneOrChatId.replace(/[^0-9]/g, '')}@c.us`;
}

/**
 * fetch borné dans le temps : un serveur WAHA figé ne doit jamais bloquer l'interface.
 * En mode proxy, la requête est enveloppée pour l'Edge Function (JWT du studio).
 */
async function wahaFetch(path: string, init: { method?: 'GET' | 'POST'; body?: string } = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = init.method ?? 'GET';
  try {
    if (WAHA_CONFIG.mode === 'direct') {
      return await fetch(`${WAHA_CONFIG.baseUrl}${path}`, {
        method,
        body: init.body,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Api-Key': directKey },
        signal: controller.signal,
      });
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return new Response(JSON.stringify({ message: 'Connexion requise' }), { status: 401 });
    return await fetch(WAHA_CONFIG.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_CONFIG.publishableKey,
      },
      body: JSON.stringify({ method, path, body: init.body ? JSON.parse(init.body) : undefined }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ping du serveur WAHA (latence mesurée par l'appelant)
 */
export async function pingWaha(): Promise<boolean> {
  try {
    const res = await wahaFetch('/ping', {}, 6000);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Récupère toutes les sessions (administration uniquement en mode proxy)
 */
export async function fetchWahaSessions(): Promise<WahaSession[]> {
  try {
    const res = await wahaFetch('/api/sessions');
    if (!res.ok) return [];
    const list = await res.json();
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * Récupère le statut d'une session spécifique (null si absente ou injoignable)
 */
export async function fetchWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<WahaSession | null> {
  // Essai prioritaire via le relais public sécurisé du moteur
  try {
    const qRes = await fetch(`${WAHA_CONFIG.baseUrl}/api/qr/status?session=${encodeURIComponent(sessionName)}&t=${Date.now()}`);
    if (qRes.ok) {
      const qData = await qRes.json();
      if (qData && qData.ok) {
        return {
          name: qData.session,
          status: qData.status,
          me: qData.phone ? { id: `${qData.phone.replace('+', '')}@c.us`, pushName: qData.pushName } : null,
          timestamps: qData.timestamps || null,
        };
      }
    }
  } catch {
    // repli standard
  }

  try {
    const res = await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Assure qu'une session studio existe sur WAHA (la provisionne et la démarre si inexistante)
 */
export async function ensureWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<WahaSession | null> {
  if (isProtectedSession(sessionName)) return fetchWahaSession(sessionName);
  try {
    const existing = await fetchWahaSession(sessionName);
    if (existing) {
      if (existing.status === 'STOPPED') await startWahaSession(sessionName);
      else if (existing.status === 'FAILED') await restartWahaSession(sessionName);
      return existing;
    }

    // Création avec configuration haute stabilité (anti-déconnexion) ; en mode proxy,
    // le serveur impose lui-même cette configuration et le nom de session.
    const res = await wahaFetch('/api/sessions', {
      method: 'POST',
      body: JSON.stringify({
        name: sessionName,
        start: true,
        config: {
          noweb: { markOnline: false, store: { enabled: true, fullSync: false } },
          webhooks: [
            {
              url: 'http://waha-bridge:3001/webhook',
              events: ['message', 'message.any', 'message.reaction', 'message.ack', 'session.status'],
              hmac: {
                key: WAHA_CONFIG.webhookHmacKey,
              },
            },
          ],
        },
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function sessionAction(sessionName: string, action: 'start' | 'stop' | 'restart'): Promise<boolean> {
  if (isProtectedSession(sessionName)) {
    console.warn(`[WAHA] Session ${sessionName} protégée : action « ${action} » refusée`);
    return false;
  }
  // Essai via le relais public sécurisé du moteur si restart/start
  if (action === 'restart' || action === 'start') {
    try {
      const qRes = await fetch(`${WAHA_CONFIG.baseUrl}/api/qr/restart?session=${encodeURIComponent(sessionName)}`, { method: 'POST' });
      if (qRes.ok) {
        const qData = await qRes.json();
        if (qData?.ok) return true;
      }
    } catch {
      // repli standard
    }
  }
  try {
    const res = await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}/${action}`, { method: 'POST' }, 15000);
    return res.ok;
  } catch {
    return false;
  }
}

/** Démarre une session WAHA arrêtée */
export const startWahaSession = (sessionName: string = WAHA_CONFIG.defaultSession) => sessionAction(sessionName, 'start');

/** Arrête une session WAHA */
export const stopWahaSession = (sessionName: string = WAHA_CONFIG.defaultSession) => sessionAction(sessionName, 'stop');

/**
 * Redémarre proprement une session WAHA (état FAILED ou bloquée en STARTING)
 */
export async function restartWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  if (await sessionAction(sessionName, 'restart')) return true;
  if (isProtectedSession(sessionName)) return false;
  // Repli pour les versions WAHA sans /restart : stop puis start
  await stopWahaSession(sessionName);
  await new Promise(r => setTimeout(r, 1500));
  return startWahaSession(sessionName);
}

/**
 * Récupère le QR code sous forme de Blob validé (jamais d'image cassée sur un 422 JSON,
 * jamais de clé API dans une URL d'image). L'appelant libère l'URL objet.
 */
export async function fetchWahaQrBlob(sessionName: string = WAHA_CONFIG.defaultSession): Promise<{
  success: boolean;
  blobUrl?: string;
  status?: string;
  error?: string;
}> {
  // Essai direct via le relais public sécurisé du moteur
  try {
    const qRes = await fetch(`${WAHA_CONFIG.baseUrl}/api/qr/image?session=${encodeURIComponent(sessionName)}&t=${Date.now()}`);
    if (qRes.ok && qRes.headers.get('content-type')?.includes('image')) {
      const blob = await qRes.blob();
      return { success: true, blobUrl: URL.createObjectURL(blob), status: 'SCAN_QR_CODE' };
    }
    if (qRes.status === 404) {
      const data = await qRes.json().catch(() => null);
      return { success: false, status: data?.status || 'FAILED', error: 'En attente d\'activation' };
    }
  } catch {
    // repli standard
  }

  try {
    const res = await wahaFetch(`/api/${encodeURIComponent(sessionName)}/auth/qr`, {}, 10000);
    if (res.ok && res.headers.get('content-type')?.includes('image')) {
      const blob = await res.blob();
      return { success: true, blobUrl: URL.createObjectURL(blob), status: 'SCAN_QR_CODE' };
    }
    const data = await res.json().catch(() => null);
    return { success: false, status: data?.status || 'STARTING', error: data?.error || data?.message || `HTTP ${res.status}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Impossible de joindre la passerelle WAHA' };
  }
}

/* WAHA renvoie l'identifiant sous plusieurs formes selon le moteur (WEBJS / NOWEB) */
function extractMessageId(data: any): string | undefined {
  const id = data?.id ?? data?.messageId ?? data?.key?.id;
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object') return id._serialized ?? id.id;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Envois : file par session, reprise uniquement quand c'est sans risque */
/* ------------------------------------------------------------------ */

const MAX_PARALLEL_SENDS = 2;
const RETRYABLE = new Set([429, 502, 503]);
const sendQueues = new Map<string, { active: number; waiting: (() => void)[] }>();

/* Au plus 2 envois simultanés par session : WhatsApp sanctionne les rafales */
async function withSendSlot<T>(session: string, task: () => Promise<T>): Promise<T> {
  let q = sendQueues.get(session);
  if (!q) sendQueues.set(session, (q = { active: 0, waiting: [] }));
  const queue = q;
  if (queue.active >= MAX_PARALLEL_SENDS) await new Promise<void>(resolve => queue.waiting.push(resolve));
  queue.active++;
  try {
    return await task();
  } finally {
    queue.active--;
    queue.waiting.shift()?.();
  }
}

async function postSend(path: string, body: Record<string, unknown>): Promise<WahaSendTextResponse> {
  const session = String(body.session || '');
  if (isProtectedSession(session)) return { success: false, error: `La session ${session} est protégée : aucun envoi depuis le Studio.` };

  return withSendSlot(session, async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await wahaFetch(path, { method: 'POST', body: JSON.stringify(body) }, 30000);
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { success: true, messageId: extractMessageId(data) };
        // 429 / 502 / 503 : le message n'a pas été accepté, on peut retenter sans doublon
        if (RETRYABLE.has(res.status) && attempt < 2) {
          await new Promise(r => setTimeout(r, 800 * 2 ** attempt + Math.random() * 400));
          continue;
        }
        return { success: false, error: data.message || data.error || `Erreur WAHA (${res.status})` };
      } catch (err: any) {
        // Délai dépassé : le message a pu partir, pas de nouvel essai (risque de doublon)
        return {
          success: false,
          error: err?.name === 'AbortError' ? 'Le serveur WAHA met trop de temps à répondre' : err?.message || 'Impossible de joindre le serveur WAHA',
        };
      }
    }
  });
}

/**
 * Envoie un message texte en direct sur WhatsApp via WAHA
 */
export async function sendWahaTextMessage(
  chatId: string,
  text: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  if (!text.trim()) return { success: false, error: 'Message vide' };
  return postSend('/api/sendText', { session: sessionName, chatId: toChatId(chatId), text });
}

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

/**
 * Envoie une note vocale native WhatsApp (PTT).
 * OGG/Opus part tel quel ; les autres formats (webm Chrome, mp4 Safari)
 * sont convertis par WAHA (`convert: true`, nécessite WAHA Plus + ffmpeg).
 */
export async function sendWahaVoiceMessage(
  chatId: string,
  audio: Blob,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  const mime = audio.type || 'audio/ogg';
  const isOgg = mime.includes('ogg');
  const data = await blobToBase64(audio);
  return postSend('/api/sendVoice', {
    session: sessionName,
    chatId: toChatId(chatId),
    convert: !isOgg,
    file: {
      mimetype: isOgg ? 'audio/ogg; codecs=opus' : mime.split(';')[0],
      filename: isOgg ? 'voice.ogg' : `voice.${mime.includes('mp4') ? 'm4a' : mime.includes('mpeg') ? 'mp3' : 'webm'}`,
      data,
    },
  });
}

/**
 * Marque la discussion comme lue côté WhatsApp (coches bleues chez le client)
 */
export async function markWahaChatSeen(chatId: string, sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  if (isProtectedSession(sessionName)) return false;
  try {
    const res = await wahaFetch('/api/sendSeen', {
      method: 'POST',
      body: JSON.stringify({ session: sessionName, chatId: toChatId(chatId) }),
    }, 8000);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Accusés WhatsApp : 0 en attente, 1 serveur, 2 remis, 3 lu, 4 écouté
 */
export type WahaAck = -1 | 0 | 1 | 2 | 3 | 4;

/**
 * Récupère les accusés des derniers messages d'une discussion (id -> ack)
 */
export async function fetchWahaMessageAcks(
  chatId: string,
  sessionName: string = WAHA_CONFIG.defaultSession,
  limit = 20
): Promise<Record<string, WahaAck>> {
  try {
    const chat = encodeURIComponent(toChatId(chatId));
    const res = await wahaFetch(`/api/${encodeURIComponent(sessionName)}/chats/${chat}/messages?limit=${limit}&downloadMedia=false`, {}, 8000);
    if (!res.ok) return {};
    const list = await res.json();
    const acks: Record<string, WahaAck> = {};
    if (Array.isArray(list)) {
      for (const m of list) {
        const id = extractMessageId(m);
        if (id && typeof m.ack === 'number') acks[id] = m.ack as WahaAck;
      }
    }
    return acks;
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Heartbeat & reconnexion automatique                                */
/* ------------------------------------------------------------------ */

export type WahaLinkState = 'connecting' | 'online' | 'scan' | 'reconnecting' | 'offline';

export interface WahaHeartbeat {
  state: WahaLinkState;
  /** Statut brut WAHA de la session */
  sessionStatus: string | null;
  latencyMs: number | null;
  lastBeatAt: number | null;
  failures: number;
  reconnectAttempts: number;
}

interface HeartbeatOptions {
  intervalMs?: number;
  maxReconnectAttempts?: number;
  onChange: (hb: WahaHeartbeat) => void;
}

/* Une session bloquée en STARTING au-delà de ce délai est relancée */
const STUCK_STARTING_MS = 90_000;

/**
 * Battement régulier sur la session WAHA :
 * - sonde l'état toutes les `intervalMs` (espacement exponentiel en cas d'échec, plafonné à 60 s, avec gigue),
 * - relance la session si WAHA la signale STOPPED / FAILED ou bloquée en STARTING (tentatives bornées),
 * - ne touche jamais une session protégée (lecture seule),
 * - se met en veille quand l'onglet est caché et repart immédiatement au retour réseau / onglet.
 */
export function startWahaHeartbeat(
  sessionName: string,
  { intervalMs = 20000, maxReconnectAttempts = 3, onChange }: HeartbeatOptions
): { stop: () => void; beatNow: () => void; reconnect: () => Promise<void> } {
  let hb: WahaHeartbeat = { state: 'connecting', sessionStatus: null, latencyMs: null, lastBeatAt: null, failures: 0, reconnectAttempts: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let inFlight = false;
  let startingSince: number | null = null;
  const maxAttempts = isProtectedSession(sessionName) ? 0 : maxReconnectAttempts;

  const emit = (patch: Partial<WahaHeartbeat>) => {
    hb = { ...hb, ...patch };
    if (!stopped) onChange(hb);
  };

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    const base = hb.failures === 0 ? intervalMs : Math.min(60000, intervalMs * 2 ** Math.min(hb.failures, 3));
    // Gigue de ±10 % : des dizaines d'onglets ne sondent pas WAHA à la même milliseconde
    timer = setTimeout(beat, base * (0.9 + Math.random() * 0.2));
  };

  const reconnect = async (status?: string | null) => {
    emit({ state: 'reconnecting', reconnectAttempts: hb.reconnectAttempts + 1 });
    let ok: boolean;
    if (status === 'FAILED' || status === 'STARTING') ok = await restartWahaSession(sessionName);
    else if (sessionName.startsWith('studio_')) ok = !!(await ensureWahaSession(sessionName));
    else ok = await startWahaSession(sessionName);
    if (!ok) emit({ state: 'offline' });
  };

  async function beat() {
    if (stopped || inFlight) return;
    if (typeof document !== 'undefined' && document.hidden) return schedule();
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      emit({ state: 'offline', failures: hb.failures + 1 });
      return schedule();
    }
    inFlight = true;
    const t0 = performance.now();
    try {
      const res = await wahaFetch(`/api/sessions/${encodeURIComponent(sessionName)}`, {}, 8000);
      const latencyMs = Math.round(performance.now() - t0);
      if (res.status === 404 && sessionName.startsWith('studio_') && hb.reconnectAttempts < maxAttempts) {
        await reconnect(null); // session jamais provisionnée
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const session: WahaSession = await res.json();
      const status = session.status;
      const now = Date.now();
      if (status !== 'STARTING') startingSince = null;

      if (status === 'WORKING') {
        emit({ state: 'online', sessionStatus: status, latencyMs, lastBeatAt: now, failures: 0, reconnectAttempts: 0 });
      } else if (status === 'SCAN_QR_CODE') {
        emit({ state: 'scan', sessionStatus: status, latencyMs, lastBeatAt: now, failures: 0 });
      } else if (status === 'STARTING') {
        startingSince ??= now;
        emit({ state: 'reconnecting', sessionStatus: status, latencyMs, lastBeatAt: now, failures: 0 });
        if (now - startingSince > STUCK_STARTING_MS && hb.reconnectAttempts < maxAttempts) {
          startingSince = null;
          await reconnect(status);
        }
      } else {
        emit({ sessionStatus: status, latencyMs, lastBeatAt: now, failures: hb.failures + 1 });
        if (hb.reconnectAttempts < maxAttempts) await reconnect(status);
        else emit({ state: 'offline' });
      }
    } catch {
      emit({ state: hb.failures >= 1 ? 'offline' : 'reconnecting', latencyMs: null, failures: hb.failures + 1 });
    } finally {
      inFlight = false;
      schedule();
    }
  }

  const beatNow = () => {
    if (timer) clearTimeout(timer);
    beat();
  };
  const onVisible = () => {
    if (!document.hidden) beatNow();
  };

  window.addEventListener('online', beatNow);
  window.addEventListener('offline', beatNow);
  document.addEventListener('visibilitychange', onVisible);
  beat();

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', beatNow);
      window.removeEventListener('offline', beatNow);
      document.removeEventListener('visibilitychange', onVisible);
    },
    beatNow,
    reconnect: async () => {
      if (maxAttempts === 0) return beatNow();
      emit({ reconnectAttempts: 0 });
      await reconnect(hb.sessionStatus);
      beatNow();
    },
  };
}
