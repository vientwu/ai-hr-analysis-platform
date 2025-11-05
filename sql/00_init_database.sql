-- AI 招聘分析平台数据库初始化脚本
-- 执行顺序：先运行此脚本，再依次运行其他表创建脚本

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 创建自定义类型
DO $$ BEGIN
    CREATE TYPE analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE recommendation_type AS ENUM ('hire', 'maybe', 'no_hire', 'pending');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interview_level AS ENUM ('junior', 'mid', 'senior', 'lead');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 创建通用的更新时间函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 创建用于生成短ID的函数
CREATE OR REPLACE FUNCTION generate_short_id(length INTEGER DEFAULT 8)
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER := 0;
BEGIN
    FOR i IN 1..length LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
    END LOOP;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 创建用于提取JSON字段的辅助函数
CREATE OR REPLACE FUNCTION extract_score_from_analysis(analysis_data JSONB, score_field TEXT)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE((analysis_data->score_field)::INTEGER, 0);
EXCEPTION
    WHEN OTHERS THEN
        RETURN 0;
END;
$$ LANGUAGE plpgsql;

-- 创建用于验证邮箱格式的函数
CREATE OR REPLACE FUNCTION is_valid_email(email TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$';
END;
$$ LANGUAGE plpgsql;

-- 创建存储桶策略 (如果使用 Supabase Storage)
-- 注意：这些策略需要在 Supabase Dashboard 中手动配置

-- 添加数据库级别的注释
COMMENT ON DATABASE postgres IS 'AI招聘分析平台数据库';

-- 创建应用配置表
CREATE TABLE IF NOT EXISTS app_config (
    id SERIAL PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value JSONB NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 插入默认配置
INSERT INTO app_config (config_key, config_value, description) VALUES
('max_file_size', '{"resume": 10485760, "recording": 104857600}', '文件大小限制(字节)'),
('supported_file_types', '{"resume": ["pdf", "doc", "docx"], "recording": ["mp3", "wav", "m4a"]}', '支持的文件类型'),
('analysis_timeout', '{"resume": 300, "interview": 600}', '分析超时时间(秒)'),
('score_weights', '{"technical": 0.4, "communication": 0.3, "cultural_fit": 0.3}', '评分权重配置')
ON CONFLICT (config_key) DO NOTHING;

-- 创建系统日志表
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    log_level VARCHAR(20) NOT NULL CHECK (log_level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL')),
    message TEXT NOT NULL,
    context JSONB,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建系统日志索引
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(log_level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);

-- 添加注释
COMMENT ON TABLE app_config IS '应用配置表';
COMMENT ON TABLE system_logs IS '系统日志表';

-- 输出初始化完成信息
DO $$
BEGIN
    RAISE NOTICE '数据库初始化完成！';
    RAISE NOTICE '请按顺序执行以下脚本：';
    RAISE NOTICE '1. 01_create_users_table.sql';
    RAISE NOTICE '2. 02_create_resume_analyses_table.sql';
    RAISE NOTICE '3. 03_create_interview_analyses_table.sql';
END $$;