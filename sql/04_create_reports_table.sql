-- 创建报告表 (reports)
-- 存储用户保存的 Markdown 报告（简历分析/面试分析），用于“我的报告”模块

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 报告类型：resume(简历分析) / interview(面试分析)
  report_type VARCHAR(20) NOT NULL CHECK (report_type IN ('resume', 'interview')),

  -- 关联来源（可选）：方便从分析记录跳转回源数据
  resume_analysis_id UUID REFERENCES resume_analyses(id) ON DELETE SET NULL,
  interview_analysis_id UUID REFERENCES interview_analyses(id) ON DELETE SET NULL,

  -- 业务字段
  job_description TEXT,        -- 与报告相关的职位描述（简历分析场景）
  debug_url TEXT,              -- 调试链接/工作流运行链接
  markdown_output TEXT NOT NULL, -- 报告的 Markdown 内容
  raw_output JSONB,            -- 原始输出（可选，保留结构化数据）

  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_resume_source ON reports(resume_analysis_id);
CREATE INDEX IF NOT EXISTS idx_reports_interview_source ON reports(interview_analysis_id);

-- 添加更新时间触发器（依赖 00_init_database.sql 中的 update_updated_at_column）
CREATE TRIGGER update_reports_updated_at 
    BEFORE UPDATE ON reports 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- RLS 策略：仅允许用户访问自己的报告
CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own reports" ON reports
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own reports" ON reports
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own reports" ON reports
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 注释
COMMENT ON TABLE reports IS '用户保存的 Markdown 报告（简历/面试）';
COMMENT ON COLUMN reports.id IS '报告主键ID';
COMMENT ON COLUMN reports.user_id IS '关联用户ID';
COMMENT ON COLUMN reports.report_type IS '报告类型：resume或interview';
COMMENT ON COLUMN reports.resume_analysis_id IS '关联的简历分析记录ID（可选）';
COMMENT ON COLUMN reports.interview_analysis_id IS '关联的面试分析记录ID（可选）';
COMMENT ON COLUMN reports.job_description IS '职位描述（用于简历分析场景）';
COMMENT ON COLUMN reports.debug_url IS '调试链接/工作流运行链接';
COMMENT ON COLUMN reports.markdown_output IS '报告的 Markdown 内容';
COMMENT ON COLUMN reports.raw_output IS '原始输出（结构化JSON）';
COMMENT ON COLUMN reports.created_at IS '创建时间';
COMMENT ON COLUMN reports.updated_at IS '更新时间';