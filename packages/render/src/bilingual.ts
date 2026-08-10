const MARK = 'data-tt'
const BILINGUAL_CLASS = 'tt-bilingual'

export const BLOCK_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, dd, dt, blockquote, figcaption, td, th'

/** Structural containers that may hold leaf text blocks on modern sites. */
const LEAF_CANDIDATE_SELECTOR = 'div, section, article'

/** Nested structure that means "not a leaf paragraph-like block". */
const NESTED_BLOCK_GUARD =
  'p, li, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, section, article, nav, header, footer, aside, form'

/**
 * Hard skips for bilingual insert.
 * Horizontal tab/nav chrome stays on replace-only via skip-closest below.
 */
export const BILINGUAL_SKIP_CLOSEST =
  [
    'button',
    'summary',
    'label',
    'select',
    'option',
    'script',
    'style',
    'noscript',
    'code',
    'pre',
    'textarea',
    'svg',
    'math',
    '[contenteditable="true"]',
    '[role="tablist"]',
    '[role="search"]',
    '[aria-hidden="true"]',
    // Extension UI
    '#tt-edge-dock',
    '[data-tt-ui]',
    '.tt-selection-bubble',
    // Horizontal chrome: bilingual insert overflows; use replace mode.
    'nav',
    'header',
    'footer',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="menubar"]',
    '[role="toolbar"]',
    '[role="contentinfo"]',
  ].join(', ')

export function isHorizontalChromeHost(el: Element): boolean {
  if (
    el.closest(
      'nav, header, footer, [role="navigation"], [role="banner"], [role="menubar"], [role="toolbar"], [role="tablist"], [role="contentinfo"]',
    )
  ) {
    return true
  }
  return false
}

export function shouldSkipBilingualHost(el: Element): boolean {
  if (el.closest(BILINGUAL_SKIP_CLOSEST)) return true
  // Prefer leaf blocks so nested li>p / heading>span trees do not double-insert.
  if (el.querySelector(BLOCK_SELECTOR)) return true
  // Do NOT skip solely because a parent is flex-row/grid: applyBilingual inserts
  // inside the host, so the parent's flex/grid item count stays the same. Skipping
  // here drops dense news/title rows on modern layouts (e.g. HLTV).
  return false
}

/**
 * True for div/section/article hosts that look like a single paragraph block
 * (no nested block structure, enough text). Used to catch article sites that
 * avoid semantic <p> tags.
 */
export function isLeafTextBlock(el: Element, minChars = 12): boolean {
  if (!el.matches(LEAF_CANDIDATE_SELECTOR)) return false
  if (shouldSkipBilingualHost(el)) return false
  if (el.querySelector(NESTED_BLOCK_GUARD) || el.querySelector(LEAF_CANDIDATE_SELECTOR)) {
    return false
  }
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text.length >= minChars
}

/** Classic semantic blocks + leaf text containers under `root`. */
export function collectTranslatableBlocks(root: ParentNode = document): Element[] {
  const seen = new Set<Element>()
  const out: Element[] = []
  const add = (el: Element) => {
    if (seen.has(el) || shouldSkipBilingualHost(el)) return
    seen.add(el)
    out.push(el)
  }
  root.querySelectorAll(BLOCK_SELECTOR).forEach((el) => add(el))
  root.querySelectorAll(LEAF_CANDIDATE_SELECTOR).forEach((el) => {
    if (isLeafTextBlock(el)) add(el)
  })
  return out
}

export function findBlockHost(node: Text): Element | null {
  let current: Node | null = node.parentElement
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const el = current as Element
    if (el.matches(BLOCK_SELECTOR)) return el
    if (el === document.body || el === document.documentElement) break
    current = el.parentElement
  }
  return node.parentElement
}

export function applyBilingual(node: Text, translated: string): HTMLElement | null {
  const host = findBlockHost(node)
  if (!host) return null
  if (shouldSkipBilingualHost(host)) return null
  if (host.getAttribute(MARK) === '1') return null

  const existing = host.querySelector(`:scope > .${BILINGUAL_CLASS}`)
  if (existing) {
    existing.textContent = translated
    host.setAttribute(MARK, '1')
    return existing as HTMLElement
  }

  const el = host.ownerDocument.createElement('div')
  el.className = BILINGUAL_CLASS
  el.setAttribute(MARK, '1')
  el.textContent = translated
  // Insert inside the host so flex/grid parents keep one child item.
  host.appendChild(el)
  host.setAttribute(MARK, '1')
  return el
}

export function restoreBilingual(root: ParentNode = document): void {
  root.querySelectorAll(`.${BILINGUAL_CLASS}`).forEach((node) => node.remove())
  root.querySelectorAll(`[${MARK}="1"]`).forEach((node) => node.removeAttribute(MARK))
}

export function bilingualStyleText(): string {
  return `
.${BILINGUAL_CLASS} {
  display: block !important;
  position: static !important;
  float: none !important;
  clear: both !important;
  width: auto !important;
  max-width: 100% !important;
  margin: 0.28em 0 0 !important;
  padding: 0 0 0 0.55em !important;
  border: 0 !important;
  border-left: 2px solid color-mix(in srgb, currentColor 32%, transparent) !important;
  background: transparent !important;
  color: inherit !important;
  font: inherit !important;
  font-size: 0.92em !important;
  font-weight: 400 !important;
  font-style: normal !important;
  line-height: 1.45 !important;
  letter-spacing: normal !important;
  text-transform: none !important;
  text-decoration: none !important;
  opacity: 0.78;
  white-space: normal !important;
  overflow-wrap: anywhere !important;
  box-sizing: border-box !important;
  pointer-events: none;
}
`
}

export const BILINGUAL_ATTR = MARK
export const BILINGUAL_CLASS_NAME = BILINGUAL_CLASS
