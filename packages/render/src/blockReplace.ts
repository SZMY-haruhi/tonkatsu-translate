/**
 * Block-level replace with optional <a href> preservation via [[Li]] markers.
 */

const ORIG_HTML_ATTR = 'data-tt-orig-html'
const REPLACED_ATTR = 'data-tt-replaced'

export function isBlockReplaced(el: Element): boolean {
  return el.getAttribute(REPLACED_ATTR) === '1'
}

function normalizeText(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

/**
 * Flatten for MT while wrapping each link label in [[L0]]…[[/L0]].
 */
export function readBlockTextForTranslate(el: Element): string {
  if (isBlockReplaced(el)) {
    return normalizeText(el.textContent ?? '')
  }
  const clone = el.cloneNode(true) as Element
  clone
    .querySelectorAll(
      'script, style, noscript, .mw-editsection, .reference, sup.reference',
    )
    .forEach((node) => node.remove())

  clone.querySelectorAll('a[href]').forEach((a, index) => {
    const label = normalizeText(a.textContent ?? '') || '·'
    a.replaceWith(document.createTextNode(`[[L${index}]]${label}[[/L${index}]]`))
  })
  return normalizeText(clone.textContent ?? '')
}

export function readBlockText(el: Element): string {
  if (isBlockReplaced(el)) {
    return normalizeText(el.textContent ?? '')
  }
  const clone = el.cloneNode(true) as Element
  clone
    .querySelectorAll(
      'script, style, noscript, .mw-editsection, .reference, sup.reference',
    )
    .forEach((node) => node.remove())
  return normalizeText(clone.textContent ?? '')
}

type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'link'; index: number; value: string }

function parseMarkedTranslation(translated: string): Segment[] | null {
  const re = /\[\[L(\d+)\]\]([\s\S]*?)\[\[\/L\1\]\]/gi
  const parts: Segment[] = []
  let last = 0
  let match: RegExpExecArray | null
  let found = 0
  while ((match = re.exec(translated))) {
    found += 1
    if (match.index > last) {
      parts.push({ kind: 'text', value: translated.slice(last, match.index) })
    }
    parts.push({
      kind: 'link',
      index: Number(match[1]),
      value: match[2] ?? '',
    })
    last = match.index + match[0].length
  }
  if (found === 0) return null
  if (last < translated.length) {
    parts.push({ kind: 'text', value: translated.slice(last) })
  }
  return parts
}

function stripLinkMarkers(translated: string): string {
  return normalizeText(
    translated
      .replace(/\[\[L\d+\]\]/gi, '')
      .replace(/\[\[\/L\d+\]\]/gi, ''),
  )
}

/**
 * Write translation back. When [[Li]] markers survive, rebuild DOM and keep hrefs.
 */
export function applyBlockReplace(el: Element, translated: string): void {
  const trimmed = translated.replace(/\s+/g, ' ').trim()
  if (!trimmed) return
  if (!el.hasAttribute(ORIG_HTML_ATTR)) {
    el.setAttribute(ORIG_HTML_ATTR, el.innerHTML)
  }
  el.setAttribute(REPLACED_ATTR, '1')

  const originalHtml = el.getAttribute(ORIG_HTML_ATTR) ?? el.innerHTML
  const probe = document.createElement('div')
  probe.innerHTML = originalHtml
  const originalAnchors = Array.from(probe.querySelectorAll('a[href]'))
  const segments = parseMarkedTranslation(translated)

  if (segments && originalAnchors.length > 0) {
    const doc = el.ownerDocument
    el.innerHTML = ''
    for (const part of segments) {
      if (part.kind === 'text') {
        if (part.value) el.appendChild(doc.createTextNode(part.value))
        continue
      }
      const src = originalAnchors[part.index]
      if (!src) {
        el.appendChild(doc.createTextNode(part.value))
        continue
      }
      const a = src.cloneNode(false) as HTMLAnchorElement
      a.textContent = part.value
      el.appendChild(a)
    }
    return
  }

  el.textContent = stripLinkMarkers(trimmed) || trimmed
}

export function restoreBlockReplace(root: ParentNode = document): void {
  root.querySelectorAll(`[${REPLACED_ATTR}="1"]`).forEach((node) => {
    const html = node.getAttribute(ORIG_HTML_ATTR)
    if (html != null) {
      node.innerHTML = html
    }
    node.removeAttribute(ORIG_HTML_ATTR)
    node.removeAttribute(REPLACED_ATTR)
  })
}
