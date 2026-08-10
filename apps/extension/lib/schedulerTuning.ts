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
    return {
      coalesceMs: 80,
      maxBatchSize: mode === 'bilingual' ? 12 : 16,
      maxBatchChars: mode === 'bilingual' ? 1400 : 1200,
      // Single local GPU: keep concurrency low to avoid thrash.
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

  // Cloud OpenAI-compatible quality tier
  return {
    coalesceMs: 100,
    maxBatchSize: mode === 'bilingual' ? 16 : 20,
    maxBatchChars: mode === 'bilingual' ? 1800 : 1600,
    maxInFlight: Math.min(4, user),
  }
}
