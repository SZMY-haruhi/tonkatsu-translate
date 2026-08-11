/**
 * Glossary / proper-noun placeholders — string-level, does not re-split DOM units.
 */

export type PlaceholderPack = {
  text: string
  terms: string[]
}

/** Longer terms first so "100 Thieves" wins over "Thieves". */
export function sortGlossaryTerms(terms: string[]): string[] {
  return Array.from(
    new Set(
      terms
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    ),
  ).sort((a, b) => b.length - a.length)
}

export function applyGlossaryPlaceholders(
  text: string,
  terms: string[],
): PlaceholderPack {
  const sorted = sortGlossaryTerms(terms)
  let out = text
  const used: string[] = []
  sorted.forEach((term, index) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(escaped, 'gi')
    if (!re.test(out)) return
    re.lastIndex = 0
    out = out.replace(re, `[[T${index}]]`)
    used[index] = term
  })
  return { text: out, terms: used }
}

export function restoreGlossaryPlaceholders(
  text: string,
  terms: string[],
): string {
  let out = text
  terms.forEach((term, index) => {
    if (!term) return
    out = out.replaceAll(`[[T${index}]]`, term)
    // Models sometimes alter brackets.
    out = out.replaceAll(`[[t${index}]]`, term)
  })
  return out
}

/** Small default pack for competitive sites — brands/orgs only, not player census. */
export const COMPETITIVE_DEFAULT_GLOSSARY = [
  'HLTV',
  'FaZe',
  'MOUZ',
  'Vitality',
  'NaVi',
  'Natus Vincere',
  'G2',
  'fnatic',
  'Heroic',
  'HEROIC',
  'Spirit',
  'Liquid',
  'Cloud9',
  'Astralis',
  'BIG',
  'ENCE',
  'Complexity',
  'FURIA',
  'The MongolZ',
  'MongolZ',
  '100 Thieves',
  'NRG',
  'MIBR',
  'Imperial',
  'paiN',
  'Virtus.pro',
  'VP',
  'EWC',
  'ESL',
  'BLAST',
  'IEM',
  'CS2',
  'CS:GO',
]
