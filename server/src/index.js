import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import fsp from 'fs/promises';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.join(__dirname, '../uploads'));
const TMP_DIR = path.resolve(process.env.TMP_DIR || path.join(__dirname, '../tmp'));
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';
const TOKEN_EXPIRATION_MINUTES = Number(process.env.TOKEN_EXPIRATION_MINUTES || 10);
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin123!';

const ROLE = Object.freeze({
  ADMIN: 'admin',
  USER: 'user',
});

const REQUEST_TYPE = Object.freeze({
  MODIFY: 'MODIFY',
  DELETE: 'DELETE',
});

const REQUEST_STATUS = Object.freeze({
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
});

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

app.use(
  '/sites',
  express.static(UPLOAD_DIR, {
    index: false,
    extensions: ['html', 'htm'],
  }),
);

const upload = multer({
  dest: TMP_DIR,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(html?|css|js|jsx|ts|tsx|json|txt|md|jpg|jpeg|png|gif|svg|webp|ico)$/i;
    if (!file.originalname.toLowerCase().match(allowedExtensions)) {
      return cb(new Error('不支持的文件类型，仅允许：HTML, CSS, JS, 图片, 文本等 Web 资源'));
    }
    cb(null, true);
  },
});

const ensureDir = async (dir) => {
  await fsp.mkdir(dir, { recursive: true });
};

const normalizeInputPath = (input = '') => input.replace(/\\/g, '/');

const sanitizeDirectoryPath = (inputPath = '') => {
  const normalized = normalizeInputPath(inputPath);
  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.replace(/[<>:"|?*\x00-\x1f]/g, '-'));
  return segments.join('/');
};

const sanitizeFileName = (name) => {
  const base = path.basename(name);
  // 只替换掉文件系统不安全的字符，保留中文和其他Unicode字符
  const safe = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-');
  const ext = path.extname(safe).toLowerCase();
  const allowedExtensions = [
    '.html', '.htm', '.css', '.js', '.jsx', '.ts', '.tsx',
    '.json', '.txt', '.md', '.jpg', '.jpeg', '.png', '.gif',
    '.svg', '.webp', '.ico'
  ];
  // 如果没有扩展名或扩展名不在允许列表中，默认添加 .html
  if (!ext || !allowedExtensions.includes(ext)) {
    return `${safe}.html`;
  }
  return safe;
};

const fileExists = async (targetPath) => {
  try {
    await fsp.access(targetPath, fs.constants.F_OK);
    return true;
  } catch (error) {
    return false;
  }
};

const buildPathFromRequest = (dirPath, fileName) => {
  const sanitizedDir = sanitizeDirectoryPath(dirPath);
  const sanitizedFile = sanitizeFileName(fileName);
  return sanitizedDir ? `${sanitizedDir}/${sanitizedFile}` : sanitizedFile;
};

const sanitizeRelativeFilePath = (inputPath = '') => {
  const normalized = normalizeInputPath(inputPath);
  const segments = normalized
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) {
    return '';
  }
  const dirSegments = segments.slice(0, -1).map((segment) => segment.replace(/[<>:"|?*\x00-\x1f]/g, '-'));
  const file = sanitizeFileName(segments[segments.length - 1]);
  return [...dirSegments, file].join('/');
};

const mapProject = (project) => ({
  id: project.id,
  path: project.path,
  owner: project.owner ? project.owner.username : 'anonymous',
  url: `/sites/${project.path}`,
  createdAt: project.createdAt.toISOString(),
});

const mapDirectoryMeta = (meta) => ({
  id: meta.id,
  path: meta.path,
  systemPrompt: meta.systemPrompt || '',
  description: meta.description || '',
  createdAt: meta.createdAt.toISOString(),
  updatedAt: meta.updatedAt.toISOString(),
});

const buildTree = (projects, directories = []) => {
  const root = {};
  const touchNode = (segments) => {
    let cursor = root;
    segments.forEach((segment, index) => {
      if (!cursor[segment]) {
        cursor[segment] = { children: {}, isFile: false, path: segments.slice(0, index + 1).join('/') };
      }
      cursor = cursor[segment].children;
    });
  };

  projects.forEach((project) => {
    const segments = project.path.split('/');
    let cursor = root;
    segments.forEach((segment, index) => {
      if (!cursor[segment]) {
        cursor[segment] = { children: {}, isFile: false, path: segments.slice(0, index + 1).join('/') };
      }
      if (index === segments.length - 1) {
        cursor[segment].isFile = true;
        cursor[segment].project = mapProject(project);
      }
      cursor = cursor[segment].children;
    });
  });

  directories.forEach((meta) => {
    if (!meta.path) {
      return;
    }
    const segments = meta.path.split('/');
    touchNode(segments);
    let cursor = root;
    segments.forEach((segment, index) => {
      if (!cursor[segment]) {
        cursor[segment] = { children: {}, isFile: false, path: segments.slice(0, index + 1).join('/') };
      }
      if (index === segments.length - 1) {
        cursor[segment].meta = mapDirectoryMeta(meta);
      }
      cursor = cursor[segment].children;
    });
  });

  const walk = (node) =>
    Object.entries(node)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => ({
        name,
        path: value.path,
        isFile: value.isFile,
        project: value.project,
        meta: value.meta,
        children: walk(value.children),
      }));

  return walk(root);
};

const collectKnownDirectories = (projects, directories = []) => {
  const set = new Set();
  projects.forEach((project) => {
    const segments = project.path.split('/');
    if (segments.length <= 1) return;
    for (let i = 1; i < segments.length; i += 1) {
      set.add(segments.slice(0, i).join('/'));
    }
  });
  directories.forEach((meta) => {
    if (meta.path) {
      set.add(meta.path);
    }
  });
  return Array.from(set).sort();
};

const createJwt = (user) =>
  jwt.sign(
    {
      sub: user.id,
      role: user.role,
      username: user.username,
    },
    JWT_SECRET,
    { expiresIn: '4h' },
  );

const extractBearerToken = (req) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return null;
  }
  const [scheme, token] = authHeader.split(' ');
  if (!token || scheme?.toLowerCase() !== 'bearer') {
    return null;
  }
  return token;
};

const resolveAdminFromRequest = (req) => {
  const token = extractBearerToken(req);
  if (!token) {
    return null;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role === ROLE.ADMIN) {
      return payload;
    }
    return null;
  } catch (error) {
    return null;
  }
};

