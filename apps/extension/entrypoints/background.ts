import { translateTextsWithCache } from '@tonkatsu-translate/pipeline';
import {
  cacheModelId,
  createProviderFromSettings,
} from '@tonkatsu-translate/provider';
import { onMessage, sendToActiveTab, type SessionState } from '../lib/messaging';
import { createPersistentCache } from '../lib/persistentCache';
import { loadSettings, saveSettings } from '../lib/settings';

const translationCachePromise = createPersistentCache();
let lastSession: SessionState = { status: 'idle' };

async function getCache() {
  return translationCachePromise;
}

export default defineBackground(() => {
  console.log('[炸猪排翻译] background ready');

  browser.commands.onCommand.addListener((command) => {
    void (async () => {
      if (command === 'translate-page') {
        await sendToActiveTab({ type: 'PAGE_TRANSLATE' });
      }
      if (command === 'restore-page') {
        await sendToActiveTab({ type: 'PAGE_RESTORE' });
      }
    })();
  });

  onMessage(async (message) => {
    switch (message.type) {
      case 'GET_SETTINGS':
        return loadSettings();
      case 'SAVE_SETTINGS':
        return saveSettings(message.settings);
      case 'GET_SESSION':
        return lastSession;
      case 'SESSION_UPDATED':
        lastSession = message.state;
        return;
      case 'TEST_CONNECTION': {
        const settings = await loadSettings();
        const provider = createProviderFromSettings(settings);
        return provider.testConnection();
      }
      case 'TRANSLATE_BATCH': {
        try {
          const settings = await loadSettings();
          const provider = createProviderFromSettings(settings);
          const cache = await getCache();
          const translations = await translateTextsWithCache({
            texts: message.texts,
            targetLang: settings.targetLang,
            sourceLang: settings.sourceLang,
            model: cacheModelId(settings),
            provider,
            cache,
          });
          return { translations };
        } catch (error) {
          return {
            ok: false as const,
            error: error instanceof Error ? error.message : '翻译失败',
          };
        }
      }
      case 'PAGE_STOP':
      case 'PAGE_TRANSLATE':
      case 'PAGE_RESTORE':
        return {
          ok: false as const,
          error: 'Send this message to the active tab content script',
        };
      default: {
        const _exhaustive: never = message;
        return _exhaustive;
      }
    }
  });
});
