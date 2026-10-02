import { useEffect, useRef, useState } from 'react';
import { subscribeStudioRealtime, type StudioLiveTable } from '../services/supabase';

/**
 * Recharge une donnée du studio en temps réel :
 * - à chaque événement Realtime Supabase sur les tables surveillées (dérebond 300 ms),
 * - et par polling de secours (Realtime peut être désactivé côté projet).
 *
 * Garde-fous quotas : une seule requête en vol à la fois (les demandes reçues
 * pendant ce temps sont fusionnées en un seul rechargement), aucune requête onglet
 * masqué, réponse périmée ignorée, polling espacé après des erreurs successives.
 * Retourne la donnée, l'horodatage de la dernière synchro et un rechargement manuel.
 */
export function useStudioLive<T>(
  loader: () => Promise<T>,
  initial: T,
  tables: StudioLiveTable[],
  deps: unknown[] = [],
  { pollMs = 20000, enabled = true }: { pollMs?: number; enabled?: boolean } = {}
) {
  const [data, setData] = useState<T>(initial);
  const [syncedAt, setSyncedAt] = useState<Date | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const initialRef = useRef(initial);
  initialRef.current = initial;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setData(initialRef.current);
      setSyncedAt(new Date());
      return;
    }
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setTimeout> | null = null;
    let inFlight = false;
    let queued = false;
    let errors = 0;

    const load = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (inFlight) {
        queued = true;
        return;
      }
      inFlight = true;
      try {
        const value = await loaderRef.current();
        if (cancelled) return;
        errors = 0;
        setData(value);
        setSyncedAt(new Date());
      } catch {
        errors++;
      } finally {
        inFlight = false;
        if (queued && !cancelled) {
          queued = false;
          void load();
        }
      }
    };

    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 300);
    };

    // Polling de secours : x2 par erreur consécutive, plafonné à 2 minutes
    const schedulePoll = () => {
      const delay = Math.min(120000, pollMs * 2 ** Math.min(errors, 3));
      pollTimer = setTimeout(async () => {
        await load();
        if (!cancelled) schedulePoll();
      }, delay);
    };

    void load();
    const unsubscribe = subscribeStudioRealtime(tables, debouncedLoad);
    schedulePoll();

    // Rafraîchissement instantané au retour sur l'onglet
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') debouncedLoad();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (pollTimer) clearTimeout(pollTimer);
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), pollMs, enabled, tick, ...deps]);

  return { data, setData, syncedAt, reload: () => setTick((t) => t + 1) };
}
