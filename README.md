# AI智能招聘分析系统

<div align="center">

![AI Recruitment Analyzer](https://img.shields.io/badge/AI-Recruitment%20Analyzer-blue?style=for-the-badge&logo=artificial-intelligence)
![Version](https://img.shields.io/badge/version-1.0.0-green?style=for-the-badge)
![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)

一个基于人工智能的招聘辅助工具，帮助HR和招聘人员快速分析简历和进行面试评估。

[🚀 在线体验](https://your-domain.vercel.app) | [📖 用户手册](docs/user-manual.md) | [🔧 开发者指南](docs/developer-guide.md) | [📋 API文档](docs/api-documentation.md)

</div>

## 🚀 功能特性 / Features

### 简历分析 / Resume Analysis
- 📄 支持多种格式：PDF、DOC、DOCX、TXT
- 🎯 智能匹配度分析
- 💡 技能差距识别
- ❓ 面试问题推荐
- 📈 改进建议

### 面试分析 / Interview Analysis
- 📝 面试录音转录文件分析
- 📊 面试表现评估
- 💬 回答质量分析
- 🗣️ 沟通能力评价
- ⭐ 综合评分

### 用户认证 / User Authentication
- 🔐 邮箱注册登录
- 🔑 密码重置功能
- 👤 用户状态管理
- 🛡️ 安全认证流程

### 用户体验 / User Experience
- 🌐 中英文双语支持
- 📱 响应式设计
- 🎨 现代化UI界面
- ⚡ 快速文件上传
- 📥 结果导出功能

## 🛠️ 技术栈 / Tech Stack

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **UI框架**: 原生CSS + Font Awesome图标
- **API集成**: Coze工作流API
- **用户认证**: Supabase Auth
- **部署**: Vercel
- **开发服务器**: http-server

## 📦 安装和运行 / Installation & Setup

### 本地开发 / Local Development

1. 克隆项目 / Clone the repository
```bash
git clone <repository-url>
cd 简历分析
```

2. 安装依赖 / Install dependencies
```bash
npm install
```

3. 启动开发服务器 / Start development server
```bash
npm run dev
```

4. 打开浏览器访问 / Open browser and visit
```
http://localhost:4321
```

### 生产构建 / Production Build

```bash
npm run build
```

## 🚀 Vercel部署 / Vercel Deployment

### 方法一：通过Vercel CLI / Method 1: Via Vercel CLI

1. 安装Vercel CLI
```bash
npm i -g vercel
```

2. 登录Vercel
```bash
vercel login
```

3. 部署项目
```bash
vercel
```

### 方法二：通过GitHub集成 / Method 2: Via GitHub Integration

1. 将代码推送到GitHub仓库
2. 在Vercel控制台导入GitHub项目
3. 配置构建设置（已包含vercel.json配置）
4. 部署完成

## ⚙️ 配置说明 / Configuration

### API配置 / API Configuration

在 `js/api.js` 文件中配置Coze API：

```javascript
const API_CONFIG = {
    baseURL: 'https://api.coze.cn/v1/workflow/run',
    token: 'your-api-token',
    spaceId: '7506054716972220443',
    workflows: {
        resume: '7513777402993016867',
        interview: '7514884191588745254'
    }
};
```

### Supabase配置 / Supabase Configuration

在 `js/supabase.js` 文件中配置Supabase项目：

```javascript
const SUPABASE_URL = 'https://your-project-ref.supabase.co';
const SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';
```

获取配置信息：
1. 登录 [Supabase控制台](https://supabase.com/dashboard)
2. 进入 Project Settings -> API
3. 复制 Project URL 和 anon public key

### 环境变量 / Environment Variables

复制 `.env.example` 为 `.env` 并配置：
- `COZE_PAT`: Coze API访问令牌
- `COZE_RESUME_WORKFLOW_ID`: 简历分析工作流ID
- `COZE_INTERVIEW_WORKFLOW_ID`: 面试分析工作流ID

Vercel部署时可配置环境变量：
- `COZE_API_TOKEN`: Coze API访问令牌
- `COZE_SPACE_ID`: Coze空间ID

## 📁 项目结构 / Project Structure

```
简历分析/
├── index.html          # 主页面
├── package.json        # 项目配置
├── vercel.json         # Vercel部署配置
├── README.md           # 项目说明
├── styles/
│   └── main.css        # 主样式文件
└── js/
    ├── main.js         # 主逻辑文件
    ├── api.js          # API调用模块
    └── i18n.js         # 国际化支持
```

## 🔧 使用说明 / Usage Guide

### 简历分析 / Resume Analysis

1. 点击"简历分析"功能卡片
2. 上传简历文件（支持PDF、DOC、DOCX、TXT格式）
3. 输入详细的岗位职责描述
4. 点击"开始分析简历"按钮
5. 等待AI分析完成
6. 查看分析结果并可下载报告

### 面试分析 / Interview Analysis

1. 点击"面试分析"功能卡片
2. 上传面试录音转录PDF文件
3. 输入面试者姓名
4. （可选）输入录音链接
5. 点击"开始分析面试"按钮
6. 等待AI分析完成
7. 查看分析结果并可下载报告

## 🔒 安全说明 / Security Notes

- API令牌已配置在前端代码中，仅用于演示
- 生产环境建议使用后端代理API调用
- 文件上传大小限制为500MB
- 支持的文件格式已进行验证

## 🐛 故障排除 / Troubleshooting

### 常见问题 / Common Issues

1. **API调用失败**
   - 检查网络连接
   - 验证API令牌是否有效
   - 确认工作流ID是否正确

2. **文件上传失败**
   - 检查文件格式是否支持
   - 确认文件大小不超过500MB
   - 尝试重新选择文件

3. **页面显示异常**
   - 清除浏览器缓存
   - 检查JavaScript控制台错误
   - 确认所有资源文件加载正常

## 📞 技术支持 / Technical Support

如遇到问题，请检查：
1. 浏览器控制台错误信息
2. 网络连接状态
3. API服务状态

## 📄 许可证 / License

MIT License

## 🤝 贡献 / Contributing

欢迎提交Issue和Pull Request来改进项目。

Welcome to submit Issues and Pull Requests to improve the project.

---

**开发完成时间**: 2024年12月
**版本**: v1.0.0
**状态**: 生产就绪 ✅