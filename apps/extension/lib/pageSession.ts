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
  isBilingualMarkup,
  isBlockLikeLink,
  restoreBilingual,
  restoreTree,
  shouldSkipBilingualHost,
} from '@tonkatsu-translate/render';
import type { ProviderEngine } from '@tonkatsu-translate/provider';
import type { SessionState } from './messaging';
import { sendToBackground } from './messaging';
import { setSessionState } from './session';
import { looksAlreadyInTargetLang, looksLikeInlineBilingual } from './langHeuristics';
import {
  resolveSchedulerTuning,
  type SchedulerTuning,
} from './schedulerTuning';
import { isNonTranslatableNoise } from './textNoise';
import {
  ensureContentTranslationCache,
  translateTextsWithContentCache,
} from './contentTranslateCache';
import { loadPublicSettings } from './settings';
import { ttPerfMark, ttPerfReset, ttPerfSummary } from './ttPerf';

type Pending = {
  text: string;
  /** 0 = in viewport, 1 = near, 2 = far / background. */
  priority: number;
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
  coalesceMs?: number;
  maxBatchSize?: number;
  maxBatchChars?: number;
  maxInFlight?: number;
};

function takeBatch(
  queues: Pending[][],
  maxBatchSize: number,
  maxBatchChars: number,
): Pending[] {
  const batch: Pending[] = [];
  let chars = 0;
  const pullFrom = (queue: Pending[]) => {
    while (queue.length > 0 && batch.length < maxBatchSize) {
      const next = queue[0]!;
      const nextChars = next.text.length;
      if (batch.length > 0 && chars + nextChars > maxBatchChars) break;
      queue.shift();
      batch.push(next);
      chars += nextChars;
      if (batch.length === 1 && nextChars >= maxBatchChars) break;
    }
  };
  for (const queue of queues) {
    if (batch.length >= maxBatchSize) break;
    if (batch.length > 0 && chars >= maxBatchChars) break;
    pullFrom(queue);
  }
  return batch;
}

function queueDepth(queues: Pending[][]) {
  return queues.reduce((n, q) => n + q.length, 0);
}

function queueChars(queues: Pending[][]) {
  return queues.reduce(
    (n, q) => n + q.reduce((m, item) => m + item.text.length, 0),
    0,
  );
}

/**
 * Coalesce many per-node translate calls into fewer provider round-trips,
 * prefer higher-priority (viewport) work, and allow parallel in-flight batches.
 */
function createBatchedTranslator(options: BatcherOptions) {
  const coalesceMs = options.coalesceMs ?? 100;
  const maxBatchSize = options.maxBatchSize ?? 16;
  const maxBatchChars = options.maxBatchChars ?? 2000;
  const maxInFlight = Math.max(1, options.maxInFlight ?? 3);

  const queues: Pending[][] = [[], [], []];
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
      // Resolve individually so DOM can paint progressively as each item settles.
      batch.forEach((item, index) => {
        item.resolve(translations[index] ?? item.text);
      });
      options.onProgress(batch.length);
    } catch (error) {
      batch.forEach((item) => item.reject(error));
    } finally {
      inFlight -= 1;
      if (queueDepth(queues) > 0) void pump();
    }
  };

  const pump = async () => {
    while (
      !options.isStopped() &&
      inFlight < maxInFlight &&
      queueDepth(queues) > 0
    ) {
      const batch = takeBatch(queues, maxBatchSize, maxBatchChars);
      if (batch.length === 0) break;
      inFlight += 1;
      void flushOne(batch);
    }
  };

  return (text: string, priority = 1) =>
    new Promise<string>((resolve, reject) => {
      if (options.isStopped()) {
        reject(new Error('已停止'));
        return;
      }
      if (!text.trim() || isNonTranslatableNoise(text)) {
        resolve(text);
        return;
      }
      const tier = Math.min(2, Math.max(0, Math.floor(priority)));
      queues[tier]!.push({ text, priority: tier, resolve, reject });
      schedule();
      if (
        (queueDepth(queues) >= maxBatchSize || queueChars(queues) >= maxBatchChars) &&
        inFlight < maxInFlight
      ) {
        if (timer != null) {
          window.clearTimeout(timer);
          timer = null;
        }
        void pump();
      }
    });
}

