# 更新日志

## 2025-01-XX - v2.0 AI 创作集散地重大改版

### 🎨 产品定位转型
将项目从"单纯的存储工具"重新定义为 **"AI 生成的集散地与加油站"**：
- **输入端**：Prompt 库和灵感画廊
- **中间环节**：AI 平台跳板
- **输出端**：作品展厅

### ✨ 新增功能

#### 1. AI Dock（AI 传送门）
新增底部固定导航栏，提供 7 个主流 AI 平台快速入口：
- 支持平台：DeepSeek、ChatGPT、Claude、v0.dev、Bolt.new、Marscode、Cursor
- Mac OS Dock 风格设计，悬停时图标放大和变色
- 点击自动复制当前目录 Prompt 并在新标签页打开 AI 平台
- 移动端横向滚动支持

**新增文件**：`client/src/components/AIDock.tsx`

#### 2. DirectoryContextCard 增强（Prompt 加油站）
- 新增"创作母题"徽章，突出 System Prompt 的重要性
- 增强复制按钮，带图标和状态反馈
- 复制后显示引导提示和跳动箭头动画
- 优化卡片布局，更突出 Prompt 内容

**修改文件**：`client/src/components/DirectoryContextCard.tsx`

#### 3. FileExplorer 改造（精品画廊）
- 默认视图改为网格模式（Grid View）
- 增大卡片尺寸，优化展示效果
- 新增渐变背景、悬停放大效果
- 文件夹按钮显示描述字段
- 横向滚动容器优化

**修改文件**：`client/src/components/FileExplorer.tsx`

#### 4. UserHome 整合新布局
- 新增"欢迎来到 AI 创作集散地"引导卡片
- 4 步创作流程可视化展示
- 集成 AIDock 组件到页面底部
- 优化整体布局和间距

**修改文件**：`client/src/pages/UserHome.tsx`

#### 5. UploadForm 智能粘贴
- 自动识别并清洗 Markdown 代码块（```html ... ```）
- 支持 `\`\`\`html`、`\`\`\`HTML` 和无语言标识的代码块
- 粘贴时显示绿色提示反馈
- 优化占位符文字说明

**修改文件**：`client/src/components/UploadForm.tsx`

#### 6. 全面移动端响应式设计

**侧边栏抽屉化**（768px 以下）：
- 移动端侧边栏变为固定定位抽屉，从左侧滑出
- 半透明遮罩层，点击遮罩自动关闭
- 悬浮覆盖在内容之上

**布局优化**：
- 文件网格自适应不同屏幕尺寸
- 文件夹按钮横向滚动
- AI Dock 移动端适配

**触屏优化**：
- 操作按钮显性化（不依赖 hover）
- 右键菜单改为底部弹窗（Bottom Action Sheet）
- 模态框全屏显示
- 按钮间距增大，适合手指点击

**小屏额外适配**（480px 以下）：
- 文件网格强制单列
- 引导卡片更紧凑
- 按钮字体和间距调整

**修改文件**：`client/src/App.css`

### 🎨 UI/UX 改进

- 新增使用引导卡片（渐变黄色背景，可关闭）
- 复制反馈动画（绿色提示 + 箭头跳动）
- Prompt 徽章（紫色渐变）
- 文件夹卡片增强（渐变背景，悬停效果）
- AI Dock 悬停效果（动态颜色，平滑动画）
- 新增动画：slideIn、bounce、pulse

### 📱 移动端体验提升

- 侧边栏抽屉模式 + 遮罩点击关闭
- 所有操作按钮触屏友好
- 横向滚动容器（文件夹、AI Dock）
- 响应式网格布局
- 底部弹窗菜单
- 模态框全屏优化

### 🔧 技术改进

- 新增 `cleanMarkdownCodeBlock` 工具函数
- 优化 CSS 媒体查询断点管理（768px, 480px）
- 改进组件状态管理
- 使用 CSS 变量实现动态颜色

### 📝 文档更新

- README.md 全面重写，突出 AI 创作生态定位
- 新增 TEST_GUIDE.md 详细测试指南
- 更新 CHANGELOG.md

### 📦 文件变更

**新增**：
- `client/src/components/AIDock.tsx`
- `TEST_GUIDE.md`

**修改**：
- `client/src/pages/UserHome.tsx`
- `client/src/components/FileExplorer.tsx`
- `client/src/components/DirectoryContextCard.tsx`
- `client/src/components/UploadForm.tsx`
- `client/src/App.css`
- `README.md`
- `CHANGELOG.md`

### 🚀 部署说明

```bash
# 重新构建前端
cd client && npm install && npm run build && cd ..

# 使用部署脚本
chmod +x scripts/deploy-ecs.sh
./scripts/deploy-ecs.sh

# 或使用 Docker Compose
docker compose up --build -d
```

### ⚠️ 注意事项

1. **无后端变更**：所有改动仅涉及前端，后端 API 完全兼容
2. **浏览器缓存**：升级后建议清除浏览器缓存（Ctrl+Shift+R）
3. **移动端测试**：建议使用 Chrome/Safari 最新版

---

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
