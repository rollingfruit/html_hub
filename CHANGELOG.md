# 更新日志

## 2025-11-25 - 中文支持与功能增强

### 🐛 Bug 修复

#### 1. 修复中文路径显示问题
- **问题**：文件夹和文件路径中的中文字符显示为 "-"
- **解决方案**：
  - `server/Dockerfile`: 添加 UTF-8 环境变量 (`LANG=C.UTF-8`, `LC_ALL=C.UTF-8`)
  - `nginx/default.conf`: 在 `/sites/` 位置块添加 `charset utf-8;` 声明
  - 确保文件系统层面正确支持 Unicode 字符

### ✨ 功能增强

#### 2. 扩展文件类型支持
- **新增支持的文件类型**：
  - 代码文件：CSS, JS, JSX, TS, TSX, JSON
  - 文本文件：TXT, MD
  - 图片文件：JPG, JPEG, PNG, GIF, SVG, WEBP, ICO

- **改进位置**：
  - `server/src/index.js`: 更新 multer fileFilter 和 sanitizeFileName 函数
  - `nginx/default.conf`: 添加完整的 MIME 类型映射
  - `client/src/components/UploadForm.tsx`: 更新文件输入 accept 属性

#### 3. 添加文件重命名功能
- **新增 API**：`PUT /api/files`
  - 支持管理员直接重命名
  - 普通用户需要通过权限令牌系统申请
  - 自动更新数据库记录和文件系统

- **前端 API**：
  - `client/src/api.ts`: 新增 `renameFile()` 函数

#### 4. 优化代码编辑器
- **Tab 键缩进支持**：
  - 在文本编辑器中按 Tab 键自动插入 2 个空格
  - 光标位置正确保持

- **改进位置**：`client/src/components/UploadForm.tsx`

#### 5. 增强文件浏览器
- **文件类型图标**：
  - 使用 lucide-react 图标库区分不同文件类型
  - 代码文件：FileCode 图标
  - 图片文件：FileImage 图标
  - 文本文件：FileText 图标
  - 其他文件：File 图标

- **智能预览**：
  - 图片文件：直接显示图片预览
  - HTML/代码文件：使用 iframe 预览
  - 其他文件：显示文件类型图标和扩展名

- **改进位置**：`client/src/components/FileExplorer.tsx`

### 📝 API 更新

新增 API 端点：

```
PUT /api/files
请求体：{ oldPath: string, newPath: string, token?: string }
响应：{ message: string, newPath: string }
```

### 🧪 测试建议

测试中文路径和新功能：

```bash
# 1. 重新构建并启动服务
cd client && npm run build && cd ..
docker compose up --build -d

# 2. 测试场景
- 创建中文命名的文件夹：例如 "测试文件夹"
- 上传中文命名的文件：例如 "测试页面.html"
- 上传图片文件测试预览功能
- 上传 CSS/JS 文件测试文件类型支持
- 在代码编辑器中测试 Tab 键缩进
```

### 📄 文件变更清单

**后端**：
- `server/Dockerfile` - UTF-8 环境配置
- `server/src/index.js` - 文件类型扩展 + 重命名 API

**网关**：
- `nginx/default.conf` - UTF-8 字符集 + MIME 类型映射

**前端**：
- `client/src/api.ts` - 重命名 API 封装
- `client/src/components/UploadForm.tsx` - Tab 缩进 + 文件类型支持
- `client/src/components/FileExplorer.tsx` - 文件类型图标 + 智能预览

### 🚀 部署说明

使用部署脚本部署到 ECS：

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

或手动部署：

```bash
# 构建前端
cd client && npm run build && cd ..

# 同步到服务器
rsync -avz --exclude 'node_modules' --exclude '.git' \
  ./ your-user@your-ecs-ip:/path/to/project/

# 在服务器上重启服务
ssh your-user@your-ecs-ip "cd /path/to/project && docker compose up -d --build"
```

### ⚠️ 注意事项

1. **中文路径**：需要重新构建 Docker 容器以应用 UTF-8 环境变量
2. **文件类型**：现在支持更多文件类型，请注意安全性（已通过 fileFilter 限制）
3. **向后兼容**：所有改动完全向后兼容，现有功能不受影响