const authenticateAdmin = async (req, res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: '未授权' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== ROLE.ADMIN) {
      return res.status(403).json({ message: '权限不足' });
    }
    req.user = payload;
    next();
  } catch (error) {
    res.status(401).json({ message: '令牌无效' });
  }
};

const ensureSeeds = async () => {
  await ensureDir(UPLOAD_DIR);
  await ensureDir(TMP_DIR);
  const admin = await prisma.user.findUnique({ where: { username: ADMIN_USERNAME } });
  if (!admin) {
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await prisma.user.create({
      data: {
        username: ADMIN_USERNAME,
        password: hashed,
        role: ROLE.ADMIN,
      },
    });
    console.log(`创建管理员 ${ADMIN_USERNAME}`);
  }
  const guest = await prisma.user.findUnique({ where: { username: 'guest_uploader' } });
  if (!guest) {
    const hashed = await bcrypt.hash('guest', 10);
    await prisma.user.create({
      data: {
        username: 'guest_uploader',
        password: hashed,
        role: ROLE.USER,
      },
    });
  }
};

const validateAccessToken = async (relativePath, token, type) => {
  if (!token) {
    return null;
  }
  return prisma.fileRequest.findFirst({
    where: {
      projectPath: relativePath,
      requestType: type,
      accessToken: token,
      status: REQUEST_STATUS.APPROVED,
      expiresAt: { gt: new Date() },
    },
  });
};

