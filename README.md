# AI智能招聘分析系统 / AI Recruitment Analyzer

面向招聘场景的生产级分析系统，支持简历智能解析、面试记录与报告管理。系统提供本地静态站与本地 API 联调，支持 Supabase 认证与云端持久化。

## 功能特性

- 简历分析：解析 PDF/DOC/DOCX/TXT/RTF/PNG/JPG，自动生成岗位匹配报告
- 面试记录：进入面试页可录音、转写、做备注，保存为面试记录报告
- 备注模式：在简历内容中选中并添加备注，支持编辑/删除，记录页可持续编辑
- 报告管理：我的报告支持筛选、查看、导出（Markdown/Word/PDF），云端或本地存储
- 认证与设置：Supabase 登录；模型与提示词设置；安全过滤与表格滚动增强

## 本地开发

1. 安装依赖
```
npm install
```
2. 启动静态站（端口 4321）
```
npm run dev
```
3. 打开首页
```
http://127.0.0.1:4321/index.html
```

> 说明：首页已移除“面试分析”功能卡片与导航入口。如需进入面试相关页面，请使用下述直达链接。

### 页面直达链接
- 进入面试（录音/转写/备注）
```
http://127.0.0.1:4321/进入面试-AI招聘分析.html
```
- 面试记录（查看与导出，备注可编辑并持久化）
```
http://127.0.0.1:4321/面试记录-AI招聘分析.html
```

## 本地 API 联调（端口 4000）

在需要后端解析/持久化联调时启动：
```
npm run api:dev
```
可用端点：
- `/api/resume-analyze` 简历分析
- `/api/interview-analyze` 面试分析
- `/api/reports-save` 报告保存
- `/api/reports-list` 报告列表
- `/api/reports-delete` 报告删除
- `/api/transcribe` 语音转写（需配置相应 Key）

## 配置说明

### 环境变量（本地）
在根目录创建 `.env`（参考 `.env.example`）：
- `SUPABASE_URL`、`SUPABASE_ANON_KEY`：Supabase 项目参数
- `COZE_PAT`：Coze 访问令牌
- `COZE_RESUME_WORKFLOW_ID`、`COZE_INTERVIEW_WORKFLOW_ID`：工作流 ID

### 前端设置
- `public/js/supabase.js` 使用 `window.__SUPABASE_CONFIG` 注入的配置初始化
- `public/js/settings.js` 提供模型与提示词设置界面
- `public/js/api.js` 封装 Coze 与本地 API 调用

## 关键页面与脚本
- 首页：`public/index.html`
  - 导航栏已移除“面试分析”入口
  - 功能卡片已移除“面试分析”卡片
- 进入面试页：`public/进入面试-AI招聘分析.html`
  - 录音与转写逻辑：`public/js/interview.js:323-407`
  - 备注模式：`public/js/interview.js:1115-1245`
- 面试记录页：`public/面试记录-AI招聘分析.html`
  - AI综合分析完整展示（取消高度限制）：样式在该页内
  - 备注持久化：`public/js/interview.js:1262-1298`
- 简历分析页逻辑与容器增强：`public/js/main.js:2625-2662`

## 使用指引
- 简历分析：在首页选择“简历分析”，上传文件与 JD，生成报告并可保存/导出
- 面试记录：通过直达链接进入面试页进行录音/转写与备注，再保存到“我的报告”
- “我的报告”：登录后查看、筛选、导出所有保存的报告

## 安全与合规
- 线上环境请勿在前端暴露密钥，建议通过后端代理调用外部 API
- 文件大小与类型已校验，避免无效文件造成解析失败
- 所有 HTML 渲染均使用 DOMPurify 进行安全过滤

## 部署
- Vercel（推荐）：配置 `Output Directory = public`，并在项目设置中添加所需环境变量
- 其他平台：确保静态资源目录指向 `public`；后端 API 路由按需挂载

## 许可证
MIT License

## 变更记录
- 移除首页“面试分析”卡片与导航入口
- 面试记录页 AI 综合分析内容取消高度限制，完整展示
- 录音无识别结果时不再插入“未配置API”占位提示，保持静默录音
