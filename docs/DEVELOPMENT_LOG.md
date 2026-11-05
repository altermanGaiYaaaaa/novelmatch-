# NovelMatch V1.0 开发记录

## 完成范围

V1.0 已实现从参考小说到个人匹配报告的完整闭环：

1. **桌面基础框架**
   - Tauri 2 + React 18 + TypeScript + Vite + Tailwind CSS。
   - 左侧导航/画像列表 + 右侧主工作区布局。
   - 首页、新建画像、参考小说、画像工作台、评估报告五个核心页面。
   - 模型设置、使用指南、编辑画像、添加小说、评分、负向评价、评估进度、评估历史等交互弹窗。

2. **本地数据管理**
   - SQLite + Migration + 外键级联。
   - 表结构：`profiles`、`reference_books`、`user_ratings`、`book_analyses`、`evaluation_records`、`app_settings`。
   - 画像创建、编辑、删除、切换。
   - 正向参考小说、七维度评分。
   - 负向参考小说、最差/第二差维度。
   - 评估记录保存、回看、删除。

3. **AI 与模型接入**
   - 三字段模型配置：API Key、模型名称、Base URL。
   - API Key 使用系统凭据存储，前端只接收掩码。
   - OpenAI Chat Completions 兼容适配层。
   - 连接测试、错误分类、超时、有限重试、请求取消。
   - JSON 提取、结构校验、解析失败自动修复一次。
   - Prompt 文件化，版本 `v1.0`。

4. **画像生成**
   - 参考小说正文抓取与章节提取。
   - 逐本七维度 AI 分析。
   - 用户评分/负向排序与文本特征关联。
   - 生成 summary、keywords、likes、dislikes、dimensionPreferences、weights、confidence。
   - 用户可编辑画像总结与关键词。

5. **小说评估**
   - 链接校验、公开页面抓取、前十章提取。
   - 目标小说七维度分析。
   - AI 返回维度分与权重，后端加权汇总匹配度。
   - 五阶段进度、取消、失败重试。
   - 匹配度报告与历史记录。

## 关键实现文件

### 前端

- `desktop/src/pages/`：首页、新建画像、参考小说、工作台、报告
- `desktop/src/components/layout/`：应用壳、侧边栏、顶栏、模型设置、帮助
- `desktop/src/components/profile/`：画像编辑
- `desktop/src/components/book/`：添加小说、评分、负向评价、小说行
- `desktop/src/components/evaluation/`：评估进度、评估历史
- `desktop/src/components/ui/`：按钮、输入框、弹窗、Toast、星级、进度
- `desktop/src/lib/`：后端调用、浏览器预览层、常量、工具
- `desktop/src/stores/appStore.ts`
- `desktop/src/types/index.ts`

### 后端

- `desktop/src-tauri/src/commands/mod.rs`
- `desktop/src-tauri/src/db/mod.rs`
- `desktop/src-tauri/src/services/ai.rs`
- `desktop/src-tauri/src/services/analysis.rs`
- `desktop/src-tauri/src/services/book.rs`
- `desktop/src-tauri/src/services/keyring_store.rs`
- `desktop/src-tauri/src/services/prompts.rs`
- `desktop/src-tauri/migrations/001_init.sql`
- `desktop/src-tauri/prompts/*.txt`

## 技术方案

| 需求 | 方案 |
| --- | --- |
| 桌面容器 | Tauri 2 |
| 本地数据库 | rusqlite + WAL + Migration |
| 前后端通信 | Tauri Commands |
| 进度与取消 | Tauri 事件 + `CancellationToken` |
| API Key | keyring / 系统凭据存储 |
| 模型调用 | OpenAI Chat Completions 兼容接口 |
| JSON 容错 | 去代码块、括号截取、结构校验、一次修复 |
| 正文抓取 | reqwest + scraper + encoding_rs |
| URL 安全 | 协议白名单、DNS/IP 内网校验、手动重定向复检 |
| 匹配度 | AI 维度分与权重 + Rust 加权汇总 |
| 状态管理 | Zustand |

## 验证记录

已完成：

```text
npm run build                         ✓
cargo fmt --check                     ✓
cargo check                           ✓
cargo check --tests                   ✓
Windows 桌面应用启动                   ✓
```

浏览器端到端检查：

- 创建画像 → 自动打开正向小说导入。
- 添加参考小说 → 七维度评分 → 保存。
- 刷新后画像与参考小说仍然存在。
- 模型配置保存、状态更新。
- 编辑画像、删除画像、返回首页。
- 评估进度弹窗与错误状态展示。
- 页面控制台无 JavaScript 错误。

## 尚未完成

1. Windows NSIS 安装包构建与 GitHub Release 上传。
2. 使用真实 API Key 的在线模型质量评估。
3. 多个小说来源的长期兼容性测试。
4. 本地数据备份/恢复。
5. 匹配度权重的真实用户反馈校准。
6. 起点等启用访问验证的来源不支持自动抓取；不绕过反爬。

## 已知限制

- 匹配度是模型驱动的个人偏好估计，不是统计验证过的客观概率。
- 番茄公开页面已验证；其他站点取决于页面结构与访问策略。
- 起点返回 `202 + probe.js` 访问验证，当前不支持自动抓取。
- 浏览器预览模式只能查看界面和 CRUD 交互，不能调用真实模型。
- “加入想读清单”目前只有界面反馈，尚未持久化。

## 下一阶段依赖

- Windows + MSVC 环境完成安装包构建。
- 准备真实模型 API Key 进行端到端验收。
- 收集真实用户反馈，校准七维度权重。
- 准备公开小说链接样本，覆盖不同来源的抓取测试。
