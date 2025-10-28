# AI智能招聘分析系统

基于Coze的AI智能招聘分析平台，提供简历分析和面试评估功能。

## 功能特性

### 📄 简历分析
- 支持多种格式：PDF、DOC、DOCX、TXT
- 智能匹配度分析
- 技能差距识别
- 面试问题推荐
- 改进建议

### 🎤 面试分析
- 面试录音转文字分析
- 表现评估
- 沟通能力评估
- 改进建议

### 👤 用户体验
- 邮箱登录注册
- 密码重置功能
- 多语言支持（中文/英文）
- 响应式设计
- 快速上传
- 报告导出（Markdown/Word）

## 技术栈

- **前端**: HTML5, CSS3, JavaScript
- **UI**: Font Awesome, 自定义CSS
- **API**: Coze AI 平台
- **认证**: Supabase Auth
- **部署**: Vercel
- **开发**: http-server

## 本地开发

### 环境要求
- Node.js 16+
- npm 或 yarn

### 安装依赖
```bash
npm install
```

### 环境配置
1. 复制环境变量文件：
```bash
cp .env.example .env
```

2. 配置环境变量：
- `COZE_API_TOKEN`: Coze API 令牌
- `COZE_RESUME_WORKFLOW_ID`: 简历分析工作流ID
- `COZE_INTERVIEW_WORKFLOW_ID`: 面试分析工作流ID
- `SUPABASE_URL`: Supabase 项目URL
- `SUPABASE_ANON_KEY`: Supabase 匿名密钥

### 启动开发服务器
```bash
# 启动前端服务器
npm start

# 启动API开发服务器
npm run api:dev
```

访问 http://localhost:4321 查看应用。

## Vercel部署

### 自动部署
1. Fork 此仓库
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### 手动部署
```bash
# 安装 Vercel CLI
npm i -g vercel

# 登录 Vercel
vercel login

# 部署
vercel
```

## 项目结构

```
.
├── api/                    # Vercel Serverless Functions
│   ├── resume-analyze.js   # 简历分析API
│   └── interview-analyze.js # 面试分析API
├── js/                     # JavaScript 文件
│   ├── main.js            # 主要逻辑
│   ├── api.js             # API 调用
│   ├── supabase.js        # Supabase 配置
│   └── i18n.js            # 国际化
├── styles/                 # 样式文件
│   └── main.css           # 主样式
├── index.html             # 主页面
├── package.json           # 项目配置
├── vercel.json            # Vercel 配置
└── README.md              # 项目说明
```

## API 接口

### 简历分析
```
POST /api/resume-analyze
Content-Type: application/json

{
  "resumeFile": "base64_encoded_file",
  "jobDescription": "job_description_text"
}
```

### 面试分析
```
POST /api/interview-analyze
Content-Type: application/json

{
  "interviewFile": "base64_encoded_pdf",
  "intervieweeName": "candidate_name",
  "recordingUrl": "optional_recording_url"
}
```

## 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 联系方式

- 项目链接: [https://github.com/vientwu/ai-hr-analysis-platform](https://github.com/vientwu/ai-hr-analysis-platform)
- 问题反馈: [Issues](https://github.com/vientwu/ai-hr-analysis-platform/issues)

---

**注意**: 使用前请确保已正确配置 Coze API 和 Supabase 服务。