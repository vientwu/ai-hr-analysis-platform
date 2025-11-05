# AI招聘分析平台 - 部署指南

## 概述
本指南将帮助您将AI招聘分析平台部署到生产环境，包括Supabase数据库配置和Vercel前端部署。

## 部署步骤

### 第一步：Supabase数据库部署

#### 1.1 创建Supabase项目
1. 访问 [Supabase](https://supabase.com)
2. 创建新项目
3. 记录项目URL和API密钥

#### 1.2 执行数据库脚本
按以下顺序在Supabase SQL编辑器中执行脚本：

```bash
# 1. 初始化数据库
sql/00_init_database.sql

# 2. 创建用户表
sql/01_create_users_table.sql

# 3. 创建简历分析表
sql/02_create_resume_analyses_table.sql

# 4. 创建面试分析表
sql/03_create_interview_analyses_table.sql
```

#### 1.3 配置认证设置
1. 在Supabase Dashboard中进入Authentication > Settings
2. 启用Email认证
3. 配置邮件模板（可选）
4. 设置重定向URL：
   - 开发环境：`http://localhost:4321`
   - 生产环境：`https://your-domain.vercel.app`

#### 1.4 配置存储桶（可选）
如果需要存储文件：
```sql
-- 创建存储桶
INSERT INTO storage.buckets (id, name, public) VALUES ('resumes', 'resumes', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('interviews', 'interviews', false);

-- 设置存储策略
CREATE POLICY "Users can upload their own files" ON storage.objects
FOR INSERT WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own files" ON storage.objects
FOR SELECT USING (auth.uid()::text = (storage.foldername(name))[1]);
```

### 第二步：Vercel前端部署

#### 2.1 准备部署文件
1. 确保项目根目录有 `vercel.json` 配置文件
2. 更新 `js/env-config.js` 中的生产/开发环境配置（通过环境变量控制，不再使用 `js/config.js`）

#### 2.2 部署到Vercel
```bash
# 安装Vercel CLI
npm i -g vercel

# 登录Vercel
vercel login

# 部署项目
vercel --prod
```

#### 2.3 配置环境变量
在Vercel Dashboard中设置以下环境变量：

```bash
# Coze API配置
COZE_PAT=your_coze_personal_access_token

# Supabase配置
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 第三步：配置域名和SSL

#### 3.1 自定义域名（可选）
1. 在Vercel Dashboard中添加自定义域名
2. 配置DNS记录
3. 等待SSL证书自动配置

#### 3.2 更新配置文件
更新 `js/supabase.js` 中的Supabase配置：
```javascript
const supabaseUrl = 'https://your-project.supabase.co';
const supabaseKey = 'your-anon-key';
```

## 部署验证

### 功能测试清单
- [ ] 用户注册功能
- [ ] 用户登录功能
- [ ] 简历分析功能
- [ ] 面试分析功能
- [ ] 历史记录查看
- [ ] 数据保存功能
- [ ] 响应式设计

### 性能测试
- [ ] 页面加载速度 < 3秒
- [ ] API响应时间 < 30秒
- [ ] 文件上传功能正常
- [ ] 移动端适配良好

### 安全测试
- [ ] 用户认证正常
- [ ] 数据权限隔离
- [ ] API安全防护
- [ ] HTTPS加密传输

## 监控和维护

### 日志监控
1. Vercel函数日志
2. Supabase数据库日志
3. 用户行为分析

### 性能监控
1. 页面加载性能
2. API响应时间
3. 数据库查询性能
4. 错误率统计

### 备份策略
1. 数据库定期备份
2. 代码版本控制
3. 配置文件备份

## 故障排除

### 常见问题

#### 1. 认证失败
- 检查Supabase URL和密钥配置
- 验证重定向URL设置
- 确认用户表创建成功

#### 2. API调用失败
- 检查Coze PAT配置
- 验证工作流ID正确
- 确认网络连接正常

#### 3. 数据保存失败
- 检查数据库表结构
- 验证RLS策略配置
- 确认用户权限正确

#### 4. 文件上传失败
- 检查文件大小限制
- 验证文件格式支持
- 确认存储配置正确

### 联系支持
如遇到部署问题，请提供：
1. 错误信息截图
2. 浏览器控制台日志
3. Vercel函数日志
4. Supabase错误日志

## 更新和升级

### 代码更新
```bash
# 拉取最新代码
git pull origin main

# 重新部署
vercel --prod
```

### 数据库迁移
1. 备份现有数据
2. 执行迁移脚本
3. 验证数据完整性
4. 更新应用版本

### 依赖更新
定期更新项目依赖：
```bash
npm update
npm audit fix
```

---

**注意事项：**
- 部署前请在开发环境充分测试
- 生产环境部署建议在低峰期进行
- 保持定期备份和监控
- 及时更新安全补丁