-- 创建面试分析表 (interview_analyses)
-- 存储面试分析结果和相关数据

CREATE TABLE IF NOT EXISTS interview_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_analysis_id UUID REFERENCES resume_analyses(id) ON DELETE SET NULL,
  
  -- 面试基本信息
  candidate_name VARCHAR(100) NOT NULL,
  interview_title VARCHAR(200),
  interview_type VARCHAR(50) DEFAULT 'general', -- general, technical, behavioral, etc.
  
  -- 文件信息 (简历文件)
  resume_file_name VARCHAR(255),
  resume_file_url TEXT,
  
  -- 录音信息
  recording_url TEXT,
  recording_duration INTEGER, -- 录音时长(秒)
  recording_file_size INTEGER,
  
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
  
  -- 面试评分 (从analysis_result中提取的关键指标)
  overall_score INTEGER CHECK (overall_score >= 0 AND overall_score <= 100),
  communication_score INTEGER CHECK (communication_score >= 0 AND communication_score <= 100),
  technical_score INTEGER CHECK (technical_score >= 0 AND technical_score <= 100),
  cultural_fit_score INTEGER CHECK (cultural_fit_score >= 0 AND cultural_fit_score <= 100),
  
  -- 面试结果建议
  recommendation VARCHAR(20) CHECK (recommendation IN ('hire', 'maybe', 'no_hire', 'pending')),
  
  -- 关键洞察
  key_strengths TEXT[],
  key_weaknesses TEXT[],
  improvement_suggestions TEXT[],
  
  -- 标签和分类
  tags TEXT[], -- 技能标签、特质标签等
  interview_level VARCHAR(20), -- junior, mid, senior, lead
  
  -- 是否收藏
  is_favorite BOOLEAN DEFAULT false,
  
  -- 备注
  notes TEXT,
  
  -- 面试官信息 (可选)
  interviewer_notes TEXT
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_interview_analyses_user_id ON interview_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_resume_analysis_id ON interview_analyses(resume_analysis_id);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_status ON interview_analyses(status);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_created_at ON interview_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_overall_score ON interview_analyses(overall_score DESC);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_recommendation ON interview_analyses(recommendation);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_interview_type ON interview_analyses(interview_type);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_interview_level ON interview_analyses(interview_level);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_tags ON interview_analyses USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_analysis_result ON interview_analyses USING GIN(analysis_result);
CREATE INDEX IF NOT EXISTS idx_interview_analyses_candidate_name ON interview_analyses(candidate_name);

-- 添加更新时间触发器
CREATE TRIGGER update_interview_analyses_updated_at 
    BEFORE UPDATE ON interview_analyses 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- 启用行级安全策略
ALTER TABLE interview_analyses ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略
CREATE POLICY "Users can view own interview analyses" ON interview_analyses
  FOR SELECT USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own interview analyses" ON interview_analyses
  FOR INSERT WITH CHECK (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own interview analyses" ON interview_analyses
  FOR UPDATE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own interview analyses" ON interview_analyses
  FOR DELETE USING (
    user_id IN (
      SELECT id FROM users WHERE auth_id = auth.uid()
    )
  );

-- 添加注释
COMMENT ON TABLE interview_analyses IS '面试分析结果表';
COMMENT ON COLUMN interview_analyses.id IS '面试分析记录主键ID';
COMMENT ON COLUMN interview_analyses.user_id IS '关联用户ID';
COMMENT ON COLUMN interview_analyses.resume_analysis_id IS '关联简历分析ID';
COMMENT ON COLUMN interview_analyses.candidate_name IS '候选人姓名';
COMMENT ON COLUMN interview_analyses.interview_title IS '面试标题';
COMMENT ON COLUMN interview_analyses.interview_type IS '面试类型';
COMMENT ON COLUMN interview_analyses.recording_url IS '面试录音URL';
COMMENT ON COLUMN interview_analyses.analysis_result IS 'Coze分析结果(JSON格式)';
COMMENT ON COLUMN interview_analyses.status IS '分析状态';
COMMENT ON COLUMN interview_analyses.overall_score IS '综合评分(0-100)';
COMMENT ON COLUMN interview_analyses.communication_score IS '沟通能力评分(0-100)';
COMMENT ON COLUMN interview_analyses.technical_score IS '技术能力评分(0-100)';
COMMENT ON COLUMN interview_analyses.cultural_fit_score IS '文化匹配度评分(0-100)';
COMMENT ON COLUMN interview_analyses.recommendation IS '录用建议';
COMMENT ON COLUMN interview_analyses.key_strengths IS '关键优势';
COMMENT ON COLUMN interview_analyses.key_weaknesses IS '关键劣势';
COMMENT ON COLUMN interview_analyses.improvement_suggestions IS '改进建议';
COMMENT ON COLUMN interview_analyses.interview_level IS '面试级别';
COMMENT ON COLUMN interview_analyses.coze_workflow_id IS 'Coze工作流ID';
COMMENT ON COLUMN interview_analyses.coze_conversation_id IS 'Coze对话ID';