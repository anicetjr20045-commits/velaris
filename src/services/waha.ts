/**
 * Service Client WAHA (WhatsApp HTTP API) pour Velaris Studio OS
 * Connexion directe à l'instance WAHA de production : https://waha.velarisagent.life
 */

export const WAHA_CONFIG = {
  baseUrl: 'https://waha.velarisagent.life',
  apiKey: 'b4cffb1ef75fb400a79e30faa3a97802',
  defaultSession: 'Test', // Session principale liée au +22656240533
  secondarySession: 'anicet2', // Session secondaire +22658357772
};

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
  config?: any;
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
 * En-têtes standards pour les requêtes WAHA
 */
function getHeaders(): HeadersInit {
  return {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    'X-Api-Key': WAHA_CONFIG.apiKey,
  };
}

/**
 * fetch borné dans le temps : un serveur WAHA figé ne doit jamais bloquer l'interface
 */
async function wahaFetch(path: string, init: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(`${WAHA_CONFIG.baseUrl}${path}`, { ...init, headers: getHeaders(), signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ping du serveur WAHA
 */
export async function pingWaha(): Promise<boolean> {
  try {
    const res = await wahaFetch('/ping', { method: 'GET' }, 6000);
    return res.ok;
  } catch (err) {
    console.warn('[WAHA] Ping failed:', err);
    return false;
  }
}

/**
 * Récupère toutes les sessions actives sur WAHA
 */
export async function fetchWahaSessions(): Promise<WahaSession[]> {
  try {
    const res = await wahaFetch(`/api/sessions`, {
      method: 'GET',
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[WAHA] fetchSessions error:', err);
    return [];
  }
}

/**
 * Récupère le statut d'une session spécifique
 */
export async function fetchWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<WahaSession | null> {
  try {
    const res = await wahaFetch(`/api/sessions/${sessionName}`, {
      method: 'GET',
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[WAHA] fetchSession(${sessionName}) error:`, err);
    return null;
  }
}

/**
 * Assure qu'une session existe sur WAHA (la provisionne et la démarre si inexistante)
 */
export async function ensureWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<WahaSession | null> {
  try {
    const existing = await fetchWahaSession(sessionName);
    if (existing) {
      if (existing.status === 'STOPPED' || existing.status === 'FAILED') {
        await startWahaSession(sessionName);
      }
      return existing;
    }

    // Création de la session avec configuration haute stabilité (anti-déconnexion)
    const res = await wahaFetch(`/api/sessions`, {
      method: 'POST',
      body: JSON.stringify({
        name: sessionName,
        start: true,
        config: {
          noweb: {
            markOnline: false,
            store: {
              enabled: true,
              fullSync: false,
            },
          },
          webhooks: [
            {
              url: 'http://waha-bridge:3001/webhook',
              events: ['message', 'message.any', 'session.status'],
            },
          ],
        },
      }),
    });

    if (!res.ok) {
      console.warn(`[WAHA] Failed to provision session ${sessionName}: HTTP ${res.status}`);
      return null;
    }

    return await res.json();
  } catch (err) {
    console.error(`[WAHA] ensureWahaSession(${sessionName}) error:`, err);
    return null;
  }
}

/**
 * Démarre ou relance une session WAHA
 */
export async function startWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  try {
    const res = await wahaFetch(`/api/sessions/${sessionName}/start`, {
      method: 'POST',
    });
    return res.ok;
  } catch (err) {
    console.error(`[WAHA] startSession(${sessionName}) error:`, err);
    return false;
  }
}

/**
 * Arrête une session WAHA
 */
export async function stopWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  try {
    const res = await wahaFetch(`/api/sessions/${sessionName}/stop`, {
      method: 'POST',
    });
    return res.ok;
  } catch (err) {
    console.error(`[WAHA] stopSession(${sessionName}) error:`, err);
    return false;
  }
}

/**
 * Redémarre proprement une session WAHA (utile en cas d'état FAILED ou timeout)
 */
export async function restartWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  try {
    const res = await wahaFetch(`/api/sessions/${sessionName}/restart`, {
      method: 'POST',
    });
    if (res.ok) return true;
    // Fallback : stop puis start
    await stopWahaSession(sessionName);
    await new Promise(r => setTimeout(r, 1500));
    return await startWahaSession(sessionName);
  } catch (err) {
    console.error(`[WAHA] restartSession(${sessionName}) error:`, err);
    return false;
  }
}

/**
 * URL directe du QR code de jumelage avec authentification par query param
 */
export function getWahaQrCodeUrl(sessionName: string = WAHA_CONFIG.defaultSession): string {
  // L'URL accepte directement le paramètre ?x-api-key pour charger l'image PNG dans un tag <img>
  return `${WAHA_CONFIG.baseUrl}/api/${sessionName}/auth/qr?x-api-key=${WAHA_CONFIG.apiKey}&t=${Date.now()}`;
}

/**
 * Récupère le QR code en tant que Blob d'image validé (évite les erreurs 422 JSON sous forme d'image cassée)
 */
export async function fetchWahaQrBlob(sessionName: string = WAHA_CONFIG.defaultSession): Promise<{
  success: boolean;
  blobUrl?: string;
  status?: string;
  error?: string;
}> {
  try {
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/${sessionName}/auth/qr?x-api-key=${WAHA_CONFIG.apiKey}&t=${Date.now()}`);
    if (res.status === 200 && res.headers.get('content-type')?.includes('image')) {
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      return { success: true, blobUrl, status: 'SCAN_QR_CODE' };
    }
    const json = await res.json().catch(() => null);
    return {
      success: false,
      status: json?.status || 'STARTING',
      error: json?.error || `HTTP ${res.status}`
    };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Impossible de joindre la passerelle WAHA' };
  }
}

/**
 * Envoie un message texte en direct sur WhatsApp via WAHA
 */
export async function sendWahaTextMessage(
  chatId: string,
  text: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  return postSend('/api/sendText', {
    session: sessionName,
    chatId: toChatId(chatId),
    text: text,
  });
}

/* WAHA renvoie l'identifiant sous plusieurs formes selon le moteur (WEBJS / NOWEB) */
function extractMessageId(data: any): string | undefined {
  const id = data?.id ?? data?.messageId ?? data?.key?.id;
  if (typeof id === 'string') return id;
  if (id && typeof id === 'object') return id._serialized ?? id.id;
  return undefined;
}

async function postSend(path: string, body: Record<string, unknown>): Promise<WahaSendTextResponse> {
  try {
    const res = await wahaFetch(path, { method: 'POST', body: JSON.stringify(body) }, 30000);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.message || `Erreur WAHA (${res.status})` };
    }
    return { success: true, messageId: extractMessageId(data) };
  } catch (err: any) {
    console.error(`[WAHA] ${path} error:`, err);
    return {
      success: false,
      error: err?.name === 'AbortError' ? 'Le serveur WAHA met trop de temps à répondre' : err?.message || 'Impossible de joindre le serveur WAHA',
    };
  }
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
      filename: isOgg ? 'voice.ogg' : `voice.${mime.includes('mp4') ? 'm4a' : 'webm'}`,
      data,
    },
  });
}

/**
 * Marque la discussion comme lue côté WhatsApp (coches bleues chez le client)
 */
export async function markWahaChatSeen(chatId: string, sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
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
    const res = await wahaFetch(`/api/${sessionName}/chats/${chat}/messages?limit=${limit}&downloadMedia=false`, { method: 'GET' }, 8000);
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

/**
 * Battement régulier sur la session WAHA :
 * - sonde l'état toutes les `intervalMs` (espacement exponentiel en cas d'échec, plafonné à 60 s),
 * - relance la session si WAHA la signale STOPPED / FAILED (tentatives bornées),
 * - se met en veille quand l'onglet est caché et repart immédiatement au retour réseau / onglet.
 * Retourne une fonction d'arrêt et de relance manuelle.
 */
export function startWahaHeartbeat(
  sessionName: string,
  { intervalMs = 15000, maxReconnectAttempts = 3, onChange }: HeartbeatOptions
): { stop: () => void; beatNow: () => void; reconnect: () => Promise<void> } {
  let hb: WahaHeartbeat = { state: 'connecting', sessionStatus: null, latencyMs: null, lastBeatAt: null, failures: 0, reconnectAttempts: 0 };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  let inFlight = false;

  const emit = (patch: Partial<WahaHeartbeat>) => {
    hb = { ...hb, ...patch };
    if (!stopped) onChange(hb);
  };

  const schedule = () => {
    if (stopped) return;
    if (timer) clearTimeout(timer);
    const delay = hb.failures === 0 ? intervalMs : Math.min(60000, intervalMs * 2 ** Math.min(hb.failures, 3));
    timer = setTimeout(beat, delay);
  };

  const reconnect = async () => {
    emit({ state: 'reconnecting', reconnectAttempts: hb.reconnectAttempts + 1 });
    const ok = sessionName.startsWith('studio_') ? !!(await ensureWahaSession(sessionName)) : await startWahaSession(sessionName);
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
      const res = await wahaFetch(`/api/sessions/${sessionName}`, { method: 'GET' }, 8000);
      const latencyMs = Math.round(performance.now() - t0);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const session: WahaSession = await res.json();
      const status = session.status;
      if (status === 'WORKING') {
        emit({ state: 'online', sessionStatus: status, latencyMs, lastBeatAt: Date.now(), failures: 0, reconnectAttempts: 0 });
      } else if (status === 'SCAN_QR_CODE') {
        emit({ state: 'scan', sessionStatus: status, latencyMs, lastBeatAt: Date.now(), failures: 0 });
      } else if (status === 'STARTING') {
        emit({ state: 'reconnecting', sessionStatus: status, latencyMs, lastBeatAt: Date.now(), failures: 0 });
      } else {
        emit({ sessionStatus: status, latencyMs, lastBeatAt: Date.now(), failures: hb.failures + 1 });
        if (hb.reconnectAttempts < maxReconnectAttempts) await reconnect();
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
      emit({ reconnectAttempts: 0 });
      await reconnect();
      beatNow();
    },
  };
}
