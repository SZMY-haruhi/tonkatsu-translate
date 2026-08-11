/**
 * Document reading-order helpers for replace-mode scheduling.
 * Lower sortKey = translate sooner (top of page / main column first).
 */

const MAIN_CONTENT_SELECTOR =
  'main, article, [role="main"], #mw-content-text, #content, .post-content, .entry-content, .mw-parser-output';

const DEMOTED_REGION_SELECTOR =
  'aside, [role="complementary"], [role="navigation"], nav, footer, .infobox, .navbox, .sidebar, .toc, .vector-toc, #toc';

function hostElement(node: Node): Element | null {
  if (node.nodeType === Node.ATTRIBUTE_NODE) {
    return (node as Attr).ownerElement;
  }
  if (node.nodeType === Node.TEXT_NODE) {
    return (node as Text).parentElement;
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    return node as Element;
  }
  return null;
}

function documentTop(el: Element): number {
  const rect = el.getBoundingClientRect();
  return rect.top + window.scrollY;
}

/**
 * Build a sort-key function once per replace session (caches main-landmark probe).
 */
export function createReplaceSortKeyFn(): (node: Node) => number {
  const hasMainLandmark = Boolean(
    document.querySelector(
      'main, article, [role="main"], #mw-content-text, #content',
    ),
  );

  return (node: Node) => {
    const el = hostElement(node);
    if (!el) return 9_000_000_000;

    let key = Math.max(0, documentTop(el)) * 100;

    if (hasMainLandmark && !el.closest(MAIN_CONTENT_SELECTOR)) {
      key += 5_000_000;
    }
    if (el.closest(DEMOTED_REGION_SELECTOR)) {
      key += 2_000_000;
    }
    if (node.nodeType === Node.ATTRIBUTE_NODE) {
      key += 8_000_000;
    }

    // Tiny tie-breaker within the same Y band only — never pull lower paragraphs up.
    const len = (node.nodeValue ?? '').length;
    key -= Math.min(len, 80) * 0.001;

    return key;
  };
}

/** Extra site chrome that burns quota without helping reading. */
export const REPLACE_IGNORED_SELECTORS = [
  'script',
  'style',
  'noscript',
  'code',
  'pre',
  'textarea',
  'svg',
  'math',
  '[contenteditable="true"]',
  '#tt-edge-dock',
  '.tt-selection-bubble',
  // Wikipedia / MediaWiki chrome
  '#mw-navigation',
  '#mw-panel',
  '#vector-main-menu',
  '#vector-toc',
  '#vector-sticky-header',
  '#vector-page-titlebar-toc',
  '#vector-appearance',
  '#p-lang-btn',
  '#p-variants',
  '#p-personal',
  '#p-views',
  '#p-cactions',
  '#p-search',
  '#siteNotice',
  '#centralNotice',
  '.vector-header-container',
  '.vector-toc',
  '.vector-page-toolbar',
  '.vector-dropdown',
  '.mw-jump-link',
  '.mw-editsection',
  '.mw-indicators',
  '.mw-authority-control',
  '#catlinks',
  '.catlinks',
  '.navbox',
  '.metadata',
  '.sistersitebox',
  '.noprint',
  '[role="navigation"]',
  'nav',
  'footer',
] as const;
