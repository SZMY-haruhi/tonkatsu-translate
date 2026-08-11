import type {
  OpenAICompatibleProviderConfig,
  TranslationProvider,
} from './types';
import { appendOllamaOriginsHintIfNeeded } from './ollamaOrigins';

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function stripCodeFence(content: string): string {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return fenced ? fenced[1].trim() : trimmed;
}

function tryParseJson(text: string): unknown {
  return JSON.parse(text);
}

/** Pull a JSON array out of noisy model output (markdown, preface, etc.). */
function extractJsonArrayText(content: string): string {
  const stripped = stripCodeFence(content);
  if (stripped.startsWith('[')) return stripped;

  const start = stripped.indexOf('[');
  const end = stripped.lastIndexOf(']');
  if (start >= 0 && end > start) {
    return stripped.slice(start, end + 1);
  }
  throw new Error('Provider returned non-JSON translation content');
}

function parseTranslations(content: string, expected: number): string[] {
  let parsed: unknown;
  try {
    parsed = tryParseJson(extractJsonArrayText(content));
  } catch {
    // Common model slip: trailing commas inside arrays.
    try {
      const repaired = extractJsonArrayText(content).replace(/,\s*([\]}])/g, '$1');
      parsed = tryParseJson(repaired);
    } catch {
      throw new Error('Provider returned non-JSON translation content');
    }
  }

  if (!Array.isArray(parsed) || !parsed.every((item) => typeof item === 'string')) {
    throw new Error('Provider JSON must be an array of strings');
  }

  if (parsed.length !== expected) {
    throw new Error(
      `Provider returned ${parsed.length} translations, expected ${expected}`,
    );
  }

  return parsed;
}

/** Qwen3 / Qwen3.5 hybrid-thinking models often fill reasoning_content and leave content empty. */
function shouldDisableThinking(model: string): boolean {
  return /qwen3/i.test(model);
}

/** Hunyuan-MT / Hy-MT dedicated translators prefer a short JSON-only instruction. */
function isHunyuanMtModel(model: string): boolean {
  return /hy-?mt|hunyuan-?mt/i.test(model);
}

function extractMessageContent(message: {
  content?: unknown;
  reasoning_content?: unknown;
}): string {
  if (typeof message.content === 'string' && message.content.trim()) {
    return message.content;
  }
  if (typeof message.reasoning_content === 'string' && message.reasoning_content.trim()) {
    return message.reasoning_content;
  }
  throw new Error('Provider response missing message content');
}

