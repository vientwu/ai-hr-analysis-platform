# 开发者指南 - AI智能招聘分析系统

## 目录
1. [项目概述](#项目概述)
2. [技术架构](#技术架构)
3. [开发环境搭建](#开发环境搭建)
4. [项目结构](#项目结构)
5. [核心模块说明](#核心模块说明)
6. [开发规范](#开发规范)
7. [测试指南](#测试指南)
8. [部署指南](#部署指南)
9. [故障排除](#故障排除)

## 项目概述

AI智能招聘分析系统是一个基于现代Web技术栈的全栈应用，集成了人工智能分析能力，为招聘流程提供智能化支持。

### 核心特性
- **前后端分离架构**：前端使用原生JavaScript，后端使用Node.js
- **AI集成**：集成Coze AI平台进行智能分析
- **数据持久化**：使用Supabase作为数据库和认证服务
- **云原生部署**：支持Vercel平台一键部署
- **响应式设计**：支持多设备访问

### 技术选型理由
- **原生JavaScript**：轻量级，无框架依赖，加载速度快
- **Node.js**：统一技术栈，丰富的生态系统
- **Supabase**：开源的Firebase替代方案，功能完整
- **Vercel**：优秀的前端部署平台，支持Serverless函数

## 技术架构

### 整体架构图
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端应用      │    │   API网关       │    │   AI服务        │
│   (Browser)     │◄──►│   (Vercel)      │◄──►│   (Coze AI)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   静态资源      │    │   Serverless    │    │   文件处理      │
│   (CDN)         │    │   Functions     │    │   (临时存储)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   数据库        │
                       │   (Supabase)    │
                       └─────────────────┘
```

### 数据流图
```
用户上传文件 → 前端验证 → API接口 → 文件处理 → AI分析 → 结果存储 → 返回前端
     │                                                    │
     └─────────────── 历史记录查询 ◄─────────────────────┘
```

## 开发环境搭建

### 系统要求
- **Node.js**: 18.0.0 或更高版本
- **npm**: 9.0.0 或更高版本
- **Git**: 2.30.0 或更高版本

### 环境配置

#### 1. 克隆项目
```bash
git clone <repository-url>
cd 简历分析
```

#### 2. 安装依赖
```bash
npm install
```

#### 3. 环境变量配置
复制环境变量模板：
```bash
cp .env.example .env
```

配置环境变量：
```env
# Coze AI 配置
COZE_PAT=your_coze_personal_access_token
COZE_RESUME_WORKFLOW_ID=your_resume_workflow_id
COZE_INTERVIEW_WORKFLOW_ID=your_interview_workflow_id

# Supabase 配置
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# 开发环境配置
NODE_ENV=development
API_DEV_PORT=3001
```

#### 4. 启动开发服务器
```bash
# 启动前端开发服务器
npm run dev

# 启动API开发服务器
npm run api:dev
```

#### 5. 访问应用
- 前端应用：http://localhost:4321
- API服务：http://localhost:3001

### 开发工具推荐
- **代码编辑器**：VS Code
- **浏览器**：Chrome DevTools
- **API测试**：Postman 或 Insomnia
- **版本控制**：Git + GitHub

## 项目结构

```
简历分析/
├── api/                    # Serverless API函数
│   ├── resume-analyze.js   # 简历分析接口
│   └── interview-analyze.js # 面试分析接口
├── css/                    # 样式文件
│   └── style.css          # 主样式文件
├── docs/                   # 项目文档
│   ├── user-manual.md     # 用户手册
│   ├── api-documentation.md # API文档
│   └── developer-guide.md  # 开发者指南
├── js/                     # JavaScript模块
│   ├── api.js             # API配置
│   ├── auth.js            # 认证模块
│   ├── dashboard.js       # 仪表板逻辑
│   ├── debug.js           # 调试工具
│   ├── env-config.js      # 环境配置
│   ├── history.js         # 历史记录
│   ├── main.js            # 主应用逻辑
│   ├── supabase.js        # Supabase客户端
│   └── utils.js           # 工具函数
├── styles/                 # 现代样式文件
│   └── main.css           # 主样式文件
├── tests/                  # 测试文件
│   ├── api.test.js        # API测试
│   ├── auth.test.js       # 认证测试
│   └── utils.test.js      # 工具函数测试
├── .env.example           # 环境变量模板
├── .gitignore             # Git忽略文件
├── dashboard.html         # 仪表板页面
├── deploy.js              # 部署脚本
├── history.html           # 历史记录页面
├── index.html             # 主页面
├── login.html             # 登录页面
├── package.json           # 项目配置
├── post-deploy-test.js    # 部署后测试
├── pre-deploy-check.js    # 部署前检查
├── README.md              # 项目说明
├── security-check.js      # 安全检查
└── vercel.json            # Vercel配置
```

## 核心模块说明

### 1. 前端模块

#### main.js - 主应用逻辑
```javascript
// 核心功能
- 文件上传处理
- 分析结果展示
- 用户界面交互
- 错误处理

// 主要函数
- initializeApp()      // 应用初始化
- handleFileUpload()   // 文件上传处理
- analyzeResume()      // 简历分析
- analyzeInterview()   // 面试分析
- displayResults()     // 结果展示
```

#### auth.js - 认证模块
```javascript
// 核心功能
- 用户登录/注册
- 会话管理
- 权限验证

// 主要函数
- login()              // 用户登录
- logout()             // 用户登出
- checkAuth()          // 认证检查
- refreshToken()       // 令牌刷新
```

#### supabase.js - 数据库客户端
```javascript
// 核心功能
- 数据库连接
- 数据CRUD操作
- 实时订阅

// 主要函数
- createClient()       // 创建客户端
- saveAnalysis()       // 保存分析结果
- getHistory()         // 获取历史记录
- deleteRecord()       // 删除记录
```

### 2. 后端模块

#### resume-analyze.js - 简历分析API
```javascript
// 核心功能
- 文件接收和验证
- 文件内容提取
- AI分析调用
- 结果处理和返回

// 处理流程
1. 验证请求参数
2. 处理上传文件
3. 提取文件内容
4. 调用AI分析
5. 处理分析结果
6. 返回响应数据
```

#### interview-analyze.js - 面试分析API
```javascript
// 核心功能
- 面试数据验证
- 内容预处理
- AI分析调用
- 评估结果生成

// 处理流程
1. 验证输入数据
2. 预处理面试内容
3. 构建分析请求
4. 调用AI服务
5. 解析分析结果
6. 生成评估报告
```

### 3. 工具模块

#### utils.js - 工具函数
```javascript
// 常用工具函数
- formatDate()         // 日期格式化
- validateFile()       // 文件验证
- sanitizeInput()      // 输入清理
- generateId()         // ID生成
- debounce()          // 防抖函数
- throttle()          // 节流函数
```

#### debug.js - 调试工具
```javascript
// 调试功能
- API测试工具
- 错误日志记录
- 性能监控
- 开发者面板
```

## 开发规范

### 1. 代码规范

#### JavaScript规范
```javascript
// 使用ES6+语法
const apiConfig = {
  baseUrl: 'https://api.example.com',
  timeout: 5000
};

// 使用async/await处理异步操作
async function analyzeResume(file) {
  try {
    const result = await apiCall(file);
    return result;
  } catch (error) {
    console.error('分析失败:', error);
    throw error;
  }
}

// 使用解构赋值
const { name, email, skills } = candidateData;

// 使用模板字符串
const message = `分析完成，候选人：${name}`;
```

#### CSS规范
```css
/* 使用BEM命名规范 */
.analysis-card {
  /* 块级元素 */
}

.analysis-card__header {
  /* 元素 */
}

.analysis-card--loading {
  /* 修饰符 */
}

/* 使用CSS变量 */
:root {
  --primary-color: #2563eb;
  --secondary-color: #64748b;
  --border-radius: 8px;
}
```

### 2. 文件命名规范
- **JavaScript文件**：使用kebab-case，如`resume-analyze.js`
- **CSS文件**：使用kebab-case，如`main-style.css`
- **HTML文件**：使用kebab-case，如`user-profile.html`
- **图片文件**：使用kebab-case，如`logo-icon.svg`

### 3. 注释规范
```javascript
/**
 * 分析简历文件
 * @param {File} file - 简历文件
 * @param {Object} options - 分析选项
 * @param {string} options.position - 目标岗位
 * @param {string} options.language - 分析语言
 * @returns {Promise<Object>} 分析结果
 */
async function analyzeResume(file, options = {}) {
  // 实现代码
}
```

### 4. 错误处理规范
```javascript
// 统一错误处理
class APIError extends Error {
  constructor(message, code, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

// 错误捕获和处理
try {
  const result = await apiCall();
  return result;
} catch (error) {
  if (error instanceof APIError) {
    // 处理API错误
    showErrorMessage(error.message);
  } else {
    // 处理未知错误
    console.error('未知错误:', error);
    showErrorMessage('系统错误，请稍后重试');
  }
}
```

## 测试指南

### 1. 单元测试

#### 测试框架
使用Jest进行单元测试：

```javascript
// tests/utils.test.js
import { validateFile, formatDate } from '../js/utils.js';

describe('工具函数测试', () => {
  test('文件验证 - 有效PDF文件', () => {
    const file = new File(['content'], 'resume.pdf', { type: 'application/pdf' });
    expect(validateFile(file)).toBe(true);
  });

  test('日期格式化', () => {
    const date = new Date('2024-01-15');
    expect(formatDate(date)).toBe('2024-01-15');
  });
});
```

#### 运行测试
```bash
# 运行所有测试
npm test

# 运行特定测试文件
npm test -- utils.test.js

# 生成覆盖率报告
npm run test:coverage
```

### 2. 集成测试

#### API测试
```javascript
// tests/api.test.js
describe('API集成测试', () => {
  test('简历分析接口', async () => {
    const formData = new FormData();
    formData.append('file', testFile);
    
    const response = await fetch('/api/resume-analyze', {
      method: 'POST',
      body: formData
    });
    
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
```

### 3. 端到端测试

#### 使用Playwright
```javascript
// tests/e2e/resume-analysis.spec.js
import { test, expect } from '@playwright/test';

test('简历分析流程', async ({ page }) => {
  await page.goto('/');
  
  // 上传文件
  await page.setInputFiles('#file-input', 'test-resume.pdf');
  
  // 点击分析按钮
  await page.click('#analyze-btn');
  
  // 等待结果
  await page.waitForSelector('.analysis-result');
  
  // 验证结果
  const result = await page.textContent('.analysis-result');
  expect(result).toContain('分析完成');
});
```

## 部署指南

### 1. 本地部署

#### 构建项目
```bash
# 安装依赖
npm install

# 运行构建检查
npm run build:check

# 运行安全检查
npm run security:check
```

#### 启动服务
```bash
# 启动前端服务
npm run dev

# 启动API服务
npm run api:dev
```

### 2. Vercel部署

#### 自动部署
```bash
# 运行部署脚本
npm run deploy

# 或者手动部署
vercel --prod
```

#### 环境变量配置
在Vercel控制台配置以下环境变量：
- `COZE_PAT`
- `COZE_RESUME_WORKFLOW_ID`
- `COZE_INTERVIEW_WORKFLOW_ID`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 3. 部署后验证

#### 运行部署后测试
```bash
node post-deploy-test.js
```

#### 检查项目
- [ ] 主页正常加载
- [ ] API接口响应正常
- [ ] 文件上传功能正常
- [ ] 数据库连接正常
- [ ] 认证功能正常

## 故障排除

### 1. 常见问题

#### 文件上传失败
```
问题：文件上传时返回413错误
解决：检查文件大小是否超过10MB限制

问题：文件格式不支持
解决：确保文件格式为PDF、DOC、DOCX或TXT
```

#### API调用失败
```
问题：AI分析接口返回401错误
解决：检查COZE_PAT环境变量是否正确配置

问题：数据库连接失败
解决：检查Supabase配置和网络连接
```

#### 部署问题
```
问题：Vercel部署失败
解决：检查vercel.json配置和环境变量

问题：函数超时
解决：优化代码性能或增加超时时间
```

### 2. 调试技巧

#### 开启调试模式
```javascript
// 在浏览器控制台中
localStorage.setItem('debug', 'true');
location.reload();
```

#### 查看详细日志
```javascript
// 在API函数中添加日志
console.log('Debug info:', { request, response });
```

#### 使用调试工具
```javascript
// 使用内置调试工具
const debugger = new APIDebugger();
debugger.testAPI();
```

### 3. 性能优化

#### 前端优化
- 使用图片懒加载
- 压缩静态资源
- 启用浏览器缓存
- 减少DOM操作

#### 后端优化
- 优化数据库查询
- 使用缓存机制
- 减少API调用次数
- 异步处理长时间任务

## 贡献指南

### 1. 开发流程
1. Fork项目仓库
2. 创建功能分支
3. 编写代码和测试
4. 提交Pull Request
5. 代码审查和合并

### 2. 提交规范
```
feat: 添加新功能
fix: 修复bug
docs: 更新文档
style: 代码格式调整
refactor: 代码重构
test: 添加测试
chore: 构建工具或辅助工具的变动
```

### 3. 代码审查清单
- [ ] 代码符合规范
- [ ] 功能正常工作
- [ ] 包含必要测试
- [ ] 文档已更新
- [ ] 无安全漏洞

---

**文档版本**: v1.0.0  
**最后更新**: 2024年1月15日  
**维护者**: 开发团队