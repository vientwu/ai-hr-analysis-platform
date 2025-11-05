# 贡献指南

感谢您对 AI智能招聘分析系统 的关注！我们欢迎所有形式的贡献，包括但不限于：

- 🐛 报告Bug
- 💡 提出新功能建议
- 📝 改进文档
- 🔧 提交代码修复
- ✨ 开发新功能
- 🧪 编写测试
- 🎨 改进UI/UX

## 📋 目录

- [开始之前](#开始之前)
- [如何贡献](#如何贡献)
- [开发环境搭建](#开发环境搭建)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request流程](#pull-request流程)
- [问题报告](#问题报告)
- [功能建议](#功能建议)
- [代码审查](#代码审查)
- [社区准则](#社区准则)

## 🚀 开始之前

### 前置要求

- **Node.js**: 18.0.0 或更高版本
- **npm**: 9.0.0 或更高版本
- **Git**: 2.30.0 或更高版本
- **代码编辑器**: 推荐使用 VS Code

### 技能要求

根据您想要贡献的领域，您可能需要以下技能：

- **前端开发**: JavaScript, HTML5, CSS3, 响应式设计
- **后端开发**: Node.js, Serverless Functions, API设计
- **数据库**: PostgreSQL, Supabase
- **AI集成**: Coze AI Platform, API集成
- **DevOps**: Vercel部署, CI/CD
- **测试**: Jest, 端到端测试
- **文档**: Markdown, 技术写作

## 🤝 如何贡献

### 1. Fork 项目

```bash
# 1. Fork 项目到您的GitHub账户
# 2. 克隆您的Fork
git clone https://github.com/YOUR_USERNAME/resume-analyzer.git
cd resume-analyzer

# 3. 添加上游仓库
git remote add upstream https://github.com/ORIGINAL_OWNER/resume-analyzer.git
```

### 2. 创建分支

```bash
# 从最新的main分支创建新分支
git checkout main
git pull upstream main
git checkout -b feature/your-feature-name

# 分支命名规范：
# feature/功能名称    - 新功能
# fix/问题描述       - Bug修复
# docs/文档类型      - 文档更新
# refactor/重构内容  - 代码重构
# test/测试内容      - 测试相关
```

### 3. 进行开发

```bash
# 安装依赖
npm install

# 启动开发环境
npm run dev

# 运行测试
npm test

# 运行安全检查
npm run security:check
```

### 4. 提交更改

```bash
# 添加更改
git add .

# 提交更改（遵循提交规范）
git commit -m "feat: 添加新的简历分析功能"

# 推送到您的Fork
git push origin feature/your-feature-name
```

### 5. 创建 Pull Request

1. 访问您的GitHub Fork页面
2. 点击 "New Pull Request"
3. 填写PR模板
4. 等待代码审查

## 🛠️ 开发环境搭建

### 详细步骤

1. **克隆项目**
```bash
git clone https://github.com/YOUR_USERNAME/resume-analyzer.git
cd resume-analyzer
```

2. **安装依赖**
```bash
npm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入您的配置
```

4. **启动开发服务器**
```bash
# 启动前端服务器
npm run dev

# 启动API服务器（新终端）
npm run api:dev
```

5. **验证环境**
```bash
# 运行测试
npm test

# 运行安全检查
npm run security:check

# 运行部署前检查
npm run pre-deploy:check
```

### 开发工具推荐

#### VS Code 扩展
- **ES6 String HTML**: HTML语法高亮
- **Live Server**: 本地服务器
- **Prettier**: 代码格式化
- **ESLint**: 代码检查
- **GitLens**: Git增强
- **Thunder Client**: API测试

#### 浏览器工具
- **Chrome DevTools**: 调试和性能分析
- **React Developer Tools**: 组件调试
- **Lighthouse**: 性能和SEO分析

## 📝 代码规范

### JavaScript 规范

```javascript
// ✅ 好的示例
const analyzeResume = async (fileData) => {
    try {
        const result = await apiClient.post('/analyze', fileData);
        return result.data;
    } catch (error) {
        console.error('简历分析失败:', error);
        throw new Error('分析失败，请重试');
    }
};

// ❌ 不好的示例
function analyze(data) {
    return fetch('/api').then(r => r.json());
}
```

### CSS 规范

```css
/* ✅ 好的示例 */
.resume-analyzer {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    background-color: var(--bg-primary);
    border-radius: 0.5rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* ❌ 不好的示例 */
.box {
    background: #fff;
    padding: 20px;
}
```

### HTML 规范

```html
<!-- ✅ 好的示例 -->
<section class="resume-upload" aria-labelledby="upload-title">
    <h2 id="upload-title">上传简历</h2>
    <input 
        type="file" 
        id="resume-file"
        accept=".pdf,.doc,.docx"
        aria-describedby="file-help"
    >
    <p id="file-help">支持PDF、Word格式，最大10MB</p>
</section>

<!-- ❌ 不好的示例 -->
<div>
    <input type="file">
    <p>上传文件</p>
</div>
```

### 命名规范

- **文件名**: kebab-case (`resume-analyzer.js`)
- **变量名**: camelCase (`resumeData`)
- **常量名**: UPPER_SNAKE_CASE (`API_ENDPOINT`)
- **类名**: PascalCase (`ResumeAnalyzer`)
- **CSS类**: kebab-case (`.resume-card`)

## 📋 提交规范

我们使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

### 提交格式

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

### 提交类型

- **feat**: 新功能
- **fix**: Bug修复
- **docs**: 文档更新
- **style**: 代码格式调整（不影响功能）
- **refactor**: 代码重构
- **test**: 测试相关
- **chore**: 构建工具或辅助工具的变动
- **perf**: 性能优化
- **ci**: CI/CD相关

### 提交示例

```bash
# 新功能
git commit -m "feat(resume): 添加批量简历分析功能"

# Bug修复
git commit -m "fix(auth): 修复登录状态丢失问题"

# 文档更新
git commit -m "docs(api): 更新API文档示例"

# 重构
git commit -m "refactor(utils): 优化文件处理工具函数"

# 性能优化
git commit -m "perf(upload): 优化大文件上传性能"
```

## 🔍 Pull Request 流程

### PR 模板

创建PR时，请填写以下信息：

```markdown
## 📝 变更描述
简要描述此PR的目的和内容

## 🎯 变更类型
- [ ] 新功能
- [ ] Bug修复
- [ ] 文档更新
- [ ] 代码重构
- [ ] 性能优化
- [ ] 测试相关

## 🧪 测试
- [ ] 单元测试通过
- [ ] 集成测试通过
- [ ] 手动测试完成
- [ ] 安全检查通过

## 📋 检查清单
- [ ] 代码符合规范
- [ ] 添加了必要的测试
- [ ] 更新了相关文档
- [ ] 无破坏性变更
- [ ] 通过了所有检查

## 📸 截图（如适用）
如果有UI变更，请提供截图

## 🔗 相关Issue
关闭 #issue_number
```

### 审查流程

1. **自动检查**: CI/CD流水线自动运行
2. **代码审查**: 至少一位维护者审查
3. **测试验证**: 功能和回归测试
4. **文档检查**: 确保文档同步更新
5. **合并**: 审查通过后合并到main分支

### 审查标准

- ✅ 功能正确实现
- ✅ 代码质量良好
- ✅ 测试覆盖充分
- ✅ 文档完整准确
- ✅ 性能影响可接受
- ✅ 安全性考虑周全

## 🐛 问题报告

### Bug 报告模板

```markdown
## 🐛 Bug描述
清晰简洁地描述Bug

## 🔄 复现步骤
1. 进入 '...'
2. 点击 '...'
3. 滚动到 '...'
4. 看到错误

## 🎯 期望行为
描述您期望发生的行为

## 📸 截图
如果适用，添加截图来帮助解释问题

## 🖥️ 环境信息
- 操作系统: [例如 Windows 11]
- 浏览器: [例如 Chrome 120]
- 版本: [例如 1.0.0]

## 📋 附加信息
添加任何其他相关信息
```

### 报告指南

1. **搜索现有Issue**: 避免重复报告
2. **使用模板**: 提供完整信息
3. **添加标签**: 帮助分类和优先级
4. **及时响应**: 回复维护者的问题

## 💡 功能建议

### 功能请求模板

```markdown
## 🚀 功能描述
清晰简洁地描述您想要的功能

## 🎯 问题背景
这个功能解决了什么问题？

## 💭 解决方案
描述您希望的解决方案

## 🔄 替代方案
描述您考虑过的替代解决方案

## 📋 附加信息
添加任何其他相关信息或截图
```

### 建议指南

1. **明确需求**: 清楚描述功能目标
2. **考虑影响**: 评估对现有功能的影响
3. **提供用例**: 给出具体的使用场景
4. **保持开放**: 接受不同的实现方案

## 👥 代码审查

### 审查者指南

- **及时响应**: 24-48小时内回复
- **建设性反馈**: 提供具体的改进建议
- **关注重点**: 功能、性能、安全、可维护性
- **保持友善**: 尊重贡献者的努力

### 被审查者指南

- **响应反馈**: 及时回复审查意见
- **解释决策**: 说明设计和实现选择
- **接受建议**: 开放地接受改进意见
- **保持耐心**: 理解审查需要时间

## 🌟 社区准则

### 我们的承诺

我们致力于为每个人提供友好、安全和欢迎的环境，无论：

- 年龄、身体大小、残疾、种族、性别认同和表达
- 经验水平、教育背景、社会经济地位、国籍
- 个人外貌、种族、宗教或性取向

### 我们的标准

**积极行为包括**:
- 使用友好和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注对社区最有利的事情
- 对其他社区成员表示同理心

**不可接受的行为包括**:
- 使用性化的语言或图像
- 恶意评论、侮辱或人身攻击
- 公开或私下骚扰
- 未经许可发布他人私人信息
- 其他在专业环境中不当的行为

### 执行

如果您遇到不当行为，请联系项目维护者。所有投诉都将被审查和调查。

## 📞 获取帮助

如果您需要帮助，可以通过以下方式联系我们：

- 📧 **邮箱**: support@example.com
- 💬 **讨论**: [GitHub Discussions](https://github.com/your-username/resume-analyzer/discussions)
- 🐛 **问题**: [GitHub Issues](https://github.com/your-username/resume-analyzer/issues)
- 📖 **文档**: [开发者指南](docs/developer-guide.md)

## 🙏 致谢

感谢所有为这个项目做出贡献的人！您的努力让这个项目变得更好。

---

**再次感谢您的贡献！** 🎉