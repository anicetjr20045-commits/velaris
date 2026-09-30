import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  WAHA_CONFIG, 
  fetchWahaSession, 
  startWahaSession, 
  stopWahaSession, 
  sendWahaTextMessage, 
  getWahaQrCodeUrl,
  type WahaSession,
  type WahaSendTextResponse
} from '../services/waha';

export interface UseWahaReturn {
  session: WahaSession | null;
  status: string;
  isOnline: boolean;
  isScanning: boolean;
  isLoading: boolean;
  qrUrl: string;
  error: string | null;
  refresh: () => Promise<void>;
  restart: () => Promise<boolean>;
  stop: () => Promise<boolean>;
  sendText: (chatId: string, text: string) => Promise<WahaSendTextResponse>;
}

export function useWahaSession(sessionName: string = WAHA_CONFIG.defaultSession): UseWahaReturn {
  const [session, setSession] = useState<WahaSession | null>(null);
  const [status, setStatus] = useState<string>('STARTING');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [qrNonce, setQrNonce] = useState<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchWahaSession(sessionName);
      if (data) {
        setSession(data);
        setStatus(data.status || 'UNKNOWN');
        setError(null);
      } else {
        setStatus('FAILED');
      }
    } catch (err: any) {
      setError(err?.message || 'Erreur de connexion WAHA');
      setStatus('DISCONNECTED');
    } finally {
      setIsLoading(false);
    }
  }, [sessionName]);

  const restart = useCallback(async () => {
    setIsLoading(true);
    setStatus('STARTING');
    const ok = await startWahaSession(sessionName);
    setQrNonce(prev => prev + 1);
    await new Promise(r => setTimeout(r, 2000));
    await refresh();
    return ok;
  }, [sessionName, refresh]);

  const stop = useCallback(async () => {
    setIsLoading(true);
    const ok = await stopWahaSession(sessionName);
    await refresh();
    return ok;
  }, [sessionName, refresh]);

  const sendText = useCallback(async (chatId: string, text: string) => {
    return await sendWahaTextMessage(chatId, text, sessionName);
  }, [sessionName]);

  // Polling automatique toutes les 6 secondes
  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      if (isMounted) {
        await refresh();
      }
    };
    poll();

    timerRef.current = setInterval(poll, 6000);

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [refresh]);

  // Détermination de l'état
  const isOnline = status === 'WORKING';
  const isScanning = status === 'SCAN_QR_CODE' || status === 'FAILED' || status === 'STARTING';
  const qrUrl = `${getWahaQrCodeUrl(sessionName)}&nonce=${qrNonce}`;

  return {
    session,
    status,
    isOnline,
    isScanning,
    isLoading,
    qrUrl,
    error,
    refresh,
    restart,
    stop,
    sendText,
  };
}
