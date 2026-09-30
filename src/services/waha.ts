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
 * Ping du serveur WAHA
 */
export async function pingWaha(): Promise<boolean> {
  try {
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/ping`, {
      method: 'GET',
      headers: getHeaders(),
    });
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
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/sessions`, {
      method: 'GET',
      headers: getHeaders(),
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
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/sessions/${sessionName}`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.warn(`[WAHA] fetchSession(${sessionName}) error:`, err);
    return null;
  }
}

/**
 * Démarre ou relance une session WAHA
 */
export async function startWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): Promise<boolean> {
  try {
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/sessions/${sessionName}/start`, {
      method: 'POST',
      headers: getHeaders(),
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
    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/sessions/${sessionName}/stop`, {
      method: 'POST',
      headers: getHeaders(),
    });
    return res.ok;
  } catch (err) {
    console.error(`[WAHA] stopSession(${sessionName}) error:`, err);
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
 * Envoie un message texte en direct sur WhatsApp via WAHA
 */
export async function sendWahaTextMessage(
  chatId: string,
  text: string,
  sessionName: string = WAHA_CONFIG.defaultSession
): Promise<WahaSendTextResponse> {
  try {
    // Normalisation du chatId WhatsApp (ex: 22656240533@c.us)
    const normalizedChatId = chatId.includes('@') 
      ? chatId 
      : `${chatId.replace(/[^0-9]/g, '')}@c.us`;

    const res = await fetch(`${WAHA_CONFIG.baseUrl}/api/sendText`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        session: sessionName,
        chatId: normalizedChatId,
        text: text,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        success: false,
        error: data.message || `Erreur WAHA (${res.status})`,
      };
    }

    return {
      success: true,
      messageId: data.id || data.messageId,
    };
  } catch (err: any) {
    console.error('[WAHA] sendTextMessage error:', err);
    return {
      success: false,
      error: err.message || 'Impossible de joindre le serveur WAHA',
    };
  }
}
