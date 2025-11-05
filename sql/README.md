# 数据库部署指南

## 概述

本目录包含 AI 招聘分析平台的完整数据库设计和部署脚本。

## 文件说明

- `00_init_database.sql` - 数据库初始化脚本（扩展、函数、配置表）
- `01_create_users_table.sql` - 用户表创建脚本
- `02_create_resume_analyses_table.sql` - 简历分析表创建脚本
- `03_create_interview_analyses_table.sql` - 面试分析表创建脚本
- `04_create_reports_table.sql` - 报告表创建脚本（“我的报告”模块）
- `database-design.md` - 详细的数据库设计文档

## 部署步骤

### 1. 在 Supabase 中执行脚本

登录 [Supabase Dashboard](https://app.supabase.com)，进入你的项目，然后：

1. 点击左侧菜单的 "SQL Editor"
2. 按以下顺序执行脚本：

```sql
-- 第一步：初始化数据库
-- 复制并执行 00_init_database.sql 的内容

-- 第二步：创建用户表
-- 复制并执行 01_create_users_table.sql 的内容

-- 第三步：创建简历分析表
-- 复制并执行 02_create_resume_analyses_table.sql 的内容

-- 第四步：创建面试分析表
-- 复制并执行 03_create_interview_analyses_table.sql 的内容

-- 第五步：创建报告表（用于“我的报告”保存与展示）
-- 复制并执行 04_create_reports_table.sql 的内容
```

### 2. 验证部署

执行以下查询验证表是否创建成功：

```sql
-- 检查所有表
SELECT table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 检查表结构
\d users
\d resume_analyses
\d interview_analyses
\d reports
```

### 3. 配置存储桶（可选）

如果需要存储文件，在 Supabase Dashboard 中：

1. 进入 "Storage" 页面
2. 创建以下存储桶：
   - `resumes` - 存储简历文件
   - `recordings` - 存储面试录音
   - `avatars` - 存储用户头像

3. 配置存储桶策略：

```sql
-- 简历文件存储策略
CREATE POLICY "Users can upload own resumes" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own resumes" ON storage.objects
  FOR SELECT USING (bucket_id = 'resumes' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 录音文件存储策略
CREATE POLICY "Users can upload own recordings" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own recordings" ON storage.objects
  FOR SELECT USING (bucket_id = 'recordings' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## 数据库特性

### 安全性
- ✅ 行级安全策略 (RLS) 已启用
- ✅ 用户只能访问自己的数据
- ✅ 与 Supabase Auth 集成
- ✅ 数据验证和约束

### 性能优化
- ✅ 关键字段索引
- ✅ JSON 字段 GIN 索引
- ✅ 复合索引优化
- ✅ 自动更新时间戳

### 数据完整性
- ✅ 外键约束
- ✅ 检查约束
- ✅ 非空约束
- ✅ 唯一约束

## 表关系图

```
users (用户表)
├── id (PK)
├── auth_id (FK -> auth.users)
└── email (UNIQUE)

resume_analyses (简历分析表)
├── id (PK)
├── user_id (FK -> users.id)
├── analysis_result (JSONB)
└── status

interview_analyses (面试分析表)
├── id (PK)
├── user_id (FK -> users.id)
├── resume_analysis_id (FK -> resume_analyses.id)
├── analysis_result (JSONB)
└── status

reports (报告表)
├── id (PK)
├── user_id (FK -> users.id)
├── report_type (resume/interview)
├── markdown_output (TEXT)
├── raw_output (JSONB)
└── created_at
```

## 常用查询示例

### 获取用户的所有分析记录
```sql
SELECT 
  u.full_name,
  r.file_name,
  r.overall_score as resume_score,
  i.candidate_name,
  i.overall_score as interview_score,
  i.recommendation
FROM users u
LEFT JOIN resume_analyses r ON u.id = r.user_id
LEFT JOIN interview_analyses i ON r.id = i.resume_analysis_id
WHERE u.auth_id = auth.uid()
ORDER BY r.created_at DESC;
```

### 获取分析统计信息
```sql
SELECT 
  COUNT(DISTINCT r.id) as total_resumes,
  COUNT(DISTINCT i.id) as total_interviews,
  AVG(r.overall_score) as avg_resume_score,
  AVG(i.overall_score) as avg_interview_score
FROM resume_analyses r
LEFT JOIN interview_analyses i ON r.id = i.resume_analysis_id
WHERE r.user_id IN (
  SELECT id FROM users WHERE auth_id = auth.uid()
);
```

## 故障排除

### 常见问题

1. **权限错误**
   - 确保 RLS 策略正确配置
   - 检查用户是否已认证

2. **外键约束错误**
   - 确保按正确顺序执行脚本
   - 检查引用的记录是否存在

3. **JSON 字段查询问题**
   - 使用正确的 JSONB 操作符
   - 确保 JSON 结构正确

### 重置数据库

如果需要重新部署：

```sql
-- 警告：这将删除所有数据！
DROP TABLE IF EXISTS interview_analyses CASCADE;
DROP TABLE IF EXISTS resume_analyses CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS app_config CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;

-- 然后重新执行部署脚本
```

## 下一步

数据库部署完成后，可以继续：

1. 配置 Supabase Auth
2. 更新 API 接口集成数据库
3. 实现前端数据展示功能
4. 部署到生产环境
### “我的报告”模块：查询当前用户保存的报告
```sql
SELECT id, report_type, job_description, created_at, debug_url, markdown_output
FROM reports
WHERE user_id IN (
  SELECT id FROM users WHERE auth_id = auth.uid()
)
ORDER BY created_at DESC;
```