import type { ProviderEngine } from '@tonkatsu-translate/provider'

export type SchedulerMode = 'bilingual' | 'replace'

export type SchedulerTuning = {
  coalesceMs: number
  /** Soft cap on items per provider request. */
  maxBatchSize: number
  /** Soft cap on total characters per provider request. */
  maxBatchChars: number
  /** Parallel in-flight provider requests. */
  maxInFlight: number
}

/**
 * Engine-aware batching / concurrency.
 * Character budgets approximate ~300–500 tokens of mixed web text.
 */
export function resolveSchedulerTuning(
  engine: ProviderEngine,
  mode: SchedulerMode,
  userMaxConcurrency?: number,
): SchedulerTuning {
  const user = Math.max(
    1,
    Math.floor(
      typeof userMaxConcurrency === 'number' && Number.isFinite(userMaxConcurrency)
        ? userMaxConcurrency
        : 4,
    ),
  )

  if (engine === 'local-openai') {
    // Smaller batches = fewer silent JSON/echo failures on long wiki paragraphs.
    return {
      coalesceMs: mode === 'replace' ? 40 : 60,
      maxBatchSize: mode === 'bilingual' ? 12 : 6,
      maxBatchChars: mode === 'bilingual' ? 1600 : 2200,
      maxInFlight: Math.min(2, user),
    }
  }

  if (engine === 'mymemory') {
    return {
      coalesceMs: 80,
      maxBatchSize: mode === 'bilingual' ? 12 : 16,
      maxBatchChars: mode === 'bilingual' ? 1400 : 1200,
      // Anonymous service: avoid multiplying its per-IP rate pressure.
      maxInFlight: Math.min(2, user),
    }
  }

  if (engine === 'deepl' || engine === 'libretranslate') {
    return {
      coalesceMs: 60,
      maxBatchSize: mode === 'bilingual' ? 24 : 32,
      maxBatchChars: mode === 'bilingual' ? 2800 : 2400,
      maxInFlight: Math.min(8, user),
    }
  }

  // Cloud OpenAI-compatible quality tier — modest batches + lower fan-out to
  // reduce provider rate-limit stalls on long encyclopedia pages.
  return {
    coalesceMs: 100,
    maxBatchSize: mode === 'bilingual' ? 10 : 8,
    maxBatchChars: mode === 'bilingual' ? 1200 : 1000,
    maxInFlight: Math.min(3, user),
  }
}
