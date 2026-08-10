import {
  LOCAL_LMSTUDIO_DEFAULT,
  LOCAL_OLLAMA_DEFAULT,
  type LocalRuntime,
} from '@tonkatsu-translate/provider';
import { sendToBackground } from '../../lib/messaging';
import { DEFAULT_SETTINGS, type Settings } from '../../lib/settings';
import {
  formatHostList,
  parseHostList,
  parseTermList,
} from '../../lib/siteRules';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const status = document.querySelector<HTMLParagraphElement>('#status');
const testBtn = document.querySelector<HTMLButtonElement>('#test');
const testStatus = document.querySelector<HTMLParagraphElement>('#testStatus');
const siteRuleFields = document.querySelector<HTMLElement>('#siteRuleFields');
const siteRulesLabel = document.querySelector<HTMLElement>('#siteRulesLabel');
const siteRulesHelp = document.querySelector<HTMLElement>('#siteRulesHelp');

const fields = {
  baseUrl: document.querySelector<HTMLInputElement>('#baseUrl'),
  apiKey: document.querySelector<HTMLInputElement>('#apiKey'),
  model: document.querySelector<HTMLInputElement>('#model'),
  localBaseUrl: document.querySelector<HTMLInputElement>('#localBaseUrl'),
  localApiKey: document.querySelector<HTMLInputElement>('#localApiKey'),
  localModel: document.querySelector<HTMLInputElement>('#localModel'),
  libreBaseUrl: document.querySelector<HTMLInputElement>('#libreBaseUrl'),
  deeplApiKey: document.querySelector<HTMLInputElement>('#deeplApiKey'),
  deeplPlan: document.querySelector<HTMLSelectElement>('#deeplPlan'),
  sourceLang: document.querySelector<HTMLSelectElement>('#sourceLang'),
  targetLang: document.querySelector<HTMLSelectElement>('#targetLang'),
  selectionTranslateEnabled: document.querySelector<HTMLInputElement>(
    '#selectionTranslateEnabled',
  ),
  siteRulesHosts: document.querySelector<HTMLTextAreaElement>('#siteRulesHosts'),
  maxConcurrency: document.querySelector<HTMLInputElement>('#maxConcurrency'),
  doNotTranslate: document.querySelector<HTMLTextAreaElement>('#doNotTranslate'),
};

function checkedValue(name: string): string | undefined {
  return document.querySelector<HTMLInputElement>(
    `input[name="${name}"]:checked`,
  )?.value;
}

