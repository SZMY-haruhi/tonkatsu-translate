# 炸猪排翻译 · 项目总计划书

> **文档版本：** 2026-08-10  
> **产品版本：** v1.0.2a（Alpha 测试）  
> **仓库：** https://github.com/SZMY-haruhi/tonkatsu-translate

本文档是项目的**唯一**规划与阶段性总结文件，替代此前分散在 `docs/superpowers/` 等处的旧计划书。

---

## 1. 项目是什么

**炸猪排翻译（Tonkatsu Translate）** 是一款面向沉浸式阅读的 **BYOK（Bring Your Own Key）** 浏览器翻译扩展，支持 Chrome / Edge（MV3）与实验性 Firefox（MV2）。

### 定位

- **不是**「沉浸式翻译」官方产品，也**不是**对其闭源产品的二次分发。
- **是** 极简、开源、用户自备 API 的网页双语工具：同一套 UX 下可切换快速机翻、自建后端或 AI 质量档。
- **分发方式：** GitHub Releases 侧载 zip；暂不上架 Chrome Web Store。
- **阶段定位：** **长期 Alpha 测试**——尚未达到产品目标，不承诺稳定版时间表；版本号使用 `1.0.xa` 标识测试构建。

### 技术架构（Monorepo）

```text
apps/extension/          WXT 扩展：content / background / options / popup
packages/provider/       翻译引擎：DeepL、MyMemory、LibreTranslate、OpenAI 兼容、本地预设
packages/pipeline/       批量翻译、内存缓存、cache key
packages/render/         双语插入、替换模式、DOM 还原
scripts/package-release  打干净发行 zip（扩展 + 源码）
docs/                    隐私说明、本总计划书
```

### 引擎分档（产品策略）

| 档位 | 用途 | 当前实现 |
|------|------|----------|
| **快速（默认）** | 整页吞吐、接近「能流畅读」 | **DeepL**（Free / Pro BYOK） |
| **免 Key 普通机翻** | 少量、临时翻译 | MyMemory（匿名约 5000 字符/日） |
| **质量（AI）** | 难句、术语、专名 | OpenAI 兼容 API；本地 Ollama / LM Studio |
| **自建** | 隐私 / 内网 | LibreTranslate |

---

## 2. 从初始到现状：已完成步骤

### 阶段 0 — 概念与 v0.1 探索（历史）

- WXT MV3 壳、整页双语 / 替换、划词、侧边 Logo 气泡
- MyMemory 试用通道、LibreTranslate、OpenAI 兼容与本地预设
- 本地缓存、站点规则、控制面板、popup
- 分支 `feat/m0-wxt-shell` 等早期迭代（已并入产品思路，仓库后做「干净 1.0」重置）

### 阶段 1 — 干净 1.0 产品树（`7cf60cd`）

- 以 orphan `main` 重启仓库，去掉测试 / smoke / QA 计划进入发行源码
- README 精简；Release 以 zip 为主；`scripts/package-release.mjs` 产出干净包
- 首发候选 **v1.0.0-rc.1**

### 阶段 2 — 性能与机翻分档（2026-08-10，A→E）

| 任务 | 内容 | 状态 |
|------|------|------|
| **A** | DeepL Provider；默认引擎；删除 MyMemory；设置迁移 | ✅ 完成 |
| **B** | 字符/条数双约束组批；引擎感知并发；站点无关噪音过滤 | ✅ 完成 |
| **C** | 视口内 > 近屏 > 远屏优先队列；渐进插入；进度 120ms 防抖 | ✅ 完成 |
| **D** | 内容侧缓存短路；`storage.local` 持久缓存加大（约 2000/4000） | ✅ 完成 |
| **E** | README / privacy；升版 **rc.2**；GitHub Release 与 zip 资产 | ✅ 完成 |

### 阶段 2 关键结论（实测，已吸收进设计）

- 墙钟主因是 **等模型/API**（fetch ≈ 100%），不是 DOM 扫描或组包。
- 云端 Qwen 与本地 14B 同负载对比：本地单卡 + 高并发反而更慢 → 本地 LLM 并发上限 ≤2。
- 优化方向：**正式机翻默认档 + 泛用调度 + 视口优先 + 缓存**，不做单站 CSS 特化。

### 阶段 3 — 仓库精简（本文档所在提交）

- 删除本地 `docs/superpowers/` 旧计划书、过时发行 zip、冒烟截图与零散 bench 脚本
-  Consolidate 为本文档 **`docs/PROJECT-PLAN.md`**

---

### 阶段 4 — 控制面板与 Alpha 重定位（v1.0.1a）

| 内容 | 状态 |
|------|------|
| 控制面板新标签页分区导航；五引擎字段隔离 | ✅ 完成 |
| 恢复 MyMemory 免 Key 机翻；站点规则层级 UI | ✅ 完成 |
| 保存按钮 / 引擎测试状态固定布局 | ✅ 完成 |
| 双语 DOM 修复；替换默认；划词 Alt 触发 | ✅ 完成 |
| 产品定位调整为**长期 Alpha**；版本号 `1.0.1a` | ✅ 完成 |

---

## 3. 当前进度

