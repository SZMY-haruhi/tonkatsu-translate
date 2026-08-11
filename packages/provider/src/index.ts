export type {
  TranslationProvider,
  OpenAICompatibleProviderConfig,
} from './types'
export { createOpenAICompatibleProvider, buildTranslationSystemPrompt } from './openaiCompatible'
export {
  createLibreTranslateProvider,
  mapLibreLang,
  DEFAULT_LIBRETRANSLATE_URL,
  type LibreTranslateProviderConfig,
} from './libreTranslate'
export {
  createDeepLProvider,
  mapDeepLTargetLang,
  mapDeepLSourceLang,
  inferDeepLPlan,
  deeplEndpoint,
  DEEPL_FREE_ENDPOINT,
  DEEPL_PRO_ENDPOINT,
  type DeepLProviderConfig,
  type DeepLPlan,
} from './deepl'
export {
  createMyMemoryProvider,
  inferMyMemorySourceLang,
  MYMEMORY_ENDPOINT,
  type MyMemoryProviderConfig,
} from './myMemory'
export {
  createProviderFromSettings,
  cacheModelId,
  type ProviderEngine,
  type ProviderSettings,
} from './createProvider'
export {
  applyLocalPreset,
  LOCAL_OLLAMA_DEFAULT,
  LOCAL_LMSTUDIO_DEFAULT,
  type LocalPresetKind,
  type LocalRuntime,
} from './localOpenAIPreset'
export {
  isLikelyOllamaEndpoint,
  appendOllamaOriginsHintIfNeeded,
  OLLAMA_ORIGINS_SETUP_HINT_ZH,
} from './ollamaOrigins'
