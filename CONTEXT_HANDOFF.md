# CONTEXT_HANDOFF · Tonkatsu Translate

> **文档类型：** Cursor 会话上下文交接（与 `docs/PROJECT-PLAN.md` 不同）  
> **用途：** 新会话在不依赖旧聊天历史的前提下接手开发  
> **生成时间：** 2026-08-11（站点族优化验收）  
> **交接时仓库版本：** `v1.0.3a`（Alpha）  
> **交接时最新提交：** （本会话改动待用户确认后提交）  
> **远端：** https://github.com/SZMY-haruhi/tonkatsu-translate  
> **前序 Release：** https://github.com/SZMY-haruhi/tonkatsu-translate/releases/tag/v1.0.2a  

**与总计划书的区别：**

| 文件 | 角色 |
|------|------|
| `docs/PROJECT-PLAN.md` | 产品长期规划、阶段总结、路线图（唯一规划文档） |
| `CONTEXT_HANDOFF.md`（本文件） | **当前会话交接**：已完成改动、决策、待办、下一步 |

若本文件与实际代码冲突，**以实际代码为准**，并更新本文件。

---

## 1. 项目概况

### 项目名称与用途

**炸猪排翻译（Tonkatsu Translate）** — 极简、BYOK 优先的 Chrome / Edge（MV3）网页翻译浏览器扩展；Firefox MV2 为实验构建。面向沉浸式阅读：整页替换/双语、划词、侧边气泡、视口优先与动态增量翻译。

不是「沉浸式翻译」官方产品，也不是对其闭源产品的二次分发。

### 当前开发阶段 / 版本

- **阶段：** 长期 **Alpha 测试**（产品未达目标，不承诺稳定时间表）
- **版本号：** `1.0.3a`（`apps/extension/package.json`）
- **分发：** GitHub Releases 侧载 zip；暂不上架 Chrome Web Store
- **版本命名约定：** `1.0.xa` 标识 Alpha 测试构建

### 整体目标

同一套 UX 下可切换：DeepL 快速机翻（默认）、MyMemory 免 Key、LibreTranslate 自建、OpenAI 兼容 / 本地模型质量档；设置与 Key 仅存用户浏览器；翻译请求由扩展 background 直达用户配置的端点。

### 当前阶段主要目标（交接时）

本会话已完成控制面板重构、双语相关修复、Alpha 重定位、以及轻量级 API Key 安全阀门（1.0.2a）。  
**下一阶段优先：** 以实际代码为准做验收与小修，而不是再开大范围架构改造。

---

## 2. 当前项目结构

### Monorepo 概览

```text
Tonkatsu Translate/
├── apps/extension/          # WXT 扩展（唯一应用）
├── packages/
│   ├── provider/            # 翻译引擎适配
│   ├── pipeline/            # 批译 + cache key
│   └── render/              # DOM 替换 / 双语 / 还原
├── scripts/                 # package-release、build-icons
├── docs/                    # PROJECT-PLAN、privacy
├── branding/                # Logo 源图
├── release/                 # 发行 zip（gitignore）
├── package.json             # pnpm workspace 根脚本
├── pnpm-workspace.yaml
├── README.md
├── LICENSE
└── CONTEXT_HANDOFF.md       # 本交接文档
```

### 重要目录与核心文件职责

#### `apps/extension/`

