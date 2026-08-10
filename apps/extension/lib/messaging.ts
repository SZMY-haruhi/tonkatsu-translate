export type SessionState =
  | { status: 'idle' }
  | { status: 'running'; done: number; total: number }
  | { status: 'error'; message: string };

export type ExtensionMessage =
  | { type: 'PAGE_TRANSLATE' }
  | { type: 'PAGE_RESTORE' }
  | { type: 'PAGE_STOP' }
  | { type: 'GET_SESSION' }
  | { type: 'SESSION_UPDATED'; state: SessionState }
  | { type: 'GET_SETTINGS' }
  | { type: 'SAVE_SETTINGS'; settings: import('./settings').Settings }
  | { type: 'TEST_CONNECTION' }
  | { type: 'TRANSLATE_BATCH'; texts: string[] };

export type ExtensionResponseMap = {
  PAGE_TRANSLATE: { ok: true } | { ok: false; error: string };
  PAGE_RESTORE: { ok: true } | { ok: false; error: string };
  PAGE_STOP: { ok: true };
  GET_SESSION: SessionState;
  SESSION_UPDATED: void;
  GET_SETTINGS: import('./settings').Settings;
  SAVE_SETTINGS: import('./settings').Settings;
  TEST_CONNECTION: { ok: boolean; message?: string };
  TRANSLATE_BATCH: { translations: string[] } | { ok: false; error: string };
};

export async function sendToBackground<T extends ExtensionMessage['type']>(
  message: Extract<ExtensionMessage, { type: T }>,
): Promise<ExtensionResponseMap[T]> {
  return browser.runtime.sendMessage(message) as Promise<ExtensionResponseMap[T]>;
}

export async function sendToActiveTab<T extends ExtensionMessage['type']>(
  message: Extract<ExtensionMessage, { type: T }>,
): Promise<ExtensionResponseMap[T] | undefined> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  if (tab?.id == null) return undefined;
  return browser.tabs.sendMessage(tab.id, message) as Promise<ExtensionResponseMap[T]>;
}

export function onMessage(
  handler: (message: ExtensionMessage) => Promise<unknown> | unknown,
) {
  browser.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    const result = handler(message as ExtensionMessage);
    if (result === undefined) return false;
    void Promise.resolve(result).then(sendResponse).catch((error: unknown) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : 'Message handler failed',
      });
    });
    return true;
  });
}
