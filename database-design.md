# AI招聘分析平台 - 数据库设计方案

## 📋 功能需求分析

基于当前系统功能，需要存储以下数据：

### 核心功能
1. **用户管理**：用户注册、登录、个人信息
2. **简历分析**：上传简历文件、JD匹配、分析结果存储
3. **面试分析**：上传面试转写、候选人信息、分析结果存储
4. **历史记录**：用户的分析历史、结果查看

### 数据流分析
- **简历分析输入**：`fileBase64`, `fileName`, `jd`
- **简历分析输出**：Coze工作流返回的分析结果JSON
- **面试分析输入**：`fileBase64`, `fileName`, `name`, `recordingUrl`
- **面试分析输出**：Coze工作流返回的面试评估JSON

## 🗄️ 数据表设计

### 1. 用户表 (users)
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  full_name VARCHAR(100),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login_at TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT true,
  
  -- Supabase Auth 集成
  auth_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);
```

**字段说明：**
- `id`: 主键，UUID格式
- `email`: 用户邮箱，唯一索引
- `full_name`: 用户姓名
- `avatar_url`: 头像URL
- `auth_id`: 关联Supabase Auth用户ID

### 2. 简历分析表 (resume_analyses)
```sql
CREATE TABLE resume_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- 输入数据
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  job_description TEXT,
  
  -- Coze 工作流信息
  coze_file_id VARCHAR(100),
  workflow_id VARCHAR(100),
  workflow_run_id VARCHAR(100),
  
  -- 分析结果
  analysis_result JSONB,
  analysis_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  
  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER
);
```

**字段说明：**
- `user_id`: 关联用户ID
- `file_name`: 上传的简历文件名
- `job_description`: 职位描述(JD)
- `analysis_result`: 存储Coze返回的完整分析结果(JSON格式)
- `analysis_status`: 分析状态(待处理/已完成/失败)

### 3. 面试分析表 (interview_analyses)
```sql
CREATE TABLE interview_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- 输入数据
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  candidate_name VARCHAR(100),
  recording_url TEXT,
  
  -- Coze 工作流信息
  coze_file_id VARCHAR(100),
  workflow_id VARCHAR(100),
  workflow_run_id VARCHAR(100),
  
  -- 分析结果
  analysis_result JSONB,
  analysis_status VARCHAR(20) DEFAULT 'pending', -- pending, completed, failed
  error_message TEXT,
  
  -- 元数据
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  processing_time_ms INTEGER
);
```

**字段说明：**
- `candidate_name`: 候选人姓名
- `recording_url`: 面试录音URL
- `analysis_result`: 存储面试分析结果(JSON格式)

### 4. 用户会话表 (user_sessions) - 可选
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_name VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🔗 表关系设计

### 主要关系
1. **users** ← **resume_analyses** (一对多)
2. **users** ← **interview_analyses** (一对多)
3. **users** ← **user_sessions** (一对多，可选)

### 外键约束
- 所有分析记录都必须关联到用户
- 删除用户时级联删除相关分析记录
- 保持数据一致性

## 📊 索引优化

### 主要索引
```sql
-- 用户表索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_auth_id ON users(auth_id);

-- 简历分析表索引
CREATE INDEX idx_resume_analyses_user_id ON resume_analyses(user_id);
CREATE INDEX idx_resume_analyses_created_at ON resume_analyses(created_at DESC);
CREATE INDEX idx_resume_analyses_status ON resume_analyses(analysis_status);

-- 面试分析表索引
CREATE INDEX idx_interview_analyses_user_id ON interview_analyses(user_id);
CREATE INDEX idx_interview_analyses_created_at ON interview_analyses(created_at DESC);
CREATE INDEX idx_interview_analyses_status ON interview_analyses(analysis_status);
```

## 🔒 行级安全策略 (RLS)

### 安全原则
1. **用户隔离**：用户只能访问自己的数据
2. **认证要求**：所有操作都需要用户认证
3. **权限控制**：读写权限分离

### RLS 策略示例
```sql
-- 启用 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE resume_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_analyses ENABLE ROW LEVEL SECURITY;

-- 用户表策略
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid() = auth_id);

CREATE POLICY "Users can update own profile" ON users
  FOR UPDATE USING (auth.uid() = auth_id);

-- 简历分析表策略
CREATE POLICY "Users can view own resume analyses" ON resume_analyses
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own resume analyses" ON resume_analyses
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 面试分析表策略（类似简历分析表）
```

## 🚀 实施计划

### 阶段1：基础表创建
1. 创建 users 表
2. 创建 resume_analyses 表
3. 创建 interview_analyses 表

### 阶段2：关系和约束
1. 设置外键关系
2. 创建必要索引
3. 添加数据验证约束

### 阶段3：安全配置
1. 启用行级安全策略
2. 配置用户权限
3. 测试安全策略

### 阶段4：优化和扩展
1. 性能优化
2. 添加扩展字段
3. 数据迁移脚本

## 📝 注意事项

1. **JSONB 存储**：分析结果使用 JSONB 格式，支持高效查询和索引
2. **时区处理**：所有时间字段使用 `TIMESTAMP WITH TIME ZONE`
3. **文件存储**：文件本身不存储在数据库，只存储元数据和 Coze file_id
4. **扩展性**：预留扩展字段，支持未来功能增加
5. **备份策略**：重要数据需要定期备份