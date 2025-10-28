# 部署指南 / Deployment Guide

## 🚀 快速部署到Vercel

### 方法一：一键部署 (推荐)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/your-username/ai-recruitment-analyzer)

### 方法二：手动部署

1. **准备工作**
   ```bash
   # 确保项目文件完整
   npm install
   npm run dev  # 本地测试
   ```

2. **登录Vercel**
   ```bash
   npm i -g vercel
   vercel login
   ```

3. **部署项目**
   ```bash
   vercel --prod
   ```

4. **配置域名（可选）**
   - 在Vercel控制台添加自定义域名
   - 配置DNS记录

## 📋 部署检查清单

### 部署前检查
- [ ] 所有文件已提交到Git仓库
- [ ] package.json配置正确
- [ ] vercel.json配置文件存在
- [ ] API配置已更新
- [ ] 本地测试通过

### 部署后验证
- [ ] 页面正常加载
- [ ] 中英文切换功能正常
- [ ] 文件上传功能正常
- [ ] API调用功能正常
- [ ] 响应式设计正常

## 🔧 环境配置

### Vercel环境变量设置

在Vercel项目设置中添加以下环境变量：

```
COZE_API_TOKEN=your_api_token_here
COZE_SPACE_ID=7506054716972220443
RESUME_WORKFLOW_ID=7513777402993016867
INTERVIEW_WORKFLOW_ID=7514884191588745254
```

### 自定义域名配置

1. 在Vercel控制台进入项目设置
2. 点击"Domains"选项卡
3. 添加自定义域名
4. 配置DNS记录指向Vercel

## 🔍 部署故障排除

### 常见部署问题

1. **构建失败**
   ```bash
   # 检查package.json
   npm run build
   ```

2. **静态文件404**
   - 检查vercel.json配置
   - 确认文件路径正确

3. **API调用失败**
   - 检查CORS设置
   - 验证API令牌

### 调试方法

1. **查看构建日志**
   - Vercel控制台 → Functions → View Logs

2. **本地模拟Vercel环境**
   ```bash
   vercel dev
   ```

3. **检查网络请求**
   - 浏览器开发者工具 → Network

## 📊 性能优化

### 建议优化项

1. **文件压缩**
   - CSS/JS文件压缩
   - 图片优化

2. **缓存策略**
   - 静态资源缓存
   - API响应缓存

3. **CDN加速**
   - 使用Vercel全球CDN
   - 静态资源CDN

## 🔒 安全配置

### 生产环境安全

1. **API密钥管理**
   - 使用环境变量
   - 定期轮换密钥

2. **HTTPS配置**
   - Vercel自动提供SSL
   - 强制HTTPS重定向

3. **访问控制**
   - 配置访问限制
   - 监控异常访问

## 📈 监控和分析

### Vercel Analytics

1. 启用Vercel Analytics
2. 监控页面性能
3. 分析用户行为

### 错误监控

1. 配置错误日志
2. 设置告警通知
3. 定期检查错误报告

---

**部署完成后，您的智能招聘分析系统将在以下地址可用：**
- 主域名：`https://your-project.vercel.app`
- 自定义域名：`https://your-domain.com`

🎉 **恭喜！您的AI招聘分析系统已成功部署！**