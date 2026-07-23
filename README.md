# XinBlog

> 一个**零服务器成本**、可一键部署到 Cloudflare 的现代个人博客系统。基于 React 19 + TypeScript + Vite + Material UI 构建，后端运行在 Cloudflare Pages Functions + D1 + Workers AI 上——**无需购买任何云服务器**，免费额度即可支撑一个高性能个人站点。

---

## ✨ 为什么选 XinBlog

### 💸 真正零服务器成本
- 前端、后端、数据库、AI 全部跑在 **Cloudflare 免费套餐**上：Pages（静态托管）+ Pages Functions（Serverless 后端）+ D1（SQLite 边缘数据库）+ Workers AI（模型推理）。
- 没有 ECS / 轻量应用服务器 / 容器服务的月费，**注册一个 Cloudflare 账号就能上线**。
- 边缘网络全球加速，访问延迟低，自带免费 HTTPS 与防 DDoS。

### ⚡ 丝滑的使用体验
- **路由懒加载 + 组件级 Suspense**：首屏快，切换页面不白屏。
- **统一 API 客户端**：内置接口级缓存（TTL）、401 自动刷新 Token、并发请求去重、缓存联动失效——你几乎感知不到网络等待。
- **Zustand 状态管理**：持久化 + 跨标签页实时同步，多窗口操作数据自动一致。
- **完整错误边界（ErrorBoundary）**：单页异常不会拖垮整个站点。
- **完善响应式**：从手机到大屏自适应，后台管理也能在移动端使用。

### 🎨 极高的可定制程度
- **主题系统**：多套内置配色预设，后台可视化自定义主色 / 副色 / 全局圆角，明暗模式一键切换。
- **自定义字体与鼠标光标**：从资源服务站按需加载，后台一键启用，无需改代码。
- **多种文章列表布局**：网格卡片 / 横向列表 / 杂志布局，后台带实时预览。
- **Markdown 文章**：基于 `react-markdown` + 代码高亮，使用 `rehype-sanitize` 做 XSS 安全过滤。
- **完整后台管理**：文章、标签、媒体库、评论、友链、外观、主题、用户、邮件通知、AI 辅助……几乎站点的一切都能在后台配置。

### 🤖 内置 AI 能力
- 文章生成、格式优化、智能对话。
- 对外暴露 **OpenAI 兼容接口**（`/v1/chat/completions`、`/v1/models`、`/v1/embeddings`），可在 Cursor / Obsidian / Continue 等工具中直接接入。
- AI 密钥仅存于后端，不暴露到浏览器。

---

## 🧰 技术栈

React 19 · TypeScript · Vite · Material UI (MUI) · Zustand · React Router · react-markdown · notistack · dayjs

后端（配套，见下方部署说明）：Cloudflare Pages Functions · D1 · Workers AI

---

## 🚀 快速开始（本地开发）

```bash
# 安装依赖
npm install

# 本地开发（默认 http://localhost:5173）
npm run dev

# 类型检查 + 生产构建
npm run build

# 代码检查
npm run lint

# 预览构建产物
npm run preview
```

### 环境变量

复制 `.env.example` 为 `.env` 并按需修改：

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| `VITE_API_BASE_URL` | 后端 API 地址，留空则使用同源（部署到 Cloudflare 后通常留空） | 空 |
| `VITE_DISABLE_CONTEXT_MENU` | 是否禁用浏览器右键菜单（`true`/`false`） | `false` |

---

## 🌩️ 部署：零服务器上线

本项目专为 **Cloudflare 免费套餐**设计，前端构建产物与后端 `_worker.js` 一同托管到 Cloudflare Pages，**无需自建服务器**。

完整图文部署流程（创建 D1 数据库、绑定 Workers AI、配置环境变量、创建管理员、配置 AI API Key 等）请见：

👉 **[Cloudflare 部署说明（docs/Cloudflare网页端部署说明.md）](./docs/Cloudflare网页端部署说明.md)**

部署要点速览：
1. 用 `npm run build` 构建，得到 `dist/`。
2. 将 `dist/` 与后端 `_worker.js`、`_routes.json` 上传到 Cloudflare Pages。
3. 创建并绑定 4 个 D1 数据库（`DB_USERS` / `DB_POSTS` / `DB_CONFIG` / `DB_MEDIA`）。
4. 绑定 Workers AI（变量名 `AI`），设置 `JWT_SECRET` 环境变量。
5. 重新部署一次即可访问。

> 后端 Worker 与 SQL 初始化脚本位于本仓库配套的 `deploy/` 与 `db/` 目录；资源素材（字体 / 光标 / 示例文章）位于配套的静态资源目录。

---

## 📁 目录结构

```
src/
├── api/        统一 API 客户端与各业务接口封装
├── components/ 通用组件 / 前台框架 / 文章 / 评论 / 后台
├── pages/      页面层（前台 + admin 后台）
├── router/     集中式路由（含权限守卫）
├── stores/     Zustand 状态层
├── theme/      运行时主题生成
├── themes/     内置文章卡片主题包
├── types/      类型定义
├── utils/      工具函数
└── hooks/      自定义 Hook
```

---

---

## 📦 部署产物（dist）

`npm run build` 会将前端构建到 `dist/`，并把后端 `_worker.js`、`_routes.json` 以及静态资源（`posts/`、`prompts/`、`_headers`）一并带出，因此 **`dist/` 是一个开箱即用的完整部署包**：

- 直接上传 `dist/` 到 Cloudflare Pages（手动上传，或 `wrangler pages deploy dist`）；
- 或在 Cloudflare Pages 绑定本仓库，构建命令 `npm run build`、输出目录 `dist`，由平台自动部署。

部署前需在 Cloudflare Pages 控制台完成：绑定 Workers AI（变量名 `AI`）、创建并绑定 4 个 D1 数据库（`DB_USERS` / `DB_POSTS` / `DB_CONFIG` / `DB_MEDIA`）、设置 `JWT_SECRET` 与 `AI_API_KEY` 环境变量。详见 [Cloudflare 部署说明](./docs/Cloudflare部署说明.md)。

---

## 🗂️ 离线部署资源包（XinBlog 0.1.0 网页端部署资源包）

仓库内附带一份整合好的 **`XinBlog0.1.0网页端部署资源包/`**，适合不走 Git 流程、直接拿去上传或分发的场景。内含三样东西：

- **`云端上传这个文件夹/`**：已经构建好的完整站点，直接整体上传到 Cloudflare Pages 即可（内容等价于上面的 `dist/`）。
- **`需要执行的数据库 SQL/`**：4 个 D1 数据库的建表脚本，部署后按说明执行初始化。
- **`Cloudflare网页端部署说明.md`**：部署步骤，从建库、绑定 Workers AI 到设置环境变量。

> 该资源包是 `dist/`、`db/`、`docs/` 的整合快照，随版本打包；若需最新内容，仍以 `npm run build` 产出的 `dist/` 为准。

---

## 📄 License

[MIT](./LICENSE)
