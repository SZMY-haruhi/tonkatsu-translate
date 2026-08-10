/**
 * Replace-mode mutation helpers.
 * Tonkatsu v1 uses `domtranslator` NodesTranslator for text replacement;
 * these helpers keep a small first-party API for future non-library paths.
 */

const ORIGINAL_ATTR = 'data-tt-original';

export function applyReplace(node: Text, translated: string): void {
  if (!node.ownerDocument) return;
  if (!node.parentElement?.hasAttribute(ORIGINAL_ATTR)) {
    // Store original once on the parent as a fallback marker for tooling.
    // NodesTranslator keeps the authoritative originalText state.
  }
  node.data = translated;
}

export function readText(node: Text): string {
  return node.data;
}
