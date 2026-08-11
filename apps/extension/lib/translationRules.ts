/**
 * Effective translation rules — Immersive Translate–style model:
 * generalRule ∪ family overlays ∪ host overlays (data, not code forks).
 */

export type SiteFamily = 'general' | 'encyclopedia' | 'competitive'

export type TranslationRule = {
  id?: string
  family?: SiteFamily
  matches?: string[]
  excludeMatches?: string[]
  /** DOM landmarks — rule applies if any selector matches (optional). */
  selectorMatches?: string[]
  selectors?: string[]
  excludeSelectors?: string[]
  excludeTags?: string[]
  extraBlockSelectors?: string[]
  /** Hosts that should stay original (team chips, etc.). */
  stayOriginalSelectors?: string[]
  paragraphMinTextCount?: number
  /** Merge competitive default glossary when true. */
  useCompetitiveGlossary?: boolean
}

export type EffectiveRule = {
  id: string
  family: SiteFamily
  selectors: string[]
  excludeSelectors: string[]
  excludeTags: string[]
  extraBlockSelectors: string[]
  stayOriginalSelectors: string[]
  paragraphMinTextCount: number
  useCompetitiveGlossary: boolean
}

export const GENERAL_RULE: TranslationRule = {
  id: 'general',
  family: 'general',
  excludeSelectors: [
    'script',
    'style',
    'noscript',
    'code',
    'pre',
    'textarea',
    'svg',
    'math',
    'nav',
    'footer',
    '[contenteditable="true"]',
    '[aria-hidden="true"]',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    '[role="search"]',
    '[role="menubar"]',
    '[role="toolbar"]',
    '[role="tablist"]',
    '.notranslate',
    '[translate="no"]',
    '#tt-edge-dock',
    '.tt-selection-bubble',
    '[data-tt-ui]',
  ],
  excludeTags: [
    'SCRIPT',
    'STYLE',
    'NOSCRIPT',
    'CODE',
    'PRE',
    'TEXTAREA',
    'SVG',
    'MATH',
    'BUTTON',
    'INPUT',
    'SELECT',
    'OPTION',
  ],
  selectors: [],
  extraBlockSelectors: [],
  stayOriginalSelectors: [],
  paragraphMinTextCount: 6,
  useCompetitiveGlossary: false,
}

/** Encyclopedia family — Wikipedia, Baidu Baike, Moegirl, etc. */
export const ENCYCLOPEDIA_FAMILY: TranslationRule = {
  id: 'family-encyclopedia',
  family: 'encyclopedia',
  matches: [
    'wikipedia.org',
    '*.wikipedia.org',
    'wikimedia.org',
    '*.wikimedia.org',
    'mediawiki.org',
    '*.mediawiki.org',
    '*.wiktionary.org',
    '*.wikibooks.org',
    '*.wikiquote.org',
    '*.wikisource.org',
    '*.wikinews.org',
    '*.wikiversity.org',
    '*.wikivoyage.org',
    'baike.baidu.com',
    '*.baike.com',
    'moegirl.org.cn',
    '*.moegirl.org.cn',
    'moegirl.org',
    '*.moegirl.org',
    'encyclopedia.com',
    '*.wikiwand.com',
  ],
  selectorMatches: [
    '#mw-content-text',
    '.mw-parser-output',
    '.lemma-summary',
    '.main-content',
    '#content-main',
  ],
  selectors: [
    '#mw-content-text .mw-parser-output',
    '#mw-content-text',
    '.lemma-summary',
    '.main-content',
    '#content-main',
  ],
  extraBlockSelectors: ['h1#firstHeading', 'h1.firstHeading', '#firstHeading', 'h1.lemmaTitle'],
  excludeSelectors: [
    '#mw-navigation',
    '#mw-panel',
    '#vector-main-menu',
    '#vector-toc',
    '#vector-sticky-header',
    '#vector-page-titlebar-toc',
    '#vector-appearance',
    '#p-lang-btn',
    '#p-lang',
    '#p-personal',
    '#p-views',
    '#p-cactions',
    '#p-search',
    '#siteNotice',
    '#centralNotice',
    '.vector-header-container',
    '.vector-toc',
    '.vector-page-toolbar',
    '.vector-dropdown',
    '.mw-jump-link',
    '.mw-editsection',
    '.mw-indicators',
    '#catlinks',
    '.catlinks',
    '.navbox',
    '.infobox',
    '.toc',
    '#toc',
    '.thumb',
    '.reference',
    '.references',
    '.reflist',
    'sup.reference',
    '.mw-references-wrap',
    '.noprint',
    '.metadata',
    '.sistersitebox',
    '.wikipedia-languages',
    '#www-wikipedia-languages',
    '.lang-list',
    '.other-languages',
    '.sister-projects',
    '.mw-portlet-lang',
    // Baidu baike chrome
    '.side-content',
    '.lemma-reference',
    '#sideContent',
  ],
  paragraphMinTextCount: 8,
}

