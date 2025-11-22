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
    if (!file.originalname.toLowerCase().match(/\.html?$/)) {
      return cb(new Error('仅允许上传 HTML 文件'));
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
  if (!['.html', '.htm'].includes(ext)) {
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
      const approvedRequest = await validateAccessToken(relativePath, token, REQUEST_TYPE.MODIFY);
      if (!approvedRequest) {
        return res.status(403).json({ message: '文件已存在，请先申请修改权限' });
      }
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
  } catch (error) {
    console.error(error);
    if (req.file && req.file.path) {
      await fsp.rm(req.file.path, { force: true });
    }
    res.status(500).json({ message: '上传失败', detail: error.message });
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
    const approvedRequest = await validateAccessToken(relativePath, token, REQUEST_TYPE.DELETE);
    if (!approvedRequest) {
      return res.status(403).json({ message: '请先申请删除权限' });
    }
  }
  await fsp.rm(absolutePath, { force: true });
  await prisma.project.delete({ where: { path: relativePath } }).catch(() => null);
  res.json({ message: '删除成功' });
});

app.post('/api/request-permission', async (req, res) => {
  const { path: targetPath, type, name, email, reason = '', clientSecret } = req.body;
  const normalizedType = typeof type === 'string' ? type.toUpperCase() : type;
  if (!targetPath || !normalizedType || !Object.values(REQUEST_TYPE).includes(normalizedType)) {
    return res.status(400).json({ message: '参数错误' });
  }
  const relativePath = sanitizeRelativeFilePath(targetPath);
  if (!relativePath) {
    return res.status(400).json({ message: '路径格式不正确' });
  }
  if (!clientSecret || typeof clientSecret !== 'string') {
    return res.status(400).json({ message: '缺少客户端密钥' });
  }
  const trimmedReason = typeof reason === 'string' ? reason.trim() : '';
  if (!trimmedReason) {
    return res.status(400).json({ message: '请填写申请理由' });
  }
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);
  const request = await prisma.fileRequest.create({
    data: {
      projectPath: relativePath,
      requestType: normalizedType,
      requesterName: name,
      requesterEmail: email,
      reason: trimmedReason,
      clientSecretHash,
    },
  });
  res.json({ requestId: request.id });
});

app.post('/api/claim-token', async (req, res) => {
  const { requestId } = req.body;
  const clientSecretHeader = req.get('x-client-secret');
  const clientSecretBody = typeof req.body?.clientSecret === 'string' ? req.body.clientSecret : '';
  const clientSecretRaw = typeof clientSecretHeader === 'string' && clientSecretHeader.trim()
    ? clientSecretHeader
    : clientSecretBody;
  const clientSecret = typeof clientSecretRaw === 'string' ? clientSecretRaw.trim() : '';
  const numericId = Number(requestId);
  if (Number.isNaN(numericId)) {
    return res.status(400).json({ message: '请求 ID 无效' });
  }
  if (!clientSecret) {
    return res.status(400).json({ message: '缺少客户端密钥' });
  }
  const request = await prisma.fileRequest.findUnique({ where: { id: numericId } });
  if (!request) {
    return res.status(404).json({ message: '请求不存在' });
  }
  if (!request.clientSecretHash) {
    return res.status(400).json({ message: '请求缺少密钥信息，请重新申请' });
  }
  const match = await bcrypt.compare(clientSecret, request.clientSecretHash);
  const baseResponse = {
    status: request.status,
    expiresAt: request.expiresAt ? request.expiresAt.toISOString() : null,
  };
  if (!match) {
    return res.json(baseResponse);
  }
  if (
    request.status === REQUEST_STATUS.APPROVED &&
    request.accessToken &&
    request.expiresAt &&
    request.expiresAt > new Date()
  ) {
    return res.json({
      ...baseResponse,
      accessToken: request.accessToken,
    });
  }
  return res.json(baseResponse);
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
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRATION_MINUTES * 60 * 1000);
  const updated = await prisma.fileRequest.update({
    where: { id: numericId },
    data: { status: REQUEST_STATUS.APPROVED, accessToken: token, expiresAt },
  });
  res.json({ message: '已批准', token, expiresAt, request: updated });
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
