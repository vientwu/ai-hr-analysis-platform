-- 手动插入与 RLS 调试脚本
-- 适用场景：前端通过 Supabase 客户端插入 resume_analyses / interview_analyses 失败（通常为 RLS 或 users 映射问题）
-- 使用方法：在 Supabase 控制台 SQL 编辑器中运行。注意：SQL 编辑器环境下 auth.uid() = NULL，启用 RLS 时基于 auth.uid() 的策略校验会失败。

BEGIN;

-- 0) 检查当前项目中的 Auth 用户，复制你的真实 auth_id（即 Supabase Auth 中的 user.id）
SELECT id AS auth_user_id, email FROM auth.users ORDER BY created_at DESC;

-- 1) 如果 users 表尚无你的记录，先创建映射（users.auth_id = auth.users.id）
-- 先禁用 users 表 RLS，避免 SQL 编辑器因 auth.uid() = NULL 导致策略不通过
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- 将下面两个值替换：<AUTH_UUID> 与 <USER_EMAIL>
INSERT INTO users (email, full_name, auth_id)
VALUES ('<USER_EMAIL>', '手动导入用户', '<AUTH_UUID>')
ON CONFLICT (auth_id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  updated_at = NOW();

-- 验证 users 映射关系是否正确（记下 app_user_id）
SELECT u.id AS app_user_id, u.email, u.auth_id FROM users u
WHERE u.auth_id = '<AUTH_UUID>';

-- 重新启用 users 表 RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2) 临时禁用目标分析表 RLS，插入样例数据以验证表结构与列名
ALTER TABLE resume_analyses DISABLE ROW LEVEL SECURITY;
ALTER TABLE interview_analyses DISABLE ROW LEVEL SECURITY;

-- 用上一步查询得到的 app_user_id 作为 user_id 填入
-- 简历分析样例
INSERT INTO resume_analyses (
  user_id, file_name, job_description, analysis_result,
  status, overall_score, match_score, tags, category, is_favorite, notes
) VALUES (
  '<APP_USER_UUID>',
  'demo-resume.pdf',
  '前端开发工程师 JD 示例',
  '{"summary": "示例分析", "score": 85, "skills": ["React", "JS"]}',
  'completed',
  85,
  80,
  ARRAY['React','JavaScript'],
  '技术',
  false,
  '手动插入样例数据'
);

-- 面试分析样例
INSERT INTO interview_analyses (
  user_id, candidate_name, resume_file_name, recording_url,
  analysis_result, status, overall_score, communication_score, technical_score,
  recommendation, key_strengths, key_weaknesses, improvement_suggestions, tags, interview_level, interviewer_notes
) VALUES (
  '<APP_USER_UUID>',
  '张三',
  'demo-resume.pdf',
  'https://example.com/recordings/demo.mp3',
  '{"summary": "面试示例分析", "score": 78, "notes": "沟通良好"}',
  'completed',
  78,
  80,
  75,
  'maybe',
  ARRAY['沟通良好','学习能力强'],
  ARRAY['项目经验较少'],
  ARRAY['加强系统设计'],
  ARRAY['React','Node'],
  'mid',
  '整体表现不错'
);

-- 3) 重新启用 RLS（生产环境必须启用，客户端插入需满足策略条件）
ALTER TABLE resume_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_analyses ENABLE ROW LEVEL SECURITY;

-- 4) 验证分析数据是否插入成功
SELECT 'resume_analyses' AS table_name, id, user_id, file_name, status, created_at
FROM resume_analyses WHERE user_id = '<APP_USER_UUID>' ORDER BY created_at DESC;

SELECT 'interview_analyses' AS table_name, id, user_id, candidate_name, status, created_at
FROM interview_analyses WHERE user_id = '<APP_USER_UUID>' ORDER BY created_at DESC;

COMMIT;

-- 如果客户端依然因 RLS 失败，请检查以下常见问题：
-- A) users 表中是否存在 auth_id = 当前登录用户ID 的记录（由前端登录流程创建）
-- B) 前端插入时是否将 resume_analyses.user_id / interview_analyses.user_id 设置为 users.id（而非 auth.users.id）
-- C) RLS 策略是否已创建且表已 ENABLE ROW LEVEL SECURITY（参见 02/03 脚本）
-- D) 当前请求是否使用 Supabase 用户的 access token（而非 anon key 或 service key）