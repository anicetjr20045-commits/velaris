import { useSyncExternalStore } from 'react';
import type { ConversationItem } from '../types';

/**
 * Statut lu / non-lu choisi par le studio, partagé entre la boîte de réception
 * et la pastille de navigation. Chaque bascule est liée au dernier échange connu :
 * dès qu'un nouveau message arrive, l'état serveur reprend la main.
 */

type Override = { unread: boolean; at: string };

const KEY = 'velaris.inbox.read.v1';
const listeners = new Set<() => void>();

const load = (): Record<string, Override> => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
};

let overrides: Record<string, Override> = typeof localStorage === 'undefined' ? {} : load();

const emit = () => listeners.forEach(l => l());

export function setConversationUnread(conv: Pick<ConversationItem, 'id' | 'lastExchange'>, unread: boolean) {
  overrides = { ...overrides, [conv.id]: { unread, at: conv.lastExchange } };
  try {
    localStorage.setItem(KEY, JSON.stringify(overrides));
  } catch {
    /* stockage plein ou navigation privée : l'état reste en mémoire */
  }
  emit();
}

export function applyReadState<T extends ConversationItem>(list: T[], state: Record<string, Override> = overrides): T[] {
  return list.map(c => {
    const o = state[c.id];
    return o && o.at === c.lastExchange && !!c.unread !== o.unread ? { ...c, unread: o.unread } : c;
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      overrides = load();
      l();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
};

/** Abonnement React : retourne la table des bascules (référence stable tant que rien ne change) */
export function useReadState() {
  return useSyncExternalStore(subscribe, () => overrides, () => overrides);
}