| 路径 | 职责 |
|------|------|
| `entrypoints/background.ts` | Service Worker：快捷键、设置、批译、持久缓存、连接测试 |
| `entrypoints/content.ts` | Content Script：整页翻译/停止/还原、站点门禁、dock、划词 |
| `entrypoints/options/` | 新标签页控制面板（分区导航、五引擎、站点规则、高级） |
| `entrypoints/popup/` | 小弹窗：翻译/停止/还原、显示模式、打开控制面板 |
| `lib/settings.ts` | **设置 + secrets 隔离**（v1.0.2a 核心） |
| `lib/messaging.ts` | 扩展消息协议 |
| `lib/pageSession.ts` | 整页翻译会话、批调度、视口优先 |
| `lib/contentTranslateCache.ts` | content 会话缓存（只吃 PublicSettings） |
| `lib/persistentCache.ts` | background `storage.local` 持久缓存 |
| `lib/edgeDock.ts` | 侧边 Logo 气泡 |
| `lib/selection.ts` | 划词（Alt+mouseup；复制后抑制） |
| `lib/siteRules.ts` | 站点允许/禁止列表匹配 |
| `lib/schedulerTuning.ts` | 引擎感知并发（本地/MyMemory ≤2） |
| `lib/langHeuristics.ts` / `textNoise.ts` | 语言启发式与噪音过滤 |
| `wxt.config.ts` | manifest、权限、快捷键、`options open_in_tab` |
| `public/icon-*.png` | 扩展图标 |

#### `packages/provider/`

五引擎：`deepl` | `mymemory` | `libretranslate` | `openai-compatible` | `local-openai`  
工厂：`createProviderFromSettings()`；缓存命名空间：`cacheModelId()`。

#### `packages/pipeline/`

`translateTextsWithCache()` + `makeCacheKey()` + 内存缓存接口。

#### `packages/render/`

`bilingual.ts`（实验双语插入）、`replace.ts`（辅助）、`restore.ts`。

#### 构建 / 发布

| 路径 | 职责 |
|------|------|
| 根 `package.json` | `pnpm dev` / `pnpm build` / `pnpm package` |
| `scripts/package-release.mjs` | 打 chrome/firefox/source zip + NOTES |
| `scripts/build-icons.py` | 从 branding 生成图标 |
| `docs/PROJECT-PLAN.md` | 长期规划 |
| `docs/privacy.md` | 隐私说明（含 Key 仅存 local） |

### 源码 / 测试 / 构建 / 发布边界

| 类别 | 路径 | Git |
|------|------|-----|
| 产品源码 | `apps/extension/`、`packages/*/src/`、`scripts/`、`docs/`、`README.md`、`branding/` | 跟踪 |
| 测试 | **无已提交自动化测试**；本地 smoke 被 gitignore | 不进发行源码 zip |
| 构建产物 | `apps/extension/.output/`、`.wxt/` | gitignore |
| Release | `release/*.zip`、`NOTES-*.md` | gitignore；经 GitHub Releases 分发 |
| 密钥/调试 | `*.env`、`test-modelskey.env`、`双语翻译bug/`、`docs/qa/` | gitignore |

**侧载目录：** `apps/extension/.output/chrome-mv3`  
**用户安装：** 解压 `release/tonkatsu-translate-v*-chrome-mv3.zip`

---

## 3. 已完成工作（本会话实际落地）

> 仅列已提交/已发布事实。讨论过但未实现的不标为完成。

### 3.1 功能与修复（约在 v1.0.1a 及之前本会话工作流中完成）

- **控制面板重构：** 新标签页分区（常规 / 翻译引擎 / 站点规则 / 高级）；五引擎独立配置；云端与本地字段隔离
- **MyMemory 恢复：** `packages/provider/src/myMemory.ts`；免 Key；源语言脚本启发式；UTF-8 分块
- **站点规则 UI：** 顶层「所有站点 / 白名单」；白名单内「仅以下禁止 / 仅以下允许」；`siteListMode` 持久化
- **本地模型 Custom：** 选「自定义」清空接口地址
- **保存 / 测试布局：** 保存按钮非 sticky 浮层；引擎页左下角「测试当前引擎」+ 右侧 `testStatus`
- **双语相关：** `bilingual.ts` 等 DOM 修复（递归翻译、布局跳过等）；**替换模式为默认**
- **划词：** 默认关闭；启用后 Alt+松开鼠标；复制后短暂抑制气泡
- **产品定位：** 长期 Alpha；README / PROJECT-PLAN / manifest 描述同步

