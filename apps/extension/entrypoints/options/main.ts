import { DEFAULT_SETTINGS, type Settings } from '../../lib/settings';
import { sendToBackground } from '../../lib/messaging';
import {
  applyLocalPreset,
  type LocalPresetKind,
} from '@tonkatsu-translate/provider';
import {
  formatHostList,
  parseHostList,
  parseTermList,
  type SiteRulesMode,
} from '../../lib/siteRules';

const form = document.querySelector<HTMLFormElement>('#settings-form');
const status = document.querySelector<HTMLParagraphElement>('#status');
const testBtn = document.querySelector<HTMLButtonElement>('#test');
const engineHint = document.querySelector<HTMLParagraphElement>('#engineHint');
const deeplFields = document.querySelector<HTMLElement>('#deeplFields');
const libreFields = document.querySelector<HTMLElement>('#libreFields');
const openaiFields = document.querySelector<HTMLElement>('#openaiFields');
const localPresets = document.querySelector<HTMLElement>('#localPresets');
const modelTipBtn = document.querySelector<HTMLButtonElement>('#modelTipBtn');
const modelTipOpenAi = document.querySelector<HTMLElement>('#model-tip-openai');
const modelTipLocal = document.querySelector<HTMLElement>('#model-tip-local');
const apiKeyTitle = document.querySelector<HTMLElement>('#apiKeyTitle');
const apiKeyHint = document.querySelector<HTMLParagraphElement>('#apiKeyHint');

const fields = {
  engine: document.querySelector<HTMLSelectElement>('#engine'),
  baseUrl: document.querySelector<HTMLInputElement>('#baseUrl'),
  apiKey: document.querySelector<HTMLInputElement>('#apiKey'),
  model: document.querySelector<HTMLInputElement>('#model'),
  libreBaseUrl: document.querySelector<HTMLInputElement>('#libreBaseUrl'),
  deeplApiKey: document.querySelector<HTMLInputElement>('#deeplApiKey'),
  deeplPlan: document.querySelector<HTMLSelectElement>('#deeplPlan'),
  sourceLang: document.querySelector<HTMLSelectElement>('#sourceLang'),
  targetLang: document.querySelector<HTMLSelectElement>('#targetLang'),
  displayMode: document.querySelector<HTMLSelectElement>('#displayMode'),
  siteRulesMode: document.querySelector<HTMLSelectElement>('#siteRulesMode'),
  siteRulesHosts: document.querySelector<HTMLTextAreaElement>('#siteRulesHosts'),
  doNotTranslate: document.querySelector<HTMLTextAreaElement>('#doNotTranslate'),
};

function closeModelTips() {
  modelTipOpenAi?.setAttribute('hidden', '');
  modelTipLocal?.setAttribute('hidden', '');
  modelTipBtn?.setAttribute('aria-expanded', 'false');
}

function activeModelTip(engine: Settings['engine']) {
  return engine === 'local-openai' ? modelTipLocal : modelTipOpenAi;
}

function readEngine(value: string | undefined): Settings['engine'] {
  if (value === 'openai-compatible') return 'openai-compatible';
  if (value === 'local-openai') return 'local-openai';
  if (value === 'libretranslate') return 'libretranslate';
  return 'deepl';
}

function readDeepLPlan(value: string | undefined): Settings['deeplPlan'] {
  return value === 'pro' ? 'pro' : 'free';
}

function readSiteRulesMode(value: string | undefined): SiteRulesMode {
  if (value === 'allowlist' || value === 'denylist') return value;
  return 'off';
}

function ensureLangOption(select: HTMLSelectElement | null, value: string) {
  if (!select) return;
  const exists = Array.from(select.options).some((opt) => opt.value === value);
  if (!exists) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    select.appendChild(opt);
  }
}

function readForm(): Settings {
  return {
    ...DEFAULT_SETTINGS,
    engine: readEngine(fields.engine?.value),
    baseUrl: fields.baseUrl?.value ?? DEFAULT_SETTINGS.baseUrl,
    apiKey: fields.apiKey?.value ?? '',
    model: fields.model?.value ?? DEFAULT_SETTINGS.model,
    libreBaseUrl: fields.libreBaseUrl?.value ?? DEFAULT_SETTINGS.libreBaseUrl,
    deeplApiKey: fields.deeplApiKey?.value ?? '',
    deeplPlan: readDeepLPlan(fields.deeplPlan?.value),
    sourceLang: fields.sourceLang?.value?.trim() || DEFAULT_SETTINGS.sourceLang,
    targetLang: fields.targetLang?.value ?? DEFAULT_SETTINGS.targetLang,
    displayMode:
      fields.displayMode?.value === 'replace' ? 'replace' : 'bilingual',
    siteRules: {
      mode: readSiteRulesMode(fields.siteRulesMode?.value),
      hosts: parseHostList(fields.siteRulesHosts?.value ?? ''),
    },
    doNotTranslate: parseTermList(fields.doNotTranslate?.value ?? ''),
  };
}

function usesOpenAiFields(engine: Settings['engine']) {
  return engine === 'openai-compatible' || engine === 'local-openai';
}

