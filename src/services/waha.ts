/**
 * Service Client WAHA (WhatsApp HTTP API) pour Velaris Studio OS
 *
 * Routage sécurisé via `/api/waha-proxy` (Vercel Serverless authentifié par JWT Supabase) :
 * - aucune clé WAHA ni clé admin exposée côté navigateur ;
 * - les sessions créateurs `studio_<8chars>` sont automatiquement routées vers
 *   le moteur léger `waha-gows` (Go WebSocket, zéro Chrome, faible RAM) ;
 * - la session historique `Test` reste routée vers `waha` (Chrome).
 */

import { supabase } from './supabase';

const env = (import.meta as any)?.env || {};
const directKey: string = env.VITE_WAHA_API_KEY || '';

export const WAHA_CONFIG = {
  baseUrl: (env.VITE_WAHA_BASE_URL || 'https://waha.velarisagent.life').replace(/\/+$/, ''),
  mode: (env.VITE_WAHA_MODE || 'proxy') as 'proxy' | 'direct',
  proxyUrl: '/api/waha-proxy',
  defaultSession: (typeof window !== 'undefined' && localStorage.getItem('waha_session')) || 'Test',
  secondarySession: 'anicet2',
  protectedSessions: ['anicet2'] as readonly string[],
  webhookHmacKey: '5a883800d77cd375559c3bdb8f99d71000b3c177a0affa9907b1cfe0535e824f',
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
 * Nom de session WAHA :
 * - Surcharge explicite locale si définie par un administrateur (`localStorage.waha_session`)
 * - Sinon `studio_<8 premiers caractères de l'id utilisateur>` pour isoler chaque membre
 */
export function wahaSessionNameFor(userId?: string | null): string {
  const custom = typeof window !== 'undefined' ? localStorage.getItem('waha_session') : null;
  if (custom) return custom;
  if (userId) return `studio_${userId.slice(0, 8)}`;
  return WAHA_CONFIG.defaultSession || 'Test';
}

/**
 * Normalisation du chatId WhatsApp (ex: 22656240533@c.us)
 */
export function toChatId(phoneOrChatId: string): string {
  return phoneOrChatId.includes('@') ? phoneOrChatId : `${phoneOrChatId.replace(/[^0-9]/g, '')}@c.us`;
}

async function getAccessToken(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  } catch {
    return null;
  }
}

async function proxyCall(
  action: string,
  sessionName: string,
  extra: Record<string, unknown> = {},
  timeoutMs = 15000
): Promise<Response | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(WAHA_CONFIG.proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ action, session: sessionName, ...extra }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * fetch direct borné dans le temps (utilisé uniquement en fallback hors session utilisateur)
 */