/** Competitive / sports aggregator family — HLTV-like card walls. */
export const COMPETITIVE_FAMILY: TranslationRule = {
  id: 'family-competitive',
  family: 'competitive',
  matches: [
    'hltv.org',
    '*.hltv.org',
    'flashscore.com',
    '*.flashscore.com',
    'espn.com',
    '*.espn.com',
    'sofascore.com',
    '*.sofascore.com',
    'liquipedia.net',
    '*.liquipedia.net',
    'vlr.gg',
    '*.vlr.gg',
    'gosugamers.net',
    '*.gosugamers.net',
  ],
  stayOriginalSelectors: [
    '.team-name',
    '.teamName',
    '.player-nick',
    '.playerNick',
    '[data-team-name]',
    '.ranking-teamName',
    '.matchTeamName',
    '.team-logo + span',
    '.teamLogo + span',
  ],
  useCompetitiveGlossary: true,
  paragraphMinTextCount: 4,
}

/**
 * Host-specific overlays (thin). Prefer family rules; keep only DOM quirks here.
 */
export const BUILTIN_RULES: TranslationRule[] = [
  ENCYCLOPEDIA_FAMILY,
  COMPETITIVE_FAMILY,
]

function normalizeHost(raw: string): string {
  return raw.trim().toLowerCase().replace(/^\.+/, '')
}

export function hostMatchesRulePattern(hostname: string, pattern: string): boolean {
  const host = normalizeHost(hostname)
  const pat = normalizeHost(pattern)
  if (!host || !pat) return false
  if (pat === '*') return true
  if (pat.startsWith('*.')) {
    const suffix = pat.slice(2)
    return Boolean(suffix) && (host === suffix || host.endsWith(`.${suffix}`))
  }
  return host === pat || host.endsWith(`.${pat}`)
}

function ruleMatchesUrl(rule: TranslationRule, hostname: string, href: string): boolean {
  const excludes = rule.excludeMatches ?? []
  if (excludes.some((p) => hostMatchesRulePattern(hostname, p) || hrefIncludes(href, p))) {
    return false
  }
  const matches = rule.matches ?? []
  if (matches.length > 0) {
    if (matches.some((p) => hostMatchesRulePattern(hostname, p) || hrefIncludes(href, p))) {
      return true
    }
  }
  const landmarks = rule.selectorMatches ?? []
  if (landmarks.length > 0 && typeof document !== 'undefined') {
    for (const sel of landmarks) {
      try {
        if (document.querySelector(sel)) return true
      } catch {
        // ignore
      }
    }
  }
  return false
}

function hrefIncludes(href: string, pattern: string): boolean {
  if (!pattern.includes('/') && !pattern.includes('*')) return false
  try {
    const re = new RegExp(
      '^' +
        pattern
          .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
          .replace(/\*/g, '.*') +
        '$',
      'i',
    )
    return re.test(href)
  } catch {
    return false
  }
}

function mergeRule(base: TranslationRule, overlay: TranslationRule): EffectiveRule {
  const uniq = (items: string[]) => Array.from(new Set(items.filter(Boolean)))
  return {
    id: overlay.id ?? base.id ?? 'merged',
    family: overlay.family ?? base.family ?? 'general',
    selectors: overlay.selectors?.length ? [...overlay.selectors] : [...(base.selectors ?? [])],
    excludeSelectors: uniq([...(base.excludeSelectors ?? []), ...(overlay.excludeSelectors ?? [])]),
    excludeTags: uniq([...(base.excludeTags ?? []), ...(overlay.excludeTags ?? [])]).map((t) =>
      t.toUpperCase(),
    ),
    extraBlockSelectors: uniq([
      ...(base.extraBlockSelectors ?? []),
      ...(overlay.extraBlockSelectors ?? []),
    ]),
    stayOriginalSelectors: uniq([
      ...(base.stayOriginalSelectors ?? []),
      ...(overlay.stayOriginalSelectors ?? []),
    ]),
    paragraphMinTextCount:
      overlay.paragraphMinTextCount ?? base.paragraphMinTextCount ?? 8,
    useCompetitiveGlossary: Boolean(
      overlay.useCompetitiveGlossary ?? base.useCompetitiveGlossary,
    ),
  }
}

export function resolveEffectiveRule(
  hostname = typeof location !== 'undefined' ? location.hostname : '',
  href = typeof location !== 'undefined' ? location.href : '',
): EffectiveRule {
  const host = normalizeHost(hostname)
  const matched = BUILTIN_RULES.find((rule) => ruleMatchesUrl(rule, host, href))
  if (matched) return mergeRule(GENERAL_RULE, matched)
  // Landmark-only encyclopedia detection (unknown wiki skins).
  if (typeof document !== 'undefined') {
    if (
      document.querySelector('#mw-content-text, .mw-parser-output, .lemma-summary')
    ) {
      return mergeRule(GENERAL_RULE, ENCYCLOPEDIA_FAMILY)
    }
  }
  return mergeRule(GENERAL_RULE, { id: 'general', family: 'general' })
}

export function joinSelectors(selectors: string[]): string {
  return selectors.filter(Boolean).join(', ')
}