| 维度 | 状态 |
|------|------|
| **版本** | v1.0.2a Alpha（[Release](https://github.com/SZMY-haruhi/tonkatsu-translate/releases/tag/v1.0.2a)） |
| **阶段** | 长期 Alpha 测试；未达产品目标，持续迭代 |
| **默认引擎** | DeepL |
| **核心路径** | 默认替换 / 实验双语 / Alt 划词 / 侧边气泡 / 站点规则 — 可用 |
| **自动化** | 本地 smoke / bench 不进入公开仓库（开发机保留可选） |
| **待验收** | 各引擎真实 Key 下整页翻译与缓存命中体验 |

---

## 4. 当前功能清单

### 用户可见

- 整页翻译与还原：`Alt+Shift+T` / `Alt+Shift+R`
- 侧边 Logo 气泡：吸附、拖动、一键启停
- **替换显示**为默认；保留实验性双语插入模式
- **划词翻译**默认关闭，启用后按住 Alt 松开鼠标触发
- 新标签页控制面板：左侧分区导航、五引擎独立配置、语言与显示、站点规则、高级设置
- 默认 **DeepL**；可选免 Key MyMemory、LibreTranslate、OpenAI 兼容、本地 Ollama/LM Studio

### 引擎与请求

- 翻译请求由扩展 **background 直达** 用户配置的厂商/自建端点，不经本项目服务器
- DeepL Free（`:fx`）/ Pro 端点自动识别
- MyMemory 匿名免 Key 通道；明确展示约 5000 字符/日限制，自动源语言使用本地脚本推断
- 云端 OpenAI 兼容 API 与本地 Ollama / LM Studio 分开保存地址、密钥和模型

### 性能与调度（rc.2）

- 字符 + 条数预算组批；按引擎调整并发（机翻偏高，本地 LLM ≤2）
- 噪音过滤：纯数字、纯符号、比分、过短无语义串等（站点无关）
- 视口优先三级队列；批内逐条 resolve → 渐进渲染
- 双层缓存：content 会话 Map + background 持久 `storage.local`
- 开发期可选 `[TT-PERF]` 控制台标记（`ttPerf.ts`）

### 发行与构建

```bash
pnpm install && pnpm build          # 开发构建
pnpm package -- --version=x.y.z     # release/ 下 chrome / firefox / source zip
```

---

## 5. 未来可做内容

按优先级与投入大致分组；**非承诺路线图**，实施前可再拆任务。

### P1 — 产品完善（Alpha 期间）

- [x] **控制面板 UX 矩阵**：新标签页分区导航，五引擎字段与云/本地配置完全隔离
- [ ] **DeepL 正式验收**：Free/Pro Key、配额与错误提示分类
- [x] **站点范围 UI**：顶层「所有站点 / 白名单」，白名单内选择仅以下禁止 / 仅以下允许
- [ ] **双语模式稳定性**：在达到可接受体验前保持实验标签
- [ ] **退出 Alpha 条件**（未定）：双语稳定、多引擎验收、错误提示完善等达标后再讨论 `1.0.0` 非测试标签

### P2 — 性能与体验

- [ ] **AI 档 SSE 流式**（机翻无流式时仍靠渐进批渲染）
- [ ] 重复访问同站缓存命中率与容量策略再评估（必要时 IndexedDB）
- [ ] 替换模式进度与双语对齐的可视反馈

### P3 — 引擎扩展

- [ ] 快速档第二选项：Google Cloud Translation / 微软翻译（与 DeepL 并列可选）
- [ ] 更多本地运行时预设（除 Ollama/LM Studio 外）

### P4 — 分发与生态

- [ ] Chrome Web Store / Edge Add-ons 上架评估（隐私问卷、权限说明）
- [ ] Firefox MV3 与 data collection 合规字段
- [ ] 多语言 UI（扩展界面本身 i18n）

### 明确不做（除非需求变更）

- 为单一网站（如 HLTV）写死 DOM/CSS 作为主路径
- 扩展内嵌 Ollama 运行时
- 依赖 Chrome 自带翻译替代本产品 UX

---

## 6. 文档与仓库约定

| 文件 | 用途 |
|------|------|
| `README.md` | 面向用户的安装、配置、功能摘要 |
| `docs/privacy.md` | 隐私与数据去向 |
| `docs/PROJECT-PLAN.md` | **本总计划书**（规划 + 阶段总结，唯一计划文档） |

本地开发用脚本（smoke、bench、密钥 env）**不提交**公开仓库；见根目录 `.gitignore`。

---

## 7. 版本里程碑

| 版本 | 说明 |
|------|------|
| v0.1.x | 早期功能验证（已 superseded） |
| v1.0.0-rc.1 | 干净 1.0 产品树首发候选 |
| v1.0.0-rc.2 | DeepL 默认、调度/视口/缓存 |
| **v1.0.1a** | 控制面板重构、MyMemory 恢复、站点规则层级；**长期 Alpha 起点** |
| **v1.0.2a** | API Key 仅存本机 local；内容脚本不读密钥；控制面板安全说明 |
| v1.0.xa | Alpha 测试系列（功能迭代，非稳定承诺） |

---

*最后更新：2026-08-10 · 与 v1.0.2a Alpha 发行同步*
