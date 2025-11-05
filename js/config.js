// 应用配置文件
const CONFIG = {
    // Supabase 配置
    SUPABASE: {
        URL: 'https://your-project.supabase.co',
        ANON_KEY: 'your-anon-key'
    },
    
    // API 配置
    API: {
        BASE_URL: process.env.NODE_ENV === 'production' 
            ? 'https://your-vercel-app.vercel.app' 
            : 'http://localhost:3000',
        ENDPOINTS: {
            RESUME_ANALYZE: '/api/resume-analyze',
            INTERVIEW_ANALYZE: '/api/interview-analyze'
        }
    },
    
    // 应用设置
    APP: {
        NAME: 'AI招聘分析平台',
        VERSION: '1.0.0',
        DEFAULT_LANGUAGE: 'zh',
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
        SUPPORTED_FILE_TYPES: {
            RESUME: ['.pdf', '.doc', '.docx', '.txt'],
            INTERVIEW: ['.mp3', '.wav', '.m4a', '.mp4']
        }
    },
    
    // 分析配置
    ANALYSIS: {
        TIMEOUT: 120000, // 2分钟超时
        RETRY_ATTEMPTS: 3,
        RETRY_DELAY: 1000 // 1秒
    },
    
    // UI 配置
    UI: {
        TOAST_DURATION: 3000,
        LOADING_DELAY: 500,
        ANIMATION_DURATION: 300
    }
};

// 导出配置
if (typeof window !== 'undefined') {
    window.CONFIG = CONFIG;
}

export default CONFIG;
export { CONFIG };