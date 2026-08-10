export type RestorableTranslator = {
  restore(node: Node): void;
};

export function restoreTree(
  translator: RestorableTranslator,
  root: Element = document.documentElement,
): void {
  translator.restore(root);
}
