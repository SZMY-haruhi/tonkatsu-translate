export type SiteRulesMode = 'off' | 'allowlist' | 'denylist'

export type SiteRules = {
  mode: SiteRulesMode
  /** Host patterns: `example.com` or `*.example.com` */
  hosts: string[]
}

export const DEFAULT_SITE_RULES: SiteRules = {
  mode: 'off',
  hosts: [],
}

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, '')
}

/** True when `hostname` matches a single pattern (`example.com` or `*.example.com`). */
export function hostMatchesPattern(hostname: string, pattern: string): boolean {
  const host = normalizeHost(hostname)
  const pat = normalizeHost(pattern)
  if (!host || !pat) return false

  if (pat.startsWith('*.')) {
    const suffix = pat.slice(2)
    if (!suffix) return false
    return host === suffix || host.endsWith(`.${suffix}`)
  }

  return host === pat
}

export function hostAllowed(hostname: string, rules: SiteRules): boolean {
  const mode = rules.mode ?? 'off'
  if (mode === 'off') return true

  const hosts = (rules.hosts ?? []).map(normalizeHost).filter(Boolean)
  const matched = hosts.some((pattern) => hostMatchesPattern(hostname, pattern))

  if (mode === 'allowlist') return matched
  if (mode === 'denylist') return !matched
  return true
}

export function siteBlockedMessage(hostname: string, rules: SiteRules): string | null {
  if (hostAllowed(hostname, rules)) return null
  if (rules.mode === 'allowlist') {
    return `当前站点 ${hostname} 不在允许列表中`
  }
  return `当前站点 ${hostname} 已在拒绝列表中`
}

/** Parse one-host-per-line / comma-separated text from the options UI. */
export function parseHostList(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\n,]+/)) {
    const host = normalizeHost(part)
    if (!host || seen.has(host)) continue
    seen.add(host)
    out.push(host)
  }
  return out
}

/** Glossary / keep terms — preserve original casing. */
export function parseTermList(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/[\n,]+/)) {
    const term = part.trim()
    if (!term || seen.has(term)) continue
    seen.add(term)
    out.push(term)
  }
  return out
}

export function formatHostList(hosts: string[]): string {
  return hosts.join('\n')
}
