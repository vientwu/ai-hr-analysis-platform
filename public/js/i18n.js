// 多语言配置（原始版本，挂载到 window.i18n）
const translations = {
    zh: {
        // 导航栏
        'nav-title': '智能招聘分析系统',
        'nav-home': '首页',
        'nav-resume': '简历分析',
        'nav-interview': '面试分析',
        'nav-language': '语言',
        
        // 首页功能卡片
        'resume-card-title': '简历分析',
        'resume-card-desc': '上传简历和岗位描述，AI智能分析匹配度和面试建议',
        'resume-card-features': '• 智能匹配度分析\n• 技能差距识别\n• 面试问题推荐\n• 改进建议',
        'interview-card-title': '面试分析',
        'interview-card-desc': '上传面试录音转录文件，AI分析面试表现和评估结果',
        'interview-card-features': '• 面试表现评估\n• 回答质量分析\n• 沟通能力评价\n• 综合评分',
        'start-analysis': '开始分析',
        
        // 简历分析模块
        'resume-title': '简历分析',
        'resume-subtitle': '上传简历文件和岗位描述，获得专业的匹配度分析',
        'upload-resume': '上传简历文件',
        'resume-formats': '支持 PDF、DOC、DOCX、TXT 格式，最大 500MB',
        'drag-drop-resume': '拖拽文件到此处或点击选择',
        'job-description': '岗位职责描述',
        'jd-placeholder': '请输入详细的岗位职责、技能要求、工作内容等...',
        'char-limit': '字符限制',
        'analyze-resume-btn': '开始分析简历',
        'analyzing': '分析中...',
        'analysis-result': '分析结果',
        'download-report': '下载报告',
        'reset-analysis': '重新分析',
        
        // 面试分析模块
        'interview-title': '面试分析',
        'interview-subtitle': '上传面试录音转录文件，获得专业的面试表现评估',
        'upload-transcript': '上传面试转录文件',
        'transcript-formats': '支持 PDF 格式，最大 500MB',
        'drag-drop-transcript': '拖拽PDF文件到此处或点击选择',
        'interviewee-name': '面试者姓名',
        'name-placeholder': '请输入面试者的姓名',
        'recording-url': '录音链接（可选）',
        'url-placeholder': '如有录音链接，请在此输入',
        'analyze-interview-btn': '开始分析面试',
        
        // 通用
        'loading': '正在处理中，请稍候...',
        'error-file-required': '请先上传文件',
        'error-jd-required': '请输入岗位职责描述',
        'error-name-required': '请输入面试者姓名',
        'error-file-format': '不支持的文件格式',
        'error-file-size': '文件大小超过限制',
        'success-analysis': '分析完成！',
        'error-analysis': '分析失败，请重试',
        'report-downloaded': '报告已下载'
    },
    
    en: {
        // Navigation
        'nav-title': 'AI Recruitment Analysis System',
        'nav-home': 'Home',
        'nav-resume': 'Resume Analysis',
        'nav-interview': 'Interview Analysis',
        'nav-language': 'Language',
        
        // Home feature cards
        'resume-card-title': 'Resume Analysis',
        'resume-card-desc': 'Upload resume and job description for AI-powered matching analysis and interview suggestions',
        'resume-card-features': '• Smart matching analysis\n• Skill gap identification\n• Interview question recommendations\n• Improvement suggestions',
        'interview-card-title': 'Interview Analysis',
        'interview-card-desc': 'Upload interview transcript for AI analysis of performance and evaluation results',
        'interview-card-features': '• Interview performance evaluation\n• Answer quality analysis\n• Communication skills assessment\n• Comprehensive scoring',
        'start-analysis': 'Start Analysis',
        
        // Resume analysis module
        'resume-title': 'Resume Analysis',
        'resume-subtitle': 'Upload resume file and job description to get professional matching analysis',
        'upload-resume': 'Upload Resume File',
        'resume-formats': 'Supports PDF, DOC, DOCX, TXT formats, max 500MB',
        'drag-drop-resume': 'Drag files here or click to select',
        'job-description': 'Job Description',
        'jd-placeholder': 'Please enter detailed job responsibilities, skill requirements, work content, etc...',
        'char-limit': 'Character Limit',
        'analyze-resume-btn': 'Start Resume Analysis',
        'analyzing': 'Analyzing...',
        'analysis-result': 'Analysis Result',
        'download-report': 'Download Report',
        'reset-analysis': 'Reset Analysis',
        
        // Interview analysis module
        'interview-title': 'Interview Analysis',
        'interview-subtitle': 'Upload interview transcript file to get professional interview performance evaluation',
        'upload-transcript': 'Upload Interview Transcript',
        'transcript-formats': 'Supports PDF format, max 500MB',
        'drag-drop-transcript': 'Drag PDF file here or click to select',
        'interviewee-name': 'Interviewee Name',
        'name-placeholder': 'Please enter the interviewee\'s name',
        'recording-url': 'Recording URL (Optional)',
        'url-placeholder': 'If you have a recording link, please enter it here',
        'analyze-interview-btn': 'Start Interview Analysis',
        
        // Common
        'loading': 'Processing, please wait...',
        'error-file-required': 'Please upload a file first',
        'error-jd-required': 'Please enter job description',
        'error-name-required': 'Please enter interviewee name',
        'error-file-format': 'Unsupported file format',
        'error-file-size': 'File size exceeds limit',
        'success-analysis': 'Analysis completed!',
        'error-analysis': 'Analysis failed, please try again',
        'report-downloaded': 'Report downloaded'
    }
};