export function buildTranslationSystemPrompt(input: {
  sourceLang: string | 'auto';
  targetLang: string;
  count: number;
  strict: boolean;
  doNotTranslate?: string[];
  model?: string;
}): string {
  const sourceHint =
    !input.sourceLang || input.sourceLang === 'auto'
      ? 'auto-detect the source language'
      : `treat the source language as ${input.sourceLang}`;

  const keepRules =
    'Preserve person names, team names, gamertags, @handles, and obvious acronyms/abbreviations unchanged. Do not translate or transliterate them.';

  const glossary = (input.doNotTranslate ?? [])
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 80);
  const glossaryRule =
    glossary.length > 0
      ? ` Also keep these glossary terms exactly unchanged: ${glossary.join(', ')}.`
      : '';

  // Compact prompt for dedicated MT checkpoints (Hy-MT / Hunyuan-MT).
  // Still pass keep/glossary — placeholders [[Tn]] / names must survive.
  if (input.model && isHunyuanMtModel(input.model)) {
    const src =
      !input.sourceLang || input.sourceLang === 'auto'
        ? ''
        : ` from ${input.sourceLang}`;
    const compactKeep =
      ' Keep [[Tn]] / [[Ln]] markers and glossary names unchanged.';
    if (input.strict) {
      return `Translate each string${src} into ${input.targetLang}.${compactKeep}${glossaryRule} Return ONLY a raw JSON array of strings with exactly ${input.count} items in the same order. No markdown, no keys, no commentary.`;
    }
    return `Translate each string${src} into ${input.targetLang}.${compactKeep}${glossaryRule} Return ONLY a JSON array of translated strings, same length/order as inputs. No markdown.`;
  }

  if (input.strict) {
    return `You are a translation engine. ${sourceHint}. Translate each input string into ${input.targetLang}. ${keepRules}${glossaryRule} Output MUST be a raw JSON array of strings with exactly ${input.count} items in the same order. No markdown fences, no keys, no commentary, no trailing commas.`;
  }

  return `You are a translation engine. ${sourceHint}. Translate each input string into ${input.targetLang}. ${keepRules}${glossaryRule} Reply with ONLY a JSON array of strings, same length/order as inputs. No markdown.`;
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleProviderConfig,
): TranslationProvider {
  const fetchImpl = config.fetchImpl ?? fetch;
  const baseUrl = normalizeBaseUrl(config.baseUrl);
  const endpoint = `${baseUrl}/chat/completions`;

  async function requestOnce(
    input: {
      texts: string[];
      sourceLang: string | 'auto';
      targetLang: string;
    },
    strict: boolean,
  ): Promise<string[]> {
    const system = buildTranslationSystemPrompt({
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      count: input.texts.length,
      strict,
      doNotTranslate: config.doNotTranslate,
      model: config.model,
    });
    const user = JSON.stringify(input.texts);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey.trim()) {
      headers.Authorization = `Bearer ${config.apiKey}`;
    }

    const payload: Record<string, unknown> = {
      model: config.model,
      temperature: strict ? 0 : 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    };
    if (shouldDisableThinking(config.model)) {
      payload.enable_thinking = false;
    }

    const packStarted = Date.now();
    const body = JSON.stringify(payload);
    const packMs = Date.now() - packStarted;

    const fetchStarted = Date.now();
    const timeoutMs = config.timeoutMs ?? 45_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Provider request timed out after ${timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
    const fetchMs = Date.now() - fetchStarted;

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      const detail = errBody ? `: ${errBody.slice(0, 200)}` : '';
      const raw = `Provider HTTP ${response.status} ${response.statusText}${detail}`;
      const message = appendOllamaOriginsHintIfNeeded(raw, baseUrl);
      const err = new Error(message);
      (err as Error & { status?: number }).status = response.status;
      throw err;
    }

    const parseStarted = Date.now();
    const data = (await response.json()) as {
      choices?: Array<{
        message?: { content?: string; reasoning_content?: string };
      }>;
    };
    const content = extractMessageContent(data.choices?.[0]?.message ?? {});
    const translations = parseTranslations(content, input.texts.length);
    const parseMs = Date.now() - parseStarted;

    // Perf probe: packing/parsing = send-side; fetch wait = model/API.
    console.log('[TT-PERF][openai]', {
      texts: input.texts.length,
      chars: input.texts.reduce((n, t) => n + t.length, 0),
      packMs,
      fetchMs,
      parseMs,
      strict,
      endpoint,
    });

    return translations;
  }

  async function translate(input: {
    texts: string[];
    sourceLang: string | 'auto';
    targetLang: string;
  }): Promise<string[]> {
    if (input.texts.length === 0) return [];

    const run = async (strict: boolean) => requestOnce(input, strict);

    try {
      return await run(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const status = (error as Error & { status?: number })?.status;
      if (status === 429 || /429|rate limit|too many requests/i.test(message)) {
        await new Promise((r) => setTimeout(r, 1500));
        return run(true);
      }
      if (
        message.includes('non-JSON') ||
        message.includes('Provider JSON') ||
        message.includes('expected')
      ) {
        return run(true);
      }
      throw error;
    }
  }

  return {
    id: 'openai-compatible',
    translate,
    async testConnection() {
      try {
        await translate({
          texts: ['ping'],
          sourceLang: 'auto',
          targetLang: 'en',
        });
        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : 'Connection failed',
        };
      }
    },
  };
}