function syncEngineUi(engine: Settings['engine']) {
  const isLocal = engine === 'local-openai';
  if (deeplFields) deeplFields.hidden = engine !== 'deepl';
  if (libreFields) libreFields.hidden = engine !== 'libretranslate';
  if (openaiFields) openaiFields.hidden = !usesOpenAiFields(engine);
  if (localPresets) localPresets.hidden = !isLocal;

  closeModelTips();
  if (modelTipBtn) {
    modelTipBtn.setAttribute(
      'aria-label',
      isLocal ? '查看本机模型填写说明' : '查看 OpenAI 兼容云服务提示',
    );
    modelTipBtn.setAttribute(
      'aria-controls',
      isLocal ? 'model-tip-local' : 'model-tip-openai',
    );
  }

  if (fields.baseUrl) {
    fields.baseUrl.placeholder = isLocal
      ? 'http://127.0.0.1:11434/v1'
      : 'https://api.openai.com/v1';
  }
  if (fields.model) {
    fields.model.placeholder = isLocal ? 'llama3.2' : 'gpt-4o-mini';
  }
  if (apiKeyTitle) {
    apiKeyTitle.textContent = isLocal ? 'API 密钥（可选）' : 'API 密钥';
  }
  if (apiKeyHint) {
    if (isLocal) {
      apiKeyHint.hidden = false;
      apiKeyHint.textContent =
        'Ollama / 多数本机 OpenAI 兼容端口通常可留空；若软件要求密钥再填写。';
    } else if (engine === 'openai-compatible') {
      apiKeyHint.hidden = false;
      apiKeyHint.textContent = '云服务一般需要填写供应商提供的 API Key。';
    } else {
      apiKeyHint.hidden = true;
      apiKeyHint.textContent = '';
    }
  }

  if (engineHint) {
    if (engine === 'deepl') {
      engineHint.textContent =
        '快速档：DeepL 机翻（需 API Key）。适合整页吞吐；难句/专名可再切到质量档 AI。';
    } else if (engine === 'libretranslate') {
      engineHint.textContent =
        '请填写可访问的 LibreTranslate 地址。社区镜像常不稳定，推荐 Docker 自建（默认 localhost:5000）。';
    } else if (isLocal) {
      engineHint.textContent =
        '请先启动本机 Ollama 或 LM Studio 的 OpenAI 兼容端口，再用下方按钮填入默认地址，保存后点「测试连接」。';
    } else {
      engineHint.textContent =
        '质量档：请求将直接发送到你配置的云端 OpenAI 兼容接口（与「本地模型」相互独立配置）。';
    }
  }
}

function fillForm(settings: Settings) {
  if (fields.engine) fields.engine.value = settings.engine;
  if (fields.baseUrl) fields.baseUrl.value = settings.baseUrl;
  if (fields.apiKey) fields.apiKey.value = settings.apiKey;
  if (fields.model) fields.model.value = settings.model;
  if (fields.libreBaseUrl) fields.libreBaseUrl.value = settings.libreBaseUrl;
  if (fields.deeplApiKey) fields.deeplApiKey.value = settings.deeplApiKey;
  if (fields.deeplPlan) fields.deeplPlan.value = settings.deeplPlan;
  ensureLangOption(fields.sourceLang, settings.sourceLang);
  ensureLangOption(fields.targetLang, settings.targetLang);
  if (fields.sourceLang) fields.sourceLang.value = settings.sourceLang;
  if (fields.targetLang) fields.targetLang.value = settings.targetLang;
  if (fields.displayMode) fields.displayMode.value = settings.displayMode;
  if (fields.siteRulesMode) fields.siteRulesMode.value = settings.siteRules.mode;
  if (fields.siteRulesHosts) {
    fields.siteRulesHosts.value = formatHostList(settings.siteRules.hosts);
  }
  if (fields.doNotTranslate) {
    fields.doNotTranslate.value = formatHostList(settings.doNotTranslate);
  }
  syncEngineUi(settings.engine);
}

function setStatus(text: string) {
  if (status) status.textContent = text;
}

function applyPreset(kind: LocalPresetKind) {
  const next = applyLocalPreset(kind, readForm());
  fillForm({ ...readForm(), ...next });
  setStatus(
    kind === 'ollama'
      ? '已填入 Ollama 默认地址。请确认本机模型名后保存并测试连接。'
      : '已填入 LM Studio 默认地址。请确认本机模型名后保存并测试连接。',
  );
}

async function init() {
  try {
    const settings = await sendToBackground({ type: 'GET_SETTINGS' });
    fillForm(settings);
  } catch {
    fillForm(DEFAULT_SETTINGS);
    setStatus('已加载默认设置（存储不可用）。');
  }
}

fields.engine?.addEventListener('change', () => {
  syncEngineUi(readForm().engine);
});

fields.deeplApiKey?.addEventListener('change', () => {
  const key = fields.deeplApiKey?.value?.trim() ?? '';
  if (fields.deeplPlan && key.endsWith(':fx')) {
    fields.deeplPlan.value = 'free';
  }
});

document.querySelector('#presetOllama')?.addEventListener('click', () => {
  applyPreset('ollama');
});
document.querySelector('#presetLmStudio')?.addEventListener('click', () => {
  applyPreset('lmstudio');
});

modelTipBtn?.addEventListener('click', () => {
  if (!modelTipBtn) return;
  const engine = readForm().engine;
  const panel = activeModelTip(engine);
  if (!panel) return;
  const willOpen = panel.hasAttribute('hidden');
  closeModelTips();
  if (willOpen) {
    panel.removeAttribute('hidden');
    modelTipBtn.setAttribute('aria-expanded', 'true');
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
    setStatus('已保存。');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '保存失败。');
  }
});

testBtn?.addEventListener('click', async () => {
  testBtn.disabled = true;
  setStatus('正在测试连接…');
  try {
    await sendToBackground({
      type: 'SAVE_SETTINGS',
      settings: readForm(),
    });
    const result = await sendToBackground({ type: 'TEST_CONNECTION' });
    setStatus(
      result.ok
        ? '连接成功。'
        : `连接失败：${result.message ?? '未知错误'}`,
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : '连接测试失败。');
  } finally {
    testBtn.disabled = false;
  }
});

void init();