let currentLanguage = 'zh';

function t(key) {
    return translations[currentLanguage][key] || key;
}

function toggleLanguage() {
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    updateLanguage();
    localStorage.setItem('preferred-language', currentLanguage);
}

function updateLanguage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            element.placeholder = translation;
        } else {
            if (translation.includes('\n')) {
                element.innerHTML = translation.replace(/\n/g, '<br>');
            } else {
                element.textContent = translation;
            }
        }
    });
    const langBtn = document.getElementById('language-btn');
    if (langBtn) {
        langBtn.textContent = currentLanguage === 'zh' ? 'EN' : '中文';
    }
    document.title = t('nav-title');
    updateButtonTexts();
}

function updateButtonTexts() {
    const resumeBtn = document.getElementById('analyze-resume-btn');
    if (resumeBtn && !resumeBtn.disabled) {
        const btnText = resumeBtn.querySelector('span');
        if (btnText) btnText.textContent = t('analyze-resume-btn');
    }
    const interviewBtn = document.getElementById('analyze-interview-btn');
    if (interviewBtn && !interviewBtn.disabled) {
        const btnText = interviewBtn.querySelector('span');
        if (btnText) btnText.textContent = t('analyze-interview-btn');
    }
}

function initializeLanguage() {
    const savedLanguage = localStorage.getItem('preferred-language');
    if (savedLanguage && translations[savedLanguage]) {
        currentLanguage = savedLanguage;
    } else {
        const browserLang = navigator.language || navigator.userLanguage;
        currentLanguage = browserLang.startsWith('zh') ? 'zh' : 'en';
    }
    updateLanguage();
}

function formatErrorMessage(error) {
    const errorMessages = {
        zh: {
            'network': '网络连接失败，请检查网络设置',
            'auth': 'API认证失败，请检查访问令牌',
            'permission': '没有访问权限，请检查工作流权限',
            'notfound': '工作流不存在，请检查工作流ID',
            'ratelimit': '请求过于频繁，请稍后重试',
            'server': '服务器内部错误，请联系技术支持',
            'filesize': '文件大小超过限制',
            'filetype': '不支持的文件格式',
            'default': '服务暂时不可用，请稍后重试'
        },
        en: {
            'network': 'Network connection failed, please check network settings',
            'auth': 'API authentication failed, please check access token',
            'permission': 'No access permission, please check workflow permissions',
            'notfound': 'Workflow does not exist, please check workflow ID',
            'ratelimit': 'Too many requests, please try again later',
            'server': 'Internal server error, please contact technical support',
            'filesize': 'File size exceeds limit',
            'filetype': 'Unsupported file format',
            'default': 'Service temporarily unavailable, please try again later'
        }
    };
    const messages = errorMessages[currentLanguage];
    if (error.message.includes('401')) return messages.auth;
    if (error.message.includes('403')) return messages.permission;
    if (error.message.includes('404')) return messages.notfound;
    if (error.message.includes('429')) return messages.ratelimit;
    if (error.message.includes('500')) return messages.server;
    if (error.message.includes('network')) return messages.network;
    if (error.message.includes('size')) return messages.filesize;
    if (error.message.includes('format')) return messages.filetype;
    return messages.default;
}

document.addEventListener('DOMContentLoaded', function() {
    initializeLanguage();
});

window.i18n = {
    t,
    toggleLanguage,
    updateLanguage,
    initializeLanguage,
    formatErrorMessage
};