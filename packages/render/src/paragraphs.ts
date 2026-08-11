/**
 * Paragraph segmentation for webpage translation.
 *
 * Walk text nodes → group by nearest block host (semantic OR leaf container).
 * Do not require <p> only — sports/news SPAs are mostly div/span soup.
 */

export type ParagraphUnit = {
  host: Element
  text: string
  /** Document Y for top→bottom scheduling. */
  top: number
}

const SEMANTIC_BLOCK_SELECTOR =
  'p, li, h1, h2, h3, h4, h5, h6, dd, dt, blockquote, figcaption, td, th'

const LEAF_HOST_SELECTOR = 'div, section, article, span, a'

export type ParagraphCollectOptions = {
  roots: ParentNode[]
  excludeSelectors: string[]
  excludeTags: string[]
  extraBlockSelectors?: string[]
  minTextCount?: number
}

function safeMatches(el: Element, selector: string): boolean {
  try {
    return el.matches(selector)
  } catch {
    return false
  }
}

function safeClosest(el: Element, selector: string): Element | null {
  try {
    return el.closest(selector)
  } catch {
    return null
  }
}

function isExcluded(
  el: Element,
  excludeJoined: string,
  excludeTags: Set<string>,
): boolean {
  if (excludeTags.has(el.tagName)) return true
  if (!excludeJoined) return false
  return safeMatches(el, excludeJoined) || Boolean(safeClosest(el, excludeJoined))
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

function isVisibleBlockish(el: Element): boolean {
  try {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    if (style.display === 'inline' || style.display === 'contents') return false
  } catch {
    // ignore
  }
  return true
}

/**
 * Prefer semantic blocks; otherwise a leaf-ish container that actually holds
 * the text (div soup / card UIs like HLTV).
 */
function findBlockAncestor(
  start: Element,
  blockSelector: string,
  rootBoundary: ParentNode,
): Element | null {
  let cur: Element | null = start
  let leafFallback: Element | null = null

  while (cur && cur !== rootBoundary && cur !== document.documentElement) {
    if (safeMatches(cur, blockSelector)) return cur

    // Leaf host: holds text, no nested semantic blocks, not a giant layout shell.
    if (
      !leafFallback &&
      safeMatches(cur, LEAF_HOST_SELECTOR) &&
      isVisibleBlockish(cur) &&
      !cur.querySelector(SEMANTIC_BLOCK_SELECTOR)
    ) {
      const childBlocks = cur.querySelectorAll(LEAF_HOST_SELECTOR)
      // Allow shallow wrappers; reject deep layout trees.
      if (childBlocks.length <= 4) {
        leafFallback = cur
      }
    }
    cur = cur.parentElement
  }

  return leafFallback
}

/**
 * Build paragraph-scale translation units under `roots`.
 */
export function collectParagraphUnits(
  options: ParagraphCollectOptions,
): ParagraphUnit[] {
  const minText = options.minTextCount ?? 8
  const excludeJoined = options.excludeSelectors.filter(Boolean).join(', ')
  const excludeTags = new Set(
    (options.excludeTags ?? []).map((t) => t.toUpperCase()),
  )
  const blockSelector = [
    SEMANTIC_BLOCK_SELECTOR,
    ...(options.extraBlockSelectors ?? []),
  ]
    .filter(Boolean)
    .join(', ')

  const byHost = new Map<Element, { parts: string[]; top: number }>()

  const considerTextNode = (node: Text, boundary: ParentNode) => {
    const raw = node.nodeValue ?? ''
    if (!raw || !raw.trim()) return
    const parent = node.parentElement
    if (!parent) return
    if (isExcluded(parent, excludeJoined, excludeTags)) return
    if (parent.closest?.('.notranslate, [translate="no"]')) return
    if (parent.closest?.('.mw-editsection, .reference, sup.reference')) return

    const host = findBlockAncestor(parent, blockSelector, boundary)
    if (!host) return
    if (isExcluded(host, excludeJoined, excludeTags)) return

    const existing = byHost.get(host)
    if (existing) {
      existing.parts.push(raw)
    } else {
      const top = host.getBoundingClientRect().top + window.scrollY
      byHost.set(host, { parts: [raw], top })
    }
  }

  for (const root of options.roots) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let current = walker.nextNode()
    while (current) {
      if (current.nodeType === Node.TEXT_NODE) {
        considerTextNode(current as Text, root)
      }
      current = walker.nextNode()
    }
  }

  for (const selector of options.extraBlockSelectors ?? []) {
    try {
      document.querySelectorAll(selector).forEach((el) => {
        if (isExcluded(el, excludeJoined, excludeTags)) return
        if (byHost.has(el)) return
        const text = normalizeText(el.textContent ?? '')
        if (text.length < minText) return
        byHost.set(el, {
          parts: [text],
          top: el.getBoundingClientRect().top + window.scrollY,
        })
      })
    } catch {
      // ignore
    }
  }

  const units: ParagraphUnit[] = []
  for (const [host, { parts, top }] of byHost) {
    const text = normalizeText(parts.join(' '))
    if (text.length < minText) continue
    // Skip absurd mega-hosts (whole page wrappers).
    if (text.length > 4000 && host.tagName === 'DIV') continue
    units.push({ host, text, top })
  }

  const filtered = units.filter(
    (unit) =>
      !units.some(
        (other) =>
          other.host !== unit.host && other.host.contains(unit.host),
      ),
  )

  return filtered.sort((a, b) => a.top - b.top)
}

/**
 * Resolve scan roots.
 * Empty selectors → document.body (full-page minus excludes).
 * Otherwise union all matches; if none match → body.
 */
export function resolveRuleRoots(selectors: string[]): ParentNode[] {
  if (!selectors.length) {
    return [document.body ?? document.documentElement]
  }
  const roots: ParentNode[] = []
  const seen = new Set<Element>()
  for (const selector of selectors) {
    try {
      document.querySelectorAll(selector).forEach((node) => {
        if (seen.has(node)) return
        seen.add(node)
        roots.push(node)
      })
    } catch {
      // ignore
    }
  }
  if (roots.length === 0) {
    return [document.body ?? document.documentElement]
  }
  return roots
}
