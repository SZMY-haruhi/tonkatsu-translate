import type { TranslationProvider } from './types'

export type MyMemoryProviderConfig = {
  /** Optional email increases free quota per MyMemory docs. */
  email?: string
  endpoint?: string
  fetchImpl?: typeof fetch
  concurrency?: number
}

export const DEFAULT_MYMEMORY_ENDPOINT = 'https://api.mymemory.translated.net/get'

type MyMemoryResponse = {
  responseStatus?: number
  responseData?: {
    translatedText?: string
  }
  quotaFinished?: boolean
  responseDetails?: string
}

/** Lightweight source guess when user selects auto. */
export function guessSourceLang(text: string): string {
  const sample = text.slice(0, 240)
  if (/[\u3040-\u30ff]/.test(sample)) return 'ja'
  if (/[\uac00-\ud7af]/.test(sample)) return 'ko'
  if (/[\u4e00-\u9fff]/.test(sample)) return 'zh-CN'
  return 'en'
}

/** Map BCP-47-ish codes to MyMemory langpair segments. */
export function mapMyMemoryLang(code: string, sampleText = ''): string {
  const normalized = code.trim()
  if (!normalized || normalized.toLowerCase() === 'auto') {
    return sampleText ? guessSourceLang(sampleText) : 'en'
  }
  return normalized
}

function buildUrl(
  endpoint: string,
  text: string,
  source: string,
  target: string,
  email?: string,
): string {
  const url = new URL(endpoint)
  url.searchParams.set('q', text)
  url.searchParams.set('langpair', `${source}|${target}`)
  if (email?.trim()) {
    url.searchParams.set('de', email.trim())
  }
  return url.toString()
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let next = 0
  const limit = Math.max(1, Math.min(concurrency, items.length || 1))

  async function run() {
    while (next < items.length) {
      const index = next
      next += 1
      results[index] = await worker(items[index]!, index)
    }
  }

  await Promise.all(Array.from({ length: limit }, () => run()))
  return results
}

export function createMyMemoryProvider(
  config: MyMemoryProviderConfig = {},
): TranslationProvider {
  const endpoint = config.endpoint ?? DEFAULT_MYMEMORY_ENDPOINT
  const fetchImpl = config.fetchImpl ?? fetch
  const email = config.email
  const concurrency = config.concurrency ?? 3

  async function translateOne(
    text: string,
    sourceLang: string | 'auto',
    targetLang: string,
  ): Promise<string> {
    const source = mapMyMemoryLang(sourceLang, text)
    const target = mapMyMemoryLang(targetLang)
    const response = await fetchImpl(buildUrl(endpoint, text, source, target, email), {
      method: 'GET',
    })

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      const detail = body ? `: ${body.slice(0, 200)}` : ''
      throw new Error(`MyMemory HTTP ${response.status}${detail}`)
    }

    const data = (await response.json()) as MyMemoryResponse
    if (data.quotaFinished) {
      throw new Error('MyMemory 免费配额已用尽，请稍后再试或切换到自备 API。')
    }
    if (data.responseStatus !== 200 || !data.responseData?.translatedText) {
      const detail =
        data.responseDetails || data.responseData?.translatedText || '未知错误'
      throw new Error(`MyMemory 翻译失败：${detail}`)
    }

    return data.responseData.translatedText
  }

  async function translate(input: {
    texts: string[]
    sourceLang: string | 'auto'
    targetLang: string
  }): Promise<string[]> {
    if (input.texts.length === 0) return []

    return mapPool(input.texts, concurrency, async (text) => {
      try {
        return await translateOne(text, input.sourceLang, input.targetLang)
      } catch (error) {
        const err = error instanceof Error ? error : new Error('MyMemory 翻译失败')
        if (err.message.includes('配额')) throw err
        // Soft-fail single items so one bad segment does not abort the page.
        return text
      }
    })
  }

  return {
    id: 'mymemory',
    translate,
    async testConnection() {
      try {
        await translateOne('ping', 'en', 'zh-CN')
        return { ok: true }
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : '连接失败',
        }
      }
    },
  }
}