### 3.2 v1.0.2a 轻量安全阀门（已提交 `7beef97`，已发 Release）

1. **API Key 仅存 `chrome.storage.local`（`tonkatsu.secrets`）**，不进 `storage.sync`
2. **公开设置可 sync/local：** `tonkatsu.settings`（无密钥）
3. **content / pageSession 只读 `loadPublicSettings()`**；密钥仅 background / options（及 popup 改模式时合并 secrets 再保存）
4. **旧版 Key 自动迁移：** `migrateLegacyKeysIfNeeded()`
5. **控制面板安全说明文案** + `docs/privacy.md` 更新

### 3.3 版本与发布（已完成）

| 版本 | 提交 | GitHub Release |
|------|------|----------------|
| v1.0.1a | `bd6ef04` | https://github.com/SZMY-haruhi/tonkatsu-translate/releases/tag/v1.0.1a |
| v1.0.2a | `7beef97` | https://github.com/SZMY-haruhi/tonkatsu-translate/releases/tag/v1.0.2a |

发行资产（本地 `release/`，未进 git）：chrome-mv3 / firefox-mv2 / source zip。

### 3.4 本会话涉及的主要文件（已完成改动集合）

**新增：**

- `packages/provider/src/myMemory.ts`

**重点修改（不完全列举）：**

- `apps/extension/entrypoints/options/*`（HTML/TS/CSS）
- `apps/extension/entrypoints/content.ts`、`popup/main.ts`
- `apps/extension/lib/settings.ts`、`pageSession.ts`、`selection.ts`、`schedulerTuning.ts`、`contentTranslateCache.ts` 等
- `packages/provider/src/createProvider.ts`、`index.ts`、`localOpenAIPreset.ts`
- `packages/render/src/bilingual.ts`、`index.ts`
- `README.md`、`docs/PROJECT-PLAN.md`、`docs/privacy.md`
- `apps/extension/package.json`、`wxt.config.ts`、`scripts/package-release.mjs`

**删除：** 本会话交接时无单独「产品源码删除」需特别记录（历史清理在更早提交 `fa11e5c`）。

### 3.5 测试（本会话）

| 项 | 结果 |
|----|------|
| `pnpm build`（1.0.1a / 1.0.2a） | ✅ 成功 |
| `pnpm package -- --version=1.0.1a` / `1.0.2a` | ✅ 产出 zip |
| 控制面板布局预览（本地 http.server + browser） | ✅ 验证保存/测试布局；预览页无扩展 API 时测试失败属预期 |
| MyMemory 现场 API | 会话早期做过连通验证（**待确认**是否需在新环境复测） |
| Aikido 扫描 | 对改动文件跑过；规则侧 0 findings；Checkov IaC 本机缺失 |
| 真实 DeepL Key 整页翻译 / 缓存命中 / Edge 侧载回归 | **未在本会话完整验收** →「已实现，未验证」 |

---

## 4. 当前实现状态

### 已可正常工作（代码层面）

- 五引擎配置与 background 直连翻译路径
- 替换模式整页翻译 / 还原 / 停止；快捷键；侧边 dock；popup
- 控制面板分区与保存/测试布局
- Key 存 local secrets；content 不读密钥
- 站点规则门禁；划词开关；双层缓存；引擎感知并发

### 尚未完成 / 实验中

- **双语模式：** 仍标实验；布局与稳定性未达「可默认」标准
- **DeepL 正式验收与错误分类：** 未完成
- **退出 Alpha 条件：** 未定义
- **自动化测试：** 仓库无 committed 测试套件
- **Chrome Web Store / Firefox MV3 合规上架：** 未做

### 已知问题 / 技术债务

