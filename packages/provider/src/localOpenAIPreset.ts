import type { ProviderSettings } from './createProvider'

export const LOCAL_OLLAMA_DEFAULT = 'http://127.0.0.1:11434/v1'
export const LOCAL_LMSTUDIO_DEFAULT = 'http://127.0.0.1:1234/v1'

export type LocalPresetKind = 'ollama' | 'lmstudio'
export type LocalRuntime = LocalPresetKind | 'custom'

/** Defaults applied when the user picks a local OpenAI-compatible daemon. */
export function applyLocalPreset<T extends Partial<ProviderSettings>>(
  kind: LocalPresetKind,
  partial?: T,
): T & {
  engine: 'local-openai'
  localRuntime: LocalPresetKind
  localBaseUrl: string
  localApiKey: string
  localModel: string
} {
  const localBaseUrl =
    kind === 'ollama' ? LOCAL_OLLAMA_DEFAULT : LOCAL_LMSTUDIO_DEFAULT
  const localModel = kind === 'ollama' ? 'llama3.2' : 'local-model'

  return {
    ...partial,
    engine: 'local-openai' as const,
    localRuntime: kind,
    localBaseUrl,
    localApiKey:
      typeof partial?.localApiKey === 'string' ? partial.localApiKey : '',
    localModel,
  } as T & {
    engine: 'local-openai'
    localRuntime: LocalPresetKind
    localBaseUrl: string
    localApiKey: string
    localModel: string
  }
}
