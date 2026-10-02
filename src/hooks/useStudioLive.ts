import { useEffect, useRef, useState } from 'react';
import { subscribeStudioRealtime, type StudioLiveTable } from '../services/supabase';

/**
 * Recharge une donnée du studio en temps réel :
 * - à chaque événement Realtime Supabase sur les tables surveillées,
 * - et par polling de secours (Realtime peut être désactivé côté projet).
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

    const load = () => {
      if (document.visibilityState !== 'visible') return;
      loaderRef.current()
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setSyncedAt(new Date());
        })
        .catch(() => {});
    };

    const debouncedLoad = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(load, 300);
    };

    // Premier chargement immédiat
    load();

    // Abonnement Supabase Realtime avec dérebond
    const unsubscribe = subscribeStudioRealtime(tables, debouncedLoad);

    // Polling de secours intelligent (actif seulement si l'onglet est visible)
    const timer = setInterval(load, pollMs);

    // Rafraîchissement instantané au retour sur l'onglet
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), pollMs, enabled, tick, ...deps]);

  return { data, setData, syncedAt, reload: () => setTick((t) => t + 1) };
}
