// 本地备用开发服务器：在 3000 端口异常时，使用 4000 端口运行同等的 /api 函数
// 用法：npm run api:dev （确保 .env 中设置了 COZE_PAT）

import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { STATIC_SECRETS } from './secrets.js';

const app = express();

// 保持与 Serverless 函数一致的 CORS 行为
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-OpenRouter-Key, X-Provider-Key, Accept');
  next();
});

app.options('*', (req, res) => res.status(204).end());

// 动态加载函数，保持与 Vercel 行为一致
app.all('/api/resume-analyze', async (req, res) => {
  const mod = await import('./api/resume-analyze.js');
  return mod.default(req, res);
});

app.all('/api/interview-analyze', async (req, res) => {
  const mod = await import('./api/interview-analyze.js');
  return mod.default(req, res);
});

app.all('/api/reports-save', async (req, res) => {
  const mod = await import('./api/reports-save.js');
  return mod.default(req, res);
});

app.all('/api/reports-list', async (req, res) => {
  const mod = await import('./api/reports-list.js');
  return mod.default(req, res);
});

app.all('/api/reports-delete', async (req, res) => {
  const mod = await import('./api/reports-delete.js');
  return mod.default(req, res);
});

app.all('/api/openrouter-chat', async (req, res) => {
  const mod = await import('./api/openrouter-chat.js');
  return mod.default(req, res);
});

app.all('/api/llm-chat', async (req, res) => {
  const mod = await import('./api/llm-chat.js');
  return mod.default(req, res);
});

app.all('/api/parse-doc', async (req, res) => {
  const mod = await import('./api/parse-doc.js');
  return mod.default(req, res);
});

// —— 静态站点（用于本地预览 UI）——
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();

// 为前端注入环境变量（Supabase 配置），仅在本地开发注入，不改动源文件
// 支持根路径和直接访问 /index.html 的情况，确保都能注入配置
app.get(['/', '/index.html'], (req, res) => {
  // 优先使用 public/index.html（与生产环境一致），若不存在再回退到根目录 index.html
  const publicIndexPath = path.join(rootDir, 'public', 'index.html');
  const rootIndexPath = path.join(rootDir, 'index.html');
  const indexPath = fs.existsSync(publicIndexPath) ? publicIndexPath : rootIndexPath;
  let html = fs.readFileSync(indexPath, 'utf8');

  const supabaseUrl = process.env.SUPABASE_URL || STATIC_SECRETS.SUPABASE_URL || '';
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || STATIC_SECRETS.SUPABASE_ANON_KEY || '';

  const injection = `\n<script>\n  // Injected by dev-server: Supabase config for frontend\n  window.__SUPABASE_CONFIG = {\n    url: ${JSON.stringify(supabaseUrl)},\n    anonKey: ${JSON.stringify(supabaseAnonKey)}\n  };\n</script>\n`;

  // 优先在 js/supabase.js 之前注入，确保初始化时能读取到配置
  const supabaseJsTag = '<script src="js/supabase.js"></script>';
  if (html.includes(supabaseJsTag)) {
    html = html.replace(supabaseJsTag, `${injection}${supabaseJsTag}`);
  } else if (html.includes('</head>')) {
    // 次选：注入到 head 尾部（通常脚本在 body 尾部，但确保更早可用）
    html = html.replace('</head>', `${injection}</head>`);
  } else if (html.includes('</body>')) {
    // 兜底：如果上述标记不存在，则注入到 </body> 之前
    html = html.replace('</body>', `${injection}</body>`);
  } else {
    // 最终兜底：直接追加
    html += injection;
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// 其余静态资源交由 static 中间件处理，统一指向 public 目录，避免与根目录 js/* 重名导致版本不一致
app.use(express.static(path.join(rootDir, 'public')));

// 便于直接访问 /public 路径时加载首页
app.get('/public', (req, res) => {
  const indexPath = path.join(rootDir, 'public', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fs.readFileSync(indexPath, 'utf8'));
  } else {
    res.status(404).send('Not Found');
  }
});

// 兼容前端使用相对路径 /report.html 的情况，统一映射到 public/report.html
app.get('/report.html', (req, res) => {
  const pagePath = path.join(rootDir, 'public', 'report.html');
  if (fs.existsSync(pagePath)) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(fs.readFileSync(pagePath, 'utf8'));
  } else {
    res.status(404).send('Not Found');
  }
});

const PORT = process.env.API_DEV_PORT ? Number(process.env.API_DEV_PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Local API dev server running at http://127.0.0.1:${PORT}`);
});
