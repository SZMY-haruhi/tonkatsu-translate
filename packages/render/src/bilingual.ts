const MARK = 'data-tt'
const BILINGUAL_CLASS = 'tt-bilingual'
const BILINGUAL_FLEX_BREAK_CLASS = 'tt-bilingual--flex-break'

export const BLOCK_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, dd, dt, blockquote, figcaption, td, th'

/** Structural containers that may hold leaf text blocks on modern sites. */
const LEAF_CANDIDATE_SELECTOR = 'div, section, article'

/** Nested structure that means "not a leaf paragraph-like block". */
const NESTED_BLOCK_GUARD =
  'p, li, h1, h2, h3, h4, h5, h6, ul, ol, table, blockquote, section, article, nav, header, footer, aside, form'

const INTERACTIVE_SELECTOR =
  'button, input, textarea, select, option, [role="button"], [role="combobox"]'

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
    '#tt-edge-dock',
    '[data-tt-ui]',
    '.tt-selection-bubble',
    `.${BILINGUAL_CLASS}`,
    'nav',
    'header',
    'footer',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="menubar"]',
    '[role="toolbar"]',
    '[role="contentinfo"]',
  ].join(', ')

function visibleElementChildren(el: Element): Element[] {
  return Array.from(el.children).filter((child) => {
    const style = getComputedStyle(child)
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
  })
}

function isFlexRowContainer(el: Element): boolean {
  const style = getComputedStyle(el)
  if (style.display !== 'flex' && style.display !== 'inline-flex') return false
  const dir = style.flexDirection
  return dir === 'row' || dir === 'row-reverse'
}

/**
 * List/grid rows, button groups, multi-link tiles — not paragraph-like hosts.
 * Prevents concatenated "S-TierNameDate" dumps and sidebar column collapse.
 */
export function isCompositeLayoutHost(el: Element): boolean {
  const visible = visibleElementChildren(el)
  if (visible.length < 2) return false

  if (el.querySelector(INTERACTIVE_SELECTOR)) return true

  const directLinks = el.querySelectorAll(':scope > a[href]')
  const allLinks = el.querySelectorAll('a[href]')
  if (directLinks.length >= 2 || allLinks.length >= 5) return true

  const directMedia = el.querySelectorAll(':scope > img, :scope > picture, :scope > svg')
  if (directMedia.length >= 1 && visible.length >= 2) return true

  const style = getComputedStyle(el)
  if (style.display === 'grid' && visible.length >= 2) return true
  if (isFlexRowContainer(el) && visible.length >= 2) return true

  const rowLike = visible.some((child) =>
    child.matches(
      'img, picture, svg, time, [class*="tier"], [class*="badge"], [class*="date"], [class*="logo"]',
    ),
  )
  if (rowLike && visible.length >= 2) return true

  return false
}

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

export function isBilingualMarkup(el: Element): boolean {
  return (
    el.classList.contains(BILINGUAL_CLASS) ||
    el.closest(`.${BILINGUAL_CLASS}`) != null
  )
}

/** Standalone list / card links (e.g. tournament title) when the row container is skipped. */
export function isBlockLikeLink(el: Element): boolean {
  if (!el.matches('a[href]')) return false
  if (isBilingualMarkup(el) || el.closest(BILINGUAL_SKIP_CLOSEST)) return false
  if (el.querySelector(BLOCK_SELECTOR)) return false

  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < 4 || text.length > 220) return false

  const style = getComputedStyle(el)
  if (style.display === 'block' || style.display === 'flex' || style.display === 'list-item') {
    return true
  }
  if (el.closest('li, td, th, dd, figcaption')) return true
  return false
}

export function shouldSkipBilingualHost(el: Element): boolean {
  if (isBilingualMarkup(el)) return true
  if (el.closest(BILINGUAL_SKIP_CLOSEST)) return true
  if (isCompositeLayoutHost(el)) return true
  if (el.querySelector(BLOCK_SELECTOR)) return true
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
  root.querySelectorAll('a[href]').forEach((el) => {
    if (isBlockLikeLink(el)) add(el)
  })
  return out
}

export function findBlockHost(node: Text): Element | null {
  let current: Node | null = node.parentElement
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    const el = current as Element
    if (el.matches(BLOCK_SELECTOR) || el.matches('a[href]')) return el
    if (el === document.body || el === document.documentElement) break
    current = el.parentElement
  }
  return node.parentElement
}

function mountBilingual(host: Element, el: HTMLElement): void {
  if (host.matches('a[href]')) {
    host.insertAdjacentElement('afterend', el)
    return
  }

  const parent = host.parentElement
  if (parent && isFlexRowContainer(parent)) {
    el.classList.add(BILINGUAL_FLEX_BREAK_CLASS)
    parent.appendChild(el)
    return
  }

  host.appendChild(el)
}

export function applyBilingual(node: Text, translated: string): HTMLElement | null {
  const host = findBlockHost(node)
  if (!host) return null
  if (shouldSkipBilingualHost(host) && !host.matches('a[href]')) return null
  if (isBilingualMarkup(host)) return null

  const trimmed = translated.replace(/\s+/g, ' ').trim()
  if (!trimmed || trimmed === '|') return null

  let existing: Element | null = null
  if (host.matches('a[href]')) {
    const next = host.nextElementSibling
    if (next?.classList.contains(BILINGUAL_CLASS)) existing = next
  } else {
    existing = host.querySelector(`:scope > .${BILINGUAL_CLASS}`)
  }

  if (existing instanceof HTMLElement) {
    existing.textContent = trimmed
    host.setAttribute(MARK, '1')
    return existing
  }

  if (host.getAttribute(MARK) === '1' && !host.matches('a[href]')) return null

  const el = host.ownerDocument.createElement('div')
  el.className = BILINGUAL_CLASS
  el.setAttribute(MARK, '1')
  el.textContent = trimmed
  mountBilingual(host, el)
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
  width: 100% !important;
  max-width: 100% !important;
  min-width: 0 !important;
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
  overflow-wrap: break-word !important;
  word-break: normal !important;
  box-sizing: border-box !important;
  pointer-events: none;
}
.${BILINGUAL_FLEX_BREAK_CLASS} {
  flex: 0 0 100% !important;
  width: 100% !important;
  max-width: 100% !important;
  order: 99 !important;
}
a[href] + .${BILINGUAL_CLASS} {
  margin-top: 0.15em !important;
}
`
}

export const BILINGUAL_ATTR = MARK
export const BILINGUAL_CLASS_NAME = BILINGUAL_CLASS
