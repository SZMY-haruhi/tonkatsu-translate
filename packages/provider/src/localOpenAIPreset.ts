import type { ProviderSettings } from './createProvider'

export const LOCAL_OLLAMA_DEFAULT = 'http://127.0.0.1:11434/v1'
export const LOCAL_LMSTUDIO_DEFAULT = 'http://127.0.0.1:1234/v1'

export type LocalPresetKind = 'ollama' | 'lmstudio'

/** Defaults applied when the user picks a local OpenAI-compatible daemon. */
export function applyLocalPreset<T extends Partial<ProviderSettings>>(
  kind: LocalPresetKind,
  partial?: T,
): T & {
  engine: 'local-openai'
  baseUrl: string
  apiKey: string
  model: string
} {
  const baseUrl = kind === 'ollama' ? LOCAL_OLLAMA_DEFAULT : LOCAL_LMSTUDIO_DEFAULT
  const model = kind === 'ollama' ? 'llama3.2' : 'local-model'

  return {
    ...partial,
    engine: 'local-openai',
    baseUrl,
    // Local daemons usually ignore auth; keep empty unless user already set one.
    apiKey: typeof partial?.apiKey === 'string' ? partial.apiKey : '',
    model,
  }
}
