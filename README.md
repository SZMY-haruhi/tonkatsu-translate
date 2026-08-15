# 炸猪排翻译 · Tonkatsu Translate

> **v1.0.3a**（测试构建；`a` = Alpha）。通过 [GitHub Releases](https://github.com/SZMY-haruhi/tonkatsu-translate/releases) 分发；暂不上架 Chrome Web Store。

<p align="center">
  <img src="branding/tonkatsu-mark-512.png" alt="炸猪排翻译" width="128" height="128" />
</p>

极简、BYOK 优先的 Chrome / Edge 网页双语翻译扩展。

面向**沉浸式阅读**：整页双语 / 替换、划词翻译、可视区优先与动态页面增量更新。默认 **DeepL 快速机翻**（自备 API Key）；也可切换到免 Key、有限额的 MyMemory，连接 LibreTranslate 自建服务，或使用 OpenAI 兼容 / 本地模型质量档。

> 这不是「沉浸式翻译」的官方项目，也不是对其闭源产品的二次分发。

## Alpha 测试说明

本扩展**尚未达到产品目标**，计划**长期处于 Alpha 测试阶段**：功能可用、持续迭代，但不承诺稳定或完整。版本号采用 `1.0.xa` 形式标识测试构建；欢迎侧载试用与反馈，请自行承担日常使用风险。

## 本版要点（1.0.3a）

- 发射端段落化 + 站点族规则（百科 / 综合竞技）：语言墙排除、结构化链接写回、专名占位
- 默认替换模式；DeepL + OpenAI 兼容 / 本地 Ollama Hy-MT
- API Key 仅存本机 `tonkatsu.secrets`（延续 1.0.2a 阀门）

## 本版要点（1.0.2a，前序）

- API Key **仅保存在本机**（`storage.local`），不进 Chrome 账号同步；内容脚本不读取密钥
- 控制面板引擎区增加 Key 安全说明

## Features

- 整页翻译与还原（`Alt+Shift+T` / `Alt+Shift+R`）；侧边 Logo 气泡一键启停
- **替换显示为默认**；双语插入为实验选项
- 划词翻译（默认关闭；控制面板开启后 **Alt+松开鼠标** 触发）
- 可视区优先（视口内 > 近屏 > 远屏），动态页面增量翻译
- DeepL 快速机翻（默认）；MyMemory 免 Key 普通机翻；LibreTranslate；OpenAI 兼容 API / 本地模型（Ollama · LM Studio）
- 所有站点 / 白名单顶层范围；白名单内可切换仅以下禁止 / 仅以下允许
- 本地翻译缓存（减少重复请求）

## Install

### 推荐：下载发行版 zip

1. 打开 [Releases](https://github.com/SZMY-haruhi/tonkatsu-translate/releases)，下载 `tonkatsu-translate-v*-chrome-mv3.zip`
2. 解压到任意本地文件夹
3. 打开 `chrome://extensions`（Edge 为 `edge://extensions`）
4. 启用「开发者模式」
5. 「加载已解压的扩展程序」→ 选择解压后的文件夹

之后升级时：下载新版 zip，解压覆盖同一文件夹（或加载新文件夹），在扩展页点击「重新加载」即可。

### 进阶：从源码构建

适合需要改代码或自行打包的情况。

```bash
pnpm install
pnpm build
```

然后加载 `apps/extension/.output/chrome-mv3`。

也可用 PowerShell + [GitHub CLI](https://cli.github.com/) 拉取已发布的构建产物，再按上方步骤加载解压目录：

```powershell
gh release download v1.0.3a -p "*chrome-mv3.zip" -D .
Expand-Archive .\tonkatsu-translate-v1.0.3a-chrome-mv3.zip -DestinationPath .\tonkatsu-chrome
```

本地打出发行包（Chrome / 可选 Firefox / 干净源码 zip）：

```bash
pnpm package -- --version=1.0.3a
```

产物在仓库根目录 `release/`（已 gitignore）。

### Firefox（实验）

发行页另附 `*-firefox-mv2.zip` 或 `*-firefox-mv3.zip`；或从源码构建：

```bash
pnpm --filter @tonkatsu-translate/extension build:firefox
```

`about:debugging` → 临时载入 → `apps/extension/.output/firefox-*/manifest.json`

## Configure

1. 打开扩展控制面板（会在普通浏览器新标签页中打开）
2. 默认引擎是 **快速 · DeepL**：填写 API Key（Free 密钥常以 `:fx` 结尾）→ **测试连接**；不使用 Key 时可选 MyMemory（匿名约 5000 字符/日）
3. 源语言默认 **自动检测**；目标语言默认简体中文
4. 质量档：OpenAI 兼容 API 与本地模型拥有独立配置；切换不会覆盖彼此的地址、密钥或模型
5. 打开网页 → 刷新 → 点侧边 Logo 气泡，或用快捷键 `Alt+Shift+T`

### 本地模型（Ollama / LM Studio，进阶）

本地档需要你本机先安装并启动运行时；**发行包不会内嵌模型**。

**Ollama（重要）：** 浏览器扩展访问本机 Ollama 时，Ollama 默认会拒绝带 `chrome-extension://` 的请求（表现为测试连接 **HTTP 403**）。请在本机设置用户环境变量后重启 Ollama：

```powershell
# Windows：仓库一键脚本（推荐）
powershell -ExecutionPolicy Bypass -File .\scripts\setup-ollama-origins.ps1

# 或手动：
[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS','*','User')
```

然后**完全退出托盘中的 Ollama 并重新打开**。控制面板 → 本地模型 → 填入地址（默认 `http://127.0.0.1:11434/v1`）与模型名 → **测试连接**。若仍失败，面板会显示可操作的排查步骤。

LM Studio 一般无需 `OLLAMA_ORIGINS`；启动 Local Server 后使用默认 `http://127.0.0.1:1234/v1` 即可。


## Privacy

详见 [`docs/privacy.md`](docs/privacy.md)。

- API Key 与设置仅保存在浏览器扩展存储中
- 翻译请求从扩展后台直达你配置的 API，本项目没有后端服务器

## License

MIT

## Credits / 技术支持

本项目以「引擎部件拼装」方式构建，感谢以下开源项目：

| 组件 | 用途 | 仓库 |
|------|------|------|
| [WXT](https://wxt.dev/) | 浏览器扩展框架（MV3） | https://github.com/wxt-dev/wxt |
| [DeepL API](https://developers.deepl.com/) | 默认快速机翻 | https://developers.deepl.com/ |
| [MyMemory](https://mymemory.translated.net/doc/spec.php) | 可选免 Key 普通机翻 | https://mymemory.translated.net/ |
| [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) | 可选自建 / 镜像翻译后端 | https://github.com/LibreTranslate/LibreTranslate |
| [domtranslator](https://github.com/translate-tools/domtranslator) | DOM 翻译管线（扫描 / 可视区 / 动态更新） | https://github.com/translate-tools/domtranslator |
| [translate-tools/core (anylang)](https://github.com/translate-tools/core) | 翻译系统原语与调度思路参考 | https://github.com/translate-tools/core |
| [Linguist](https://github.com/translate-tools/linguist) | 成熟开源翻译扩展的架构参考 | https://github.com/translate-tools/linguist |
| [Traduzir-paginas-web (TWP)](https://github.com/FilipePS/Traduzir-paginas-web) | 网页翻译扩展领域的经典开源实现 | https://github.com/FilipePS/Traduzir-paginas-web |

---

## Author

<a href="https://tonkatsu258.vercel.app/">
  <img src="branding/tonkatsu-mark-512.png" width="96" height="96" alt="tonkatsu258" />
</a>

**感谢star❤️**

**[tonkatsu258](https://tonkatsu258.vercel.app/)** · [个人网站](https://tonkatsu258.vercel.app/)

