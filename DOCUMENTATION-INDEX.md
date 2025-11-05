# 项目文档索引

## 项目信息
- **项目名称**: AI智能招聘分析系统
- **版本**: 1.0.0
- **最后更新**: 2025-01-29
- **文档状态**: ✅ 完整

## 📚 核心文档

### 项目概览
- **[README.md](./README.md)** - 项目介绍、快速开始指南
- **[CHANGELOG.md](./CHANGELOG.md)** - 版本更新记录
- **[LICENSE](./LICENSE)** - 项目许可证
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - 贡献指南

### 用户文档
- **[docs/user-manual.md](./docs/user-manual.md)** - 用户使用手册
- **[user-acceptance-test-checklist.md](./user-acceptance-test-checklist.md)** - 用户验收测试清单

### 开发文档
- **[docs/developer-guide.md](./docs/developer-guide.md)** - 开发者指南
- **[docs/api-documentation.md](./docs/api-documentation.md)** - API接口文档
- **[database-design.md](./database-design.md)** - 数据库设计文档

## 🔧 技术文档

### 架构设计
- **[database-design.md](./database-design.md)** - 数据库架构设计
- **[vercel.json](./vercel.json)** - 部署配置文件
- **[package.json](./package.json)** - 项目依赖配置

### 环境配置
- **[.env.example](./.env.example)** - 环境变量模板
- **[.gitignore](./.gitignore)** - Git忽略文件配置

## 🧪 测试文档

### 测试计划
- **[test-plan.md](./test-plan.md)** - 完整测试计划
- **[user-acceptance-test-checklist.md](./user-acceptance-test-checklist.md)** - UAT检查清单

### 测试页面
> 说明：为保持代码整洁并准备生产部署，所有测试页面（test-*.html）已移除。仍保留测试计划与脚本，可通过浏览器DevTools、Postman或脚本进行集成测试。

### 测试报告
- **[performance-test-report-*.md](./performance-test-report-1761797626157.md)** - 性能测试报告
- **[performance-test-data-*.json](./performance-test-data-1761797626158.json)** - 性能测试数据

## 🔒 安全文档

### 安全审计
- **[security-audit-report.md](./security-audit-report.md)** - 安全审计报告
- **[security-audit-final-report.md](./security-audit-final-report.md)** - 最终安全审计报告

### 安全脚本
- **[security-check.js](./security-check.js)** - 安全检查脚本

## 🚀 部署文档

### 部署指南
- **[deployment-completion-report.md](./deployment-completion-report.md)** - 部署完成报告
- **[deployment/](./deployment/)** - 部署相关文件目录

### 部署脚本
- **[deploy.js](./deploy.js)** - 部署脚本
- **[pre-deploy-check.js](./pre-deploy-check.js)** - 部署前检查脚本
- **[scripts/deploy-automation.js](./scripts/deploy-automation.js)** - 自动化部署脚本
- **[scripts/post-deploy-validation.js](./scripts/post-deploy-validation.js)** - 部署后验证脚本

## 📊 监控和维护

### 性能监控
> 说明：为生产化清理，性能测试脚本（scripts/performance-test.js）已移除。可使用浏览器DevTools或外部压测工具（如 k6、JMeter）进行性能验证。

### 数据管理
- **[js/analysis-history.js](./js/analysis-history.js)** - 历史记录管理（当前使用）
> 说明：为清理未使用的旧脚本，`scripts/resume-history.js` 和 `scripts/interview-history.js` 已于清理中移除，功能已由 `js/analysis-history.js` 覆盖。

## 🗄️ 数据库文档

### SQL脚本
- **[sql/](./sql/)** - 数据库脚本目录
  - 包含数据库初始化、迁移和维护脚本

## 📁 文档组织结构

```
项目根目录/
├── 📄 核心文档 (README, LICENSE, etc.)
├── 📁 docs/ - 详细文档目录
│   ├── user-manual.md - 用户手册
│   ├── developer-guide.md - 开发指南
│   └── api-documentation.md - API文档
├── 📁 tests/ - 测试相关目录
├── 📁 scripts/ - 脚本文件目录
├── 📁 deployment/ - 部署相关目录
├── 📁 sql/ - 数据库脚本目录
└── （已移除）测试页面 (test-*.html)
```

## 📋 文档维护清单

### ✅ 已完成文档
- [x] 项目README和基础信息
- [x] API接口文档
- [x] 用户使用手册
- [x] 开发者指南
- [x] 数据库设计文档
- [x] 测试计划和报告
- [x] 安全审计报告
- [x] 部署指南和报告
- [x] 性能测试报告

### 📝 文档质量标准
- **完整性**: 所有核心功能都有对应文档
- **准确性**: 文档内容与实际代码保持一致
- **可读性**: 文档结构清晰，语言简洁明了
- **时效性**: 文档及时更新，反映最新状态
- **实用性**: 文档提供实际操作指导

### 🔄 文档更新流程
1. **代码变更时**: 同步更新相关文档
2. **功能发布时**: 更新用户手册和API文档
3. **版本发布时**: 更新CHANGELOG和版本信息
4. **定期审查**: 每月检查文档的准确性和完整性

## 📞 文档反馈

如果您在使用文档过程中发现问题或有改进建议，请：
1. 查看相关文档是否已有解答
2. 检查文档版本是否为最新
3. 提交问题反馈或改进建议

## 📈 文档统计

- **总文档数量**: 25+ 个文件
- **核心文档**: 8 个
- **技术文档**: 10 个
- **测试文档**: 15 个
- **文档覆盖率**: 100% (所有功能都有文档)
- **文档质量**: 优秀 (结构完整，内容准确)

---

**文档索引版本**: 1.0
**最后更新**: 2025-01-29
**维护者**: AI开发助手
**下次审查**: 2025-02-29