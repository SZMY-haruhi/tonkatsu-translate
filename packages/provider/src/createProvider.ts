import { createLibreTranslateProvider, DEFAULT_LIBRETRANSLATE_URL } from './libreTranslate'
import { createMyMemoryProvider } from './myMemory'
import { createOpenAICompatibleProvider } from './openaiCompatible'
import type { TranslationProvider } from './types'

export type ProviderEngine =
  | 'mymemory'
  | 'libretranslate'
  | 'openai-compatible'
  | 'local-openai'

export type ProviderSettings = {
  engine: ProviderEngine
  baseUrl: string
  apiKey: string
  model: string
  libreBaseUrl?: string
  maxConcurrency?: number
  doNotTranslate?: string[]
}

export function cacheModelId(settings: ProviderSettings): string {
  if (settings.engine === 'mymemory') return 'mymemory'
  if (settings.engine === 'libretranslate') {
    return `libre:${settings.libreBaseUrl?.trim() || DEFAULT_LIBRETRANSLATE_URL}`
  }
  if (settings.engine === 'local-openai') {
    return `local:${settings.baseUrl.trim()}|${settings.model}`
  }
  return settings.model
}

export function createProviderFromSettings(
  settings: ProviderSettings,
): TranslationProvider {
  if (settings.engine === 'mymemory') {
    return createMyMemoryProvider({
      concurrency: settings.maxConcurrency ?? 3,
    })
  }

  if (settings.engine === 'libretranslate') {
    const baseUrl = settings.libreBaseUrl?.trim() || DEFAULT_LIBRETRANSLATE_URL
    return createLibreTranslateProvider({ baseUrl })
  }

  // openai-compatible and local-openai share the same chat/completions path.
  return createOpenAICompatibleProvider({
    baseUrl: settings.baseUrl,
    apiKey: settings.apiKey,
    model: settings.model,
    doNotTranslate: settings.doNotTranslate,
  })
}
