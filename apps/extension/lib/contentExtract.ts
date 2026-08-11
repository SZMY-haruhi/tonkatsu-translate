/**
 * Emit-side extraction facade: effective rules → paragraph units.
 */

import {
  classifyBlock,
  collectParagraphUnits,
  resolveRuleRoots,
  type ParagraphUnit,
} from '@tonkatsu-translate/render';
import {
  joinSelectors,
  resolveEffectiveRule,
  type EffectiveRule,
} from './translationRules';

export function collectReplaceParagraphs(
  rule: EffectiveRule = resolveEffectiveRule(),
): ParagraphUnit[] {
  const roots = resolveRuleRoots(rule.selectors)
  const stayJoined = joinSelectors(rule.stayOriginalSelectors)
  const units = collectParagraphUnits({
    roots,
    excludeSelectors: rule.excludeSelectors,
    excludeTags: rule.excludeTags,
    extraBlockSelectors: rule.extraBlockSelectors,
    minTextCount: rule.paragraphMinTextCount,
  })

  return units.filter((unit) => {
    const role = classifyBlock(unit.host, { stayOriginalJoined: stayJoined })
    // Skip link directories entirely; skip stay-original / entity chips on competitive.
    if (role === 'link-directory') return false
    if (stayJoined && role === 'entity-chip') {
      try {
        if (
          unit.host.matches(stayJoined) ||
          unit.host.closest(stayJoined)
        ) {
          return false
        }
      } catch {
        // fall through — heuristic entity chips still translate unless matched
      }
    }
    return true
  })
}

export function isParagraphHostCandidate(
  el: Element,
  rule: EffectiveRule = resolveEffectiveRule(),
): boolean {
  return collectReplaceParagraphs(rule).some(
    (unit) => unit.host === el || el.contains(unit.host),
  )
}

export type { EffectiveRule, ParagraphUnit }
