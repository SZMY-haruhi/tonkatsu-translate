import {
  DEFAULT_LIBRETRANSLATE_URL,
  type ProviderEngine,
} from '@tonkatsu-translate/provider';
import {
  DEFAULT_SITE_RULES,
  type SiteRules,
  type SiteRulesMode,
} from './siteRules';

export type DisplayMode = 'bilingual' | 'replace';
export type { ProviderEngine, SiteRules, SiteRulesMode };

export type Settings = {
  engine: ProviderEngine;
  baseUrl: string;
  apiKey: string;
  model: string;
  libreBaseUrl: string;
  targetLang: string;
  sourceLang: 'auto' | string;
  displayMode: DisplayMode;
  maxConcurrency: number;
  siteRules: SiteRules;
  /** Terms the model must keep unchanged (names, teams, glossary). */
  doNotTranslate: string[];
};

export const DEFAULT_SETTINGS: Settings = {
  engine: 'mymemory',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  libreBaseUrl: DEFAULT_LIBRETRANSLATE_URL,
  targetLang: 'zh-CN',
  sourceLang: 'auto',
  displayMode: 'bilingual',
  maxConcurrency: 4,
  siteRules: { ...DEFAULT_SITE_RULES, hosts: [] },
  doNotTranslate: [],
};

const STORAGE_KEY = 'tonkatsu.settings';

function isDisplayMode(value: unknown): value is DisplayMode {
  return value === 'bilingual' || value === 'replace';
}

function isEngine(value: unknown): value is ProviderEngine {
  return (
    value === 'mymemory' ||
    value === 'libretranslate' ||
    value === 'openai-compatible' ||
    value === 'local-openai'
  );
}

function isSiteRulesMode(value: unknown): value is SiteRulesMode {
  return value === 'off' || value === 'allowlist' || value === 'denylist';
}

function mergeSiteRules(input: unknown): SiteRules {
  if (!input || typeof input !== 'object') {
    return { mode: 'off', hosts: [] };
  }
  const raw = input as Partial<SiteRules>;
  const hosts = Array.isArray(raw.hosts)
    ? raw.hosts.filter((h): h is string => typeof h === 'string' && h.trim().length > 0)
        .map((h) => h.trim().toLowerCase())
    : [];
  return {
    mode: isSiteRulesMode(raw.mode) ? raw.mode : 'off',
    hosts,
  };
}

function mergeDoNotTranslate(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (typeof item !== 'string') continue;
    const term = item.trim();
    if (!term || seen.has(term)) continue;
    seen.add(term);
    out.push(term);
  }
  return out;
}

export function mergeSettings(partial: Partial<Settings> | null | undefined): Settings {
  const input = partial ?? {};
  return {
    engine: isEngine(input.engine) ? input.engine : DEFAULT_SETTINGS.engine,
    baseUrl: typeof input.baseUrl === 'string' && input.baseUrl.trim()
      ? input.baseUrl.trim()
      : DEFAULT_SETTINGS.baseUrl,
    apiKey: typeof input.apiKey === 'string' ? input.apiKey : DEFAULT_SETTINGS.apiKey,
    model: typeof input.model === 'string' && input.model.trim()
      ? input.model.trim()
      : DEFAULT_SETTINGS.model,
    libreBaseUrl:
      typeof input.libreBaseUrl === 'string' && input.libreBaseUrl.trim()
        ? input.libreBaseUrl.trim()
        : DEFAULT_SETTINGS.libreBaseUrl,
    targetLang: typeof input.targetLang === 'string' && input.targetLang.trim()
      ? input.targetLang.trim()
      : DEFAULT_SETTINGS.targetLang,
    sourceLang: typeof input.sourceLang === 'string' && input.sourceLang.trim()
      ? input.sourceLang.trim()
      : DEFAULT_SETTINGS.sourceLang,
    displayMode: isDisplayMode(input.displayMode)
      ? input.displayMode
      : DEFAULT_SETTINGS.displayMode,
    maxConcurrency:
      typeof input.maxConcurrency === 'number' &&
      Number.isFinite(input.maxConcurrency) &&
      input.maxConcurrency > 0
        ? Math.floor(input.maxConcurrency)
        : DEFAULT_SETTINGS.maxConcurrency,
    siteRules: mergeSiteRules(input.siteRules),
    doNotTranslate: mergeDoNotTranslate(input.doNotTranslate),
  };
}

async function storageArea() {
  try {
    if (browser.storage?.sync) return browser.storage.sync;
  } catch {
    // fall through
  }
  return browser.storage.local;
}

export async function loadSettings(): Promise<Settings> {
  const area = await storageArea();
  const result = await area.get(STORAGE_KEY);
  const raw = result[STORAGE_KEY] as Partial<Settings> | undefined;
  return mergeSettings(raw);
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const next = mergeSettings(settings);
  const area = await storageArea();
  await area.set({ [STORAGE_KEY]: next });
  return next;
}
