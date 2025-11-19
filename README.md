# ECS 静态托管共创平台

该项目提供了一个可托管到 ECS 的 HTML 文件共创平台，包含 React 前端、Node.js + Express + Prisma 后端、Nginx 网关与部署脚本。用户可浏览与上传 HTML 文件，管理员可管理权限审批，满足共创与展示需求。

## 目录结构

```text
ecs-hosting-platform/
├── client/                 # 前端 React + Vite 应用
├── server/                 # 后端 Express + Prisma + SQLite
├── nginx/                  # Nginx 配置
├── scripts/                # 运维脚本，如 deploy.sh
├── docker-compose.yml      # 编排前后端、Nginx
└── README.md
```

## 快速开始（本地开发）

1. 初始化依赖
   ```bash
   # 前端
   cd client
   npm install
   npm run dev
   # 另开终端启动后端
   cd ../server
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run dev
   ```
2. 配置环境变量  
   - 将 `server/.env.example` 复制为 `.env` 并调整 `DATABASE_URL`, `UPLOAD_DIR`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `JWT_SECRET`。
   - 默认管理员账户为 `admin/Admin123!`，上线前请务必修改。
3. Docker 一体化（可选）
   ```bash
   # 构建前端产物
   cd client && npm run build && cd ..
   docker compose up --build
   ```
4. 访问地址
   - 前端：`http://localhost`
   - 托管 HTML：`http://localhost/sites/<path>`
   - API：`http://localhost/api/*`

## 功能概览

- 用户端：
  - 浏览当前所有托管目录与文件。
  - 上传 HTML，选择或新建目录路径。
  - 若需覆盖/删除已存在的 HTML，先提交权限申请。
- 管理端：
  - 登录专属页面。
  - 查看审批请求并同意或拒绝，生成临时 Token。
  - Token 有效期 10 分钟，用于授权用户操作指定 HTML。

## API 一览

| Method | Path | 说明 |
| --- | --- | --- |
| `GET /api/projects` | 返回所有托管条目及目录树。 |
| `POST /api/upload` | 上传 HTML，支持 `path`（相对目录）与 `token`（覆盖时必填）。 |
| `DELETE /api/files` | 通过审批 Token 删除指定 HTML。 |
| `POST /api/request-permission` | 申请 `MODIFY` / `DELETE` 权限，返回请求号。 |
| `POST /api/auth/login` | 管理员登录，返回 JWT。 |
| `GET /api/admin/requests` | 管理员查看最新审批请求。 |
| `POST /api/admin/approve` | 审批并生成 Token 或拒绝。 |

## 前端交互

- `/`：用户入口，提供目录浏览、上传、删除与权限申请。
- `/admin`：管理员入口，登录后可审批请求、发放 Token。
- React + Vite 构建，生产模式由 Nginx 静态托管。

## 部署到 ECS

- `scripts/deploy.sh` 包含前端构建、Prisma 生成、`rsync` 同步与远程 `docker compose up -d --build` 四步流。配置好 `ECS_IP` 后执行即可滚动更新。
- `docker-compose.yml` 默认在服务器上挂载 `./server_data/uploads` 与 `./server_data/db` 持久化用户数据。
- Nginx 路由策略：
  - `/sites/*` -> `/var/www/sites`（直接读取 Node 写入的 HTML）。
  - `/api/*` -> `hosting_server:3000`。
  - 其它路由 -> React SPA，支持刷新与前端路由。

更多细节请参阅前端、后端与脚本内注释。
