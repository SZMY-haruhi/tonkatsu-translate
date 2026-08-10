# Privacy — 炸猪排翻译 / Tonkatsu Translate

本扩展是 **BYOK 优先 / 可选匿名机翻 / 自建后端** 工具：翻译请求发往**你选择的服务**，本项目不运营官方翻译云、账号或广告后端。

## What we store (on your device)

| Data | Where | Purpose |
|------|--------|---------|
| API key (if you enter one) | `chrome.storage.local` only (`tonkatsu.secrets`) | Authenticate to **your** provider; never synced via Chrome account |
| Other settings | `chrome.storage.sync` when available, else `chrome.storage.local` | Persist configuration without secrets |
| Translation cache (source→target pairs) | `chrome.storage.local` (capped) | Reduce repeat API calls |
| Edge-dock position (side / height ratio) | `chrome.storage.local` | Remember the floating control across sites |

No project-operated server receives your settings, keys, or page text.

## What leaves your browser

When you translate (full page or selection):

1. Selected or discovered page text is sent from the **extension background** to the endpoint implied by your engine:
   - **DeepL** (default fast tier): `api-free.deepl.com` or `api.deepl.com` with your API key
   - **MyMemory** (optional keyless tier): `api.mymemory.translated.net`; its operator applies anonymous per-IP limits
   - **LibreTranslate**: the base URL you set (often localhost)
   - **OpenAI-compatible / local**: the base URL + key + model you set

There is **no project-operated translation proxy**. When MyMemory is selected, page text is sent directly to MyMemory rather than through this project.

2. The response text is written back into the page DOM (bilingual insert or replace) and may be cached locally.

Page HTML is not uploaded as a whole document; the extension sends text units needed for translation.

## What we do not do

- No account, login, or cloud sync of keys through this project
- No telemetry / analytics SDK in the extension
- No ads or third-party tracking pixels from this project
- No Chrome Web Store account requirement for GitHub zip installs

## Your controls

- Clear extension storage via the browser’s extension settings to wipe keys, cache, and dock position
- Prefer a self-hosted or local OpenAI-compatible endpoint if you do not want third-party APIs
- Stop / restore page translation at any time (`Alt+Shift+R` or the edge dock)

## Contact

Issues and privacy questions: the project’s GitHub repository issue tracker.
