# Cloudflare 网页端部署说明

> 本文档假设你已经拿到一个包含以下内容的压缩包或文件夹：
> - **云端上传这个文件夹**：构建好的网站文件，需要上传到 Cloudflare Pages。
> - **需要执行的数据库 SQL**：4 个 SQL 文件，用于初始化 Cloudflare D1 数据库。
>
> 你只需要按照下面的步骤，在 Cloudflare Dashboard 网页上点击操作即可，不需要命令行。

---

## 一、你拿到的文件夹说明

### 1. 云端上传这个文件夹

里面应该包含：

```
云端上传这个文件夹/
├── _worker.js          ← 后端 API，必须上传
├── _routes.json        ← 路由规则，必须上传
├── index.html          ← 网站首页
├── assets/             ← JS、CSS 等资源
└── logo.png
```

> 上传时，选择**整个文件夹**，Cloudflare 会以文件夹内的内容作为网站根目录。

### 2. 需要执行的数据库 SQL

里面应该包含 4 个文件：

| SQL 文件 | 用途 | 要导入到哪个 D1 数据库 |
|----------|------|------------------------|
| `config.sql` | 站点配置、友链、系统表 | `myblog-config` |
| `posts.sql` | 文章、标签、评论、点赞 | `myblog-posts` |
| `users.sql` | 用户、刷新 Token、验证码 | `myblog-users` |
| `media.sql` | 媒体资源、分片表 | `myblog-media` |

---

## 二、部署前准备

1. 注册并登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)。
2. 准备两个强随机字符串，后面分别作为 `JWT_SECRET` 和 `AI_API_KEY` 使用。建议各自至少 32 位随机字符，例如：
   ```
   JWT_SECRET  ：XinBlog_2026_Secret_Key_For_JWT_Token
   AI_API_KEY  ：xinblog-ai-9f3a2c7e1b8d4a6f
   ```
   你可以自行修改，但请记牢，不要告诉别人。

---

## 三、第一步：创建 4 个 D1 数据库

1. 登录 Cloudflare Dashboard 后，左侧菜单找到 **Workers & Pages**，点击展开。
2. 点击 **D1**，进入数据库管理页面。
3. 点击右上角的 **Create database** 按钮。
4. 在弹出的输入框中，输入数据库名称：`myblog-config`，然后点击 **Create**。
5. 重复上面的步骤，再创建 3 个数据库：
   - `myblog-posts`
   - `myblog-users`
   - `myblog-media`

创建完成后，你会在 D1 列表里看到 4 个数据库。

---

## 四、第二步：执行 SQL 初始化数据表

### 4.1 进入 SQL 执行控制台

1. 在 D1 数据库列表中，点击 `myblog-config` 进入详情页。
2. 点击顶部标签页的 **Console**。
3. 你会看到一个 SQL 输入框，可以在这里粘贴并执行 SQL。

### 4.2 导入 config.sql

1. 用记事本或任何文本编辑器打开 `需要执行的数据库SQL/config.sql`。
2. 复制里面的全部内容。
3. 粘贴到 `myblog-config` 的 Console 输入框中。
4. 点击 **Execute** 或 **Run** 按钮执行。
5. 如果提示成功，说明表已经创建好了。

> 如果执行时提示“不支持多条语句”，就把 SQL 按 `;` 分号拆开，逐条执行。

### 4.3 导入其余 3 个 SQL

按照下面的对应关系，分别进入对应数据库的 Console，粘贴执行：

| 数据库 | 要执行的 SQL 文件 |
|--------|-------------------|
| `myblog-posts` | `posts.sql` |
| `myblog-users` | `users.sql` |
| `myblog-media` | `media.sql` |

### 4.4 检查是否成功

执行完成后，在 Console 里输入以下命令查看表：

```sql
SELECT name FROM sqlite_master WHERE type='table';
```

如果看到对应的表名，说明初始化成功。

---

## 五、第三步：上传网站到 Cloudflare Pages

### 5.1 创建 Pages 项目

1. 在 Cloudflare Dashboard 左侧菜单，点击 **Workers & Pages**。
2. 点击 **Create application** 按钮。
3. 选择 **Pages** 标签。
4. 点击 **Upload assets**。
5. 输入项目名称，例如 `my-blog`，然后点击 **Create project**。

### 5.2 上传文件夹

1. 在创建好的项目页面，点击 **Upload assets from computer**。
2. 打开你拿到的 **云端上传这个文件夹**。
3. 将整个文件夹拖入网页上传区域，或者点击选择文件夹后选中它。
4. 等待上传完成，确保列表中包含 `_worker.js` 和 `_routes.json`。
5. 点击 **Deploy site**。

