import {
  DOMTranslator,
  IntersectionScheduler,
  NodesTranslator,
  PersistentDOMTranslator,
} from 'domtranslator';
import { createNodesFilter } from 'domtranslator/utils/nodes';
import {
  applyBilingual,
  bilingualStyleText,
  BLOCK_SELECTOR,
  BILINGUAL_ATTR,
  BILINGUAL_SKIP_CLOSEST,
  collectTranslatableBlocks,
  isLeafTextBlock,
  restoreBilingual,
  restoreTree,
  shouldSkipBilingualHost,
} from '@tonkatsu-translate/render';
import type { SessionState } from './messaging';
import { sendToBackground } from './messaging';
import { setSessionState } from './session';
import { looksAlreadyInTargetLang } from './langHeuristics';

type Pending = {
  text: string;
  resolve: (value: string) => void;
  reject: (reason?: unknown) => void;
};

export type PageSessionControls = {
  stop: () => void;
  restore: () => void;
};

type BatcherOptions = {
  translateBatch: (texts: string[]) => Promise<string[]>;
  isStopped: () => boolean;
  onProgress: (doneDelta: number) => void;
  /** Wait to merge nearby requests into one API call. */
  coalesceMs?: number;
  /** Max texts per provider request. */
  maxBatchSize?: number;
  /** Max parallel provider requests. */
  maxInFlight?: number;
};

/**
 * Coalesce many per-node translate calls into fewer provider round-trips,
 * and allow a small number of parallel in-flight batches.
 */
function createBatchedTranslator(options: BatcherOptions) {
  const coalesceMs = options.coalesceMs ?? 100;
  const maxBatchSize = options.maxBatchSize ?? 16;
  const maxInFlight = Math.max(1, options.maxInFlight ?? 3);

  let queue: Pending[] = [];
  let timer: number | null = null;
  let inFlight = 0;

  const schedule = () => {
    if (timer != null) return;
    timer = window.setTimeout(() => {
      timer = null;
      void pump();
    }, coalesceMs);
  };

  const flushOne = async (batch: Pending[]) => {
    try {
      if (options.isStopped()) {
        batch.forEach((item) => item.reject(new Error('已停止')));
        return;
      }
      const translations = await options.translateBatch(batch.map((item) => item.text));
      batch.forEach((item, index) => {
        item.resolve(translations[index] ?? item.text);
      });
      options.onProgress(batch.length);
    } catch (error) {
      batch.forEach((item) => item.reject(error));
    } finally {
      inFlight -= 1;
      if (queue.length > 0) void pump();
    }
  };

  const pump = async () => {
    while (
      !options.isStopped() &&
      inFlight < maxInFlight &&
      queue.length > 0
    ) {
      const batch = queue.splice(0, maxBatchSize);
      inFlight += 1;
      void flushOne(batch);
    }
  };

  return (text: string) =>
    new Promise<string>((resolve, reject) => {
      if (options.isStopped()) {
        reject(new Error('已停止'));
        return;
      }
      if (!text.trim()) {
        resolve(text);
        return;
      }
      queue.push({ text, resolve, reject });
      schedule();
      // If a slot is free and queue is already large, flush without waiting full coalesce.
      if (queue.length >= maxBatchSize && inFlight < maxInFlight) {
        if (timer != null) {
          window.clearTimeout(timer);
          timer = null;
        }
        void pump();
      }
    });
}

function ensureBilingualStyles() {
  const id = 'tt-bilingual-style';
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = bilingualStyleText();
  document.documentElement.appendChild(style);
}

