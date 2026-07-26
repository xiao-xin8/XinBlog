# XinBlog

> 一个**零服务器成本**、可一键部署到 Cloudflare 的现代个人博客系统。基于 React 19 + TypeScript + Vite + Material UI 构建，后端运行在 Cloudflare Pages Functions + D1 + Workers AI 上——**无需购买任何云服务器**，免费额度即可支撑一个高性能个人站点。

***

## ✨ 主要特性

### 💸 真正零服务器成本

- 前端、后端、数据库、AI 全部跑在 **Cloudflare 免费套餐**上：Pages（静态托管）+ Pages Functions（Serverless 后端）+ D1（SQLite 边缘数据库）+ Workers AI（模型推理）。
- 没有 ECS / 轻量应用服务器 / 容器服务的月费，**注册一个 Cloudflare 账号就能上线**。
- 边缘网络全球加速，访问延迟低，自带免费 HTTPS 与防 DDoS。

### ⚡ 丝滑的使用体验

- **路由懒加载 + 组件级 Suspense**：首屏快，切换页面不白屏。
- **统一 API 客户端**：内置接口级缓存（TTL）、401 自动刷新 Token、并发请求去重、缓存联动失效。
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

### 💕 看板娘（Live2D）

- 支持**本地模型**：将模型放到 `public/live2d-models/` 即自动使用，缺失时回退官方 CDN。
- 高级设置可填写**自定义模型 CDN 地址**，自行指定模型源。

***

## 🧰 技术栈

React 19 · TypeScript · Vite · Material UI (MUI) · Zustand · React Router · react-markdown · notistack · dayjs

后端（配套）：Cloudflare Pages Functions · D1 · Workers AI

***

## 🚀 快速开始（本地开发）

```bash
# 安装依赖
npm install

# 本地开发（默认 http://localhost:5173）
npm run dev

# 类型检查 + 生产构建，产物输出到 dist/
npm run build

# 代码检查
npm run lint

# 预览构建产物
npm run preview
```

### 环境变量

复制 `.env.example` 为 `.env` 并按需修改：

| 变量                          | 说明                                      | 默认值     |
| --------------------------- | --------------------------------------- | ------- |
| `VITE_API_BASE_URL`         | 后端 API 地址，留空则使用同源（部署到 Cloudflare 后通常留空） | 空       |
| `VITE_DISABLE_CONTEXT_MENU` | 是否禁用浏览器右键菜单（`true`/`false`，默认不禁用，更友好）   | `false` |


***

## 🌩️ 部署：零服务器上线

本项目专为 **Cloudflare 免费套餐**设计，前端构建产物与后端 `_worker.js` 一同托管到 Cloudflare Pages，**无需自建服务器**。

部署步骤：

1. 用 `npm run build` 构建，得到 `dist/` 目录（包含前端资源以及 `_worker.js`、`_routes.json`）。
2. 将 `dist/` 整个目录上传到 Cloudflare Pages（或本地用 `wrangler pages deploy dist`）。
3. 创建并绑定 4 个 D1 数据库（`DB_USERS` / `DB_POSTS` / `DB_CONFIG` / `DB_MEDIA`）。
4. 绑定 Workers AI（变量名 `AI`），设置 `JWT_SECRET` 环境变量。
5. 重新部署一次即可访问。

📖 **详细图文部署教程（网页端）**：https://xin--blog.pages.dev/post/post-1784971762189

> 后端 Worker 即仓库内的 `public/_worker.js`（与 `_routes.json` 一并随 `public/` 拷贝进 `dist/`）；数据库表结构初始化 SQL 位于本仓库 `db/` 目录（含 `数据库初始化.md` 说明）。字体 / 光标 / 示例文章等资源素材托管在独立的静态资源站点（由 `src/config.ts` 中的 `CLOUD_BASE_URL` 指定），并不随本仓库分发。

***

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

***

## 📝 更新日志

### v0.2.0 (2026-07-26)

- **主题设置大幅增强**：新增「主题设置」管理页面，内含 5 个子标签 ——
  - **文章卡片**：自定义文章卡片视觉样式
  - **文章详情**：自定义文章详情页风格
  - **场景主题**：自定义场景特效
  - **英雄区主题**：自定义 Hero（首屏）布局
  - **导航设置**：自定义顶部导航视觉风格
- **看板娘（Live2D）体验优化**：
  - 默认从官方 CDN 加载模型；
  - 保留本地模型优先加载（检测到本地模型时自动使用，缺失则回退 CDN）；
  - 高级设置新增「自定义模型 CDN 地址」，可自行指定模型源。
- **Bug 修复**：修复首次加载重复请求 3 次站点配置（`/api/v1/site`）的问题，降低冷启动请求数与延迟；其他若干细节修复。

***

## 📄 License

[MIT](./LICENSE) © 2026 XinBlog