function setChecked(name: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[name="${name}"][value="${value}"]`,
  );
  if (input) input.checked = true;
}

function readEngine(): Settings['engine'] {
  const value = checkedValue('engine');
  if (
    value === 'mymemory' ||
    value === 'libretranslate' ||
    value === 'openai-compatible' ||
    value === 'local-openai'
  ) {
    return value;
  }
  return 'deepl';
}

function readLocalRuntime(): LocalRuntime {
  const value = checkedValue('localRuntime');
  if (value === 'lmstudio' || value === 'custom') return value;
  return 'ollama';
}

function ensureLangOption(select: HTMLSelectElement | null, value: string) {
  if (!select) return;
  if (Array.from(select.options).some((option) => option.value === value)) return;
  const option = document.createElement('option');
  option.value = value;
  option.textContent = value;
  select.appendChild(option);
}

function readForm(): Settings {
  const concurrency = Number(fields.maxConcurrency?.value);
  const localRuntime = readLocalRuntime();
  const siteListMode =
    checkedValue('siteListMode') === 'denylist' ? 'denylist' : 'allowlist';
  return {
    ...DEFAULT_SETTINGS,
    engine: readEngine(),
    baseUrl: fields.baseUrl?.value.trim() || DEFAULT_SETTINGS.baseUrl,
    apiKey: fields.apiKey?.value ?? '',
    model: fields.model?.value.trim() || DEFAULT_SETTINGS.model,
    localRuntime,
    localBaseUrl:
      fields.localBaseUrl?.value.trim() ||
      (localRuntime === 'custom' ? '' : DEFAULT_SETTINGS.localBaseUrl),
    localApiKey: fields.localApiKey?.value ?? '',
    localModel:
      fields.localModel?.value.trim() || DEFAULT_SETTINGS.localModel,
    libreBaseUrl:
      fields.libreBaseUrl?.value.trim() || DEFAULT_SETTINGS.libreBaseUrl,
    deeplApiKey: fields.deeplApiKey?.value ?? '',
    deeplPlan: fields.deeplPlan?.value === 'pro' ? 'pro' : 'free',
    sourceLang:
      fields.sourceLang?.value.trim() || DEFAULT_SETTINGS.sourceLang,
    targetLang: fields.targetLang?.value || DEFAULT_SETTINGS.targetLang,
    displayMode:
      checkedValue('displayMode') === 'bilingual' ? 'bilingual' : 'replace',
    selectionTranslateEnabled:
      fields.selectionTranslateEnabled?.checked ?? false,
    maxConcurrency:
      Number.isFinite(concurrency) && concurrency > 0
        ? Math.min(12, Math.floor(concurrency))
        : DEFAULT_SETTINGS.maxConcurrency,
    siteRules: {
      mode:
        checkedValue('siteScope') === 'whitelist' ? siteListMode : 'off',
      hosts: parseHostList(fields.siteRulesHosts?.value ?? ''),
    },
    siteListMode,
    doNotTranslate: parseTermList(fields.doNotTranslate?.value ?? ''),
  };
}

function syncEngineUi() {
  const engine = readEngine();
  document.querySelectorAll<HTMLElement>('[data-provider]').forEach((panel) => {
    panel.hidden = panel.dataset.provider !== engine;
  });
}

function syncSiteRulesUi() {
  const whitelist = checkedValue('siteScope') === 'whitelist';
  const allowlist = checkedValue('siteListMode') !== 'denylist';
  if (siteRuleFields) siteRuleFields.hidden = !whitelist;
  if (siteRulesLabel) {
    siteRulesLabel.textContent = allowlist ? '允许的主机' : '禁止的主机';
  }
  if (siteRulesHelp) {
    siteRulesHelp.textContent = allowlist
      ? '保存后刷新目标网页。未列出的站点会同时禁用整页翻译和划词翻译。'
      : '保存后刷新目标网页。列出的站点会同时禁用整页翻译和划词翻译。';
  }
}

function fillForm(settings: Settings) {
  setChecked('engine', settings.engine);
  setChecked('localRuntime', settings.localRuntime);
  setChecked('displayMode', settings.displayMode);
  setChecked(
    'siteScope',
    settings.siteRules.mode === 'off' ? 'all' : 'whitelist',
  );
  setChecked('siteListMode', settings.siteListMode);

  if (fields.baseUrl) fields.baseUrl.value = settings.baseUrl;
  if (fields.apiKey) fields.apiKey.value = settings.apiKey;
  if (fields.model) fields.model.value = settings.model;
  if (fields.localBaseUrl) fields.localBaseUrl.value = settings.localBaseUrl;
  if (fields.localApiKey) fields.localApiKey.value = settings.localApiKey;
  if (fields.localModel) fields.localModel.value = settings.localModel;
  if (fields.libreBaseUrl) fields.libreBaseUrl.value = settings.libreBaseUrl;
  if (fields.deeplApiKey) fields.deeplApiKey.value = settings.deeplApiKey;
  if (fields.deeplPlan) fields.deeplPlan.value = settings.deeplPlan;

  ensureLangOption(fields.sourceLang, settings.sourceLang);
  ensureLangOption(fields.targetLang, settings.targetLang);
  if (fields.sourceLang) fields.sourceLang.value = settings.sourceLang;
  if (fields.targetLang) fields.targetLang.value = settings.targetLang;
  if (fields.selectionTranslateEnabled) {
    fields.selectionTranslateEnabled.checked =
      settings.selectionTranslateEnabled;
  }
  if (fields.siteRulesHosts) {
    fields.siteRulesHosts.value = formatHostList(settings.siteRules.hosts);
  }
  if (fields.maxConcurrency) {
    fields.maxConcurrency.value = String(settings.maxConcurrency);
  }
  if (fields.doNotTranslate) {
    fields.doNotTranslate.value = formatHostList(settings.doNotTranslate);
  }

  syncEngineUi();
  syncSiteRulesUi();
}

function setStatus(text: string, state: 'idle' | 'success' | 'error' = 'idle') {
  if (!status) return;
  status.textContent = text;
  status.dataset.state = state;
}

function setTestStatus(text: string, state: 'idle' | 'success' | 'error' = 'idle') {
  if (!testStatus) return;
  testStatus.textContent = text;
  testStatus.dataset.state = state;
}

function showSection(section: string, updateHash = true) {
  const valid = ['general', 'engine', 'sites', 'advanced'];
  const next = valid.includes(section) ? section : 'general';
  document.querySelectorAll<HTMLElement>('[data-page]').forEach((page) => {
    const active = page.dataset.page === next;
    page.hidden = !active;
    page.classList.toggle('is-active', active);
  });
  document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((item) => {
    const active = item.dataset.section === next;
    item.classList.toggle('is-active', active);
    if (active) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });
  if (updateHash) history.replaceState(null, '', `#${next}`);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function applyRuntimeDefaults(runtime: LocalRuntime) {
  if (runtime === 'ollama') {
    if (fields.localBaseUrl) fields.localBaseUrl.value = LOCAL_OLLAMA_DEFAULT;
    if (fields.localModel) fields.localModel.value = 'llama3.2';
  } else if (runtime === 'lmstudio') {
    if (fields.localBaseUrl) fields.localBaseUrl.value = LOCAL_LMSTUDIO_DEFAULT;
    if (fields.localModel) fields.localModel.value = 'local-model';
  } else {
    if (fields.localBaseUrl) fields.localBaseUrl.value = '';
    setStatus('自定义接口地址已清空，请手动填写。');
    fields.localBaseUrl?.focus();
    return;
  }
  setStatus('已填入本地运行时默认值，请确认模型名。');
}

