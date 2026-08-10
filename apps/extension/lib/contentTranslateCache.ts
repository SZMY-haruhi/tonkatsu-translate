import { makeCacheKey } from '@tonkatsu-translate/pipeline'
import { cacheModelId } from '@tonkatsu-translate/provider'
import type { Settings } from './settings'

/** Per-tab session cache: skip background RTT for repeats on the same page. */
const store = new Map<string, string>()
const MAX_ENTRIES = 2500

let meta: {
  targetLang: string
  sourceLang: string
  model: string
} | null = null

function metaFingerprint(settings: Settings) {
  return `${cacheModelId(settings)}|${settings.sourceLang}|${settings.targetLang}`
}

let lastFingerprint = ''

/** Call once when a page translation session starts (or settings change). */
export function resetContentTranslationCache(settings: Settings) {
  store.clear()
  meta = {
    targetLang: settings.targetLang,
    sourceLang: settings.sourceLang,
    model: cacheModelId(settings),
  }
  lastFingerprint = metaFingerprint(settings)
}

/** Ensure cache is keyed for current settings without wiping hits unnecessarily. */
export function ensureContentTranslationCache(settings: Settings) {
  const next = metaFingerprint(settings)
  if (!meta || next !== lastFingerprint) {
    resetContentTranslationCache(settings)
  }
}

function keyFor(text: string): string | null {
  if (!meta) return null
  return makeCacheKey(text, meta.targetLang, meta.model, meta.sourceLang)
}

function remember(key: string, value: string) {
  if (store.has(key)) store.delete(key)
  store.set(key, value)
  while (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest === undefined) break
    store.delete(oldest)
  }
}

/**
 * Resolve translations using content-side cache first; only misses hit `fetchMisses`.
 */
export async function translateTextsWithContentCache(
  texts: string[],
  fetchMisses: (misses: string[]) => Promise<string[]>,
): Promise<string[]> {
  if (texts.length === 0) return []
  const results = new Array<string>(texts.length)
  const missIndexes: number[] = []
  const missTexts: string[] = []

  texts.forEach((text, index) => {
    const key = keyFor(text)
    const hit = key ? store.get(key) : undefined
    if (hit !== undefined) {
      results[index] = hit
    } else {
      missIndexes.push(index)
      missTexts.push(text)
    }
  })

  if (missTexts.length === 0) {
    console.log('[TT-PERF][content-cache] all hits', { texts: texts.length })
    return results
  }

  const translated = await fetchMisses(missTexts)
  translated.forEach((value, offset) => {
    const index = missIndexes[offset]!
    const original = texts[index]!
    results[index] = value
    const key = keyFor(original)
    if (key) remember(key, value)
  })

  if (missIndexes.length < texts.length) {
    console.log('[TT-PERF][content-cache] partial', {
      texts: texts.length,
      hits: texts.length - missIndexes.length,
      misses: missIndexes.length,
    })
  }

  return results
}