async function wahaFetch(path: string, init: { method?: 'GET' | 'POST'; body?: string } = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const method = init.method ?? 'GET';
  try {
    const headers: Record<string, string> = { Accept: 'application/json', 'Content-Type': 'application/json' };
    if (directKey) headers['X-Api-Key'] = directKey;
    return await fetch(`${WAHA_CONFIG.baseUrl}${path}`, {
      method,
      body: init.body,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ping du serveur WAHA
 */
export async function pingWaha(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/ping`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Récupère toutes les sessions (admin uniquement)
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
 * Récupère le statut d'une session spécifique (null si absente ou injoignable).
 * Auto-provisionne côté serveur les sessions `studio_*` si l'utilisateur est authentifié.
 */
export async function fetchWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<WahaSession | null> {
  try {
    const pRes = await proxyCall('status', sessionName, {}, 12000);
    if (pRes) {
      if (!pRes.ok) return null;
      const pData = await pRes.json().catch(() => null);
      if (pData?.ok && pData.session) {
        return pData.session as WahaSession;
      }
      return null;
    }
  } catch {
    // Repli direct uniquement si aucun JWT
  }

  try {
    const qRes = await fetch(`${WAHA_CONFIG.baseUrl}/api/qr/status?session=${encodeURIComponent(sessionName)}&t=${Date.now()}`);
    if (qRes.ok) {
      const qData = await qRes.json();
      if (qData && qData.session && qData.status !== 'UNREACHABLE') {
        return {
          name: qData.session,
          status: qData.status || (qData.isOnline ? 'WORKING' : 'FAILED'),
          me: qData.phone ? { id: `${qData.phone.replace('+', '')}@c.us`, pushName: qData.pushName } : null,
          timestamps: qData.timestamps || null,
        };
      }
    }
  } catch {
    // repli standard
  }

  return null;
}

/**
 * Assure qu'une session studio existe et tourne sur WAHA GOWS
 */
export async function ensureWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<WahaSession | null> {
  if (isProtectedSession(sessionName)) return fetchWahaSession(sessionName);
  try {
    const pRes = await proxyCall('ensure', sessionName, {}, 18000);
    if (pRes && pRes.ok) {
      const pData = await pRes.json().catch(() => null);
      if (pData?.ok && pData.session) return pData.session as WahaSession;
    }
  } catch {
    // ignore
  }
  return fetchWahaSession(sessionName);
}

async function sessionAction(sessionName: string, action: 'start' | 'stop' | 'restart' | 'logout'): Promise<boolean> {
  if (isProtectedSession(sessionName)) {
    console.warn(`[WAHA] Session ${sessionName} protégée : action « ${action} » refusée`);
    return false;
  }

  try {
    const mapped = action === 'start' ? 'ensure' : action;
    const pRes = await proxyCall(mapped, sessionName, {}, 22000);
    if (pRes) {
      return pRes.ok;
    }
  } catch {
    // repli
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

/** Déconnecte proprement un téléphone (pour changer de numéro) */
export const logoutWahaSession = (sessionName: string = WAHA_CONFIG.defaultSession) => sessionAction(sessionName, 'logout');

/**
 * Redémarre proprement une session WAHA (état FAILED, STOPPED ou régénération QR)
 */
export async function restartWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  if (isProtectedSession(sessionName)) return false;
  return sessionAction(sessionName, 'restart');
}

/**
 * Récupère le QR code sous forme de Blob PNG validé. L'appelant libère l'URL objet.
 */
export async function fetchWahaQrBlob(sessionName: string = WAHA_CONFIG.defaultSession): Promise<{
  success: boolean;
  blobUrl?: string;
  status?: string;
  error?: string;
}> {
  try {
    const pRes = await proxyCall('qr', sessionName, {}, 15000);
    if (pRes) {
      if (pRes.ok && pRes.headers.get('content-type')?.includes('image')) {
        const blob = await pRes.blob();
        return { success: true, blobUrl: URL.createObjectURL(blob), status: 'SCAN_QR_CODE' };
      }
      const errData = await pRes.json().catch(() => null);
      return { success: false, status: 'STARTING', error: errData?.error || `HTTP ${pRes.status}` };
    }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Impossible de récupérer le QR Code' };
  }

  try {
    const qRes = await fetch(`${WAHA_CONFIG.baseUrl}/api/qr/image?session=${encodeURIComponent(sessionName)}&t=${Date.now()}`);
    if (qRes.ok && qRes.headers.get('content-type')?.includes('image')) {
      const blob = await qRes.blob();
      return { success: true, blobUrl: URL.createObjectURL(blob), status: 'SCAN_QR_CODE' };
    }
    const data = await qRes.json().catch(() => null);
    return { success: false, status: data?.status || 'FAILED', error: "En attente d'activation" };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Impossible de joindre la passerelle WAHA' };
  }
}

/**
 * Demande un code d'appairage à 8 chiffres pour connecter WhatsApp sans caméra (1 seul téléphone)
 */
export async function requestWahaPairingCode(
  sessionName: string,
  phoneNumber: string
): Promise<{ ok: boolean; code?: string; error?: string }> {
  if (isProtectedSession(sessionName)) {
    return { ok: false, error: `La session ${sessionName} est protégée.` };
  }
  try {
    const pRes = await proxyCall('pairing-code', sessionName, { phoneNumber }, 18000);
    if (!pRes) {
      return { ok: false, error: 'Connexion utilisateur requise pour générer un code.' };
    }
    const data = await pRes.json().catch(() => ({}));
    if (!pRes.ok || !data?.ok) {
      return { ok: false, error: data?.error || `Erreur (${pRes.status})` };
    }
    return { ok: true, code: data.code };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Impossible de joindre la passerelle WhatsApp.' };
  }
}

/* WAHA renvoie l'identifiant sous plusieurs formes selon le moteur (GOWS / WEBJS / NOWEB) */
function extractMessageId(data: any): string | undefined {
  const id = data?.id ?? data?.messageId ?? data?.key?.id;
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object') return id._serialized ?? id.id;
  return undefined;
}

/* ------------------------------------------------------------------ */
/* Envois : file par session, routés via /api/waha-proxy              */
/* ------------------------------------------------------------------ */

const MAX_PARALLEL_SENDS = 2;
const RETRYABLE = new Set([429, 502, 503]);
const sendQueues = new Map<string, { active: number; waiting: (() => void)[] }>();

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

  const action = path.replace(/^\/api\//, '');

  return withSendSlot(session, async () => {
    for (let attempt = 0; ; attempt++) {
      try {
        const pRes = await proxyCall(action, session, { payload: body }, 30000);
        if (pRes) {
          const data = await pRes.json().catch(() => ({}));
          if (pRes.ok && data?.ok) {
            return { success: true, messageId: extractMessageId(data.data) };
          }
          if (RETRYABLE.has(pRes.status) && attempt < 2) {
            await new Promise(r => setTimeout(r, 800 * 2 ** attempt + Math.random() * 400));
            continue;
          }
          return { success: false, error: data?.error || data?.message || `Erreur WAHA (${pRes.status})` };
        }

        // Repli sans JWT (dev/admin local uniquement)
        const res = await wahaFetch(path, { method: 'POST', body: JSON.stringify(body) }, 30000);
        const data = await res.json().catch(() => ({}));
        if (res.ok) return { success: true, messageId: extractMessageId(data) };
        if (RETRYABLE.has(res.status) && attempt < 2) {
          await new Promise(r => setTimeout(r, 800 * 2 ** attempt + Math.random() * 400));
          continue;
        }
        return { success: false, error: data.message || data.error || `Erreur WAHA (${res.status})` };
      } catch (err: any) {
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
 * OGG/Opus part tel quel ; les autres formats (mp3, webm, m4a) sont convertis par ffmpeg côté WAHA (`convert: true`).
 */
export async function sendWahaVoiceMessage(
  chatId: string,
  audio: Blob,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  const effectiveSession = sessionName || WAHA_CONFIG.defaultSession || 'Test';
  const mime = audio.type || 'audio/ogg';
  const isOgg = mime.includes('ogg') || mime.includes('opus');
  const data = await blobToBase64(audio);
  const ext = mime.includes('mp4') ? 'm4a' : (mime.includes('mpeg') || mime.includes('mp3')) ? 'mp3' : 'webm';
  return postSend('/api/sendVoice', {
    session: effectiveSession,
    chatId: toChatId(chatId),
    convert: !isOgg,
    file: {
      mimetype: isOgg ? 'audio/ogg; codecs=opus' : mime.split(';')[0],
      filename: isOgg ? 'voice.ogg' : `voice.${ext}`,
      data,
    },
  });
}

/**
 * Envoie un fichier ou média hébergé directement sur WhatsApp via WAHA
 */
export async function sendWahaFileMessage(
  chatId: string,
  url: string,
  sessionName: string = WAHA_CONFIG.defaultSession,
  options?: { caption?: string; mimetype?: string; filename?: string }
): Promise<WahaSendTextResponse> {
  const file: Record<string, unknown> = { url };
  if (options?.mimetype) file.mimetype = options.mimetype;
  if (options?.filename) file.filename = options.filename;
  const payload: Record<string, unknown> = {
    session: sessionName,
    chatId: toChatId(chatId),
    file,
  };
  if (options?.caption?.trim()) {
    payload.caption = options.caption.trim();
  }
  return postSend('/api/sendFile', payload);
}

/**
 * Envoie une note vocale native WhatsApp (PTT) à partir d'une URL hébergée.
 */
export async function sendWahaVoiceUrl(
  chatId: string,
  url: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  const session = sessionName || WAHA_CONFIG.defaultSession;
  const filename = url.split('/').pop() || 'voice.ogg';
  return postSend('/api/sendVoice', {
    session,
    chatId: toChatId(chatId),
    file: {
      url,
      mimetype: 'audio/ogg; codecs=opus',
      filename,
    },
  });
}

/**
 * Envoie un message vidéo WhatsApp à partir d'une URL hébergée.
 */
export async function sendWahaVideoMessage(
  chatId: string,
  url: string,
  sessionName: string = WAHA_CONFIG.defaultSession,
  options?: { caption?: string; filename?: string }
): Promise<WahaSendTextResponse> {
  const session = sessionName || WAHA_CONFIG.defaultSession;
  const payload: Record<string, unknown> = {
    session,
    chatId: toChatId(chatId),
    file: {
      url,
      mimetype: 'video/mp4',
      filename: options?.filename || 'video-demo.mp4',
    },
  };
  if (options?.caption?.trim()) {
    payload.caption = options.caption.trim();
  }
  return postSend('/api/sendVideo', payload);
}

export async function markWahaChatSeen(chatId: string, sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  if (isProtectedSession(sessionName)) return false;
  const r = await postSend('/api/sendSeen', { session: sessionName, chatId: toChatId(chatId) });
  return r.success;
}

export async function setWahaChatArchived(
  chatId: string,
  archived: boolean,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<boolean> {
  if (isProtectedSession(sessionName)) return false;
  try {
    const normChat = toChatId(chatId);
    const directRes = await fetch(`${WAHA_CONFIG.baseUrl}/api/chat-archive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session: sessionName,
        chatId: normChat,
        archived,
      }),
    }).catch(() => null);

    if (directRes && directRes.ok) return true;

    const chat = encodeURIComponent(normChat);
    const action = archived ? 'archive' : 'unarchive';
    const res = await wahaFetch(`/api/${encodeURIComponent(sessionName)}/chats/${chat}/${action}`, {
      method: 'POST',
    }, 8000);
    return res.ok;
  } catch {
    return false;
  }
}