const createLog = async (action, targetPath, operator, details = null) => {
  try {
    await prisma.log.create({
      data: {
        action,
        targetPath,
        operator,
        details: details ? JSON.stringify(details) : null,
      },
    });
  } catch (error) {
    console.error('Failed to create log:', error);
  }
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.get('/api/projects', async (req, res) => {
  const [projects, directoryMetas] = await Promise.all([
    prisma.project.findMany({ include: { owner: true }, orderBy: { createdAt: 'desc' } }),
    prisma.directoryMeta.findMany({ orderBy: { updatedAt: 'desc' } }),
  ]);
  const tree = buildTree(projects, directoryMetas);
  const directories = collectKnownDirectories(projects, directoryMetas);
  res.json({
    projects: projects.map(mapProject),
    tree,
    directories,
    directoryMeta: directoryMetas.map(mapDirectoryMeta),
  });
});

app.get('/api/directory', async (req, res) => {
  const rawPath = req.query.path ?? '';
  const pathValue = sanitizeDirectoryPath(rawPath);
  const record = await prisma.directoryMeta.findUnique({ where: { path: pathValue } });
  if (!record) {
    return res.json({
      directory: {
        path: pathValue,
        systemPrompt: '',
        description: '',
      },
    });
  }
  return res.json({ directory: mapDirectoryMeta(record) });
});

app.post('/api/directory', async (req, res) => {
  const { path: rawPath = '', systemPrompt = '', description = '' } = req.body;
  const pathValue = sanitizeDirectoryPath(rawPath);
  if (pathValue === undefined) {
    return res.status(400).json({ message: '路径无效' });
  }
  const directory = await prisma.directoryMeta.upsert({
    where: { path: pathValue },
    update: { systemPrompt, description },
    create: { path: pathValue, systemPrompt, description },
  });
  res.json({ directory: mapDirectoryMeta(directory) });
});

app.post('/api/mkdir', async (req, res) => {
  const { parentPath = '', name = '', systemPrompt = '', description = '' } = req.body;
  let targetPath = req.body.path || '';
  if (!targetPath) {
    const combined = [parentPath, name].filter(Boolean).join('/');
    targetPath = combined;
  }
  const sanitized = sanitizeDirectoryPath(targetPath);
  if (!sanitized) {
    return res.status(400).json({ message: '目录名不可为空' });
  }
  const absoluteDir = path.join(UPLOAD_DIR, sanitized);
  await ensureDir(absoluteDir);
  const directory = await prisma.directoryMeta.upsert({
    where: { path: sanitized },
    update: {
      systemPrompt,
      description,
    },
    create: {
      path: sanitized,
      systemPrompt,
      description,
    },
  });
  res.json({ directory: mapDirectoryMeta(directory) });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const { path: dirPath = '', token, content, filename } = req.body;
  const hasFileUpload = Boolean(req.file);
  const hasTextUpload = !req.file && typeof content === 'string' && typeof filename === 'string';
  const adminUser = resolveAdminFromRequest(req);
  const isAdminRequest = Boolean(adminUser);

  if (!hasFileUpload && !hasTextUpload) {
    return res.status(400).json({ message: '请上传文件或粘贴 HTML 内容' });
  }

  const originalName = hasFileUpload ? req.file.originalname : filename;
  const relativePath = buildPathFromRequest(dirPath, originalName);
  const absolutePath = path.join(UPLOAD_DIR, relativePath);
  const absoluteDir = path.dirname(absolutePath);

  try {
    const exists = await fileExists(absolutePath);
    if (exists && !isAdminRequest) {
      return res.status(403).json({ message: '文件已存在，请先申请修改权限' });
    }

    await ensureDir(absoluteDir);

    if (hasFileUpload) {
      await fsp.rename(req.file.path, absolutePath);
    } else if (hasTextUpload) {
      await fsp.writeFile(absolutePath, content, 'utf-8');
    }

    const project = await prisma.project.upsert({
      where: { path: relativePath },
      update: {},
      create: {
        path: relativePath,
        owner: isAdminRequest
          ? {
            connect: { id: adminUser.sub },
          }
          : {
            connect: { username: 'guest_uploader' },
          },
      },
      include: { owner: true },
    });

    res.json({
      message: exists ? '文件已更新' : '上传成功',
      project: mapProject(project),
    });

    // Log the action
    createLog(
      exists ? 'MODIFY' : 'UPLOAD',
      relativePath,
      adminUser ? adminUser.username : 'guest',
      { method: hasFileUpload ? 'file' : 'text' }
    );
  } catch (error) {
    console.error(error);
    if (req.file && req.file.path) {
      await fsp.rm(req.file.path, { force: true });
    }
    res.status(500).json({ message: '上传失败', detail: error.message });
  }
});

app.put('/api/files', async (req, res) => {
  const { oldPath, newPath, token } = req.body;
  const adminUser = resolveAdminFromRequest(req);
  const isAdminRequest = Boolean(adminUser);

  if (!oldPath || !newPath) {
    return res.status(400).json({ message: '缺少路径参数' });
  }

  const oldRelativePath = sanitizeRelativeFilePath(oldPath);
  const newRelativePath = sanitizeRelativeFilePath(newPath);

  if (!oldRelativePath || !newRelativePath) {
    return res.status(400).json({ message: '路径格式不正确' });
  }

  const oldAbsolutePath = path.join(UPLOAD_DIR, oldRelativePath);
  const newAbsolutePath = path.join(UPLOAD_DIR, newRelativePath);

  const oldExists = await fileExists(oldAbsolutePath);
  if (!oldExists) {
    return res.status(404).json({ message: '源文件不存在' });
  }

  const newExists = await fileExists(newAbsolutePath);
  if (newExists) {
    return res.status(409).json({ message: '目标文件已存在' });
  }

  if (!isAdminRequest) {
    return res.status(403).json({ message: '权限不足，仅管理员可操作' });
  }

  try {
    // 确保目标目录存在
    const newDir = path.dirname(newAbsolutePath);
    await ensureDir(newDir);

    // 重命名文件
    await fsp.rename(oldAbsolutePath, newAbsolutePath);

    // 更新数据库记录
    // Check if it's a directory
    const stat = await fsp.stat(newAbsolutePath); // It's already renamed, so check new path
    const isDirectory = stat.isDirectory();

    if (isDirectory) {
      // Update all related projects
      const projects = await prisma.project.findMany({
        where: { path: { startsWith: oldRelativePath + '/' } },
      });
      for (const p of projects) {
        const newProjPath = p.path.replace(oldRelativePath, newRelativePath);
        await prisma.project.update({
          where: { id: p.id },
          data: { path: newProjPath },
        });
      }

      // Update all related directory metas
      const metas = await prisma.directoryMeta.findMany({
        where: {
          OR: [
            { path: oldRelativePath },
            { path: { startsWith: oldRelativePath + '/' } },
          ],
        },
      });
      for (const m of metas) {
        const newMetaPath = m.path.replace(oldRelativePath, newRelativePath);
        await prisma.directoryMeta.update({
          where: { id: m.id },
          data: { path: newMetaPath },
        });
      }
    } else {
      // Update single file record
      // Check if project exists first (it might not if it's a raw file upload without project record, though upload creates one)
      const project = await prisma.project.findUnique({ where: { path: oldRelativePath } });
      if (project) {
        await prisma.project.update({
          where: { path: oldRelativePath },
          data: { path: newRelativePath },
        });
      }
    }

    createLog(
      'MOVE',
      oldRelativePath,
      adminUser.username,
      { newPath: newRelativePath, isDirectory }
    );

    res.json({ message: '重命名成功', newPath: newRelativePath });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: '重命名失败', detail: error.message });
  }
});

