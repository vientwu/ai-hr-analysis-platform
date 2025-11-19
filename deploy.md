# 部署指南 / Deployment Guide

本指南涵盖本地开发与部署到 Vercel 的完整步骤，尤其是环境变量的正确配置（COZE_PAT 与 Supabase 配置），以避免出现 500 Internal Server Error 或“数据库服务未初始化”等问题。

## 1) 环境变量与密钥管理

请勿将真实密钥提交到仓库。使用 `.env`（本地）与 Vercel 项目设置（生产）来管理密钥。

必须配置（后端）：
- COZE_PAT：Coze Personal Access Token，用于文件上传与工作流调用

可选（后端）：
- COZE_RESUME_WORKFLOW_ID：简历分析工作流 ID（不填则使用代码默认 7513777402993016867）
- COZE_INTERVIEW_WORKFLOW_ID：面试分析工作流 ID（不填则使用代码默认 7514884191588745254）

前端认证（由 dev-server 注入）：
- SUPABASE_URL：Supabase 项目 URL（Project Settings → API → Project URL）
- SUPABASE_ANON_KEY：Supabase anon key（受 RLS 保护，安全用于前端）

本地开发端口（可选）：
- API_DEV_PORT：备用后端端口（默认 4000；需要第二个进程时可设为 4100）

`.env.example` 已与后端代码保持一致（COZE_PAT），拷贝为 `.env` 后按需填写：

```
COZE_PAT=your_coze_pat_here
COZE_RESUME_WORKFLOW_ID=7513777402993016867
COZE_INTERVIEW_WORKFLOW_ID=7514884191588745254

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

NODE_ENV=development
API_DEV_PORT=4000
```

## 2) 本地开发

1. 安装依赖：
```
npm install
```

2. 配置 `.env`（或在 PowerShell 会话中设置环境变量）：
```
# 方式A：编辑 .env 文件
COZE_PAT=pat_xxx
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=anon_xxx

# 方式B：仅当会话内测试（不写入文件）
$env:COZE_PAT='pat_xxx'
$env:SUPABASE_URL='https://xxxxx.supabase.co'
$env:SUPABASE_ANON_KEY='anon_xxx'
```

3. 启动本地后端（备用 API 服务，静态页面预览）：
```
npm run api:dev       # 默认 http://127.0.0.1:4000/

# 如需第二个进程：
$env:API_DEV_PORT=4100; node dev-server.js  # http://127.0.0.1:4100/
```

4. 验证环境注入与 API：
- 访问 http://127.0.0.1:4000/ 并打开控制台：
  - window.Auth.mode 应为 'supabase'
  - !!window.__SUPABASE_CONFIG 为 true
  - !!window.Auth.supabase 为 true
- 健康检查：
  - GET http://127.0.0.1:4000/api/resume-analyze → 200，返回 { ok: true, message: '...Use POST.' }
- 最小化 POST 测试（PowerShell）：
```
$body = @{ fileName='test.txt'; fileBase64=[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes('hello')); jd='ping' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:4000/api/resume-analyze -ContentType 'application/json' -Body $body
```

## 3) 部署到 Vercel（生产）

1. 登录并导入项目：
```
npm i -g vercel
vercel login
vercel --prod
```

2. 在 Vercel 项目设置 → Environment Variables 添加：
```
COZE_PAT=pat_xxx
COZE_RESUME_WORKFLOW_ID=7513777402993016867
COZE_INTERVIEW_WORKFLOW_ID=7514884191588745254
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=anon_xxx
```

3. 部署完成后，前端通过 Vercel 的 Serverless Functions 调用后端，且 Supabase 在浏览器端通过 anon key 使用受 RLS 的读写策略。

## 4) 故障排除

1) 500 Internal Server Error（简历/面试分析）
- 常见原因：未设置或设置了错误的 COZE_PAT
- 解决：在本地 `.env` 或 Vercel 环境变量中设置正确的 COZE_PAT，并重启后端进程

2) “数据库服务未初始化”
- 原因：未注入 Supabase 配置或 UMD 库未加载
- 检查：
  - window.Auth.mode === 'supabase'
  - !!window.__SUPABASE_CONFIG && !!window.__SUPABASE_CONFIG.url && !!window.__SUPABASE_CONFIG.anonKey
  - typeof window.supabase === 'object'
  - !!window.Auth.supabase === true

3) 进入 supabase 模式但列表为空 / 保存失败
- 需要创建 reports 表并启用 RLS（仅本人可读写）：
```
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  title text not null,
  type text check (type in ('resume','interview')) not null,
  content text not null,
  created_at timestamptz default now() not null
);

alter table public.reports enable row level security;

create policy "read_own_reports" on public.reports for select using ( auth.uid() = user_id );
create policy "write_own_reports" on public.reports for insert with check ( auth.uid() = user_id );
```

## 5) 其他说明

- 本地 UI 与 API 均由 `dev-server.js` 提供，且会在返回 `index.html` 时注入 `window.__SUPABASE_CONFIG`，确保 `supabase.js` 初始化读取到配置。
- 前端不再直接调用 Coze API，文件上传与工作流调用全部经由后端函数处理（更安全）。
- 请定期轮换 COZE_PAT，并避免泄露到日志或仓库中。

---

部署完成后常用地址示例：
- 本地：`http://127.0.0.1:4000/`（或 `4100`）
- 生产：`https://your-project.vercel.app`