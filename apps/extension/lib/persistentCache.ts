import {
  createMemoryCache,
  makeCacheKey,
  type TranslationCache,
} from '@tonkatsu-translate/pipeline';

const STORAGE_KEY = 'tonkatsu.translationCache.v1';
const MAX_PERSISTED = 500;

type PersistedEntry = { key: string; value: string };

export async function createPersistentCache(): Promise<TranslationCache> {
  const memory = createMemoryCache(1000);
  try {
    const stored = await browser.storage.local.get(STORAGE_KEY);
    const entries = (stored[STORAGE_KEY] as PersistedEntry[] | undefined) ?? [];
    for (const entry of entries) {
      memory.set(entry.key, entry.value);
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
      // Recreate from recent memory by probing known keys is hard;
      // keep a side list via wrapper.
      await browser.storage.local.set({
        [STORAGE_KEY]: recentEntries.slice(-MAX_PERSISTED),
      });
    } catch {
      // ignore
    }
  };

  const recentEntries: PersistedEntry[] = [];

  return {
    get(key) {
      return memory.get(key);
    },
    set(key, value) {
      memory.set(key, value);
      recentEntries.push({ key, value });
      if (recentEntries.length > MAX_PERSISTED * 2) {
        recentEntries.splice(0, recentEntries.length - MAX_PERSISTED);
      }
      schedulePersist();
    },
    size() {
      return memory.size();
    },
  };
}

export { makeCacheKey };
