export interface TranslationCache {
  get(key: string): string | undefined;
  set(key: string, value: string): void;
  size(): number;
}
