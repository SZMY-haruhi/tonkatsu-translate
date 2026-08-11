/** Hints for connecting browser extensions to local OpenAI-compatible daemons. */

export function isLikelyOllamaEndpoint(baseUrl: string): boolean {
  const normalized = baseUrl.trim().toLowerCase();
  return normalized.includes(':11434') || normalized.includes('ollama');
}

/** Shown in options / provider errors when Ollama rejects chrome-extension Origin. */
export const OLLAMA_ORIGINS_SETUP_HINT_ZH = [
  'Ollama 默认会拒绝来自浏览器扩展的请求（HTTP 403）。',
  '请在本机设置用户环境变量 OLLAMA_ORIGINS=*（或 chrome-extension://*），然后完全退出托盘中的 Ollama 并重新打开。',
  'Windows PowerShell：',
  "[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS','*','User')",
  '也可运行仓库脚本：scripts/setup-ollama-origins.ps1',
].join('\n');

export function appendOllamaOriginsHintIfNeeded(
  message: string,
  baseUrl: string,
  opts?: { forceOllama?: boolean },
): string {
  if (!message) return message;
  if (!/403|Forbidden/i.test(message)) return message;
  const treatAsOllama =
    opts?.forceOllama ||
    isLikelyOllamaEndpoint(baseUrl) ||
    /ollama/i.test(message);
  if (!treatAsOllama) return message;
  if (message.includes('OLLAMA_ORIGINS')) return message;
  return `${message}\n\n${OLLAMA_ORIGINS_SETUP_HINT_ZH}`;
}
