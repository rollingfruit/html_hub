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
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

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

// Supabase Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';

// LLM API Keys
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';

// Initialize Supabase Admin Client (for verifying tokens)
const supabase = SUPABASE_URL && SUPABASE_SERVICE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

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

app.use('/sites', async (req, res, next) => {
  if (req.method !== 'GET') return next();

  const requestPath = decodeURIComponent(req.path);
  // Remove leading slash if present
  const relativePath = requestPath.startsWith('/') ? requestPath.slice(1) : requestPath;

  // Simple check: if it ends with .html or is a directory (which might serve index.html)
  // We want to count visits to the "page".
  // Note: This is a heuristic. Nginx or Express static might serve index.html for directories.
  // If the path has an extension that is NOT html, skip.
  const ext = path.extname(relativePath).toLowerCase();
  const isHtmlOrDir = !ext || ext === '.html' || ext === '.htm';

  // Skip if it is a preview request
  if (req.query.preview) {
    return next();
  }

  if (isHtmlOrDir && relativePath) {
    try {
      // We need to find the project that matches this path.
      // The path might be "subdir/index.html", so the project path is "subdir/index.html".
      // Or if it is "subdir/", it might map to "subdir/index.html".
      // Let's try to update the exact match first.

      // However, the user might be visiting "subdir/" and the file is "subdir/index.html".
      // The `Project` table stores the file path, e.g. "subdir/index.html".

      let targetPath = relativePath;
      if (!ext) {
        // It's a directory or extensionless path. 
        // If it ends with /, append index.html. If not, maybe append /index.html?
        // Express static redirects leaf without slash to leaf/ if it is a dir.
        // Let's assume we want to count the "index.html" corresponding to this dir.
        if (targetPath.endsWith('/')) {
          targetPath += 'index.html';
        } else {
          // If it doesn't end with slash, it might be a file without extension or a dir.
          // If it is a dir, express static redirects.
          // Let's just try to update exact match or match with /index.html
          // But for simplicity, let's just try to update the project with this path.
        }
      }

      // Actually, let's just try to update the project where path equals relativePath
      // If relativePath is a directory "foo/", we probably don't have a project named "foo/".
      // We have "foo/index.html".

      const candidates = [relativePath];
      if (!ext) {
        candidates.push(path.join(relativePath, 'index.html'));
        if (!relativePath.endsWith('/')) {
          candidates.push(relativePath + '/index.html');
        }
      }

      // We can use updateMany to be safe, or findFirst then update.
      // updateMany doesn't support increment on SQLite in some old versions? No, it should.
      // But let's just try to update the most likely candidate.

      // Let's just try to update the exact match first.
      await prisma.project.updateMany({
        where: {
          path: { in: candidates }
        },
        data: {
          visits: { increment: 1 }
        }
      });

    } catch (error) {
      // Ignore errors (e.g. record not found) to not block the request
      console.error('Visit count error:', error);
    }
  }

  next();
});

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
  visits: project.visits || 0,
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

// Supabase Authentication Middleware
const supabaseAuthMiddleware = async (req, res, next) => {
  if (!supabase) {
    return res.status(503).json({ message: 'Supabase 认证服务未配置' });
  }

  const token = extractBearerToken(req);
  if (!token) {
    return res.status(401).json({ message: '未授权：请提供认证令牌' });
  }

  try {
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ message: '令牌无效或已过期' });
    }

    // Sync user to local database
    let localUser = await prisma.user.findUnique({ where: { supabaseId: user.id } });
    if (!localUser) {
      // Auto-create user in local database
      const username = user.email || `user_${user.id.slice(0, 8)}`;
      localUser = await prisma.user.create({
        data: {
          supabaseId: user.id,
          email: user.email,
          username,
          password: '', // Not used for Supabase auth
          role: ROLE.USER,
          credits: 0, // Start with 0 credits
        },
      });
      console.log(`新 Supabase 用户已同步: ${username}`);
    }

    req.supabaseUser = user;
    req.user = localUser;
    next();
  } catch (error) {
    console.error('Supabase auth error:', error);
    res.status(401).json({ message: '认证失败' });
  }
};

// Create API Log for LLM usage tracking
const createApiLog = async (userId, endpoint, model, inputTokens, outputTokens, cost, status) => {
  try {
    await prisma.apiLog.create({
      data: {
        userId,
        endpoint,
        model,
        inputTokens,
        outputTokens,
        cost,
        status,
      },
    });
  } catch (error) {
    console.error('Failed to create API log:', error);
  }
};

