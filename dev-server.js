// 本地备用开发服务器：在 3000 端口异常时，使用 4000 端口运行同等的 /api 函数
// 用法：npm run api:dev （确保 .env 中设置了 COZE_PAT）

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();

// 保持与 Serverless 函数一致的 CORS 行为
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

// —— 静态站点（用于本地预览 UI）——
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = process.cwd();
app.use(express.static(rootDir));
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});

const PORT = process.env.API_DEV_PORT ? Number(process.env.API_DEV_PORT) : 4000;
app.listen(PORT, () => {
  console.log(`Local API dev server running at http://127.0.0.1:${PORT}`);
});