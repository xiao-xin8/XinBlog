# XinBlog

> 一个**零服务器成本**、可一键部署到 Cloudflare 的现代个人博客系统。
> 前端、后端、数据库、AI 全部跑在 **Cloudflare 免费套餐**上——**不用买任何云服务器**，注册一个 Cloudflare 账号就能上线。

***

## 这是什么

XinBlog 是一个开箱即用的个人博客 / 内容站系统：

- **前端**：React 19 + TypeScript + Vite + Material UI
- **后端**：Cloudflare Pages Functions（Serverless，无需服务器）
- **数据库**：Cloudflare D1（SQLite 边缘数据库）
- **AI**：Cloudflare Workers AI（提供 AI 写作助手与 OpenAI 兼容接口）

你只需要一个 Cloudflare 账号（免费），按文档点几下，就能上线一个带后台管理、评论、友链、主题定制和 AI 助手的完整博客。

***

## 功能一览

- 文章 / 标签管理，Markdown 写作 + 代码高亮 + XSS 安全过滤
- 媒体库、评论、点赞、友链
- 完整后台：外观主题、配色、字体、鼠标光标、文章列表布局，全部可视化定制
- 内置 AI：文章生成、格式优化、智能对话，对外暴露 OpenAI 兼容接口（`/v1/chat/completions` 等）
- 多套内置主题、明暗模式、完善响应式（手机也能进后台管理）

***

## 技术栈

React 19 · TypeScript · Vite · MUI · Zustand · React Router · react-markdown · Cloudflare Pages Functions · D1 · Workers AI

***

## 怎么部署（两条路线）

### 路线 A：直接用构建产物部署（推荐，不需要 Git、不需要命令行）

仓库里已经准备好了两样**可以直接部署**的内容，二选一：

1. **`dist/`** —— 已经构建好的完整站点（前端 + 后端 `_worker.js` + 路由与资源文件）。
2. **`XinBlog0.1.0网页端部署资源包.zip`** —— 与 `dist/` 等价的压缩包，方便下载分发。

任选其一，在 Cloudflare 网页上上传即可。**全程不用写命令、不用 Git。**

- 部署教程请看 **[网页端部署说明](./docs/Cloudflare网页端部署说明.md)**（精简防呆版）。

### 路线 B：自己改源码后部署（开发者）

```bash
npm install
npm run build      # 产物输出到 dist/
```

然后把 `dist/` 上传到 Cloudflare Pages（步骤见上面的部署说明）。

***

## 部署前你需要准备的（Cloudflare 侧）

在 Cloudflare 控制台里需要创建 / 绑定这些东西（部署说明里有逐步图文）：

- **4 个 D1 数据库**：`myblog-users` / `myblog-posts` / `myblog-config` / `myblog-media`
- **1 个 Workers AI 绑定**（变量名必须大写 `AI`）
- **2 个环境变量**：`JWT_SECRET`、`AI_API_KEY`（各自一个强随机串）

数据库建表 SQL 在 `db/` 目录，部署说明会告诉你逐个执行。

***

## 本地开发

```bash
npm install
npm run dev        # 本地开发，默认 http://localhost:5173
npm run build      # 生产构建，输出到 dist/
npm run lint       # 代码检查
npm run preview    # 预览构建产物
```

环境变量见 `.env.example`（复制为 `.env` 按需修改；部署到 Cloudflare 后通常留空）。

| 变量                          | 说明                          | 默认值     |
| --------------------------- | --------------------------- | ------- |
| `VITE_API_BASE_URL`         | 后端 API 地址，留空则使用同源           | 空       |
| `VITE_DISABLE_CONTEXT_MENU` | 是否禁用浏览器右键菜单（`true`/`false`） | `false` |

***

## 目录结构

```
my-blog-deploy/
├── src/            前端源码（React + TypeScript）
├── public/         后端 _worker.js、_routes.json、_headers、prompts/、logo.png
├── db/             4 个 D1 建表 SQL（config / posts / users / media）
├── docs/           部署说明文档
├── dist/           构建产物（已构建好，可直接部署）
├── *.config / vite.config.ts / wrangler.toml   构建与部署配置
├── .env.example    环境变量模板
├── LICENSE         MIT
└── README.md       本文件
```

***

## License

[MIT](./LICENSE) —— 可自由使用、修改、分发。