async function init() {
  try {
    const settings = await sendToBackground({ type: 'GET_SETTINGS' });
    fillForm(settings);
    setStatus('设置已加载');
  } catch {
    fillForm(DEFAULT_SETTINGS);
    setStatus('存储不可用，已加载默认设置。', 'error');
  }
  showSection(location.hash.slice(1) || 'general', false);
}

document.querySelectorAll<HTMLButtonElement>('[data-section]').forEach((item) => {
  item.addEventListener('click', () => showSection(item.dataset.section ?? 'general'));
});

document.querySelectorAll<HTMLInputElement>('input[name="engine"]').forEach((input) => {
  input.addEventListener('change', syncEngineUi);
});

document.querySelectorAll<HTMLInputElement>('input[name="siteScope"]').forEach((input) => {
  input.addEventListener('change', syncSiteRulesUi);
});

document.querySelectorAll<HTMLInputElement>('input[name="siteListMode"]').forEach((input) => {
  input.addEventListener('change', syncSiteRulesUi);
});

document.querySelectorAll<HTMLInputElement>('input[name="localRuntime"]').forEach((input) => {
  input.addEventListener('change', () => {
    if (input.checked) applyRuntimeDefaults(readLocalRuntime());
  });
});

fields.deeplApiKey?.addEventListener('change', () => {
  if (fields.deeplApiKey?.value.trim().endsWith(':fx') && fields.deeplPlan) {
    fields.deeplPlan.value = 'free';
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const saved = await sendToBackground({
      type: 'SAVE_SETTINGS',
      settings: readForm(),
    });
    fillForm(saved);
    setStatus('设置已保存。刷新目标网页后生效。', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败。', 'error');
  }
});

testBtn?.addEventListener('click', async () => {
  testBtn.disabled = true;
  setTestStatus('正在测试当前引擎…');
  try {
    await sendToBackground({
      type: 'SAVE_SETTINGS',
      settings: readForm(),
    });
    const result = await sendToBackground({ type: 'TEST_CONNECTION' });
    setTestStatus(
      result.ok
        ? '连接成功。'
        : `连接失败：${result.message ?? '未知错误'}`,
      result.ok ? 'success' : 'error',
    );
  } catch (error) {
    setTestStatus(
      error instanceof Error ? error.message : '连接测试失败。',
      'error',
    );
  } finally {
    testBtn.disabled = false;
  }
});

void init();
