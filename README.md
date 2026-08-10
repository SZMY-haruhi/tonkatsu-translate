# 炸猪排翻译 · Tonkatsu Translate

> **v1.0.0-rc.2**（正式版候选）。通过 [GitHub Releases](https://github.com/SZMY-haruhi/tonkatsu-translate/releases) 分发；暂不上架 Chrome Web Store。

<p align="center">
  <img src="branding/tonkatsu-mark-512.png" alt="炸猪排翻译" width="128" height="128" />
</p>

极简、用户自备 API（BYOK）的 Chrome / Edge 网页双语翻译扩展。

面向**沉浸式阅读**：整页双语 / 替换、划词翻译、可视区优先与动态页面增量更新。默认 **DeepL 快速机翻**（自备 API Key）；也可接 LibreTranslate 自建，或切换到 OpenAI 兼容 / 本地模型质量档。

项目规划与阶段总结见 **[`docs/PROJECT-PLAN.md`](docs/PROJECT-PLAN.md)**。

> 这不是「沉浸式翻译」的官方项目，也不是对其闭源产品的二次分发。

## 本版要点（rc.2）

- 默认引擎改为 **DeepL**；已移除 MyMemory
- 字符预算组批 + 引擎感知并发；站点无关噪音过滤
- 视口内优先队列与渐进插入；进度防抖
- 内容侧缓存短路 + 加大本地持久缓存

## Features

- 整页翻译与还原（`Alt+Shift+T` / `Alt+Shift+R`）；侧边 Logo 气泡一键启停
- 双语插入与替换显示
- 划词翻译
- 可视区优先（视口内 > 近屏 > 远屏），动态页面增量翻译
- DeepL 快速机翻（默认）；LibreTranslate；OpenAI 兼容 API / 本地模型（Ollama · LM Studio）
- 按站点允许 / 拒绝；保留词与专名提示
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
gh release download v1.0.0-rc.2 -p "*chrome-mv3.zip" -D .
Expand-Archive .\tonkatsu-translate-v1.0.0-rc.2-chrome-mv3.zip -DestinationPath .\tonkatsu-chrome
```

本地打出发行包（Chrome / 可选 Firefox / 干净源码 zip）：

```bash
pnpm package -- --version=1.0.0-rc.2
```

产物在仓库根目录 `release/`（已 gitignore）。

### Firefox（实验）

发行页另附 `*-firefox-mv2.zip` 或 `*-firefox-mv3.zip`；或从源码构建：

```bash
pnpm --filter @tonkatsu-translate/extension build:firefox
```

`about:debugging` → 临时载入 → `apps/extension/.output/firefox-*/manifest.json`

## Configure

1. 打开扩展控制面板
2. 默认引擎是 **快速 · DeepL**：填写 API Key（Free 密钥常以 `:fx` 结尾）→ **测试连接**
3. 源语言默认 **自动检测**；目标语言默认简体中文
4. 质量档：切换到 **OpenAI 兼容 API** 或 **本地模型**，填写接口 / 密钥 / 模型
5. 打开网页 → 刷新 → 点侧边 Logo 气泡，或用快捷键 `Alt+Shift+T`

翻译请求从扩展后台**直达**你配置的厂商 / 自建端点（DeepL、LibreTranslate、OpenAI 兼容等），不经过本项目服务器。旧设置里若仍是 `mymemory`，会静默映射到 DeepL。

## Privacy

详见 [`docs/privacy.md`](docs/privacy.md)。

- API Key 与设置仅保存在浏览器扩展存储中
- 翻译请求从扩展后台直达你配置的 API，不经过本项目服务器

## License

MIT

## Credits / 技术支持

本项目以「引擎部件拼装」方式构建，感谢以下开源项目：

| 组件 | 用途 | 仓库 |
|------|------|------|
| [WXT](https://wxt.dev/) | 浏览器扩展框架（MV3） | https://github.com/wxt-dev/wxt |
| [DeepL API](https://developers.deepl.com/) | 默认快速机翻 | https://developers.deepl.com/ |
| [LibreTranslate](https://github.com/LibreTranslate/LibreTranslate) | 可选自建 / 镜像翻译后端 | https://github.com/LibreTranslate/LibreTranslate |
| [domtranslator](https://github.com/translate-tools/domtranslator) | DOM 翻译管线（扫描 / 可视区 / 动态更新） | https://github.com/translate-tools/domtranslator |
| [translate-tools/core (anylang)](https://github.com/translate-tools/core) | 翻译系统原语与调度思路参考 | https://github.com/translate-tools/core |
| [Linguist](https://github.com/translate-tools/linguist) | 成熟开源翻译扩展的架构参考 | https://github.com/translate-tools/linguist |
| [Traduzir-paginas-web (TWP)](https://github.com/FilipePS/Traduzir-paginas-web) | 网页翻译扩展领域的经典开源实现 | https://github.com/FilipePS/Traduzir-paginas-web |