function batcherFromTuning(
  tuning: SchedulerTuning,
  options: {
    translateBatch: (texts: string[]) => Promise<string[]>;
    isStopped: () => boolean;
    onProgress: (doneDelta: number) => void;
  },
) {
  return createBatchedTranslator({
    ...options,
    coalesceMs: tuning.coalesceMs,
    maxBatchSize: tuning.maxBatchSize,
    maxBatchChars: tuning.maxBatchChars,
    maxInFlight: tuning.maxInFlight,
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

function viewportPriority(el: Element): number {
  if (isNearViewport(el, 0)) return 0;
  if (isNearViewport(el, 280)) return 1;
  return 2;
}

function createProgressEmitter(
  isStopped: () => boolean,
  onProgress: (state: SessionState) => void,
) {
  let done = 0;
  let total = 0;
  let timer: number | null = null;

  const flush = () => {
    timer = null;
    if (isStopped()) return;
    setSessionState({ status: 'running', done, total: Math.max(total, done) });
    onProgress({ status: 'running', done, total: Math.max(total, done) });
  };

  const schedule = () => {
    if (timer != null) return;
    timer = window.setTimeout(flush, 120);
  };

  return {
    bumpTotal(delta = 1) {
      total += delta;
      schedule();
    },
    bumpDone(delta: number) {
      done += delta;
      schedule();
    },
    emitNow(state: SessionState) {
      if (timer != null) {
        window.clearTimeout(timer);
        timer = null;
      }
      setSessionState(state);
      onProgress(state);
    },
  };
}

function startBilingualTranslation(options: {
  translateBatch: (texts: string[]) => Promise<string[]>;
  onProgress: (state: SessionState) => void;
  maxConcurrency?: number;
  targetLang?: string;
  engine?: ProviderEngine;
}): PageSessionControls {
  let stopped = false;
  const targetLang = options.targetLang?.trim() || 'zh-CN';
  const lastText = new WeakMap<Element, string>();
  const queued = new WeakSet<Element>();
  const tuning = resolveSchedulerTuning(
    options.engine ?? 'deepl',
    'bilingual',
    options.maxConcurrency,
  );
  const progress = createProgressEmitter(() => stopped, options.onProgress);

  const translateOne = batcherFromTuning(tuning, {
    translateBatch: options.translateBatch,
    isStopped: () => stopped,
    onProgress: (delta) => progress.bumpDone(delta),
  });

  ensureBilingualStyles();

  const clearHost = (el: Element) => {
    el.querySelectorAll('.tt-bilingual').forEach((node) => node.remove());
    if (el.matches('a[href]')) {
      const next = el.nextElementSibling;
      if (next?.classList.contains('tt-bilingual')) next.remove();
    }
    el.removeAttribute(BILINGUAL_ATTR);
    lastText.delete(el);
    queued.delete(el);
  };

  const processElement = async (el: Element, priority = viewportPriority(el)) => {
    if (stopped) return;
    if (isBilingualMarkup(el)) return;
    if (shouldSkipBilingualHost(el) || el.closest(BILINGUAL_SKIP_CLOSEST)) return;
    const text = collectBlockText(el);
    if (text.length < 2) return;
    if (isNonTranslatableNoise(text)) return;
    if (looksLikeInlineBilingual(text)) return;
    if (looksAlreadyInTargetLang(text, targetLang)) return;
    if (el.getAttribute(BILINGUAL_ATTR) === '1' && lastText.get(el) === text) return;
    if (queued.has(el) && lastText.get(el) === text) return;
    if (el.getAttribute(BILINGUAL_ATTR) === '1') clearHost(el);

    queued.add(el);
    lastText.set(el, text);
    progress.bumpTotal(1);
    try {
      const translated = await translateOne(text, priority);
      if (stopped) return;
      if (collectBlockText(el) !== text) {
        clearHost(el);
        observer.observe(el);
        return;
      }
      // Progressive paint: insert as soon as this block's batch item resolves.
      const probe = document.createTextNode('');
      el.appendChild(probe);
      applyBilingual(probe, translated);
      probe.remove();
      lastText.set(el, text);
      queued.delete(el);
    } catch (error) {
      clearHost(el);
      if (!stopped) {
        progress.emitNow({
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
          const el = entry.target;
          const priority = entry.intersectionRatio > 0.15 ? 0 : 1;
          void processElement(el, priority);
        }
      }
    },
    { rootMargin: '280px', threshold: [0, 0.15, 0.5] },
  );

  const watch = (root: ParentNode) => {
    collectTranslatableBlocks(root).forEach((el) => observer.observe(el));
  };

  const maybeObserve = (el: Element) => {
    if (isBilingualMarkup(el)) return;
    if (
      el.matches(BLOCK_SELECTOR) ||
      isLeafTextBlock(el) ||
      isBlockLikeLink(el)
    ) {
      observer.observe(el);
      if (isNearViewport(el)) void processElement(el, viewportPriority(el));
    }
  };

  const mutationObserver = new MutationObserver((mutations) => {
    if (stopped) return;
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (!(node instanceof Element)) return;
        if (isBilingualMarkup(node)) return;
        maybeObserve(node);
        watch(node);
        collectTranslatableBlocks(node).forEach((el) => {
          if (isNearViewport(el)) void processElement(el, viewportPriority(el));
        });
      });
      if (mutation.type === 'characterData') {
        const parent = mutation.target.parentElement;
        if (parent?.closest('.tt-bilingual')) return;
        const host =
          parent?.closest?.(BLOCK_SELECTOR) ??
          (parent && isLeafTextBlock(parent) ? parent : null);
        if (host instanceof Element && host.getAttribute(BILINGUAL_ATTR) === '1') {
          clearHost(host);
          observer.observe(host);
          if (isNearViewport(host)) void processElement(host, viewportPriority(host));
        }
      }
    }
  });

  progress.emitNow({ status: 'running', done: 0, total: 0 });
  ttPerfReset();
  const scanStarted = performance.now();
  watch(document);
  const near = collectTranslatableBlocks(document);
  const scanMs = performance.now() - scanStarted;
  ttPerfMark('local', 'initial DOM scan + observe', scanMs, {
    blocks: near.length,
  });
  // Viewport-first: in-view (0) then near-margin (1).
  near
    .map((el) => ({ el, priority: viewportPriority(el) }))
    .filter((item) => item.priority <= 1)
    .sort((a, b) => a.priority - b.priority)
    .forEach((item) => {
      void processElement(item.el, item.priority);
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
      ttPerfSummary('stop');
      progress.emitNow({ status: 'idle' });
    },
    restore() {
      stopped = true;
      observer.disconnect();
      mutationObserver.disconnect();
      restoreBilingual(document);
      document.getElementById('tt-bilingual-style')?.remove();
      ttPerfSummary('restore');
      progress.emitNow({ status: 'idle' });
    },
  };
}

function startReplaceTranslation(options: {
  translateBatch: (texts: string[]) => Promise<string[]>;
  onProgress: (state: SessionState) => void;
  maxConcurrency?: number;
  engine?: ProviderEngine;
}): PageSessionControls {
  let stopped = false;
  const tuning = resolveSchedulerTuning(
    options.engine ?? 'deepl',
    'replace',
    options.maxConcurrency,
  );
  const progress = createProgressEmitter(() => stopped, options.onProgress);

  const translateCallback = batcherFromTuning(tuning, {
    translateBatch: options.translateBatch,
    isStopped: () => stopped,
    onProgress: (delta) => progress.bumpDone(delta),
  });

  const nodesTranslator = new NodesTranslator(async (text, _score) => {
    if (isNonTranslatableNoise(text)) return text;
    progress.bumpTotal(1);
    // IntersectionScheduler already defers off-screen nodes; treat as high priority.
    return translateCallback(text, 0);
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
  progress.emitNow({ status: 'running', done: 0, total: 0 });
  try {
    persistent.translate(root);
  } catch (error) {
    progress.emitNow({
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
      progress.emitNow({ status: 'idle' });
    },
    restore() {
      stopped = true;
      try {
        restoreTree(persistent, root);
      } catch {
        // Already torn down / never observed — still clear best-effort.
        disconnectObservers();
      }
      progress.emitNow({ status: 'idle' });
    },
  };
}

export function startPageTranslation(options: {
  mode: 'replace' | 'bilingual';
  translateBatch: (texts: string[]) => Promise<string[]>;
  onProgress: (state: SessionState) => void;
  maxConcurrency?: number;
  targetLang?: string;
  engine?: ProviderEngine;
}): PageSessionControls {
  if (options.mode === 'bilingual') {
    return startBilingualTranslation(options);
  }
  return startReplaceTranslation(options);
}

async function translateBatchRaw(texts: string[]): Promise<string[]> {
  const started = performance.now();
  const response = await sendToBackground({ type: 'TRANSLATE_BATCH', texts });
  ttPerfMark('send', 'batch RTT (includes API wait in background)', performance.now() - started, {
    texts: texts.length,
  });
  if ('translations' in response) return response.translations;
  throw new Error(response.error || '翻译失败');
}

/** Content-cache aware batch translate (Task D short-circuit). */
export async function translateBatchViaBackground(texts: string[]): Promise<string[]> {
  const settings = await loadPublicSettings();
  ensureContentTranslationCache(settings);
  return translateTextsWithContentCache(texts, translateBatchRaw);
}
