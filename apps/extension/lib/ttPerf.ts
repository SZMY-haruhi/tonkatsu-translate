/** Temporary page-translation perf probes. Filter DevTools console by `[TT-PERF]`. */

export type PerfBucket = 'local' | 'send' | 'api';

type Acc = {
  count: number;
  totalMs: number;
  maxMs: number;
  texts: number;
  cacheHits: number;
  cacheMisses: number;
};

const acc: Record<PerfBucket, Acc> = {
  local: blank(),
  send: blank(),
  api: blank(),
};

function blank(): Acc {
  return { count: 0, totalMs: 0, maxMs: 0, texts: 0, cacheHits: 0, cacheMisses: 0 };
}

export function ttPerfMark(
  bucket: PerfBucket,
  label: string,
  ms: number,
  extra?: Record<string, unknown>,
) {
  const row = acc[bucket];
  row.count += 1;
  row.totalMs += ms;
  row.maxMs = Math.max(row.maxMs, ms);
  if (typeof extra?.texts === 'number') row.texts += extra.texts;
  if (typeof extra?.cacheHits === 'number') row.cacheHits += extra.cacheHits;
  if (typeof extra?.cacheMisses === 'number') row.cacheMisses += extra.cacheMisses;

  console.log(`[TT-PERF][${bucket}] ${label}`, {
    ms: Math.round(ms),
    ...extra,
  });
}

export function ttPerfSummary(reason: string) {
  const summarize = (b: PerfBucket) => {
    const row = acc[b];
    return {
      calls: row.count,
      totalMs: Math.round(row.totalMs),
      maxMs: Math.round(row.maxMs),
      avgMs: row.count ? Math.round(row.totalMs / row.count) : 0,
      texts: row.texts || undefined,
      cacheHits: row.cacheHits || undefined,
      cacheMisses: row.cacheMisses || undefined,
    };
  };
  const local = summarize('local');
  const send = summarize('send');
  const api = summarize('api');
  const total = local.totalMs + send.totalMs + api.totalMs;
  const share = (ms: number) =>
    total > 0 ? `${Math.round((ms / total) * 100)}%` : 'n/a';

  const report = {
    reason,
    local,
    send,
    api,
    wallShareApprox: {
      local: share(local.totalMs),
      send: share(send.totalMs),
      api: share(api.totalMs),
      note: 'api/send may overlap when concurrency>1; api totalMs can exceed wall clock',
    },
  };
  console.log('[TT-PERF][summary]', report);
  return report;
}

export function ttPerfReset() {
  acc.local = blank();
  acc.send = blank();
  acc.api = blank();
}
