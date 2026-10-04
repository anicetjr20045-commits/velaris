import { useSyncExternalStore } from 'react';
import type { ConversationItem } from '../types';

/**
 * Statut lu / non-lu et archivage choisi par le studio, partagé entre la boîte de réception
 * et la pastille de navigation. Chaque bascule est liée au dernier échange connu :
 * dès qu'un nouveau message arrive, l'état serveur reprend la main.
 */

type Override = { unread: boolean; at: string };
type ArchiveOverride = { isArchived: boolean; at: string };

const KEY_READ = 'velaris.inbox.read.v1';
const KEY_ARCHIVE = 'velaris.inbox.archive.v1';
const listeners = new Set<() => void>();

const loadMap = <T>(key: string): Record<string, T> => {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
};

let readOverrides: Record<string, Override> = typeof localStorage === 'undefined' ? {} : loadMap<Override>(KEY_READ);
let archiveOverrides: Record<string, ArchiveOverride> = typeof localStorage === 'undefined' ? {} : loadMap<ArchiveOverride>(KEY_ARCHIVE);

let stateVersion = 0;
const emit = () => {
  stateVersion++;
  listeners.forEach(l => l());
};

export function setConversationUnread(conv: Pick<ConversationItem, 'id' | 'lastExchange'>, unread: boolean) {
  readOverrides = { ...readOverrides, [conv.id]: { unread, at: conv.lastExchange } };
  try {
    localStorage.setItem(KEY_READ, JSON.stringify(readOverrides));
  } catch {
    /* stockage plein ou navigation privée : l'état reste en mémoire */
  }
  emit();
}

export function setConversationArchived(conv: Pick<ConversationItem, 'id' | 'lastExchange'>, isArchived: boolean) {
  archiveOverrides = { ...archiveOverrides, [conv.id]: { isArchived, at: conv.lastExchange } };
  try {
    localStorage.setItem(KEY_ARCHIVE, JSON.stringify(archiveOverrides));
  } catch {
    /* stockage plein ou navigation privée : l'état reste en mémoire */
  }
  emit();
}

export function applyReadState<T extends ConversationItem>(
  list: T[],
  readState: Record<string, Override> = readOverrides,
  archiveState: Record<string, ArchiveOverride> = archiveOverrides
): T[] {
  return list.map(c => {
    let unread = c.unread;
    let isArchived = c.isArchived;

    const ro = readState[c.id];
    if (ro && ro.at === c.lastExchange) {
      unread = ro.unread;
    }

    const ao = archiveState[c.id];
    if (ao) {
      isArchived = ao.isArchived;
    }

    return { ...c, unread, isArchived };
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY_READ) {
      readOverrides = loadMap<Override>(KEY_READ);
      emit();
    } else if (e.key === KEY_ARCHIVE) {
      archiveOverrides = loadMap<ArchiveOverride>(KEY_ARCHIVE);
      emit();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener('storage', onStorage);
  };
};

export function useReadState() {
  useSyncExternalStore(
    subscribe,
    () => stateVersion,
    () => stateVersion
  );
  return { readOverrides, archiveOverrides };
}

