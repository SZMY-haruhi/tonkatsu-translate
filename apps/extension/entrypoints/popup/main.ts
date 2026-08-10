import { sendToActiveTab } from '../../lib/messaging';
import { openControlPanel } from '../../lib/openControlPanel';
import { loadSettings, saveSettings, type DisplayMode } from '../../lib/settings';

const status = document.querySelector<HTMLParagraphElement>('#status');
const translateBtn = document.querySelector<HTMLButtonElement>('#translate');
const stopBtn = document.querySelector<HTMLButtonElement>('#stop');
const restoreBtn = document.querySelector<HTMLButtonElement>('#restore');
const optionsBtn = document.querySelector<HTMLButtonElement>('#open-options');
const modeSelect = document.querySelector<HTMLSelectElement>('#displayMode');

function setStatus(text: string) {
  if (status) status.textContent = text;
}

async function refreshSession() {
  try {
    const state = await sendToActiveTab({ type: 'GET_SESSION' });
    if (!state) {
      setStatus('请先打开普通网页。');
      return;
    }
    if (state.status === 'running') {
      setStatus(`翻译中… ${state.done}/${state.total}`);
    } else if (state.status === 'error') {
      setStatus(state.message);
    } else {
      setStatus('就绪');
    }
  } catch {
    setStatus('页面脚本不可用，请刷新标签页。');
  }
}

async function init() {
  const settings = await loadSettings();
  if (modeSelect) modeSelect.value = settings.displayMode;
  await refreshSession();
  window.setInterval(() => {
    void refreshSession();
  }, 500);
}

modeSelect?.addEventListener('change', async () => {
  const settings = await loadSettings();
  const displayMode = (modeSelect.value === 'replace' ? 'replace' : 'bilingual') as DisplayMode;
  await saveSettings({ ...settings, displayMode });
  // Clear any in-page session so the next translate starts clean in the new mode.
  try {
    await sendToActiveTab({ type: 'PAGE_RESTORE' });
  } catch {
    // ignore pages without content script
  }
  setStatus(displayMode === 'replace' ? '模式：替换' : '模式：双语');
});

translateBtn?.addEventListener('click', async () => {
  setStatus('开始中…');
  try {
    const result = await sendToActiveTab({ type: 'PAGE_TRANSLATE' });
    if (!result) {
      setStatus('没有活动标签页。');
      return;
    }
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus('翻译中…');
    window.setTimeout(() => {
      void refreshSession();
    }, 500);
  } catch {
    setStatus('请刷新标签页后再试。');
  }
});

stopBtn?.addEventListener('click', async () => {
  try {
    await sendToActiveTab({ type: 'PAGE_STOP' });
    setStatus('已停止。');
  } catch {
    setStatus('请刷新标签页后再试。');
  }
});

restoreBtn?.addEventListener('click', async () => {
  try {
    const result = await sendToActiveTab({ type: 'PAGE_RESTORE' });
    if (!result) {
      setStatus('没有活动标签页。');
      return;
    }
    if (!result.ok) {
      setStatus(result.error);
      return;
    }
    setStatus('已还原。');
  } catch {
    setStatus('请刷新标签页后再试。');
  }
});

optionsBtn?.addEventListener('click', () => {
  void openControlPanel().finally(() => window.close());
});

void init();