function collectBlockText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  clone.querySelectorAll('.tt-bilingual').forEach((node) => node.remove());
  return (clone.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function isNearViewport(el: Element, margin = 280): boolean {
  const rect = el.getBoundingClientRect();
  return rect.bottom >= -margin && rect.top <= window.innerHeight + margin;
}

function startBilingualTranslation(options: {
  translateBatch: (texts: string[]) => Promise<string[]>;
  onProgress: (state: SessionState) => void;
  maxConcurrency?: number;
  targetLang?: string;
}): PageSessionControls {
  let stopped = false;
  let done = 0;
  let total = 0;
  const targetLang = options.targetLang?.trim() || 'zh-CN';
  const lastText = new WeakMap<Element, string>();
  const queued = new WeakSet<Element>();

  const emit = (state: SessionState) => {
    setSessionState(state);
    options.onProgress(state);
  };

  const translateOne = createBatchedTranslator({
    translateBatch: options.translateBatch,
    isStopped: () => stopped,
    coalesceMs: 120,
    // Smaller batches keep long encyclopedia paragraphs inside model JSON budgets.
    maxBatchSize: 8,
    maxInFlight: options.maxConcurrency ?? 3,
    onProgress: (delta) => {
      done += delta;
      if (!stopped) emit({ status: 'running', done, total: Math.max(total, done) });
    },
  });

  ensureBilingualStyles();

  const clearHost = (el: Element) => {
    el.querySelectorAll('.tt-bilingual').forEach((node) => node.remove());
    el.removeAttribute(BILINGUAL_ATTR);
    lastText.delete(el);
    queued.delete(el);
  };

  const processElement = async (el: Element) => {
    if (stopped) return;
    if (shouldSkipBilingualHost(el) || el.closest(BILINGUAL_SKIP_CLOSEST)) return;
    const text = collectBlockText(el);
    if (text.length < 2) return;
    if (looksAlreadyInTargetLang(text, targetLang)) return;
    if (el.getAttribute(BILINGUAL_ATTR) === '1' && lastText.get(el) === text) return;
    if (queued.has(el) && lastText.get(el) === text) return;
    if (el.getAttribute(BILINGUAL_ATTR) === '1') clearHost(el);

    queued.add(el);
    lastText.set(el, text);
    total += 1;
    emit({ status: 'running', done, total });
    try {
      const translated = await translateOne(text);
      if (stopped) return;
      if (collectBlockText(el) !== text) {
        clearHost(el);
        observer.observe(el);
        return;
      }
      const probe = document.createTextNode('');
      el.appendChild(probe);
      applyBilingual(probe, translated);
      probe.remove();
      lastText.set(el, text);
      queued.delete(el);
    } catch (error) {
      clearHost(el);
      if (!stopped) {
        emit({
          status: 'error',
          message: error instanceof Error ? error.message : '翻译失败',
        });
      }
    }
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting && entry.target instanceof Element) {
          void processElement(entry.target);
        }
      }
    },
    { rootMargin: '280px' },
  );

  const watch = (root: ParentNode) => {
    collectTranslatableBlocks(root).forEach((el) => observer.observe(el));
  };

  const maybeObserve = (el: Element) => {
    if (
      el.matches(BLOCK_SELECTOR) ||
      isLeafTextBlock(el)
    ) {
      observer.observe(el);
      if (isNearViewport(el)) void processElement(el);
    }
  };

  const mutationObserver = new MutationObserver((mutations) => {
    if (stopped) return;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        maybeObserve(node);
        watch(node);
        collectTranslatableBlocks(node).forEach((el) => {
          if (isNearViewport(el)) void processElement(el);
        });
      });
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        const host =
          parent?.closest?.(BLOCK_SELECTOR) ??
          (parent && isLeafTextBlock(parent) ? parent : null);
        if (host instanceof Element && host.getAttribute(BILINGUAL_ATTR) === '1') {
          clearHost(host);
          observer.observe(host);
          if (isNearViewport(host)) void processElement(host);
        }
      }
    }
  });

  emit({ status: 'running', done: 0, total: 0 });
  watch(document);
  // Eagerly queue the first screen so requests coalesce into few API calls.
  collectTranslatableBlocks(document).forEach((el) => {
    if (isNearViewport(el)) void processElement(el);
  });
  mutationObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  return {
    stop() {
      stopped = true;
      observer.disconnect();
      mutationObserver.disconnect();
      emit({ status: 'idle' });
    },
    restore() {
      stopped = true;
      observer.disconnect();
      mutationObserver.disconnect();
      restoreBilingual(document);
      document.getElementById('tt-bilingual-style')?.remove();
      emit({ status: 'idle' });
    },
  };
}

function startReplaceTranslation(options: {
  translateBatch: (texts: string[]) => Promise<string[]>;
  onProgress: (state: SessionState) => void;
  maxConcurrency?: number;
}): PageSessionControls {
  let stopped = false;
  let done = 0;
  let total = 0;

  const emit = (state: SessionState) => {
    setSessionState(state);
    options.onProgress(state);
  };

  const translateCallback = createBatchedTranslator({
    translateBatch: options.translateBatch,
    isStopped: () => stopped,
    coalesceMs: 120,
    maxBatchSize: 16,
    maxInFlight: options.maxConcurrency ?? 3,
    onProgress: (delta) => {
      done += delta;
      if (!stopped) emit({ status: 'running', done, total: Math.max(total, done) });
    },
  });

  const nodesTranslator = new NodesTranslator(async (text, _score) => {
    total += 1;
    emit({ status: 'running', done, total });
    return translateCallback(text);
  });

  const domTranslator = new DOMTranslator(nodesTranslator, {
    scheduler: new IntersectionScheduler({ rootMargin: '280px' }),
    filter: createNodesFilter({
      attributesList: ['title', 'alt', 'placeholder', 'aria-label'],
      ignoredSelectors: [
        'script',
        'style',
        'noscript',
        'code',
        'pre',
        'textarea',
        'svg',
        'math',
        '[contenteditable="true"]',
        '#tt-edge-dock',
        '.tt-selection-bubble',
      ],
    }),
  });

  const persistent = new PersistentDOMTranslator(domTranslator);
  const root = document.documentElement;
  emit({ status: 'running', done: 0, total: 0 });
  try {
    persistent.translate(root);
  } catch (error) {
    emit({
      status: 'error',
      message: error instanceof Error ? error.message : '无法开始翻译',
    });
  }

  const disconnectObservers = () => {
    // PersistentDOMTranslator only exposes restore() for teardown; pull the
    // private observer map so "停止" can halt work without reverting text.
    const storage = (
      persistent as unknown as {
        observedNodesStorage?: Map<Element, { disconnect: () => void }>;
      }
    ).observedNodesStorage;
    const observer = storage?.get(root);
    observer?.disconnect();
    storage?.delete(root);
  };

  return {
    stop() {
      stopped = true;
      disconnectObservers();
      emit({ status: 'idle' });
    },
    restore() {
      stopped = true;
      try {
        restoreTree(persistent, root);
      } catch {
        // Already torn down / never observed — still clear best-effort.
        disconnectObservers();
      }
      emit({ status: 'idle' });
    },
  };
}

export function startPageTranslation(options: {
  mode: 'replace' | 'bilingual';
  translateBatch: (texts: string[]) => Promise<string[]>;
  onProgress: (state: SessionState) => void;
  maxConcurrency?: number;
  targetLang?: string;
}): PageSessionControls {
  if (options.mode === 'bilingual') {
    return startBilingualTranslation(options);
  }
  return startReplaceTranslation(options);
}

export async function translateBatchViaBackground(texts: string[]): Promise<string[]> {
  const response = await sendToBackground({ type: 'TRANSLATE_BATCH', texts });
  if ('translations' in response) return response.translations;
  throw new Error(response.error || '翻译失败');
}
