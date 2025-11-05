-- 手动插入测试数据的SQL脚本
-- 请在Supabase控制台的SQL编辑器中执行此脚本

-- 1. 临时禁用RLS策略
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE reports DISABLE ROW LEVEL SECURITY;

-- 2. 插入测试用户
INSERT INTO users (id, email, full_name, auth_id) VALUES 
('00000000-0000-0000-0000-000000000001', 'test1@example.com', '测试用户1', '00000000-0000-0000-0000-000000000001'),
('00000000-0000-0000-0000-000000000002', 'test2@example.com', '测试用户2', '00000000-0000-0000-0000-000000000002'),
('00000000-0000-0000-0000-000000000003', 'test3@example.com', '测试用户3', '00000000-0000-0000-0000-000000000003')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  auth_id = EXCLUDED.auth_id;

-- 3. 插入测试报告
INSERT INTO reports (
  user_id, 
  report_type, 
  job_description, 
  markdown_output, 
  raw_output,
  resume_analysis_id,
  interview_analysis_id
) VALUES 
(
  '00000000-0000-0000-0000-000000000001',
  'resume',
  '前端开发工程师 - 负责React应用开发',
  '# 简历分析报告

## 基本信息
- 姓名：张三
- 职位：前端开发工程师
- 经验：3年

## 技能匹配度
- React: 90%
- JavaScript: 85%
- CSS: 80%

## 总体评分：85分

## 建议
1. 加强TypeScript技能
2. 学习更多前端框架
3. 提升项目经验描述',
  '{"score": 85, "skills": ["React", "JavaScript", "CSS"], "recommendations": ["TypeScript", "Vue.js"]}',
  NULL,
  NULL
),
(
  '00000000-0000-0000-0000-000000000002',
  'interview',
  '后端开发工程师 - Java Spring Boot开发',
  '# 面试分析报告

## 面试表现
- 技术能力：良好
- 沟通能力：优秀
- 问题解决：良好

## 技术评估
- Java: 80%
- Spring Boot: 75%
- 数据库: 70%

## 总体评分：78分

## 面试建议
1. 深入学习Spring生态
2. 加强数据库优化知识
3. 提升系统设计能力',
  '{"score": 78, "technical_skills": ["Java", "Spring Boot", "MySQL"], "soft_skills": ["communication", "problem_solving"]}',
  NULL,
  NULL
),
(
  '00000000-0000-0000-0000-000000000003',
  'resume',
  '全栈开发工程师 - React + Node.js',
  '# 全栈简历分析

## 前端技能
- React: 88%
- Vue.js: 75%
- TypeScript: 80%

## 后端技能
- Node.js: 85%
- Express: 80%
- MongoDB: 70%

## 总体评分：82分

## 发展建议
1. 加强数据库设计
2. 学习微服务架构
3. 提升DevOps技能',
  '{"score": 82, "frontend": ["React", "Vue.js", "TypeScript"], "backend": ["Node.js", "Express", "MongoDB"]}',
  NULL,
  NULL
);

-- 4. 重新启用RLS策略
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- 5. 验证插入结果
SELECT 
  u.email,
  u.full_name,
  r.report_type,
  r.job_description,
  r.created_at
FROM users u
LEFT JOIN reports r ON u.id = r.user_id
ORDER BY u.email, r.created_at DESC;