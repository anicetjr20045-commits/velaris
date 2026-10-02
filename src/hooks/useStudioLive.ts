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
    const load = () =>
      loaderRef.current()
        .then((value) => {
          if (cancelled) return;
          setData(value);
          setSyncedAt(new Date());
        })
        .catch(() => {});

    load();
    const unsubscribe = subscribeStudioRealtime(tables, load);
    const timer = setInterval(load, pollMs);
    return () => {
      cancelled = true;
      unsubscribe();
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tables.join(','), pollMs, enabled, tick, ...deps]);

  return { data, setData, syncedAt, reload: () => setTick((t) => t + 1) };
}
