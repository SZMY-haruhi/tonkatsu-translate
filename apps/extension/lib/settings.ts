import {
  DEFAULT_LIBRETRANSLATE_URL,
  LOCAL_LMSTUDIO_DEFAULT,
  LOCAL_OLLAMA_DEFAULT,
  type DeepLPlan,
  type LocalRuntime,
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
  localRuntime: LocalRuntime;
  localBaseUrl: string;
  localApiKey: string;
  localModel: string;
  libreBaseUrl: string;
  deeplApiKey: string;
  deeplPlan: DeepLPlan;
  targetLang: string;
  sourceLang: 'auto' | string;
  displayMode: DisplayMode;
  maxConcurrency: number;
  siteRules: SiteRules;
  /** Last selected list behavior, preserved while site rules are disabled. */
  siteListMode: 'allowlist' | 'denylist';
  /** Terms the model must keep unchanged (names, teams, glossary). */
  doNotTranslate: string[];
  /** Show selection bubble when enabled (Alt+mouseup; suppressed after copy). */
  selectionTranslateEnabled: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  engine: 'deepl',
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  localRuntime: 'ollama',
  localBaseUrl: LOCAL_OLLAMA_DEFAULT,
  localApiKey: '',
  localModel: 'llama3.2',
  libreBaseUrl: DEFAULT_LIBRETRANSLATE_URL,
  deeplApiKey: '',
  deeplPlan: 'free',
  targetLang: 'zh-CN',
  sourceLang: 'auto',
  displayMode: 'replace',
  maxConcurrency: 4,
  /** Off by default — enable in options; when on, Alt+mouseup triggers (see selection.ts). */
  selectionTranslateEnabled: false,
  siteRules: { ...DEFAULT_SITE_RULES, hosts: [] },
  siteListMode: 'allowlist',
  doNotTranslate: [],
};

const STORAGE_KEY = 'tonkatsu.settings';

function isDisplayMode(value: unknown): value is DisplayMode {
  return value === 'bilingual' || value === 'replace';
}

function isDeepLPlan(value: unknown): value is DeepLPlan {
  return value === 'free' || value === 'pro';
}

function isLocalRuntime(value: unknown): value is LocalRuntime {
  return value === 'ollama' || value === 'lmstudio' || value === 'custom';
}

function isEngine(value: unknown): value is ProviderEngine {
  return (
    value === 'deepl' ||
    value === 'mymemory' ||
    value === 'libretranslate' ||
    value === 'openai-compatible' ||
    value === 'local-openai'
  );
}

function normalizeEngine(value: unknown): ProviderEngine {
  if (isEngine(value)) return value;
  return DEFAULT_SETTINGS.engine;
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
    mode:
      raw.mode === 'allowlist' || raw.mode === 'denylist'
        ? raw.mode
        : 'off',
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
  const engine = normalizeEngine(input.engine);
  const deeplApiKey =
    typeof input.deeplApiKey === 'string' ? input.deeplApiKey : DEFAULT_SETTINGS.deeplApiKey;
  let deeplPlan: DeepLPlan = isDeepLPlan(input.deeplPlan)
    ? input.deeplPlan
    : DEFAULT_SETTINGS.deeplPlan;
  // Auto-detect free keys when plan was never set explicitly in older saves.
  if (!isDeepLPlan(input.deeplPlan) && deeplApiKey.trim().endsWith(':fx')) {
    deeplPlan = 'free';
  }

  const hasSeparateLocalConfig =
    typeof input.localBaseUrl === 'string' ||
    typeof input.localApiKey === 'string' ||
    typeof input.localModel === 'string' ||
    isLocalRuntime(input.localRuntime);
  const migratedLocalUrl =
    !hasSeparateLocalConfig &&
    engine === 'local-openai' &&
    typeof input.baseUrl === 'string' &&
    input.baseUrl.trim()
      ? input.baseUrl.trim()
      : DEFAULT_SETTINGS.localBaseUrl;
  const localRuntime = isLocalRuntime(input.localRuntime)
    ? input.localRuntime
    : migratedLocalUrl === LOCAL_LMSTUDIO_DEFAULT
      ? 'lmstudio'
      : migratedLocalUrl === LOCAL_OLLAMA_DEFAULT
        ? 'ollama'
        : engine === 'local-openai' && migratedLocalUrl !== DEFAULT_SETTINGS.localBaseUrl
          ? 'custom'
          : DEFAULT_SETTINGS.localRuntime;
  const localBaseUrl =
    typeof input.localBaseUrl === 'string'
      ? input.localBaseUrl.trim() || (localRuntime === 'custom' ? '' : migratedLocalUrl)
      : migratedLocalUrl;
  const siteRules = mergeSiteRules(input.siteRules);
  const siteListMode =
    input.siteListMode === 'allowlist' || input.siteListMode === 'denylist'
      ? input.siteListMode
      : siteRules.mode === 'denylist'
        ? 'denylist'
        : 'allowlist';

  return {
    engine,
    baseUrl:
      (engine !== 'local-openai' || hasSeparateLocalConfig) &&
      typeof input.baseUrl === 'string' &&
      input.baseUrl.trim()
        ? input.baseUrl.trim()
        : DEFAULT_SETTINGS.baseUrl,
    apiKey:
      (engine !== 'local-openai' || hasSeparateLocalConfig) &&
      typeof input.apiKey === 'string'
        ? input.apiKey
        : DEFAULT_SETTINGS.apiKey,
    model:
      (engine !== 'local-openai' || hasSeparateLocalConfig) &&
      typeof input.model === 'string' &&
      input.model.trim()
        ? input.model.trim()
        : DEFAULT_SETTINGS.model,
    localRuntime,
    localBaseUrl,
    localApiKey:
      typeof input.localApiKey === 'string'
        ? input.localApiKey
        : engine === 'local-openai' && typeof input.apiKey === 'string'
          ? input.apiKey
          : DEFAULT_SETTINGS.localApiKey,
    localModel:
      typeof input.localModel === 'string' && input.localModel.trim()
        ? input.localModel.trim()
        : engine === 'local-openai' &&
            typeof input.model === 'string' &&
            input.model.trim()
          ? input.model.trim()
          : DEFAULT_SETTINGS.localModel,
    libreBaseUrl:
      typeof input.libreBaseUrl === 'string' && input.libreBaseUrl.trim()
        ? input.libreBaseUrl.trim()
        : DEFAULT_SETTINGS.libreBaseUrl,
    deeplApiKey,
    deeplPlan,
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
    siteRules,
    siteListMode,
    doNotTranslate: mergeDoNotTranslate(input.doNotTranslate),
    selectionTranslateEnabled:
      typeof input.selectionTranslateEnabled === 'boolean'
        ? input.selectionTranslateEnabled
        : DEFAULT_SETTINGS.selectionTranslateEnabled,
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
