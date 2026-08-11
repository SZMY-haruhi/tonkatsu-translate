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
  const kana = (normalized.match(/[\u3040-\u30ff]/g) ?? []).length

  if (/^zh/i.test(targetLang)) {
    // Japanese source often has many kanji; kana means it is not already Chinese.
    if (kana >= 2) return false
    // Pure / mostly Chinese already → skip (prevents X/zh UI bilingual doubles).
    if (cjk >= 2 && latin === 0) return true
    if (normalized.length < 6) return false
    return cjk >= 4 && cjk >= Math.max(1, latin) * 2
  }

  if (/^ja/i.test(targetLang)) {
    if (normalized.length < 6) return false
    // Already Japanese if kana-heavy (or kana + kanji) with little Latin.
    return kana >= 4 && latin <= 2
  }

  if (/^en/i.test(targetLang)) {
    if (normalized.length < 6) return false
    return latin >= 8 && cjk === 0 && kana === 0
  }

  return false
}

/**
 * True when a provider "translation" is almost certainly an echo / failed batch
 * (e.g. Hy-MT returning the English source unchanged for zh-CN).
 */
export function translationLooksUntranslated(
  source: string,
  translated: string,
  targetLang: string,
): boolean {
  const s = source.replace(/\s+/g, ' ').trim()
  const t = translated.replace(/\s+/g, ' ').trim()
  if (!t) return true
  if (t === s) return true

  const srcLatin = (s.match(/[A-Za-z]/g) ?? []).length
  const srcCjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length
  const outCjk = (t.match(/[\u4e00-\u9fff]/g) ?? []).length
  const outKana = (t.match(/[\u3040-\u30ff]/g) ?? []).length
  const outLatin = (t.match(/[A-Za-z]/g) ?? []).length

  if (/^zh/i.test(targetLang)) {
    // Latin-heavy source should produce CJK; empty CJK ⇒ failed echo.
    if (srcLatin >= 10 && srcCjk === 0 && outCjk < 2) return true
  }
  if (/^ja/i.test(targetLang)) {
    if (srcLatin >= 10 && srcCjk === 0 && outKana < 2 && outCjk < 2) return true
  }
  if (/^en/i.test(targetLang)) {
    if (srcCjk >= 4 && outLatin < 4) return true
  }
  return false
}
