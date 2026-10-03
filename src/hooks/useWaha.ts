import { useState, useEffect, useCallback, useRef } from 'react';
import {
  WAHA_CONFIG,
  fetchWahaSession,
  fetchWahaQrBlob,
  ensureWahaSession,
  isProtectedSession,
  stopWahaSession,
  restartWahaSession,
  sendWahaTextMessage,
  startWahaHeartbeat,
  type WahaHeartbeat,
  type WahaSession,
  type WahaSendTextResponse
} from '../services/waha';
import { supabase } from '../services/supabase';

/**
 * Battement de cœur WAHA (état du flux, latence, reconnexion automatique et manuelle)
 */
export function useWahaHeartbeat(
  sessionName: string,
  { enabled = true, autoReconnect = true }: { enabled?: boolean; autoReconnect?: boolean } = {}
) {
  const [hb, setHb] = useState<WahaHeartbeat>({
    state: 'connecting', sessionStatus: null, latencyMs: null, lastBeatAt: null, failures: 0, reconnectAttempts: 0,
  });
  const ctrlRef = useRef<ReturnType<typeof startWahaHeartbeat> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    // Sans reconnexion automatique (mode démo), le battement reste en lecture seule
    const ctrl = startWahaHeartbeat(sessionName, { onChange: setHb, maxReconnectAttempts: autoReconnect ? 3 : 0 });
    ctrlRef.current = ctrl;
    return () => {
      ctrl.stop();
      ctrlRef.current = null;
    };
  }, [sessionName, enabled, autoReconnect]);

  const reconnect = useCallback(async () => {
    await ctrlRef.current?.reconnect();
  }, []);

  return { ...hb, reconnect };
}

export interface UseWahaReturn {
  session: WahaSession | null;
  status: string;
  isOnline: boolean;
  isScanning: boolean;
  isLoading: boolean;
  /** URL objet du QR code validé (image PNG réelle), null tant qu'aucun QR n'est disponible */
  qrUrl: string | null;
  error: string | null;
  readOnly: boolean;
  refresh: () => Promise<void>;
  restart: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  sendText: (chatId: string, text: string) => Promise<WahaSendTextResponse>;
}

/* Sonde rapide pendant l'appairage, lente une fois la ligne connectée */
const POLL_PAIRING_MS = 6000;
const POLL_CONNECTED_MS = 30000;
/* Le QR WhatsApp tourne toutes les ~20 s */
const QR_REFRESH_MS = 18000;

interface Options {
  /** Lecture seule : ni provisionnement, ni redémarrage, ni écriture Supabase */
  readOnly?: boolean;
  /** Session du studio connecté : seule celle-ci est synchronisée dans wa_sessions */
  syncToStudio?: boolean;
  enabled?: boolean;
}

export function useWahaSession(sessionName: string = WAHA_CONFIG.defaultSession, opts: Options = {}): UseWahaReturn {
  const readOnly = opts.readOnly || isProtectedSession(sessionName);
  const syncToStudio = !!opts.syncToStudio && !readOnly;
  const enabled = opts.enabled ?? true;

  const [session, setSession] = useState<WahaSession | null>(null);
  const [status, setStatus] = useState<string>('STARTING');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [qrNonce, setQrNonce] = useState(0);

  const inFlight = useRef(false);
  /* Dernier état écrit dans wa_sessions : on n'écrit que sur changement */
  const lastSynced = useRef<string | null>(null);

  const syncStudioRow = useCallback(async (data: WahaSession) => {
    const phone = data.me?.id ? data.me.id.split('@')[0] : null;
    const key = `${data.status}|${phone}`;
    if (lastSynced.current === key) return;
    const { data: { session: auth } } = await supabase.auth.getSession();
    if (!auth?.user) return;
    const connected = data.status === 'WORKING';
    const { error: upsertError } = await supabase.from('wa_sessions').upsert(
      {
        user_id: auth.user.id,
        session_name: sessionName,
        status: connected ? 'connected' : data.status === 'SCAN_QR_CODE' ? 'scanning' : 'disconnected',
        phone_number: phone,
        engine_owner: 'velaris_engine',
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'session_name' }
    );
    if (!upsertError) lastSynced.current = key;
  }, [sessionName]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      let data = await fetchWahaSession(sessionName);
      if (!data && !readOnly && sessionName.startsWith('studio_')) {
        // Auto-provisioning de la session studio si elle n'existe pas encore sur WAHA
        data = await ensureWahaSession(sessionName);
      }

      if (data) {
        setSession(data);
        setStatus(data.status || 'UNKNOWN');
        setError(null);
        if (syncToStudio) await syncStudioRow(data);
      } else {
        setStatus('UNREACHABLE');
        setError('Session introuvable ou passerelle WAHA injoignable');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur de connexion WAHA');
      setStatus('UNREACHABLE');
    } finally {
      inFlight.current = false;
      setIsLoading(false);
    }
  }, [sessionName, readOnly, syncToStudio, syncStudioRow]);

  const restart = useCallback(async () => {
    if (readOnly) return false;
    setIsLoading(true);
    setStatus('STARTING');
    setQrUrl(null);
    let ok = await restartWahaSession(sessionName);
    if (!ok && sessionName.startsWith('studio_')) ok = !!(await ensureWahaSession(sessionName));
    await new Promise(r => setTimeout(r, 2000));
    await refresh();
    setQrNonce(n => n + 1);
    return ok;
  }, [sessionName, refresh, readOnly]);

  const stop = useCallback(async () => {
    if (readOnly) return false;
    setIsLoading(true);
    const ok = await stopWahaSession(sessionName);
    await refresh();
    return ok;
  }, [sessionName, refresh, readOnly]);

  const sendText = useCallback(
    (chatId: string, text: string) => sendWahaTextMessage(chatId, text, sessionName),
    [sessionName]
  );

  const isOnline = status === 'WORKING';

  // Polling adaptatif, suspendu quand l'onglet est masqué
  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;
    const loop = async () => {
      if (!document.hidden) await refresh();
      if (!cancelled) timer = setTimeout(loop, isOnline ? POLL_CONNECTED_MS : POLL_PAIRING_MS);
    };
    loop();
    const onVisible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh, enabled, isOnline]);

  // QR code : récupéré en Blob validé tant que la session attend un scan
  useEffect(() => {
    if (!enabled || status !== 'SCAN_QR_CODE' || readOnly) {
      setQrUrl(null);
      return;
    }
    let cancelled = false;
    let current: string | null = null;
    const load = async () => {
      if (document.hidden) return;
      const res = await fetchWahaQrBlob(sessionName);
      if (cancelled) {
        if (res.blobUrl) URL.revokeObjectURL(res.blobUrl);
        return;
      }
      if (res.success && res.blobUrl) {
        if (current) URL.revokeObjectURL(current);
        current = res.blobUrl;
        setQrUrl(res.blobUrl);
      }
    };
    load();
    const timer = setInterval(load, QR_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      if (current) URL.revokeObjectURL(current);
    };
  }, [sessionName, status, enabled, readOnly, qrNonce]);

  return {
    session,
    status,
    isOnline,
    isScanning: status === 'SCAN_QR_CODE',
    isLoading,
    qrUrl,
    error,
    readOnly,
    refresh,
    restart,
    stop,
    sendText,
  };
}
