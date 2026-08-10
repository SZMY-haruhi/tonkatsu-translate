export interface TranslationProvider {
  id: string;
  translate(input: {
    texts: string[];
    sourceLang: string | 'auto';
    targetLang: string;
  }): Promise<string[]>;
  testConnection(): Promise<{ ok: boolean; message?: string }>;
}

export type OpenAICompatibleProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
  /** Extra terms that must remain unchanged in translations. */
  doNotTranslate?: string[];
};
