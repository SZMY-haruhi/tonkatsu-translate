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
const libreFields = document.querySelector<HTMLElement>('#libreFields');
const openaiFields = document.querySelector<HTMLElement>('#openaiFields');
const localPresets = document.querySelector<HTMLElement>('#localPresets');
const modelTipBtn = document.querySelector<HTMLButtonElement>('.tip');
const modelTipPanel = document.querySelector<HTMLElement>('#model-tip');

const fields = {
  engine: document.querySelector<HTMLSelectElement>('#engine'),
  baseUrl: document.querySelector<HTMLInputElement>('#baseUrl'),
  apiKey: document.querySelector<HTMLInputElement>('#apiKey'),
  model: document.querySelector<HTMLInputElement>('#model'),
  libreBaseUrl: document.querySelector<HTMLInputElement>('#libreBaseUrl'),
  sourceLang: document.querySelector<HTMLSelectElement>('#sourceLang'),
  targetLang: document.querySelector<HTMLSelectElement>('#targetLang'),
  displayMode: document.querySelector<HTMLSelectElement>('#displayMode'),
  siteRulesMode: document.querySelector<HTMLSelectElement>('#siteRulesMode'),
  siteRulesHosts: document.querySelector<HTMLTextAreaElement>('#siteRulesHosts'),
  doNotTranslate: document.querySelector<HTMLTextAreaElement>('#doNotTranslate'),
};

function readEngine(value: string | undefined): Settings['engine'] {
  if (value === 'openai-compatible') return 'openai-compatible';
  if (value === 'local-openai') return 'local-openai';
  if (value === 'libretranslate') return 'libretranslate';
  return 'mymemory';
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
  if (libreFields) libreFields.hidden = engine !== 'libretranslate';
  if (openaiFields) openaiFields.hidden = !usesOpenAiFields(engine);
  if (localPresets) localPresets.hidden = engine !== 'local-openai';
  if (engineHint) {
    if (engine === 'mymemory') {
      engineHint.textContent =
        '使用 MyMemory 免费接口，无需 API Key；有配额限制，仅供试用。源语言选「自动」时会按文本粗略判断。';
    } else if (engine === 'libretranslate') {
      engineHint.textContent =
        '请填写可访问的 LibreTranslate 地址。社区镜像常不稳定，推荐 Docker 自建（默认 localhost:5000）。';
    } else if (engine === 'local-openai') {
      engineHint.textContent =
        '请先启动本机 Ollama 或 LM Studio 的 OpenAI 兼容端口，再用下方按钮填入默认地址，保存后点「测试连接」。';
    } else {
      engineHint.textContent = '请求将直接发送到你配置的 OpenAI 兼容接口。';
    }
  }
}

function fillForm(settings: Settings) {
  if (fields.engine) fields.engine.value = settings.engine;
  if (fields.baseUrl) fields.baseUrl.value = settings.baseUrl;
  if (fields.apiKey) fields.apiKey.value = settings.apiKey;
  if (fields.model) fields.model.value = settings.model;
  if (fields.libreBaseUrl) fields.libreBaseUrl.value = settings.libreBaseUrl;
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

document.querySelector('#presetOllama')?.addEventListener('click', () => {
  applyPreset('ollama');
});
document.querySelector('#presetLmStudio')?.addEventListener('click', () => {
  applyPreset('lmstudio');
});

modelTipBtn?.addEventListener('click', () => {
  if (!modelTipPanel || !modelTipBtn) return;
  const open = modelTipPanel.hasAttribute('hidden');
  modelTipPanel.toggleAttribute('hidden', !open);
  modelTipBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
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