app.delete('/api/files', async (req, res) => {
  const { path: filePath, token } = req.body;
  const adminUser = resolveAdminFromRequest(req);
  const isAdminRequest = Boolean(adminUser);
  if (!filePath) {
    return res.status(400).json({ message: '缺少路径' });
  }
  const relativePath = sanitizeRelativeFilePath(filePath);
  if (!relativePath) {
    return res.status(400).json({ message: '路径格式不正确' });
  }
  const absolutePath = path.join(UPLOAD_DIR, relativePath);
  const exists = await fileExists(absolutePath);
  if (!exists) {
    return res.status(404).json({ message: '文件不存在' });
  }
  if (!isAdminRequest) {
    return res.status(403).json({ message: '权限不足，仅管理员可操作' });
  }
  await fsp.rm(absolutePath, { force: true });
  await fsp.rm(absolutePath, { force: true, recursive: true });

  // Clean up DB
  // If it's a directory, we should technically clean up children too, but for now let's just handle the target
  // Actually, if we delete a directory, we should delete all projects inside it
  await prisma.project.deleteMany({
    where: {
      OR: [
        { path: relativePath },
        { path: { startsWith: relativePath + '/' } }
      ]
    }
  });
  await prisma.directoryMeta.deleteMany({
    where: {
      OR: [
        { path: relativePath },
        { path: { startsWith: relativePath + '/' } }
      ]
    }
  });

  createLog('DELETE', relativePath, adminUser.username);
  res.json({ message: '删除成功' });
});

