import type { TranslationCache } from './types';

function hashString(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i += 1) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

export function makeCacheKey(
  text: string,
  targetLang: string,
  model: string,
  sourceLang: string | 'auto' = 'auto',
): string {
  return `${model}::${sourceLang}::${targetLang}::${hashString(text)}`;
}

export function createMemoryCache(maxEntries = 1000): TranslationCache {
  const store = new Map<string, string>();

  return {
    get(key: string) {
      const value = store.get(key);
      if (value === undefined) return undefined;
      // Refresh LRU order.
      store.delete(key);
      store.set(key, value);
      return value;
    },
    set(key: string, value: string) {
      if (store.has(key)) store.delete(key);
      store.set(key, value);
      while (store.size > maxEntries) {
        const oldest = store.keys().next().value;
        if (oldest === undefined) break;
        store.delete(oldest);
      }
    },
    size() {
      return store.size;
    },
  };
}