1. **`scripts/package-release.mjs` NOTES 模板仍写 “MyMemory removed”** —— 与当前代码矛盾；手动写的 `release/NOTES-v1.0.2a.md` 正确，但下次无手写 NOTES 时模板会误导。
2. **`replace.ts` 对主路径帮助有限** —— 实际替换依赖 `domtranslator`。
3. **replace `stop()` 访问 PersistentDOMTranslator 私有字段** —— 脆弱。
4. **本机明文 LevelDB 存储 Key** —— 已接受的轻量方案边界（非加密保险箱）；用户风险已在 UI/privacy 说明。
5. **Windows 构建偶发 `.output` 目录 EBUSY/文件锁** —— 历史上用临时输出目录或关掉占用进程绕过；**待确认**当前环境是否仍频繁出现。
6. **侧载扩展 ID 随加载路径变化** —— 「移除再加载」或换路径会导致 Key「丢失」（实为新 ID）；固定目录 + 仅「重新加载」可避免。

### 临时方案

- 发行 NOTES：重要版本用手写 `release/NOTES-v*.md` 覆盖/补充（模板仍过时）。
- 开发加载：优先固定 `apps/extension/.output/chrome-mv3`，避免反复 Remove。

---

## 5. 关键技术决策（新会话勿擅自推翻）

| 决策 | 原因 | 否决/避免 |
|------|------|-----------|
| **长期 Alpha（`1.0.xa`）** | 未达产品目标 | 勿轻易标「正式 1.0.0」 |
| **默认引擎 DeepL；默认显示 replace** | 吞吐与布局稳定性 | 勿默认双语 |
| **MyMemory 保留为免 Key 档** | 用户需要无 Key 入口 | 勿再按 rc.2「删除 MyMemory」叙事改产品 |
| **五引擎字段隔离** | 切换引擎不互相覆盖 | 勿合并云端/本地同一套 URL/Key |
| **Key → `tonkatsu.secrets` + `storage.local` only** | 防 Chrome 同步上云 | 勿把 Key 写回 sync 的 settings |
| **content 只读 PublicSettings** | 缩小 Key 暴露面 | 勿在 content 再 `loadSettings()` 含密钥 |
| **轻量安全，不做主密码/WebCrypto/会话 Key** | 用户明确要求精简 | 勿擅自上重量级加密方案 |
| **控制面板新标签页 + 分区导航** | UX 要求 | 勿改回独立小窗堆砌 |
| **保存按钮文档流固定；测试状态在引擎区** | 反浮层覆盖 | 勿恢复 sticky/透明浮层共用 status |
| **划词默认关；Alt+mouseup** | 避免干扰复制 | 勿默认开划词 |
| **站点规则：所有站点/白名单 + 禁止/允许** | UX | 勿改回扁平长列表主交互 |
| **翻译请求不经项目服务器** | BYOK/隐私 | 勿加遥测或代理后端 |
| **`docs/PROJECT-PLAN.md` 为唯一规划文档** | 已清理分散计划 | 勿再造多份计划书替代它；本 handoff 只做会话交接 |
| **测试/smoke 不进公开仓库** | 干净发行源码 | 勿提交 smoke profile / 密钥 env |

---

## 6. 当前工作流程

### 开发

```bash
pnpm install
pnpm dev          # WXT 热重载
# 或
pnpm build        # packages tsc --noEmit + wxt build
```

Chrome/Edge：加载 `apps/extension/.output/chrome-mv3`；改代码后优先点扩展「重新加载」。

### 测试

- 无仓库内自动化测试命令。
- 手动：控制面板保存/测试引擎、真实网页整页翻译、划词、站点规则、缓存二次打开。
- 可选本地 smoke（gitignore，开发机自留）。

### 打包与发布

```bash
pnpm package -- --version=1.0.2a   # 或下一版本
# 产出 release/*.zip + NOTES（模板可能过时，请人工校对）
git push origin main
gh release create vX.Y.Za --title "..." --notes-file release/NOTES-vX.Y.Za.md \
  release/tonkatsu-translate-vX.Y.Za-chrome-mv3.zip \
  release/tonkatsu-translate-vX.Y.Za-firefox-mv2.zip \
  release/tonkatsu-translate-vX.Y.Za-source.zip
```