部署成功后，页面会显示一个 `*.pages.dev` 地址，例如：

```
https://my-blog.pages.dev
```

---

## 六、第四步：绑定 D1 数据库

上传成功后，还需要让 Pages 能够访问刚才创建的 D1 数据库。

1. 进入你的 Pages 项目详情页。
2. 点击顶部菜单 **Settings**。
3. 左侧选择 **Functions**。
4. 找到 **D1 database bindings**，点击 **Add binding**。
5. 依次添加下面 4 个绑定：

| Variable name | D1 database |
|---------------|-------------|
| `DB_USERS`    | `myblog-users` |
| `DB_POSTS`    | `myblog-posts` |
| `DB_CONFIG`   | `myblog-config` |
| `DB_MEDIA`    | `myblog-media` |

> **Variable name 必须完全一致**，不能写错大小写，也不能改成别的名字。后端 `_worker.js` 就是靠这些名字找到数据库的。

---

## 七、第五步：绑定 Workers AI（AI 功能必需）

如果希望使用 AI 助手、AI 生成文章、图片生成以及 OpenAI 兼容 API，需要绑定 Cloudflare Workers AI。

1. 在 Pages 项目 **Settings** 页面，左侧选择 **Functions**。
2. 找到 **AI bindings**，点击 **Add binding**。
3. 填写：
   - **Variable name**：`AI`
   - **AI model**：选择 **Workers AI**
4. 点击 **Save**。

> **Variable name 必须是大写的 `AI`**，后端 `_worker.js` 通过 `env.AI` 调用模型。没有绑定 AI 时，AI 相关接口会返回 `AI binding not configured`。

---

## 八、第六步：设置环境变量（JWT_SECRET 与 AI_API_KEY 一起设置）

本站运行需要两个环境变量，**建议在这一步一次性一起设置**：

1. 在 Pages 项目 **Settings** 页面，左侧选择 **Environment variables**。
2. 点击 **Add variable**，先添加第一个：
   - **Variable name**：`JWT_SECRET`
   - **Value**：你在准备阶段生成的强随机字符串
3. 再次点击 **Add variable**，添加第二个：
   - **Variable name**：`AI_API_KEY`
   - **Value**：你在准备阶段生成的另一个强随机字符串
4. 两个都添加完成后，点击 **Save**。

> `JWT_SECRET` 是登录鉴权的密钥，非常重要，不要泄露。

---

## 九、第七步：重新部署一次（让前面的配置全部生效）

完成 D1 绑定、Workers AI 绑定并设置好 `JWT_SECRET` 与 `AI_API_KEY` 后，**必须重新上传一次网站，所有配置才会生效**：

1. 在 Pages 项目详情页，点击顶部 **Deployments**。
2. 点击 **Create new deployment**。
3. 选择 **Upload assets**。
4. 再次上传 **云端上传这个文件夹**。
5. 等待部署完成。

> 这一步很关键：如果没有重新部署，`JWT_SECRET` 和 `AI_API_KEY` 都不会生效，AI 相关接口会返回 401。

---

## 十、第八步：验证部署是否成功

打开 Cloudflare 分配给你的域名，例如：

```
https://my-blog.pages.dev/
```


如果功能异常接口报错，请检查：
- 是否上传了 `_worker.js` 和 `_routes.json`
- 是否绑定了 4 个 D1 数据库
- 是否绑定了 **Workers AI**（Variable name 为 `AI`）
- 是否设置了 `JWT_SECRET` 和 `AI_API_KEY`
- 是否重新部署了一次

---

## 十一、第九步：创建管理员账号

第一个注册的用户会自动成为管理员（`super_admin`）。

1. 打开你的 Pages 域名，例如 `https://my-blog.pages.dev`。
2. 点击右上角的用户图标，进入登录/注册页面。
3. 选择注册，填写用户名、邮箱、密码。
4. 注册完成后，访问：
   ```
   https://my-blog.pages.dev/admin/login
   ```
5. 用刚注册的账号登录，即可进入管理后台。

---

## 十二、第十步：配置 AI 调用凭证（外部调用 AI）

本站的 AI 能力有两种对外调用方式，**外部工具（如 Cursor / Obsidian / Continue）以 OpenAI 兼容接口调用本站模型时，必须持有下面任一种 API Key 才能通过鉴权**：

- **方式 A：内置 API Key（环境变量 `AI_API_KEY`）** —— 已在第六步设置，作用全局，推荐优先使用。
- **方式 B：在后台创建的自定义 API Key** —— 可为不同工具分别签发、可单独吊销。

