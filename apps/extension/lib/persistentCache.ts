import {
  createMemoryCache,
  type TranslationCache,
} from '@tonkatsu-translate/pipeline';

const STORAGE_KEY = 'tonkatsu.translationCache.v1';
/** Persist more entries for long encyclopedia / news sessions. */
const MAX_PERSISTED = 2000;
const MEMORY_ENTRIES = 4000;

type PersistedEntry = { key: string; value: string };

export async function createPersistentCache(): Promise<TranslationCache> {
  const memory = createMemoryCache(MEMORY_ENTRIES);
  const recentByKey = new Map<string, string>();

  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const entries = (stored[STORAGE_KEY] as PersistedEntry[] | undefined) ?? [];
    for (const entry of entries) {
      memory.set(entry.key, entry.value);
      recentByKey.set(entry.key, entry.value);
    }
  } catch {
    // ignore hydration failures
  }

  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  const schedulePersist = () => {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      void persist();
    }, 400);
  };

  const persist = async () => {
    try {
      const entries: PersistedEntry[] = [];
      for (const [key, value] of recentByKey) {
        entries.push({ key, value });
      }
      await browser.storage.local.set({
        [STORAGE_KEY]: entries.slice(-MAX_PERSISTED),
      });
    } catch {
      // ignore
    }
  };

  return {
    get(key) {
      return memory.get(key);
    },
    set(key, value) {
      memory.set(key, value);
      // Refresh insertion order for persistence LRU-ish trim.
      if (recentByKey.has(key)) recentByKey.delete(key);
      recentByKey.set(key, value);
      while (recentByKey.size > MAX_PERSISTED) {
        const oldest = recentByKey.keys().next().value;
        if (oldest === undefined) break;
        recentByKey.delete(oldest);
      }
      schedulePersist();
    },
    size() {
      return memory.size();
    },
  };
}

export { makeCacheKey } from '@tonkatsu-translate/pipeline';