### 版本 / 产物关系

- **源码版本：** `apps/extension/package.json` → `1.0.2a`
- **构建输出：** `.output/chrome-mv3`（本地侧载）
- **发行 zip：** `release/`（gitignore）→ GitHub Release 资产
- **WXT manifest：** 可能出现 `version` 与 `version_name` 拆分（以构建产物为准）

---

## 7. 测试状态

### 已测

- 生产构建与 package 流程（1.0.1a、1.0.2a）
- 控制面板布局（保存位置、引擎测试状态栏位）
- 静态预览下 options 页面结构（扩展 API 不可用时的错误属预期）

### 未测 / 需重点验证（新会话）

1. **升级路径：** 从 1.0.1a → 1.0.2a 后，已有 Key 是否自动迁移到 `tonkatsu.secrets` 且仍能翻译
2. **Chrome 与 Edge** 侧载：保存 Key、关闭浏览器再开、确认未进账号同步（行为层面）
3. **content 不持有密钥：** 抽样确认 content 路径只用 public settings
4. **DeepL / OpenAI / 本地 / MyMemory / Libre** 各引擎「测试连接」+ 小页翻译
5. **双语模式** 在目标站的视觉回归（已知薄弱）
6. **修复 `package-release.mjs` NOTES 模板后** 再跑一次 package，确认 NOTES 文案正确

---

## 8. 待办事项

### P0（建议优先）

- [ ] 修正 `scripts/package-release.mjs` 中 NOTES 模板「MyMemory removed」过时文案
- [x] 长文本替换多轮测修（2026-08-11）：调度/超时/假名启发式；报告见 `docs/qa/2026-08-11-long-replace-test-report.md`
- [x] **测试 Key 稳妥方案**：多轮回归默认 DeepL；LLM 仅质量抽检。见 `docs/qa/TEST-KEYS-STRATEGY.md` + `test-modelskey.env.example`；smoke 已支持 `TEST_DEEPL_API_KEY` / `TEST_ENGINE`
- [ ] 填入 DeepL Key 后，用 `TEST_ENGINE=deepl` 重跑 `long-replace` 确认限流噪声下降
- [ ] 手动验收 1.0.2a：Key 迁移、Chrome/Edge 本地存储行为（secrets 探针在 smoke 已覆盖；浏览器账号同步行为仍待人工）

### P1（当前阶段）

- [ ] 超长英维基全文吞吐与限流韧性（仍波动）
- [ ] 节点级替换导致的日/中/英碎片混杂（需更大文本单元）
- [ ] DeepL Free/Pro 错误提示分类与真实 Key 验收
- [ ] 双语模式稳定性（未达标前保持实验标签）
- [ ] 视需要：popup 改模式时读写 secrets 的路径再审计是否可更干净（当前已能工作）

### P2（后续）

- [ ] AI 档 SSE 流式
- [ ] 缓存策略（IndexedDB 等）再评估
- [ ] 快速档第二选项（Google / 微软）
- [ ] Store 上架与 Firefox MV3
- [ ] UI i18n
- [ ] 「近屏完成 / 后台继续」进度语义，减少用户过早还原

### 暂不处理 / 已排除

- 主密码 + WebCrypto 加密 Key
- 「仅本次会话」Key 模式（可日后再议）
- 为单站写死 CSS/DOM 主路径
- 扩展内嵌 Ollama 运行时
- 依赖 Chrome 自带翻译替代产品 UX
- 把 smoke/密钥提交进公开仓库

---

## 9. 下一步工作（新会话启动顺序）

