-- 创建简历分析表 (resume_analyses)
-- 存储简历分析结果和相关数据

CREATE TABLE IF NOT EXISTS resume_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- 文件信息
  file_name VARCHAR(255) NOT NULL,
  file_size INTEGER,
  file_type VARCHAR(50),
  file_url TEXT, -- 存储在 Supabase Storage 中的文件URL
  
  -- 职位描述
  job_description TEXT,
  
  -- 分析结果 (JSON格式存储Coze返回的结构化数据)
  analysis_result JSONB NOT NULL,
  
  -- 分析状态
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  
  -- Coze 工作流信息
  coze_workflow_id VARCHAR(100),
  coze_conversation_id VARCHAR(100),
  
  -- 时间戳
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  
  -- 分析评分 (从analysis_result中提取的关键指标)
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  match_score INTEGER CHECK (match_score >= 0 AND match_score <= 100),
  
  -- 标签和分类
  tags TEXT[], -- 技能标签、行业标签等
  category VARCHAR(50), -- 简历类别：技术、销售、管理等
  
  -- 是否收藏
  is_favorite BOOLEAN DEFAULT false,
  
  -- 备注
  notes TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_resume_analyses_user_id ON resume_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_status ON resume_analyses(status);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_created_at ON resume_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_overall_score ON resume_analyses(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_category ON resume_analyses(category);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_tags ON resume_analyses USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_resume_analyses_analysis_result ON resume_analyses USING GIN(analysis_result);

-- 添加更新时间触发器
CREATE TRIGGER update_resume_analyses_updated_at 
    BEFORE UPDATE ON resume_analyses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE resume_analyses ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
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

CREATE POLICY "Users can update own resume analyses" ON resume_analyses
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own resume analyses" ON resume_analyses
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 添加注释
COMMENT ON TABLE resume_analyses IS '简历分析结果表';
COMMENT ON COLUMN resume_analyses.id IS '分析记录主键ID';
COMMENT ON COLUMN resume_analyses.user_id IS '关联用户ID';
COMMENT ON COLUMN resume_analyses.file_name IS '简历文件名';
COMMENT ON COLUMN resume_analyses.file_url IS '文件存储URL';
COMMENT ON COLUMN resume_analyses.job_description IS '职位描述';
COMMENT ON COLUMN resume_analyses.analysis_result IS 'Coze分析结果(JSON格式)';
COMMENT ON COLUMN resume_analyses.status IS '分析状态';
COMMENT ON COLUMN resume_analyses.overall_score IS '综合评分(0-100)';
COMMENT ON COLUMN resume_analyses.match_score IS '匹配度评分(0-100)';
COMMENT ON COLUMN resume_analyses.tags IS '标签数组';
COMMENT ON COLUMN resume_analyses.category IS '简历类别';
COMMENT ON COLUMN resume_analyses.coze_workflow_id IS 'Coze工作流ID';
COMMENT ON COLUMN resume_analyses.coze_conversation_id IS 'Coze对话ID';