app.post('/api/request-permission', async (req, res) => {
  const { path: targetPath, type, name, email, reason = '' } = req.body;
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : type;
  if (!targetPath || !normalizedType || !Object.values(REQUEST_TYPE).includes(normalizedType)) {
    return res.status(400).json({ message: '参数错误' });
  }
  const relativePath = sanitizeRelativeFilePath(targetPath);
  if (!relativePath) {
    return res.status(400).json({ message: '路径格式不正确' });
  }
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason) {
    return res.status(400).json({ message: '请填写申请理由' });
  }
  const request = await prisma.fileRequest.create({
    data: {
      projectPath: relativePath,
      requestType: normalizedType,
      requesterName: name,
      requesterEmail: email,
      reason: trimmedReason,
      pendingContent: normalizedType === REQUEST_TYPE.MODIFY ? req.body.content : undefined,
    },
  });
  res.json({ requestId: request.id });
});



app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: '请输入用户名和密码' });
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }
  const match = await bcrypt.compare(password, user.password);
  if (!match || user.role !== ROLE.ADMIN) {
    return res.status(401).json({ message: '用户名或密码错误' });
  }
  const token = createJwt(user);
  res.json({ token });
});

app.get('/api/admin/requests', authenticateAdmin, async (req, res) => {
  const requests = await prisma.fileRequest.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ requests });
});

app.get('/api/admin/logs', authenticateAdmin, async (req, res) => {
  const page = Number(req.query.page) || 1;
  const limit = Number(req.query.limit) || 50;
  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.log.count(),
  ]);

  res.json({ logs, total, page, totalPages: Math.ceil(total / limit) });
});

app.post('/api/admin/approve', authenticateAdmin, async (req, res) => {
  const { requestId, action } = req.body;
  if (!requestId || !['APPROVE', 'REJECT'].includes(action)) {
    return res.status(400).json({ message: '参数错误' });
  }
  const numericId = Number(requestId);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({ message: '请求 ID 无效' });
  }
  const request = await prisma.fileRequest.findUnique({ where: { id: numericId } });
  if (!request) {
    return res.status(404).json({ message: '请求不存在' });
  }
  if (action === 'REJECT') {
    const updated = await prisma.fileRequest.update({
      where: { id: numericId },
      data: { status: REQUEST_STATUS.REJECTED, accessToken: null, expiresAt: null },
    });
    return res.json({ message: '已拒绝', request: updated });
  }
  const absolutePath = path.join(UPLOAD_DIR, request.projectPath);

  try {
    if (request.requestType === REQUEST_TYPE.DELETE) {
      if (await fileExists(absolutePath)) {
        await fsp.rm(absolutePath, { force: true, recursive: true });
      }
      await prisma.project.delete({ where: { path: request.projectPath } }).catch(() => null);
    } else if (request.requestType === REQUEST_TYPE.MODIFY) {
      if (request.pendingContent) {
        await ensureDir(path.dirname(absolutePath));
        await fsp.writeFile(absolutePath, request.pendingContent, 'utf-8');
      }
    }

    const updated = await prisma.fileRequest.update({
      where: { id: numericId },
      data: { status: REQUEST_STATUS.APPROVED },
    });

    createLog(
      request.requestType === REQUEST_TYPE.DELETE ? 'DELETE' : 'MODIFY',
      request.projectPath,
      req.user.username, // Admin who approved
      { requestId: numericId, requester: request.requesterName }
    );

    res.json({ message: '已批准', request: updated });
  } catch (error) {
    console.error('Approval execution failed:', error);
    res.status(500).json({ message: '操作执行失败', detail: error.message });
  }
});

// 全局错误处理，确保上传异常返回友好信息
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: `上传失败: ${err.message}` });
  }
  if (err) {
    return res.status(400).json({ message: err.message || '请求失败' });
  }
  return next();
});

const start = async () => {
  await ensureSeeds();
  app.listen(PORT, HOST, () => {
    console.log(`Server listening on http://${HOST}:${PORT}`);
  });
};

start().catch((error) => {
  console.error('启动失败', error);
  process.exit(1);
});
