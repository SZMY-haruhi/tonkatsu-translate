import { bindEdgeDock } from '../lib/edgeDock';
import { onMessage, sendToBackground, type SessionState } from '../lib/messaging';
import {
  startPageTranslation,
  translateBatchViaBackground,
  type PageSessionControls,
} from '../lib/pageSession';
import { bindSelectionTranslate } from '../lib/selection';
import { getSessionState, setSessionState } from '../lib/session';
import { loadPublicSettings } from '../lib/settings';
import { siteBlockedMessage } from '../lib/siteRules';
import { resetContentTranslationCache } from '../lib/contentTranslateCache';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    let controls: PageSessionControls | null = null;
    let setDockSession = (_state: SessionState) => {};
    let setDockBlocked = (_message: string | null) => {};
    let hostBlocked: string | null = null;

    const publish = async (state: SessionState) => {
      setSessionState(state);
      setDockSession(state);
      try {
        await sendToBackground({ type: 'SESSION_UPDATED', state });
      } catch {
        // ignore
      }
    };

    const refreshHostGate = async () => {
      const settings = await loadPublicSettings();
      hostBlocked = siteBlockedMessage(location.hostname, settings.siteRules);
      setDockBlocked(hostBlocked);
      return hostBlocked;
    };

    const runTranslate = async () => {
      try {
        const blocked = await refreshHostGate();
        if (blocked) {
          await publish({ status: 'error', message: blocked });
          return { ok: false as const, error: blocked };
        }
        // Always restore previous session first so mode switches / re-runs
        // do not stack bilingual inserts on top of replace text (or vice versa).
        controls?.restore();
        controls = null;
        const settings = await loadPublicSettings();
        resetContentTranslationCache(settings);
        controls = startPageTranslation({
          mode: settings.displayMode,
          translateBatch: translateBatchViaBackground,
          maxConcurrency: settings.maxConcurrency,
          targetLang: settings.targetLang,
          engine: settings.engine,
          glossaryTerms: settings.doNotTranslate,
          onProgress: (state) => {
            void publish(state);
          },
        });
        await publish({ status: 'running', done: 0, total: 0 });
        return { ok: true as const };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : '无法开始翻译';
        await publish({ status: 'error', message: errorMessage });
        return { ok: false as const, error: errorMessage };
      }
    };

    const runStop = async () => {
      controls?.stop();
      controls = null;
      await publish({ status: 'idle' });
      return { ok: true as const };
    };

    const runRestore = async () => {
      controls?.restore();
      controls = null;
      await publish({ status: 'idle' });
      return { ok: true as const };
    };

    const dock = bindEdgeDock({
      onToggle: (nextActive) => {
        if (nextActive) void runTranslate();
        else void runRestore();
      },
    });
    setDockSession = dock.setSession;
    setDockBlocked = dock.setHostBlocked;
    void refreshHostGate();

    bindSelectionTranslate({
      enabled: async () => {
        if (hostBlocked) return false;
        const settings = await loadPublicSettings();
        return settings.selectionTranslateEnabled;
      },
      translate: async (text) => {
        await refreshHostGate();
        if (hostBlocked) throw new Error(hostBlocked);
        const [translated] = await translateBatchViaBackground([text]);
        return translated ?? text;
      },
    });

    onMessage((message) => {
      switch (message.type) {
        case 'GET_SESSION':
          return getSessionState();
        case 'PAGE_STOP':
          return runStop();
        case 'PAGE_RESTORE':
          return runRestore();
        case 'PAGE_TRANSLATE':
          return runTranslate();
        default:
          return undefined;
      }
    });
  },
});