// LLM Provider configurations
const LLM_PROVIDERS = {
  'openai': {
    baseUrl: "https://api.apiyi.com/v1",
    getApiKey: () => OPENAI_API_KEY,
    models: ['gpt-4.1-mini', 'gpt-4-turbo', 'gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo'],
  },
  'deepseek': {
    baseUrl: 'https://api.deepseek.com/v1',
    getApiKey: () => DEEPSEEK_API_KEY,
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  'anthropic': {
    baseUrl: 'https://api.anthropic.com/v1',
    getApiKey: () => ANTHROPIC_API_KEY,
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ========================
// User API Routes (Supabase Auth)
// ========================

// Get current user profile
app.get('/api/user/profile', supabaseAuthMiddleware, async (req, res) => {
  const user = req.user;

  // Get recent API usage stats
  const last30Days = new Date();
  last30Days.setDate(last30Days.getDate() - 30);

  const [totalLogs, recentLogs] = await Promise.all([
    prisma.apiLog.count({ where: { userId: user.id } }),
    prisma.apiLog.findMany({
      where: { userId: user.id, createdAt: { gte: last30Days } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);

  res.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      credits: user.credits,
      role: user.role,
      createdAt: user.createdAt,
    },
    stats: {
      totalApiCalls: totalLogs,
      recentLogs: recentLogs.map(log => ({
        id: log.id,
        endpoint: log.endpoint,
        model: log.model,
        cost: log.cost,
        status: log.status,
        createdAt: log.createdAt,
      })),
    },
  });
});

// Get available token packages
app.get('/api/user/packages', async (req, res) => {
  const packages = await prisma.tokenPackage.findMany({
    where: { isActive: true },
    orderBy: { priceYuan: 'asc' },
  });
  res.json({ packages });
});

// ========================
// LLM Proxy API Routes
// ========================

// Estimate tokens (rough estimation based on characters)
const estimateTokens = (text) => {
  if (!text) return 0;
  // Rough estimation: ~4 characters per token for English, ~2 for Chinese
  const charCount = typeof text === 'string' ? text.length : JSON.stringify(text).length;
  return Math.ceil(charCount / 3);
};

// Cost per 1000 tokens (in credits, rough estimates)
const TOKEN_COSTS = {
  'gpt-4': { input: 0.03, output: 0.06 },
  'gpt-4-turbo': { input: 0.01, output: 0.03 },
  'gpt-4o': { input: 0.005, output: 0.015 },
  'gpt-4o-mini': { input: 0.00015, output: 0.0006 },
  'gpt-3.5-turbo': { input: 0.0005, output: 0.0015 },
  'deepseek-chat': { input: 0.0001, output: 0.0002 },
  'deepseek-coder': { input: 0.0001, output: 0.0002 },
  'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
  'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
  'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 },
};

// Get provider from model name
const getProviderFromModel = (model) => {
  for (const [provider, config] of Object.entries(LLM_PROVIDERS)) {
    if (config.models.includes(model)) {
      return { provider, ...config };
    }
  }
  return null;
};

// LLM Chat Proxy Endpoint
app.post('/api/llm/chat', supabaseAuthMiddleware, async (req, res) => {
  const user = req.user;
  const { model, messages, stream = true, ...otherParams } = req.body;

  if (!model || !messages || !Array.isArray(messages)) {
    return res.status(400).json({ message: '缺少必要参数: model, messages' });
  }

  // Check user credits
  if (user.credits <= 0) {
    return res.status(402).json({ message: '积分不足，请充值后再试' });
  }

  // Find provider
  const providerConfig = getProviderFromModel(model);
  if (!providerConfig) {
    return res.status(400).json({ message: `不支持的模型: ${model}` });
  }

  const apiKey = providerConfig.getApiKey();
  if (!apiKey) {
    return res.status(503).json({ message: `${providerConfig.provider} API 未配置` });
  }

  // Estimate input tokens for pre-check
  const inputText = messages.map(m => m.content || '').join(' ');
  const estimatedInputTokens = estimateTokens(inputText);
  const costRate = TOKEN_COSTS[model] || { input: 0.001, output: 0.002 };
  const estimatedCost = (estimatedInputTokens / 1000) * costRate.input;

  // Pre-check if user has enough credits (with some buffer)
  if (user.credits < estimatedCost * 2) {
    return res.status(402).json({ message: '积分不足以完成此请求' });
  }

  let totalInputTokens = estimatedInputTokens;
  let totalOutputTokens = 0;
  let status = 'success';

  try {
    // Handle Anthropic differently (different API format)
    if (providerConfig.provider === 'anthropic') {
      const anthropicMessages = messages.filter(m => m.role !== 'system');
      const systemMessage = messages.find(m => m.role === 'system');

      const requestBody = {
        model,
        max_tokens: otherParams.max_tokens || 4096,
        messages: anthropicMessages,
        stream,
      };
      if (systemMessage) {
        requestBody.system = systemMessage.content;
      }

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios({
          method: 'POST',
          url: `${providerConfig.baseUrl}/messages`,
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          data: requestBody,
          responseType: 'stream',
        });

        let outputContent = '';
        response.data.on('data', (chunk) => {
          const text = chunk.toString();
          res.write(text);

          // Extract text from delta for token counting
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.delta?.text) {
                  outputContent += data.delta.text;
                }
                if (data.usage) {
                  totalInputTokens = data.usage.input_tokens || totalInputTokens;
                  totalOutputTokens = data.usage.output_tokens || estimateTokens(outputContent);
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
        });

        response.data.on('end', async () => {
          res.end();
          totalOutputTokens = totalOutputTokens || estimateTokens(outputContent);
          const cost = (totalInputTokens / 1000) * costRate.input + (totalOutputTokens / 1000) * costRate.output;

          await prisma.user.update({
            where: { id: user.id },
            data: { credits: { decrement: cost } },
          });

          await createApiLog(user.id, 'anthropic', model, totalInputTokens, totalOutputTokens, cost, status);
        });

        response.data.on('error', async (error) => {
          console.error('Stream error:', error);
          status = 'failed';
          res.end();
          await createApiLog(user.id, 'anthropic', model, totalInputTokens, 0, 0, status);
        });
      } else {
        // Non-streaming request
        const response = await axios.post(
          `${providerConfig.baseUrl}/messages`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': apiKey,
              'anthropic-version': '2023-06-01',
            },
          }
        );

        const usage = response.data.usage || {};
        totalInputTokens = usage.input_tokens || totalInputTokens;
        totalOutputTokens = usage.output_tokens || estimateTokens(response.data.content?.[0]?.text || '');
        const cost = (totalInputTokens / 1000) * costRate.input + (totalOutputTokens / 1000) * costRate.output;

        await prisma.user.update({
          where: { id: user.id },
          data: { credits: { decrement: cost } },
        });

        await createApiLog(user.id, 'anthropic', model, totalInputTokens, totalOutputTokens, cost, status);

        res.json(response.data);
      }
    } else {
      // OpenAI-compatible API (OpenAI, DeepSeek)
      const requestBody = {
        model,
        messages,
        stream,
        ...otherParams,
      };

      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const response = await axios({
          method: 'POST',
          url: `${providerConfig.baseUrl}/chat/completions`,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          data: requestBody,
          responseType: 'stream',
        });

        let outputContent = '';
        response.data.on('data', (chunk) => {
          const text = chunk.toString();
          res.write(text);

          // Extract content from delta for token counting
          const lines = text.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.choices?.[0]?.delta?.content) {
                  outputContent += data.choices[0].delta.content;
                }
              } catch (e) { /* ignore parse errors */ }
            }
          }
        });

        response.data.on('end', async () => {
          res.end();
          totalOutputTokens = estimateTokens(outputContent);
          const cost = (totalInputTokens / 1000) * costRate.input + (totalOutputTokens / 1000) * costRate.output;

          await prisma.user.update({
            where: { id: user.id },
            data: { credits: { decrement: cost } },
          });

          await createApiLog(user.id, providerConfig.provider, model, totalInputTokens, totalOutputTokens, cost, status);
        });

        response.data.on('error', async (error) => {
          console.error('Stream error:', error);
          status = 'failed';
          res.end();
          await createApiLog(user.id, providerConfig.provider, model, totalInputTokens, 0, 0, status);
        });
      } else {
        // Non-streaming request
        const response = await axios.post(
          `${providerConfig.baseUrl}/chat/completions`,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${apiKey}`,
            },
          }
        );

        const usage = response.data.usage || {};
        totalInputTokens = usage.prompt_tokens || totalInputTokens;
        totalOutputTokens = usage.completion_tokens || estimateTokens(response.data.choices?.[0]?.message?.content || '');
        const cost = (totalInputTokens / 1000) * costRate.input + (totalOutputTokens / 1000) * costRate.output;

        await prisma.user.update({
          where: { id: user.id },
          data: { credits: { decrement: cost } },
        });

        await createApiLog(user.id, providerConfig.provider, model, totalInputTokens, totalOutputTokens, cost, status);

        res.json(response.data);
      }
    }
  } catch (error) {
    console.error('LLM proxy error:', error.response?.data || error.message);
    status = 'failed';
    await createApiLog(user.id, providerConfig?.provider || 'unknown', model, totalInputTokens, 0, 0, status);

    const errorMessage = error.response?.data?.error?.message || error.message || 'LLM 请求失败';
    res.status(error.response?.status || 500).json({ message: errorMessage });
  }
});

// Get supported models
app.get('/api/llm/models', (req, res) => {
  const models = [];
  for (const [provider, config] of Object.entries(LLM_PROVIDERS)) {
    const apiKey = config.getApiKey();
    if (apiKey) {
      models.push(...config.models.map(m => ({ provider, model: m, available: true })));
    } else {
      models.push(...config.models.map(m => ({ provider, model: m, available: false })));
    }
  }
  res.json({ models });
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
