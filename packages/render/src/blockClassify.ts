/**
 * Block role classification — shared heuristics for encyclopedia & competitive families.
 * Prefer structure over hostname lists.
 */

export type BlockRole = 'prose' | 'link-directory' | 'entity-chip' | 'chrome'

const LANG_DIR_HINT =
  /wikipedia\s*languages|维基百科语言|姊妹项目|sister\s*projects|other\s*languages|其他语言|言語|1[\s,]?000[\s,]?000\+|250[\s,]?000\+|50[\s,]?000\+\s*articles?/i

/**
 * High-density outbound link clusters (language walls, tag clouds, sister grids).
 * These must not enter the translation queue.
 */
export function isLinkDirectory(el: Element): boolean {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < 8) return false

  const anchors = el.querySelectorAll('a[href]')
  if (anchors.length < 8) {
    // Smaller clusters still count when almost every child is a link.
    const kids = Array.from(el.children)
    if (kids.length >= 5 && kids.filter((k) => k.matches('a[href], li')).length >= kids.length * 0.75) {
      const linkChars = Array.from(anchors).reduce(
        (n, a) => n + ((a.textContent ?? '').trim().length),
        0,
      )
      if (anchors.length >= 5 && linkChars >= text.length * 0.7) return true
    }
    return false
  }

  const linkChars = Array.from(anchors).reduce(
    (n, a) => n + ((a.textContent ?? '').trim().length),
    0,
  )
  if (linkChars >= text.length * 0.65 && anchors.length >= 8) return true

  // Heading context: "1,000,000+ articles" language walls.
  const prev = el.previousElementSibling
  const head = `${prev?.textContent ?? ''} ${el.getAttribute('aria-label') ?? ''}`
  if (LANG_DIR_HINT.test(head) || LANG_DIR_HINT.test(text.slice(0, 80))) {
    if (anchors.length >= 6) return true
  }

  return false
}

/**
 * Short entity chips (team names, IDs) — prefer stay-original at host level.
 */
export function isEntityChip(el: Element, min = 2, max = 28): boolean {
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text.length < min || text.length > max) return false
  if (/[.!?。！？]/.test(text)) return false
  const words = text.split(/\s+/).length
  if (words > 4) return false
  // Mostly letters / digits / short symbols — not a sentence.
  if (!/^[\w][\w .'\-]*$/i.test(text) && !/^[\p{L}\p{N}][\p{L}\p{N} .'\-]*$/u.test(text)) {
    return false
  }
  return true
}

export function classifyBlock(
  el: Element,
  options?: { stayOriginalJoined?: string },
): BlockRole {
  const stay = options?.stayOriginalJoined ?? ''
  if (stay) {
    try {
      if (el.matches(stay) || el.closest(stay)) return 'entity-chip'
    } catch {
      // ignore
    }
  }
  if (isLinkDirectory(el)) return 'link-directory'
  if (isEntityChip(el)) return 'entity-chip'
  return 'prose'
}