### 12.1 内置 API Key（已在第六步设置）

`AI_API_KEY` 已经在 **第六步的环境变量** 中设置好了，无需在此重复。外部工具直接使用该 `AI_API_KEY` 作为 Bearer Token 调用 `/v1` 接口即可。

### 12.2 在后台创建自定义 API Key（可选，便于分工具管理）

如需为不同外部工具分别签发、可单独吊销的 Key：

1. 登录管理后台后，进入：
   ```
   https://my-blog.pages.dev/admin/ai
   ```
2. 点击顶部标签切换到 **API Key**。
3. 输入 Key 名称（例如 `cursor` 或 `continue`），点击 **创建**。
4. 创建成功后，会弹窗显示完整的 API Key。**请务必立即复制保存**，关闭弹窗后将无法再次查看完整 Key。
5. 在外部工具中配置：
   - **Base URL**：`https://my-blog.pages.dev/v1`
   - **API Key**：第六步的 `AI_API_KEY`，或此处复制的自定义 Key
   - **Model**：支持内置别名（如 `llama-3.3-70b`、`flux-1-schnell`），也支持任意 Cloudflare Workers AI 模型 ID（如 `@cf/meta/llama-3.3-70b-instruct-fp8-fast`）

> 使用自定义模型时，模型 ID 格式为 `custom:<自定义模型ID>`。

---

## 十三、第十一步：绑定自定义域名（可选）

如果你有自己的域名，可以绑定到 Pages 项目上。

1. 进入 Pages 项目详情页，点击 **Custom domains**。
2. 点击 **Set up a custom domain**。
3. 输入你的域名，例如 `blog.example.com`。
4. 按照提示，在你的域名 DNS 中添加一条 CNAME 记录：
   - 类型：**CNAME**
   - 名称：**blog**
   - 目标：**my-blog.pages.dev**
5. 等待几分钟，DNS 生效后，SSL 证书会自动颁发。

---

## 十四、后续更新

如果以后拿到新的 **云端上传这个文件夹**，只需要重复 **第七步（重新部署）**：

**Deployments** → **Create new deployment** → **Upload assets**，重新上传即可。

> 如果更新后改动了环境变量（如更换 `JWT_SECRET` / `AI_API_KEY`），同样需要重新部署一次使其生效。

---

## 十五、常见问题

| 问题 | 可能原因 | 解决方法 |
|------|----------|----------|
| `/api/v1/site` 返回 500 | `JWT_SECRET`、D1 或 AI 绑定未生效 | 检查 Settings 里的绑定和环境变量，确认后重新部署 |
| `/api/*` 返回 404 | `_worker.js` 或 `_routes.json` 没上传 | 重新上传整个文件夹 |
| 页面空白 | 只上传了 `assets/` 文件夹 | 要上传整个 **云端上传这个文件夹** |
| AI 接口返回 `AI binding not configured` | 未绑定 Workers AI | 在 Settings → Functions → AI bindings 中添加 Variable name 为 `AI` 的绑定 |
| 外部调用 `/v1` 返回 401 | 未设置 `AI_API_KEY` | 在环境变量中设置 `AI_API_KEY`（第六步），并重新部署一次 |
| 登录后没有管理权限 | 不是第一个注册用户 | 在 `myblog-users` 数据库的 `users` 表中，把自己的 `role` 改成 `super_admin` |
| 评论或点赞不可用 | 互动功能未开启 | 登录后台，在“互动设置”中开启 |

---

## 十六、检查清单

部署完成后，确认以下事项都已完成：

- [ ] 已创建 4 个 D1 数据库：`myblog-users`、`myblog-posts`、`myblog-config`、`myblog-media`
- [ ] 已在对应数据库中执行 4 个 SQL 文件
- [ ] 已将 **云端上传这个文件夹** 上传到 Cloudflare Pages
- [ ] Pages 项目中已绑定 4 个 D1 数据库，Variable name 正确
- [ ] Pages 项目中已绑定 **Workers AI**，Variable name 为 `AI`
- [ ] 已在环境变量中一起设置 `JWT_SECRET` 与 `AI_API_KEY`（第六步）
- [ ] 已重新部署一次（第七步），使上述配置全部生效
- [ ] 访问 `/api/v1/site` 能返回 JSON
- [ ] 已注册第一个管理员账号
- [ ] （按需）已在后台 **AI 管理 → API Key** 创建自定义 Key

---

> 文档版本：2026-07-23
> 适用项目：XinBlog（React + Vite + Cloudflare Pages + D1 + Workers AI）