1. **阅读本文件 +** `docs/qa/2026-08-11-long-replace-test-report.md`。  
2. **不要重做** 控制面板大重构、MyMemory 接入、secrets 拆分；亦勿回滚本次长文调度修复（除非有回归证据）。  
3. **先修仍开放的 P0：** `package-release.mjs` NOTES 模板。  
4. **继续** 超长英维基压测 / 碎片混杂方案，或按用户指定发版。  
5. 若用户要求发版：测修代码需先 commit；版本继续 `1.0.xa`。  
6. 每完成一个阶段，**更新本 `CONTEXT_HANDOFF.md`**。

---

## 10. 重要上下文（换窗口易丢）

### 存储键（事实）

| 键 | 区域 | 内容 |
|----|------|------|
| `tonkatsu.settings` | sync 优先，否则 local | 无 API Key 的公开设置 |
| `tonkatsu.secrets` | **仅 local** | `apiKey` / `localApiKey` / `deeplApiKey` |
| `tonkatsu.translationCache.v1` | local | 翻译缓存 |
| `tonkatsu.edgeDock.pos` | local | 气泡位置 |

### 谁读密钥

- **读：** background（翻译/测试）、options（表单）、popup（改 displayMode 时合并 secrets 再 save）
- **不读：** content、`pageSession` 批译前设置读取（`loadPublicSettings`）

### 用户已澄清的产品意图

- Key **要**保存在本机，但希望有轻量阀门，避免「不知不觉上云 / 进网页上下文」
- **不要**上重量级加密保险箱方案
- Alpha **长期**；未达目标前不宣称正式版
- Edge 与 Chrome 同样适用上述 storage 行为

### Windows 开发注意

- `.output` 被占用时 `wxt build` 可能 EBUSY；关掉占用进程或临时改输出目录（历史做法）
- 侧载勿频繁「移除」扩展，否则 ID 变、Key 看似丢失

### 仓库纯净规则

- 不提交 `.output`、`release/*.zip`、env 密钥、smoke 产物
- 公开源码 zip 由 `package-release.mjs` 过滤测试/smoke

### 文档权威

- 规划：`docs/PROJECT-PLAN.md`
- 用户安装说明：`README.md`
- 隐私：`docs/privacy.md`
- 会话交接：本文件

### 不确定项（待确认）

- 用户本机是否已用真实 DeepL Key 完成 1.0.2a 验收
- MyMemory 日限额下的当前 IP 状态
- 是否需要为扩展固定 manifest `key` 以稳定侧载 ID（讨论过，**未实现**）

---

# New Session Startup Instructions

你是接手 **Tonkatsu Translate** 的 Cursor Agent。请按下列顺序行动：

1. **先读** 项目根目录 `CONTEXT_HANDOFF.md`（本文件），再按需读 `docs/PROJECT-PLAN.md` 与 `README.md`。  
2. **理解** 当前版本为 **v1.0.2a Alpha**；最近发布提交为 `7beef97`。不要重复已完成的控制面板重构、MyMemory 恢复、secrets 拆分。  
3. **遵守**「关键技术决策」：Key 仅 `storage.local`、content 不读密钥、默认 replace、长期 Alpha、轻量安全不做主密码加密。  
4. **优先** 处理本文件第 8–9 节：先修 `package-release.mjs` NOTES 模板，再做手动验收。  
5. **改代码前** 用只读方式核对相关源文件实际状态；若与本交接文档冲突，**以代码为准**并在回复中明确指出冲突，同时更新本文件。  
6. **不要** 擅自扩大范围（Store 上架、重量级加密、默认双语等），除非用户明确要求。  
7. **每完成一个阶段** 更新 `CONTEXT_HANDOFF.md`（已完成 / 待验证 / 下一步），保证下一次会话可继续无缝接手。  
8. 需要发版时：版本继续 `1.0.xa`；`pnpm build` → `pnpm package` → 校对 NOTES → commit → push → `gh release create`；保持仓库不提交构建产物与密钥。