export type WahaAck = -1 | 0 | 1 | 2 | 3 | 4;

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

export async function fetchWahaContact(
  chatId: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<{ pushname?: string; name?: string; number?: string } | null> {
  const session = sessionName || WAHA_CONFIG.defaultSession || 'Test';
  const targetId = encodeURIComponent(toChatId(chatId));
  try {
    const res = await wahaFetch(`/api/contacts?contactId=${targetId}&session=${encodeURIComponent(session)}`, {}, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      pushname: data?.pushname || data?.notifyName || undefined,
      name: data?.name || undefined,
      number: data?.number || undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchWahaProfilePicture(
  chatId: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<string | null> {
  const session = sessionName || WAHA_CONFIG.defaultSession || 'Test';
  const targetId = encodeURIComponent(toChatId(chatId));
  try {
    const res = await wahaFetch(`/api/contacts/profile-picture?contactId=${targetId}&session=${encodeURIComponent(session)}`, {}, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.profilePictureURL || null;
  } catch {
    return null;
  }
}

/* ------------------------------------------------------------------ */
/* Heartbeat & reconnexion automatique                                */
/* ------------------------------------------------------------------ */

export type WahaLinkState = 'connecting' | 'online' | 'scan' | 'reconnecting' | 'offline';

export interface WahaHeartbeat {
  state: WahaLinkState;
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

const STUCK_STARTING_MS = 90_000;

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
      const session = await fetchWahaSession(sessionName);
      const latencyMs = Math.round(performance.now() - t0);
      if (!session) {
        if (sessionName.startsWith('studio_') && hb.reconnectAttempts < maxAttempts) {
          await reconnect(null);
          return;
        }
        throw new Error('Session introuvable');
      }

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
