/** Cheap heuristics to avoid bilingual-duplicating text already in the target language. */
export function looksLikeInlineBilingual(text: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (!/\|/.test(normalized)) return false
  const hasLatin = /[A-Za-z]/.test(normalized)
  const hasCjk = /[\u4e00-\u9fff]/.test(normalized)
  return hasLatin && hasCjk && normalized.length <= 240
}

export function looksAlreadyInTargetLang(text: string, targetLang: string): boolean {
  const normalized = text.replace(/\s+/g, ' ').trim()
  if (normalized.length < 2) return false

  const cjk = (normalized.match(/[\u4e00-\u9fff]/g) ?? []).length
  const latin = (normalized.match(/[A-Za-z]/g) ?? []).length

  if (/^zh/i.test(targetLang)) {
    // Pure / mostly Chinese already → skip (prevents X/zh UI bilingual doubles).
    if (cjk >= 2 && latin === 0) return true
    if (normalized.length < 6) return false
    return cjk >= 4 && cjk >= Math.max(1, latin) * 2
  }

  if (/^en/i.test(targetLang)) {
    if (normalized.length < 6) return false
    return latin >= 8 && cjk === 0
  }

  return false
}
