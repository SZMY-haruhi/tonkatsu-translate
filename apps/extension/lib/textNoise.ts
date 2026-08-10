/**
 * Site-agnostic noise filter: skip strings that waste MT/LLM quota
 * (scores, pure digits, punctuation-only, tiny non-linguistic tokens).
 * Keep conservative so real short labels (team names, etc.) still translate.
 */
export function isNonTranslatableNoise(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length < 2) return true

  // Pure punctuation / symbols / whitespace
  if (/^[\p{P}\p{S}\s]+$/u.test(t)) return true
  // Lone separators (wiki / UI pipes)
  if (/^[\|\s·•\-–—]+$/.test(t)) return true

  // Scores, versions-like digit runs: 16-14, 3:0, 1.2.3, 100%, +12
  if (/^[\d\s\-–—:./+%]+$/.test(t)) return true

  // Simple dates / times
  if (/^\d{1,4}([./\-]\d{1,2}){1,2}$/.test(t)) return true
  if (/^\d{1,2}:\d{2}(:\d{2})?(\s*[AaPp][Mm])?$/.test(t)) return true

  const letters = (t.match(/[A-Za-z\u4e00-\u9fff]/g) ?? []).length
  const digits = (t.match(/\d/g) ?? []).length

  // Digits only (no letters)
  if (digits >= 1 && letters === 0) return true

  // Very short with almost no letters (e.g. "#1", "A.")
  if (t.length <= 2 && letters < 2) return true

  return false
}
