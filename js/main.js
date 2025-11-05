// 导入模块
import { notificationManager, showToast } from './notification.js';
import { auth } from './auth.js';
import { apiIntegration } from './api-integration.js';

// 全局变量
let currentLanguage = 'zh';
let currentAnalysisType = 'resume';
let isAnalyzing = false;
let resumeFile = null;
let interviewFile = null;
// 缓存Markdown内容与调试链接，便于下载与查看
let resumeMarkdown = '';
let interviewMarkdown = '';
let resumeDebugUrl = '';
let interviewDebugUrl = '';
let isLoggedIn = false;

// 最近一次分析的关联信息，用于把“我的报告”与分析记录联动
let lastResumeAnalysisId = null;
let lastInterviewAnalysisId = null;
let lastResumeAnalysisJSON = null;
let lastInterviewAnalysisJSON = null;
let lastResumeWorkflowRunId = null;
let lastInterviewWorkflowRunId = null;
let lastResumeConversationId = null;
let lastInterviewConversationId = null;

// “我的报告”子标签与分页状态
let activeReportsTab = 'reports';
let resumeHistoryPage = 1;
let interviewHistoryPage = 1;
const HISTORY_PAGE_SIZE = 5;



// 更新导航栏显示
function updateNavigation() {
    const userMenu = document.getElementById('userMenu');
    const loginBtn = document.getElementById('login-btn');
    const userDisplayName = document.getElementById('userDisplayName');
    const notice = document.getElementById('reports-notice');
    
    // 直接使用 auth.isAuthenticated() 检查认证状态
    const authenticated = auth.isAuthenticated();
    const user = auth.getCurrentUser();
    console.log('更新导航栏 - 认证状态:', authenticated, '用户数据:', user); // 调试日志
    
    if (authenticated && user) {
        console.log('显示用户菜单，用户:', user); // 调试日志
        
        // 显示用户菜单，隐藏登录按钮
        if (userMenu) userMenu.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        
        // 设置用户信息
        if (userDisplayName && user) {
            const displayName = user.full_name || user.email?.split('@')[0] || '用户';
            userDisplayName.textContent = displayName;
            console.log('导航栏设置用户显示名:', displayName); // 调试日志
        }
        
        // 更新报告通知
        if (notice) {
            notice.textContent = '已登录，可查看与保存你的报告。';
        }
        
        // 设置下拉菜单事件
        setupDropdownMenu();
        
        // 设置退出登录事件
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.onclick = async () => {
                try {
                    await auth.signOut();
                    updateNavigation();
                    showToast('已退出登录', 'success');
                } catch (error) {
                    showToast('退出登录失败', 'error');
                }
            };
        }
    } else {
        // 隐藏用户菜单，显示登录按钮
        if (userMenu) userMenu.style.display = 'none';
        if (loginBtn) {
            loginBtn.style.display = 'inline-block';
            // 移除onclick事件，因为现在使用<a>标签跳转
        }
        
        // 更新报告通知
        if (notice) {
            notice.textContent = '请先登录后查看与保存报告。';
        }
    }
}

// 设置下拉菜单功能
function setupDropdownMenu() {
    const dropdownToggle = document.getElementById('userDropdown');
    const dropdownMenu = document.getElementById('dropdownMenu');
    
    if (dropdownToggle && dropdownMenu) {
        dropdownToggle.onclick = (e) => {
            e.stopPropagation();
            dropdownMenu.classList.toggle('show');
        };
        
        // 点击外部关闭下拉菜单
        document.addEventListener('click', () => {
            dropdownMenu.classList.remove('show');
        });
        
        // 阻止下拉菜单内部点击事件冒泡
        dropdownMenu.onclick = (e) => {
            e.stopPropagation();
        };
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async function() {
    // 初始化全局错误处理器
    if (window.ErrorHandler) {
        // ErrorHandler 在构造时已经自动设置了全局处理器
        console.log('全局错误处理器已启用');
    }
    
    try {
        // 检查认证状态并等待完成
        await auth.checkAuthState();
        console.log('认证状态检查完成');
        
        // 同步 isLoggedIn 状态
        isLoggedIn = auth.isAuthenticated();
        console.log('同步认证状态:', isLoggedIn);
        
        // 更新导航栏
        updateNavigation();
        
        // 设置下拉菜单
        setupDropdownMenu();
    } catch (error) {
        console.error('初始化认证状态失败:', error);
        // 即使认证失败也要更新UI
        updateNavigation();
        setupDropdownMenu();
    }
    
    setupEventListeners();
    
    // 等待i18n模块加载完成后再调用updateLanguage
    if (window.i18n && window.i18n.updateLanguage) {
        window.i18n.updateLanguage();
    } else {
        // 如果i18n还未加载，延迟调用
        setTimeout(() => {
            if (window.i18n && window.i18n.updateLanguage) {
                window.i18n.updateLanguage();
            }
        }, 100);
    }
    
    // 初始化 Supabase Auth（等待库加载完成）
    initializeAuth();
    
    // 初始化应用（绑定文件上传、字符计数与表单校验等事件）
    // 注意：此前未调用该函数会导致上传后不显示文件信息
    initializeApp();
    
    // 初始化历史记录管理器
    try {
        if (window.resumeHistoryManager) {
            await window.resumeHistoryManager.init();
            console.log('简历历史记录管理器初始化完成');
        }
        
        if (window.interviewHistoryManager) {
            await window.interviewHistoryManager.init();
            console.log('面试历史记录管理器初始化完成');
        }
    } catch (error) {
        console.error('历史记录管理器初始化失败:', error);
    }
    
    // 检查是否需要返回到分析页面
    checkReturnToAnalysis();
});

// 初始化Auth系统
async function initializeAuth() {
    let retryCount = 0;
    const maxRetries = 10;
    const retryDelay = 200;
    
    const tryInitialize = async () => {
        // 检查Supabase CDN库是否已加载
        if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
            if (retryCount < maxRetries) {
                retryCount++;
                console.log(`等待Supabase库加载... (${retryCount}/${maxRetries})`);
                setTimeout(tryInitialize, retryDelay);
                return;
            } else {
                console.error('Supabase库加载超时');
                return;
            }
        }
        
        // 初始化Supabase Auth
        if (window.Auth && typeof window.Auth.initialize === 'function') {
            try {
                await window.Auth.initialize();
                console.log('Supabase Auth初始化成功');
            } catch (error) {
                console.error('Supabase Auth初始化失败:', error);
            }
        }
        
        // 初始化AuthManager
        if (window.auth && typeof window.auth.init === 'function') {
            try {
                await window.auth.init();
                console.log('AuthManager初始化成功');
            } catch (error) {
                console.error('AuthManager初始化失败:', error);
            }
        }
    };
    
    tryInitialize();
}

// 初始化应用
function initializeApp() {
    // 设置文件上传事件
    setupFileUpload('resume-file', 'resume-upload', handleResumeFile);
    setupFileUpload('interview-file', 'interview-upload', handleInterviewFile);
    
    // 设置JD字符计数
    const jdTextarea = document.getElementById('job-description');
    if (jdTextarea) {
        jdTextarea.addEventListener('input', updateCharCount);
    }
    
    // 设置表单验证
    setupFormValidation();
}

// 设置事件监听器
function setupEventListeners() {
    // 面试者姓名输入验证
    const nameInput = document.getElementById('interviewee-name');
    if (nameInput) {
        nameInput.addEventListener('input', validateInterviewForm);
    }
    
    // JD输入验证
    const jdInput = document.getElementById('job-description');
    if (jdInput) {
        jdInput.addEventListener('input', validateResumeForm);
    }
    
    // 登录模态框事件监听器
    setupAuthModalListeners();
}

// 设置登录模态框事件监听器
function setupAuthModalListeners() {
    // 模态框关闭事件
    const modal = document.getElementById('login-modal');
    if (modal) {
        // 点击背景关闭模态框
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                hideAuthModal();
            }
        });
    }
    
    // 关闭按钮
    const closeButton = document.querySelector('#login-modal .modal-close');
    if (closeButton) {
        closeButton.addEventListener('click', hideAuthModal);
    }
    
    // 标签切换 - 使用实际的按钮选择器
    const tabButtons = document.querySelectorAll('#login-modal .tab-button');
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            const tabName = this.textContent.trim() === '登录' ? 'login' : 'register';
            switchAuthTab(tabName);
        });
    });
    
    // 登录表单提交
    const loginForm = document.getElementById('modal-login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // 注册表单提交
    const registerForm = document.getElementById('modal-register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // 忘记密码链接
    const forgotPasswordLink = document.querySelector('#login-modal .auth-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', function(e) {
            e.preventDefault();
            hideAuthModal();
            // 显示密码重置模态框
            showPasswordResetModal();
        });
    }
    
    // ESC键关闭模态框
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const modal = document.getElementById('login-modal');
            if (modal && modal.style.display === 'flex') {
                hideAuthModal();
            }
        }
    });
}

// 处理文件上传
function handleFileUpload(file, type) {
    if (!file) return;
    
    // 验证文件类型
    const allowedTypes = type === 'resume' ? 
        ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'] :
        ['audio/mpeg', 'audio/wav', 'audio/mp3', 'audio/m4a'];
    
    if (!allowedTypes.includes(file.type)) {
        showToast(`请上传正确的${type === 'resume' ? '简历' : '音频'}文件格式`, 'error');
        return;
    }
    
    // 验证文件大小 (10MB)
    if (file.size > 10 * 1024 * 1024) {
        showToast('文件大小不能超过10MB', 'error');
        return;
    }
    
    // 显示上传进度
    showUploadProgress(file, type);
    
    // 模拟上传进度
    simulateUploadProgress(type, () => {
        // 显示文件信息
        const fileInfo = document.getElementById(`${type}FileInfo`);
        const fileName = document.getElementById(`${type}FileName`);
        const fileSize = document.getElementById(`${type}FileSize`);
        
        if (fileInfo && fileName && fileSize) {
            fileName.textContent = file.name;
            fileSize.textContent = formatFileSize(file.size);
            fileInfo.style.display = 'block';
        }
        
        // 存储文件
        if (type === 'resume') {
            currentResumeFile = file;
        } else {
            currentInterviewFile = file;
        }
        
        showToast(`${type === 'resume' ? '简历' : '面试录音'}文件上传成功`, 'success');
    });
}

// 显示上传进度
function showUploadProgress(file, type) {
    const uploadArea = document.getElementById(`${type}Upload`);
    if (!uploadArea) return;
    
    // 创建进度条
    const progressContainer = document.createElement('div');
    progressContainer.className = 'upload-progress';
    progressContainer.innerHTML = `
        <div class="upload-progress-info">
            <span class="upload-filename">${file.name}</span>
            <span class="upload-percentage">0%</span>
        </div>
        <div class="upload-progress-bar">
            <div class="upload-progress-fill"></div>
        </div>
    `;
    
    // 替换上传区域内容
    const originalContent = uploadArea.innerHTML;
    uploadArea.innerHTML = '';
    uploadArea.appendChild(progressContainer);
    
    // 存储原始内容以便恢复
    uploadArea.dataset.originalContent = originalContent;
}

// 模拟上传进度
function simulateUploadProgress(type, onComplete) {
    const uploadArea = document.getElementById(`${type}Upload`);
    const progressFill = uploadArea?.querySelector('.upload-progress-fill');
    const progressPercentage = uploadArea?.querySelector('.upload-percentage');
    
    if (!progressFill || !progressPercentage) return;
    
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            
            // 完成后恢复原始内容
            setTimeout(() => {
                if (uploadArea.dataset.originalContent) {
                    uploadArea.innerHTML = uploadArea.dataset.originalContent;
                    delete uploadArea.dataset.originalContent;
                }
                onComplete();
            }, 500);
        }
        
        progressFill.style.width = `${progress}%`;
        progressPercentage.textContent = `${Math.round(progress)}%`;
    }, 100);
}

// 监听登录状态变化，更新UI
window.addEventListener('auth-changed', (e) => {
    const user = e.detail?.user || null;
    isLoggedIn = !!user;
    console.log('认证状态变化:', { user, isLoggedIn }); // 调试日志
    updateNavigation();
});

// updateAuthUI函数已移除，统一使用updateNavigation函数处理UI更新

// 设置文件上传
function setupFileUpload(inputId, uploadAreaId, handler) {
    const fileInput = document.getElementById(inputId);
    const uploadArea = document.getElementById(uploadAreaId);
    
    if (!fileInput || !uploadArea) return;
    
    // 文件选择事件
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handler(file);
        }
    });
    
    // 拖拽事件
    const dropArea = uploadArea.querySelector('.upload-area');
    
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });
    
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });
    
    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });
    
    dropArea.addEventListener('drop', function(e) {
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handler(files[0]);
        }
    });
}

// 防止默认拖拽行为
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

// 高亮拖拽区域
function highlight(e) {
    e.target.closest('.upload-area').classList.add('drag-over');
}

// 取消高亮
function unhighlight(e) {
    e.target.closest('.upload-area').classList.remove('drag-over');
}

// 处理简历文件
function handleResumeFile(file) {
    if (!validateFile(file, ['pdf', 'doc', 'docx', 'txt'], 500)) {
        return;
    }
    
    resumeFile = file;
    displayFileInfo(file, 'resume-file-info');
    validateResumeForm();
}

// 处理面试文件
function handleInterviewFile(file) {
    if (!validateFile(file, ['pdf'], 500)) {
        return;
    }
    
    interviewFile = file;
    displayFileInfo(file, 'interview-file-info');
    validateInterviewForm();
}

// 验证文件
function validateFile(file, allowedTypes, maxSizeMB) {
    try {
        const fileExtension = file.name.split('.').pop().toLowerCase();
        const fileSizeMB = file.size / (1024 * 1024);
        
        if (!allowedTypes.includes(fileExtension)) {
            const error = new Error(`不支持的文件格式。请上传 ${allowedTypes.join(', ').toUpperCase()} 格式的文件。`);
            
            // 使用全局错误处理器
            if (window.ErrorHandler) {
                window.ErrorHandler.handleValidationError(error, {
                    field: 'file_type',
                    value: fileExtension,
                    allowedValues: allowedTypes,
                    filename: file.name
                });
            }
            
            showToast(`不支持的文件格式。请上传 ${allowedTypes.join(', ').toUpperCase()} 格式的文件。`, 'error');
            return false;
        }
        
        if (fileSizeMB > maxSizeMB) {
            const error = new Error(`文件大小超过限制。最大支持 ${maxSizeMB}MB，当前文件 ${fileSizeMB.toFixed(2)}MB。`);
            
            // 使用全局错误处理器
            if (window.ErrorHandler) {
                window.ErrorHandler.handleValidationError(error, {
                    field: 'file_size',
                    value: fileSizeMB,
                    maxValue: maxSizeMB,
                    filename: file.name
                });
            }
            
            showToast(`文件大小超过限制。最大支持 ${maxSizeMB}MB。`, 'error');
            return false;
        }
        
        return true;
    } catch (error) {
        // 处理其他意外错误
        const validationError = new Error('文件验证失败，请检查文件是否损坏');
        if (window.ErrorHandler) {
            window.ErrorHandler.handleFileError(validationError, {
                filename: file.name,
                filesize: file.size,
                filetype: file.type,
                originalError: error.message
            });
        }
        showToast('文件验证失败，请检查文件是否损坏', 'error');
        return false;
    }
}

// 显示文件信息
function displayFileInfo(file, infoElementId) {
    const infoElement = document.getElementById(infoElementId);
    if (!infoElement) return;
    
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const fileExtension = file.name.split('.').pop().toUpperCase();
    
    infoElement.innerHTML = `
        <i class="fas fa-file-${getFileIcon(fileExtension)}"></i>
        <div class="file-details">
            <h4>${file.name}</h4>
            <p>${fileSizeMB} MB • ${fileExtension} 格式</p>
        </div>
    `;
    infoElement.style.display = 'flex';
}

// 获取文件图标
function getFileIcon(extension) {
    const icons = {
        'PDF': 'pdf',
        'DOC': 'word',
        'DOCX': 'word',
        'TXT': 'alt'
    };
    return icons[extension] || 'alt';
}

// 更新字符计数
function updateCharCount() {
    const textarea = document.getElementById('job-description');
    const counter = document.getElementById('jd-char-count');
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
        
        if (textarea.value.length > 5000) {
            counter.style.color = '#ef4444';
            textarea.value = textarea.value.substring(0, 5000);
            counter.textContent = '5000';
        } else {
            counter.style.color = '#6b7280';
        }
    }
}

// 验证简历分析表单
function validateResumeForm() {
    const jdText = document.getElementById('job-description').value.trim();
    const analyzeBtn = document.getElementById('analyze-resume-btn');
    
    const isValid = resumeFile && jdText.length > 0;
    analyzeBtn.disabled = !isValid;
}

// 验证面试分析表单
function validateInterviewForm() {
    const name = document.getElementById('interviewee-name').value.trim();
    const analyzeBtn = document.getElementById('analyze-interview-btn');
    
    const isValid = interviewFile && name.length >= 2;
    analyzeBtn.disabled = !isValid;
}

// 设置表单验证
function setupFormValidation() {
    // 实时验证表单，仅在主分析页面执行
    if (document.getElementById('resume-module') && document.getElementById('interview-module')) {
        setInterval(() => {
            const resumeModule = document.getElementById('resume-module');
            const interviewModule = document.getElementById('interview-module');

            if (resumeModule && resumeModule.style.display !== 'none') {
                validateResumeForm();
            }
            if (interviewModule && interviewModule.style.display !== 'none') {
                validateInterviewForm();
            }
        }, 500);
    }
}

// 检查是否需要返回到分析页面
function checkReturnToAnalysis() {
    // 检查是否有返回分析页面的标记
    const returnToAnalysis = sessionStorage.getItem('returnToAnalysis');
    
    if (returnToAnalysis && auth.isAuthenticated()) {
        // 清除标记
        sessionStorage.removeItem('returnToAnalysis');
        
        // 延迟执行，确保页面完全加载
        setTimeout(() => {
            if (returnToAnalysis === 'resume') {
                showResumeAnalysis();
            } else if (returnToAnalysis === 'interview') {
                showInterviewAnalysis();
            }
        }, 100);
    }
}

// 显示主页
function showHome() {
    document.getElementById('resume-module').style.display = 'none';
    document.getElementById('interview-module').style.display = 'none';
    const myReports = document.getElementById('my-reports-module');
    if (myReports) myReports.style.display = 'none';
    document.querySelector('.feature-cards').style.display = 'grid';
}

// 显示简历分析
function showResumeAnalysis() {
    // 检查用户是否已登录
    if (!auth.isAuthenticated()) {
        // 保存当前页面状态，登录后返回
        sessionStorage.setItem('returnToAnalysis', 'resume');
        // 显示登录模态框
        showAuthModal();
        return;
    }
    
    document.querySelector('.feature-cards').style.display = 'none';
    document.getElementById('resume-module').style.display = 'block';
    document.getElementById('resume-module').classList.add('fade-in');
    
    // 重置表单
    resetResumeForm();
}

// 显示面试分析
function showInterviewAnalysis() {
    // 检查用户是否已登录
    if (!auth.isAuthenticated()) {
        // 保存当前页面状态，登录后返回
        sessionStorage.setItem('returnToAnalysis', 'interview');
        // 显示登录模态框
        showAuthModal();
        return;
    }
    
    document.querySelector('.feature-cards').style.display = 'none';
    document.getElementById('interview-module').style.display = 'block';
    document.getElementById('interview-module').classList.add('fade-in');
    
    // 重置表单
    resetInterviewForm();
}

// 将函数暴露到全局作用域，以便HTML中的onclick事件可以访问
window.showHome = showHome;
window.showResumeAnalysis = showResumeAnalysis;
window.showInterviewAnalysis = showInterviewAnalysis;

// 显示我的报告
async function showMyReports() {
    // 检查当前页面是否为analysis-history.html
    if (window.location.pathname.includes('analysis-history.html')) {
        // 如果已经在分析记录页面，直接刷新数据
        if (window.analysisHistoryManager) {
            try {
                await window.analysisHistoryManager.loadRecords();
            } catch (error) {
                console.error('刷新分析记录失败:', error);
            }
        }
        return;
    }
    
    // 检查是否在index.html页面
    const featureCards = document.querySelector('.feature-cards');
    const resumeModule = document.getElementById('resume-module');
    const interviewModule = document.getElementById('interview-module');
    const myReports = document.getElementById('my-reports-module');
    
    // 如果不在index.html页面，跳转到analysis-history.html
    if (!myReports) {
        window.location.href = 'analysis-history.html';
        return;
    }
    
    // 在index.html页面的原有逻辑
    if (featureCards) featureCards.style.display = 'none';
    if (resumeModule) resumeModule.style.display = 'none';
    if (interviewModule) interviewModule.style.display = 'none';
    
    myReports.style.display = 'block';
    myReports.classList.add('fade-in');
    
    // 确保历史记录管理器已初始化
    try {
        if (window.resumeHistoryManager && !window.resumeHistoryManager.initialized) {
            await window.resumeHistoryManager.init();
        }
        if (window.interviewHistoryManager && !window.interviewHistoryManager.initialized) {
            await window.interviewHistoryManager.init();
        }
    } catch (error) {
        console.error('历史记录管理器初始化失败:', error);
    }
    
    // 默认显示"报告列表"子标签
    switchReportsTab('reports');
}

// 重置简历表单
function resetResumeForm() {
    document.getElementById('resume-file').value = '';
    document.getElementById('job-description').value = '';
    document.getElementById('resume-file-info').style.display = 'none';
    document.getElementById('resume-result').style.display = 'none';
    resumeFile = null;
    updateCharCount();
    validateResumeForm();
}

// 重置面试表单
function resetInterviewForm() {
    document.getElementById('interview-file').value = '';
    document.getElementById('interviewee-name').value = '';
    document.getElementById('recording-url').value = '';
    document.getElementById('interview-file-info').style.display = 'none';
    document.getElementById('interview-result').style.display = 'none';
    interviewFile = null;
    validateInterviewForm();
}

// 登录相关函数已移除，现在使用页面跳转

// 打开/关闭重置密码弹窗
function openResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'flex';
}
// 兼容 index.html 中的“忘记密码”链接，避免未定义错误
function showModalForgotPassword() {
    try {
        if (typeof openResetModal === 'function') {
            openResetModal();
        } else {
            // 回退到登录/注册模态
            showAuthModal();
        }
    } catch (e) {
        console.error('打开忘记密码模态失败:', e);
        showAuthModal();
    }
}
function closeResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'none';
}

// 登录/注册/退出
// handleEmailLogin 函数已移除，现在使用独立登录页面

// handleEmailSignup 和 handleForgotPassword 函数已移除，现在使用独立登录页面

// 在密码重置链接进入页面时，弹出设置新密码的窗口
window.addEventListener('password-recovery', () => {
    openResetModal();
});

async function handlePasswordUpdate() {
    try {
        const pwd = document.getElementById('reset-password').value.trim();
        const pwd2 = document.getElementById('reset-password-confirm').value.trim();
        const btn = document.querySelector('#reset-modal .modal-actions .btn-primary');
        if (!pwd || !pwd2) { showToast('请输入新密码并确认', 'warning'); return; }
        if (pwd.length < 6) { showToast('新密码至少 6 位', 'warning'); return; }
        if (pwd !== pwd2) { showToast('两次输入的密码不一致', 'warning'); return; }
        if (btn) btn.disabled = true;
        const { error } = await Auth.updatePassword(pwd);
        if (error) throw error;
        showToast('密码已更新，请重新登录', 'success');
        closeResetModal();
        // 修复：使用现有的登录模态框函数
        showAuthModal();
    } catch (err) {
        // 使用全局错误处理器处理认证错误
        if (window.ErrorHandler) {
            window.ErrorHandler.handleAuthError(err);
        } else {
            // 降级处理
            showToast('更新密码失败：' + err.message);
        }
    } finally {
        const btn = document.querySelector('#reset-modal .modal-actions .btn-primary');
        if (btn) btn.disabled = false;
    }
}

async function handleLogout() {
    try {
        const { error } = await Auth.signOut();
        if (error) throw error;
        showToast('已退出登录', 'success');
    } catch (err) {
        showToast('退出失败：' + err.message);
    }
}

// 公开登录相关方法到全局，确保 HTML 内联 onclick 可调用
window.openResetModal = openResetModal;
window.closeResetModal = closeResetModal;
window.handlePasswordUpdate = handlePasswordUpdate;
window.handleLogout = handleLogout;

// 分析简历
async function analyzeResume() {
    if (!resumeFile) {
        showToast('请先上传简历文件', 'error');
        return;
    }
    
    const jdText = document.getElementById('job-description').value.trim();
    if (!jdText) {
        showToast('请输入岗位职责描述', 'error');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyze-resume-btn');
    const spinner = analyzeBtn.querySelector('.fa-spin');
    const btnText = analyzeBtn.querySelector('span');
    
    // 防止重复提交
    if (isAnalyzing) {
        showToast('正在分析中，请稍候...', 'warning');
        return;
    }
    
    isAnalyzing = true;
    
    // 显示加载通知
    const loadingNotification = notificationManager.loading('正在分析简历，请稍候...');
    
    // 预先转换文件为base64（优化：并行处理）
    let fileBase64Promise = null;
    if (auth.isAuthenticated()) {
        fileBase64Promise = fileToBase64(resumeFile);
    }
    
    try {
        // 显示加载状态
        showLoading();
        analyzeBtn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = currentLanguage === 'zh' ? '分析中...' : 'Analyzing...';
        
        // 调用API（添加超时控制）
        const result = await Promise.race([
            window.API.callResumeAnalysisAPI(resumeFile, jdText),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('请求超时，请检查网络连接')), 120000) // 2分钟超时
            )
        ]);
        
        // 隐藏加载通知
        notificationManager.hide(loadingNotification);
        
        // 显示结果
        displayResumeResult(result);
        
        // 保存到数据库（优化：使用预先转换的base64）
        if (result.saveToDatabase && auth.isAuthenticated() && fileBase64Promise) {
            try {
                const fileBase64 = await fileBase64Promise;
                
                // 异步保存，不阻塞用户界面
                apiIntegration.saveResumeAnalysis({
                    fileBase64: fileBase64,
                    fileName: resumeFile.name,
                    jd: jdText,
                    result: result.data,
                    workflowRunId: result.saveToDatabase.workflowRunId,
                    conversationId: result.saveToDatabase.conversationId
                }).then(async saveResult => {
                    if (saveResult.success) {
                        console.log('简历分析结果已保存到数据库');
                        // 缓存返回的分析记录ID，便于在"我的报告"进行联动
                        try {
                            lastResumeAnalysisId = saveResult?.data?.id || null;
                        } catch (_) {}
                        
                        // 自动保存报告到reports表，实现数据同步
                        try {
                            await autoSaveReportToSupabase('resume', jdText, result.saveToDatabase.workflowRunId, result.saveToDatabase.conversationId);
                            console.log('简历分析报告已自动保存到我的报告');
                        } catch (reportSaveError) {
                            console.warn('自动保存报告失败:', reportSaveError);
                        }
                        
                        showToast('简历分析完成，结果已保存到您的历史记录', 'success');
                    } else {
                        console.warn('保存到数据库失败:', saveResult.error);
                        showToast(currentLanguage === 'zh' ? '简历分析完成！' : 'Resume analysis completed!', 'success');
                    }
                }).catch(saveError => {
                    console.error('保存到数据库时出错:', saveError);
                    showToast(currentLanguage === 'zh' ? '简历分析完成！' : 'Resume analysis completed!', 'success');
                });
            } catch (base64Error) {
                console.error('文件转换失败:', base64Error);
                showToast(currentLanguage === 'zh' ? '简历分析完成！' : 'Resume analysis completed!', 'success');
            }
        } else {
            showToast(currentLanguage === 'zh' ? '简历分析完成！' : 'Resume analysis completed!', 'success');
        }
        
    } catch (error) {
        console.error('简历分析失败:', error);
        
        // 使用全局错误处理器
        if (window.ErrorHandler) {
            window.ErrorHandler.handleAPIError(error, {
                operation: 'resume_analysis',
                filename: resumeFile?.name,
                filesize: resumeFile?.size,
                jdLength: jdText?.length
            });
        }
        
        // 根据错误类型提供更具体的错误信息
        let errorMessage = '分析失败，请重试';
        if (error.message.includes('超时') || error.name === 'AbortError') {
            errorMessage = '请求超时，请检查网络连接后重试';
        } else if (error.message.includes('网络') || error.message.includes('fetch')) {
            errorMessage = '网络连接异常，请检查网络后重试';
        } else if (error.message.includes('文件')) {
            errorMessage = '文件处理失败，请检查文件格式';
        } else if (error.message.includes('认证') || error.message.includes('401')) {
            errorMessage = '认证失败，请重新登录';
        } else if (error.message.includes('权限') || error.message.includes('403')) {
            errorMessage = '权限不足，请联系管理员';
        } else if (error.message.includes('频繁') || error.message.includes('429')) {
            errorMessage = '请求过于频繁，请稍后再试';
        }
        
        showToast(currentLanguage === 'zh' ? errorMessage : 'Analysis failed, please try again', 'error');
        
        // 确保隐藏加载通知
        notificationManager.hide(loadingNotification);
    } finally {
        // 恢复按钮状态
        isAnalyzing = false;
        hideLoading();
        analyzeBtn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = currentLanguage === 'zh' ? '开始分析简历' : 'Start Resume Analysis';
    }
}

// 分析面试
async function analyzeInterview() {
    if (!interviewFile) {
        showToast('请先上传面试录音PDF文件', 'error');
        return;
    }
    
    const name = document.getElementById('interviewee-name').value.trim();
    if (!name) {
        showToast('请输入面试者姓名', 'error');
        return;
    }
    
    // 防止重复提交
    if (isAnalyzing) {
        showToast('正在分析中，请稍候...', 'warning');
        return;
    }
    
    isAnalyzing = true;
    
    const recordingUrl = document.getElementById('recording-url').value.trim();
    const analyzeBtn = document.getElementById('analyze-interview-btn');
    const spinner = analyzeBtn.querySelector('.fa-spin');
    const btnText = analyzeBtn.querySelector('span');
    
    // 显示加载通知
    const loadingNotification = notificationManager.loading('正在分析面试录音，请稍候...');
    
    // 预先转换文件为base64（优化：并行处理）
    let fileBase64Promise = null;
    if (auth.isAuthenticated()) {
        fileBase64Promise = fileToBase64(interviewFile);
    }
    
    try {
        // 显示加载状态
        showLoading();
        analyzeBtn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = currentLanguage === 'zh' ? '分析中...' : 'Analyzing...';
        
        // 调用API（添加超时控制）
        const result = await Promise.race([
            window.API.callInterviewAnalysisAPI(interviewFile, name, recordingUrl),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('请求超时，请检查网络连接')), 180000) // 3分钟超时（面试分析通常更耗时）
            )
        ]);
        
        // 隐藏加载通知
        notificationManager.hide(loadingNotification);
        
        // 显示结果
        displayInterviewResult(result);
         
        // 保存到数据库（优化：使用预先转换的base64）
        if (result.saveToDatabase && auth.isAuthenticated() && fileBase64Promise) {
            try {
                const fileBase64 = await fileBase64Promise;
                
                // 异步保存，不阻塞用户界面
                apiIntegration.saveInterviewAnalysis({
                    fileBase64: fileBase64,
                    fileName: interviewFile.name,
                    candidateName: name,
                    recordingUrl: recordingUrl,
                    result: result.data,
                    workflowRunId: result.saveToDatabase.workflowRunId,
                    conversationId: result.saveToDatabase.conversationId
                }).then(async saveResult => {
                    if (saveResult.success) {
                        console.log('面试分析结果已保存到数据库');
                        // 缓存返回的分析记录ID，便于在"我的报告"进行联动
                        try {
                            lastInterviewAnalysisId = saveResult?.data?.id || null;
                        } catch (_) {}
                        
                        // 自动保存报告到reports表，实现数据同步
                        try {
                            // 获取当前职位描述
                            const currentJd = document.getElementById('jd-text')?.value || '';
                            await autoSaveReportToSupabase('interview', currentJd, result.saveToDatabase.workflowRunId, result.saveToDatabase.conversationId);
                            console.log('面试分析报告已自动保存到我的报告');
                        } catch (reportSaveError) {
                            console.warn('自动保存报告失败:', reportSaveError);
                        }
                        
                        showToast('面试分析完成，结果已保存到您的历史记录', 'success');
                    } else {
                        console.warn('保存到数据库失败:', saveResult.error);
                        showToast(currentLanguage === 'zh' ? '面试分析完成！' : 'Interview analysis completed!', 'success');
                    }
                }).catch(saveError => {
                    console.error('保存到数据库时出错:', saveError);
                    showToast(currentLanguage === 'zh' ? '面试分析完成！' : 'Interview analysis completed!', 'success');
                });
            } catch (base64Error) {
                console.error('文件转换失败:', base64Error);
                showToast(currentLanguage === 'zh' ? '面试分析完成！' : 'Interview analysis completed!', 'success');
            }
        } else {
            showToast(currentLanguage === 'zh' ? '面试分析完成！' : 'Interview analysis completed!', 'success');
        }
        
    } catch (error) {
        console.error('面试分析失败:', error);
        
        // 使用全局错误处理器
        if (window.ErrorHandler) {
            window.ErrorHandler.handleAPIError(error, {
                operation: 'interview_analysis',
                filename: interviewFile?.name,
                filesize: interviewFile?.size,
                candidateName: name,
                recordingUrl: recordingUrl
            });
        }
        
        // 根据错误类型提供更具体的错误信息
        let errorMessage = '分析失败，请重试';
        if (error.message.includes('超时') || error.name === 'AbortError') {
            errorMessage = '请求超时，请检查网络连接后重试';
        } else if (error.message.includes('网络') || error.message.includes('fetch')) {
            errorMessage = '网络连接异常，请检查网络后重试';
        } else if (error.message.includes('文件')) {
            errorMessage = '文件处理失败，请检查文件格式';
        } else if (error.message.includes('认证') || error.message.includes('401')) {
            errorMessage = '认证失败，请重新登录';
        } else if (error.message.includes('权限') || error.message.includes('403')) {
            errorMessage = '权限不足，请联系管理员';
        } else if (error.message.includes('频繁') || error.message.includes('429')) {
            errorMessage = '请求过于频繁，请稍后再试';
        }
        
        showToast(currentLanguage === 'zh' ? errorMessage : 'Analysis failed, please try again', 'error');
        
        // 确保隐藏加载通知
        notificationManager.hide(loadingNotification);
    } finally {
        // 恢复按钮状态
        isAnalyzing = false;
        hideLoading();
        analyzeBtn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = currentLanguage === 'zh' ? '开始分析面试' : 'Start Interview Analysis';
    }
}

// 显示简历分析结果
function displayResumeResult(result) {
    const resultSection = document.getElementById('resume-result');
    const resultContent = document.getElementById('resume-result-content');
    
    console.log('显示简历分析结果:', result);
    
    // 记录原始结构化结果与运行信息，供后续“我的报告”联动使用
    try {
        lastResumeAnalysisJSON = result?.data || result || null;
        lastResumeWorkflowRunId = result?.saveToDatabase?.workflowRunId || null;
        lastResumeConversationId = result?.saveToDatabase?.conversationId || null;
    } catch (_) {}

    // 提取并渲染Markdown
    const markdown = extractMarkdownFromResult(result, 'resume');
    resumeMarkdown = markdown || '';
    resumeDebugUrl = (result && result.debug_url) ? result.debug_url : '';
    const finalMarkdown = buildReportMarkdown('简历分析报告', resumeMarkdown, resumeDebugUrl);
    renderMarkdown(finalMarkdown, resultContent);
    
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 显示面试分析结果
function displayInterviewResult(result) {
    const resultSection = document.getElementById('interview-result');
    const resultContent = document.getElementById('interview-result-content');
    
    console.log('显示面试分析结果:', result);
    
    // 记录原始结构化结果与运行信息，供后续“我的报告”联动使用
    try {
        lastInterviewAnalysisJSON = result?.data || result || null;
        lastInterviewWorkflowRunId = result?.saveToDatabase?.workflowRunId || null;
        lastInterviewConversationId = result?.saveToDatabase?.conversationId || null;
    } catch (_) {}

    // 提取并渲染Markdown
    const markdown = extractMarkdownFromResult(result, 'interview');
    interviewMarkdown = markdown || '';
    interviewDebugUrl = (result && result.debug_url) ? result.debug_url : '';
    const finalMarkdown = buildReportMarkdown('面试分析报告', interviewMarkdown, interviewDebugUrl);
    renderMarkdown(finalMarkdown, resultContent);
    
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 自动保存报告到 Supabase（用于分析完成后的自动同步）
async function autoSaveReportToSupabase(type, jobDescription, workflowRunId, conversationId) {
    try {
        // 检查用户认证
        const user = window.auth?.getCurrentUser?.() || null;
        if (!user) {
            console.log('用户未登录，跳过自动保存报告');
            return;
        }
        
        // 获取 Supabase 客户端
        const supabase = window.Auth?.getClient?.();
        if (!supabase) {
            console.warn('Supabase 客户端未初始化，跳过自动保存报告');
            return;
        }
        
        // 获取报告内容
        let markdownOutput = '';
        let debugUrl = '';
        let resumeAnalysisId = null;
        let interviewAnalysisId = null;
        
        if (type === 'resume') {
            markdownOutput = resumeMarkdown || '';
            debugUrl = resumeDebugUrl || '';
            resumeAnalysisId = lastResumeAnalysisId;
        } else if (type === 'interview') {
            markdownOutput = interviewMarkdown || '';
            debugUrl = interviewDebugUrl || '';
            interviewAnalysisId = lastInterviewAnalysisId;
        }
        
        if (!markdownOutput) {
            console.warn('没有找到报告内容，跳过自动保存');
            return;
        }
        
        // 构建调试URL
        const finalDebugUrl = debugUrl || (workflowRunId && conversationId ? 
            `https://www.coze.cn/space/7428748863932653568/bot/7428749196589506560/debug/${workflowRunId}?conversation_id=${conversationId}` : '');
        
        // 准备报告数据
        const reportData = {
            user_id: user.id,
            report_type: type,
            job_description: jobDescription || '',
            debug_url: finalDebugUrl,
            markdown_output: markdownOutput,
            raw_output: markdownOutput,
            resume_analysis_id: resumeAnalysisId,
            interview_analysis_id: interviewAnalysisId
        };
        
        // 插入到 reports 表
        const { data, error } = await supabase
            .from('reports')
            .insert([reportData])
            .select();
        
        if (error) {
            console.warn('自动保存报告失败:', error);
            return;
        }
        
        console.log('报告已自动保存到我的报告:', data);
        
    } catch (error) {
        console.warn('自动保存报告时出错:', error);
    }
}

// 保存报告到 Supabase（按用户隔离）
async function saveReportToSupabase(type) {
    try {
        // 使用我们数据库中的用户记录（users 表），以匹配 RLS 与外键
        const user = window.auth?.getCurrentUser?.() || null;
        if (!user) {
            showToast('请先登录后再保存报告', 'warning');
            // 修复：openLoginModal 未定义，改为显示登录模态框
            showAuthModal();
            return;
        }
        // 修复：正确获取 Supabase 客户端
        const supabase = window.Auth?.getClient?.();
        if (!supabase) {
            showToast('Supabase 客户端未初始化，请刷新页面后重试', 'error');
            return;
        }
        const debugUrl = type === 'resume' ? resumeDebugUrl : interviewDebugUrl;
        const markdown = type === 'resume' ? resumeMarkdown : interviewMarkdown;
        if (!markdown) {
            showToast('尚未生成报告，无法保存');
            return;
        }
        // 立即给出保存中的反馈，避免“无反应”的感知
        const savingNotification = notificationManager.loading('正在保存到“我的报告”…');
        
        const jd = document.getElementById('job-description')?.value || null;
        
        // 若分析记录ID尚未拿到，进行一次回退保存，以确保报告能与分析记录联动
        try {
            if (type === 'resume' && !lastResumeAnalysisId && lastResumeAnalysisJSON) {
                const fallbackBase64 = resumeFile ? await fileToBase64(resumeFile) : null;
                const saveRes = await apiIntegration.saveResumeAnalysis({
                    fileBase64: fallbackBase64,
                    fileName: resumeFile?.name || 'resume.pdf',
                    jd: jd,
                    result: lastResumeAnalysisJSON,
                    workflowRunId: lastResumeWorkflowRunId,
                    conversationId: lastResumeConversationId
                });
                if (saveRes && saveRes.success) {
                    lastResumeAnalysisId = saveRes?.data?.id || lastResumeAnalysisId;
                }
            } else if (type === 'interview' && !lastInterviewAnalysisId && lastInterviewAnalysisJSON) {
                const fallbackBase64 = interviewFile ? await fileToBase64(interviewFile) : null;
                const name = document.getElementById('interviewee-name')?.value || null;
                const recordingUrl = document.getElementById('recording-url')?.value || null;
                const saveRes = await apiIntegration.saveInterviewAnalysis({
                    fileBase64: fallbackBase64,
                    fileName: interviewFile?.name || 'interview.pdf',
                    candidateName: name,
                    recordingUrl: recordingUrl,
                    result: lastInterviewAnalysisJSON,
                    workflowRunId: lastInterviewWorkflowRunId,
                    conversationId: lastInterviewConversationId
                });
                if (saveRes && saveRes.success) {
                    lastInterviewAnalysisId = saveRes?.data?.id || lastInterviewAnalysisId;
                }
            }
        } catch (fallbackErr) {
            console.warn('回退保存分析记录失败（不影响报告保存）:', fallbackErr);
        }

        const finalResumeId = type === 'resume' ? (lastResumeAnalysisId || null) : null;
        const finalInterviewId = type === 'interview' ? (lastInterviewAnalysisId || null) : null;
        const rawOutput = JSON.stringify({
            workflowRunId: type === 'resume' ? lastResumeWorkflowRunId : lastInterviewWorkflowRunId,
            conversationId: type === 'resume' ? lastResumeConversationId : lastInterviewConversationId
        });

        const { data, error } = await supabase
            .from('reports')
            .insert({
                user_id: user.id,
                report_type: type,
                job_description: type === 'resume' ? jd : null,
                debug_url: debugUrl || null,
                markdown_output: markdown,
                raw_output: rawOutput || null,
                resume_analysis_id: finalResumeId,
                interview_analysis_id: finalInterviewId
            })
            .select();
        if (error) throw error;
        // 隐藏“保存中”提示并显示成功反馈
        notificationManager.hide(savingNotification);
        showToast('已保存到“我的报告”', 'success');
        // 保存成功后，自动切换到“我的报告”并刷新列表，方便用户立即看到结果
        try {
            if (typeof showMyReports === 'function') {
                showMyReports();
            } else {
                // 兼容：若未暴露 showMyReports，则直接尝试刷新列表
                if (typeof loadMyReports === 'function') {
                    loadMyReports();
                }
            }
        } catch (e) {
            console.warn('跳转到“我的报告”时发生警告：', e);
        }
    } catch (err) {
        // 使用全局错误处理器处理数据库错误（兼容旧版本缺少方法的情况）
        if (window.ErrorHandler && typeof window.ErrorHandler.handleDatabaseError === 'function') {
            window.ErrorHandler.handleDatabaseError(err, { operation: 'insert', table: 'reports' });
        } else {
            // 降级处理，避免因缺少方法导致 TypeError
            console.error('Database error (fallback):', err);
            showToast('保存失败：' + (err?.message || '数据库操作失败'));
        }
        // 确保“保存中”提示被关闭
        try { notificationManager.hide?.(savingNotification); } catch (_) {}
    }
}

// 加载“我的报告”列表
async function loadMyReports() {
    try {
        // 使用我们数据库中的用户记录（users 表），以匹配 RLS 与外键
        const user = window.auth?.getCurrentUser?.() || null;
        const listEl = document.getElementById('reports-list');
        if (!listEl) return;
        if (!user) {
            listEl.innerHTML = '<p>未登录，无法查看报告。</p>';
            return;
        }
        // 修复：正确获取 Supabase 客户端
        const supabase = window.Auth?.getClient?.();
        if (!supabase) {
            listEl.innerHTML = '<p>Supabase 客户端未初始化，请刷新页面后重试。</p>';
            return;
        }
        const { data, error } = await supabase
            .from('reports')
            .select('id, report_type, job_description, created_at, debug_url, markdown_output, resume_analysis_id, interview_analysis_id')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            listEl.innerHTML = '<p>暂无报告，先去生成一份吧。</p>';
            return;
        }
        const html = data.map(item => {
            const title = item.report_type === 'resume' ? '简历分析' : '面试分析';
            const created = new Date(item.created_at).toLocaleString();
            const linkedIdHtml = item.report_type === 'resume'
                ? (item.resume_analysis_id ? `<p><small>关联简历分析ID：<a href="resume-history.html" target="_blank">#${item.resume_analysis_id}</a></small></p>` : '')
                : (item.interview_analysis_id ? `<p><small>关联面试分析ID：<a href="interview-history.html" target="_blank">#${item.interview_analysis_id}</a></small></p>` : '');
            return `
                <div class="report-item">
                    <h4>${title} · ${created}</h4>
                    ${item.job_description ? `<p><strong>JD：</strong>${escapeHtml(item.job_description).slice(0, 200)}...</p>` : ''}
                    ${item.debug_url ? `<p><a href="${item.debug_url}" target="_blank">调试链接</a></p>` : ''}
                    ${linkedIdHtml}
                    <div class="result-actions" style="margin-top:0.5rem">
                        <button class="btn-secondary" onclick='downloadSavedDocx(${JSON.stringify({id:item.id}).replace(/"/g, "&quot;")})'>下载 Word</button>
                        <button class="btn-secondary" onclick='downloadSavedMarkdown(${JSON.stringify({id:item.id}).replace(/"/g, "&quot;")})'>下载.md</button>
                        <button class="btn-primary" onclick='viewSavedMarkdown(${JSON.stringify({id:item.id}).replace(/"/g, "&quot;")})'>查看内容</button>
                        <button class="btn-danger" onclick='deleteReport("${item.id}", "${title}")' style="background-color: #dc3545; border-color: #dc3545;">
                            <i class="fas fa-trash"></i> 删除
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        listEl.innerHTML = html;
        // 存入内存以便后续下载和查看
        window._savedReportsCache = data;
    } catch (err) {
        // 使用全局错误处理器处理数据库错误（兼容旧版本缺少方法的情况）
        if (window.ErrorHandler && typeof window.ErrorHandler.handleDatabaseError === 'function') {
            window.ErrorHandler.handleDatabaseError(err, { operation: 'select', table: 'reports' });
        } else {
            // 降级处理，避免因缺少方法导致 TypeError
            console.error('Database error (fallback):', err);
            showToast('加载报告失败：' + (err?.message || '数据库操作失败'));
        }
    }
}

// 切换“我的报告”子标签
function switchReportsTab(tabName) {
    activeReportsTab = tabName;
    // 更新按钮样式
    const tabReports = document.getElementById('tab-reports');
    const tabResume = document.getElementById('tab-resume');
    const tabInterview = document.getElementById('tab-interview');
    if (tabReports && tabResume && tabInterview) {
        tabReports.classList.toggle('active', tabName === 'reports');
        tabResume.classList.toggle('active', tabName === 'resume');
        tabInterview.classList.toggle('active', tabName === 'interview');
    }

    // 切换容器显示
    const reportsList = document.getElementById('reports-list');
    const resumeList = document.getElementById('resume-history-list');
    const interviewList = document.getElementById('interview-history-list');
    const resumePager = document.getElementById('resume-pagination');
    const interviewPager = document.getElementById('interview-pagination');
    const refreshBtn = document.getElementById('subtab-refresh-btn');

    if (!reportsList || !resumeList || !interviewList) return;

    if (tabName === 'reports') {
        reportsList.style.display = 'block';
        resumeList.style.display = 'none';
        interviewList.style.display = 'none';
        if (resumePager) resumePager.style.display = 'none';
        if (interviewPager) interviewPager.style.display = 'none';
        if (refreshBtn) refreshBtn.setAttribute('onclick', 'loadMyReports()');
        loadMyReports();
    } else if (tabName === 'resume') {
        reportsList.style.display = 'none';
        resumeList.style.display = 'block';
        interviewList.style.display = 'none';
        if (resumePager) resumePager.style.display = 'flex';
        if (interviewPager) interviewPager.style.display = 'none';
        if (refreshBtn) refreshBtn.setAttribute('onclick', 'window.resumeHistoryManager?.loadRecords()');
        // 使用新的历史记录管理器
        if (window.resumeHistoryManager) {
            window.resumeHistoryManager.loadRecords();
        } else {
            loadResumeHistory(); // 降级处理
        }
    } else {
        reportsList.style.display = 'none';
        resumeList.style.display = 'none';
        interviewList.style.display = 'block';
        if (resumePager) resumePager.style.display = 'none';
        if (interviewPager) interviewPager.style.display = 'flex';
        if (refreshBtn) refreshBtn.setAttribute('onclick', 'window.interviewHistoryManager?.loadRecords()');
        // 使用新的历史记录管理器
        if (window.interviewHistoryManager) {
            window.interviewHistoryManager.loadRecords();
        } else {
            loadInterviewHistory(); // 降级处理
        }
    }
}

async function loadResumeHistory(page = resumeHistoryPage) {
    try {
        const notice = document.getElementById('reports-notice');
        const list = document.getElementById('resume-history-list');
        const pageInfo = document.getElementById('resume-page-info');
        if (!auth.isAuthenticated()) {
            if (notice) notice.textContent = '请先登录后查看与保存报告。';
            return;
        }
        const supabase = window.Auth?.getClient?.();
        if (!supabase) throw new Error('Supabase 客户端未初始化');
        const user = await auth.getCurrentUser();
        if (!user?.id) throw new Error('未获取到用户信息');

        const from = (page - 1) * HISTORY_PAGE_SIZE;
        const to = from + HISTORY_PAGE_SIZE - 1;
        const { data, error, count } = await supabase
            .from('reports')
            .select('id, created_at, title, type, resume_analysis_id, interview_analysis_id', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('type', 'resume')
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) throw error;
        const totalPages = Math.max(1, Math.ceil((count || 0) / HISTORY_PAGE_SIZE));
        resumeHistoryPage = Math.max(1, Math.min(page, totalPages));
        if (pageInfo) pageInfo.textContent = `第 ${resumeHistoryPage} / ${totalPages} 页`;

        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = '<p>暂无简历分析记录。</p>';
            return;
        }
        list.innerHTML = data.map(item => {
            const created = new Date(item.created_at).toLocaleString();
            const title = item.title || '简历分析报告';
            const analysisId = item.resume_analysis_id || '-';
            return `
                <div class="report-item">
                    <h4>简历 · ${created}</h4>
                    <p><small>标题：${escapeHtml(title)}</small></p>
                    <p><small>分析ID：${escapeHtml(analysisId)}</small></p>
                    <div class="result-actions" style="margin-top:0.5rem">
                        <a class="btn-primary" href="resume-history.html" target="_blank">在历史页查看</a>
                        <button class="btn-secondary" onclick='copyText(${JSON.stringify({text:item.resume_analysis_id || item.id}).replace(/"/g, "&quot;")})'>复制ID</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('加载简历历史失败:', err);
        showToast('加载简历历史失败：' + (err.message || '未知错误'));
    }
}

async function loadInterviewHistory(page = interviewHistoryPage) {
    try {
        const notice = document.getElementById('reports-notice');
        const list = document.getElementById('interview-history-list');
        const pageInfo = document.getElementById('interview-page-info');
        if (!auth.isAuthenticated()) {
            if (notice) notice.textContent = '请先登录后查看与保存报告。';
            return;
        }
        const supabase = window.Auth?.getClient?.();
        if (!supabase) throw new Error('Supabase 客户端未初始化');
        const user = await auth.getCurrentUser();
        if (!user?.id) throw new Error('未获取到用户信息');

        const from = (page - 1) * HISTORY_PAGE_SIZE;
        const to = from + HISTORY_PAGE_SIZE - 1;
        const { data, error, count } = await supabase
            .from('reports')
            .select('id, created_at, title, type, resume_analysis_id, interview_analysis_id', { count: 'exact' })
            .eq('user_id', user.id)
            .eq('type', 'interview')
            .order('created_at', { ascending: false })
            .range(from, to);
        if (error) throw error;
        const totalPages = Math.max(1, Math.ceil((count || 0) / HISTORY_PAGE_SIZE));
        interviewHistoryPage = Math.max(1, Math.min(page, totalPages));
        if (pageInfo) pageInfo.textContent = `第 ${interviewHistoryPage} / ${totalPages} 页`;

        if (!list) return;
        if (!data || data.length === 0) {
            list.innerHTML = '<p>暂无面试分析记录。</p>';
            return;
        }
        list.innerHTML = data.map(item => {
            const created = new Date(item.created_at).toLocaleString();
            const title = item.title || '面试分析报告';
            const analysisId = item.interview_analysis_id || '-';
            return `
                <div class="report-item">
                    <h4>面试 · ${created}</h4>
                    <p><small>标题：${escapeHtml(title)}</small></p>
                    <p><small>分析ID：${escapeHtml(analysisId)}</small></p>
                    <div class="result-actions" style="margin-top:0.5rem">
                        <a class="btn-primary" href="interview-history.html" target="_blank">在历史页查看</a>
                        <button class="btn-secondary" onclick='copyText(${JSON.stringify({text:item.interview_analysis_id || item.id}).replace(/"/g, "&quot;")})'>复制ID</button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (err) {
        console.error('加载面试历史失败:', err);
        showToast('加载面试历史失败：' + (err.message || '未知错误'));
    }
}

function changeResumePage(delta) {
    const next = Math.max(1, resumeHistoryPage + delta);
    loadResumeHistory(next);
}

function changeInterviewPage(delta) {
    const next = Math.max(1, interviewHistoryPage + delta);
    loadInterviewHistory(next);
}

function downloadSavedMarkdown(meta) {
    try {
        const item = (window._savedReportsCache || []).find(r => r.id === meta.id);
        if (!item) { showToast('未找到报告内容'); return; }
        const blob = new Blob([item.markdown_output || ''], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${item.id}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('报告下载成功', 'success');
    } catch (err) {
        showToast('下载失败：' + err.message);
    }
}

function viewSavedMarkdown(meta) {
    const item = (window._savedReportsCache || []).find(r => r.id === meta.id);
    if (!item) { showToast('未找到报告内容'); return; }
    // 在“我的报告”模块中以 Markdown 渲染内容
    const container = document.getElementById('reports-list');
    if (container) {
        container.innerHTML = `<h3>报告内容</h3><div class="markdown-content">${DOMPurify.sanitize(marked.parse(item.markdown_output || ''))}</div>`;
    }
}

function downloadSavedDocx(meta) {
    try {
        if (!window.htmlDocx || !window.htmlDocx.asBlob) {
            showToast('Word导出组件未加载，已回退为Markdown下载');
            return downloadSavedMarkdown(meta);
        }
        const item = (window._savedReportsCache || []).find(r => r.id === meta.id);
        if (!item) { showToast('未找到报告内容'); return; }
        const title = item.report_type === 'resume' ? '简历分析报告' : '面试分析报告';
        const html = buildReportHTML(title, item.markdown_output || '', item.debug_url || '');
        const blob = window.htmlDocx.asBlob(html, { orientation: 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report_${item.id}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        showToast('导出Word失败：' + err.message);
    }
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
}

// 复制文本到剪贴板（用于复制分析记录ID等）
function copyText(meta) {
    try {
        const text = typeof meta === 'string' ? meta : (meta?.text || '');
        if (!text) {
            showToast('没有可复制的内容');
            return;
        }
        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => showToast('已复制到剪贴板'))
                .catch(err => {
                    console.warn('Clipboard 写入失败，回退到选择复制:', err);
                    fallbackCopyText(text);
                });
        } else {
            fallbackCopyText(text);
        }
    } catch (e) {
        console.error('复制失败:', e);
        showToast('复制失败：' + (e.message || '未知错误'));
    }
}

function fallbackCopyText(text) {
    try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('已复制到剪贴板');
    } catch (err) {
        showToast('复制失败，请手动选择文本复制');
    }
}

// 重新分析简历
function resetResumeAnalysis() {
    document.getElementById('resume-result').style.display = 'none';
    document.getElementById('analyze-resume-btn').disabled = false;
}

// 重新分析面试
function resetInterviewAnalysis() {
    document.getElementById('interview-result').style.display = 'none';
    document.getElementById('analyze-interview-btn').disabled = false;
}

// 下载结果
function downloadResult(type) {
    const content = type === 'resume' ? resumeMarkdown : interviewMarkdown;
    const debugUrl = type === 'resume' ? resumeDebugUrl : interviewDebugUrl;
    const finalContent = buildReportMarkdown(type === 'resume' ? '简历分析报告' : '面试分析报告', content, debugUrl);
    const filename = type === 'resume' ? 
        `简历分析报告_${new Date().toISOString().split('T')[0]}.md` :
        `面试分析报告_${new Date().toISOString().split('T')[0]}.md`;
    
    const blob = new Blob([finalContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast(currentLanguage === 'zh' ? '报告已下载' : 'Report downloaded', 'success');
}

// 将 Markdown 转为完整 HTML（用于导出到 Word）
function buildReportHTML(title, markdown, debugUrl) {
    const headerMd = buildReportMarkdown(title, markdown, debugUrl);
    const bodyHtml = (window.DOMPurify && window.marked)
        ? window.DOMPurify.sanitize(window.marked.parse(headerMd))
        : (window.marked ? window.marked.parse(headerMd) : `<pre>${escapeHtml(headerMd)}</pre>`);
    const styles = `
        <style>
            body { font-family: 'Segoe UI', Roboto, Arial, 'Microsoft Yahei', sans-serif; line-height: 1.6; }
            h1, h2, h3 { color: #111827; }
            h1 { font-size: 22pt; margin: 0 0 16px 0; }
            h2 { font-size: 18pt; margin: 16px 0 12px; }
            h3 { font-size: 14pt; margin: 12px 0 8px; }
            p, li { font-size: 11pt; color: #374151; }
            ul, ol { margin: 0 0 12px 24px; }
            table { width: 100%; border-collapse: collapse; margin: 12px 0; }
            th, td { border: 1px solid #9ca3af; padding: 6px 8px; font-size: 10.5pt; }
            code, pre { background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 6px; }
            a { color: #2563eb; text-decoration: none; }
        </style>
    `;
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${styles}</head><body>${bodyHtml}</body></html>`;
}

// 下载结果（Word .docx 格式）
function downloadResultDocx(type) {
    try {
        if (!window.htmlDocx || !window.htmlDocx.asBlob) {
            // 库未加载时回退为Markdown下载
            showToast('Word导出组件未加载，已回退为Markdown下载');
            return downloadResult(type);
        }
        const content = type === 'resume' ? resumeMarkdown : interviewMarkdown;
        if (!content) {
            return showToast('尚未生成报告，无法下载');
        }
        const debugUrl = type === 'resume' ? resumeDebugUrl : interviewDebugUrl;
        const title = type === 'resume' ? '简历分析报告' : '面试分析报告';
        const html = buildReportHTML(title, content, debugUrl);
        const blob = window.htmlDocx.asBlob(html, { orientation: 'portrait', margins: { top: 720, right: 720, bottom: 720, left: 720 } });
        const filename = `${title}_${new Date().toISOString().split('T')[0]}.docx`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Word文档已下载', 'success');
    } catch (err) {
        console.error('导出Word失败:', err);
        showToast('导出Word失败：' + err.message);
    }
}

// 显示加载动画
function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

// 隐藏加载动画
function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}



// 文件转换为Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = error => reject(error);
    });
}

// ===== Markdown 渲染与数据提取工具函数 =====
function renderMarkdown(markdown, element) {
    if (!element) return;
    try {
        if (window.marked) {
            window.marked.setOptions({
                gfm: true,
                breaks: true
            });
            const html = window.DOMPurify ? window.DOMPurify.sanitize(window.marked.parse(markdown || '')) : window.marked.parse(markdown || '');
            element.innerHTML = html;
        } else {
            element.textContent = markdown || '';
        }
    } catch (e) {
        console.error('Markdown 渲染失败:', e);
        element.textContent = markdown || '';
    }
}

function buildReportMarkdown(title, content, debugUrl) {
    const header = `# ${title}\n\n- 日期：${new Date().toLocaleString('zh-CN')}\n` + (debugUrl ? `- 调试链接：[查看运行记录](${debugUrl})\n` : '') + '\n';
    return header + (content || '（无内容）');
}

function extractMarkdownFromResult(result, type) {
    if (!result) return '';
    let data = result.data;
    try {
        // 如果是字符串尝试JSON解析
        if (typeof data === 'string') {
            try {
                const parsed = JSON.parse(data);
                data = parsed;
            } catch (_) {
                // 直接返回字符串（可能已经是Markdown）
                return data;
            }
        }
        // 对象结构：优先取 output_list 或 output
        if (data && typeof data === 'object') {
            if (Array.isArray(data.output_list)) {
                return data.output_list.join('\n\n');
            }
            if (typeof data.output === 'string') {
                return data.output;
            }
        }
        // 兜底：格式化显示对象
        return '```\n' + JSON.stringify(data, null, 2) + '\n```';
    } catch (e) {
        console.error('提取Markdown失败:', e);
        return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    }
}

// ==================== 登录模态框控制 ====================

// 显示登录模态框
function showAuthModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'flex';
        // 默认显示登录标签
        showLoginTab();
    }
}

// 隐藏登录模态框
function hideAuthModal() {
    const modal = document.getElementById('login-modal');
    if (modal) {
        modal.style.display = 'none';
        // 清除表单数据
        clearAuthForms();
    }
}

// 显示登录标签
function showLoginTab() {
    switchAuthTab('login');
}

// 显示注册标签
function showRegisterTab() {
    switchAuthTab('register');
}

// 清除表单数据
function clearAuthForms() {
    // 清除登录表单
    const loginEmail = document.getElementById('modal-login-email');
    const loginPassword = document.getElementById('modal-login-password');
    const rememberMe = document.getElementById('modal-remember-me');
    
    if (loginEmail) loginEmail.value = '';
    if (loginPassword) loginPassword.value = '';
    if (rememberMe) rememberMe.checked = false;
    
    // 清除注册表单
    const registerName = document.getElementById('modal-register-name');
    const registerEmail = document.getElementById('modal-register-email');
    const registerPassword = document.getElementById('modal-register-password');
    const registerConfirm = document.getElementById('modal-register-confirm');
    
    if (registerName) registerName.value = '';
    if (registerEmail) registerEmail.value = '';
    if (registerPassword) registerPassword.value = '';
    if (registerConfirm) registerConfirm.value = '';
    
    const agreeTerms = document.getElementById('modal-agree-terms');
    if (agreeTerms) agreeTerms.checked = false;
    
    // 清除错误消息
    hideAuthMessages();
}

// 显示错误消息
function showAuthError(message) {
    const errorElement = document.getElementById('modal-login-error');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
    hideAuthSuccess();
}

// 显示成功消息
function showAuthSuccess(message) {
    const successElement = document.getElementById('modal-login-success');
    if (successElement) {
        successElement.textContent = message;
        successElement.style.display = 'block';
    }
    hideAuthError();
}

// 隐藏错误消息
function hideAuthError() {
    const errorElement = document.getElementById('modal-login-error');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// 隐藏成功消息
function hideAuthSuccess() {
    const successElement = document.getElementById('modal-login-success');
    if (successElement) {
        successElement.style.display = 'none';
    }
}

// 隐藏所有消息
function hideAuthMessages() {
    hideAuthError();
    hideAuthSuccess();
}

// 处理登录表单提交
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('modal-login-email').value.trim();
    const password = document.getElementById('modal-login-password').value;
    const rememberMe = document.getElementById('modal-remember-me').checked;
    
    // 基本验证
    if (!email || !password) {
        showAuthError('请填写邮箱和密码');
        return;
    }
    
    if (!isValidEmail(email)) {
        showAuthError('请输入有效的邮箱地址');
        return;
    }
    
    // 显示加载状态
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.innerHTML = '<span class="loading-spinner"></span>登录中...';
    submitButton.disabled = true;
    
    hideAuthMessages();
    
    try {
        // 应用“记住我”设置，确保持久化配置即时生效
        if (window.Auth && typeof window.Auth.setRememberMe === 'function') {
            window.Auth.setRememberMe(rememberMe);
        }
        // 调用登录API
        const result = await auth.signIn(email, password);
        
        if (result.success) {
            showAuthSuccess('登录成功！');
            
            // 延迟关闭模态框并刷新页面状态
            setTimeout(() => {
                hideAuthModal();
                // 更新导航栏状态
                updateNavigation();
                // 检查是否需要返回分析页面
                checkReturnToAnalysis();
            }, 1000);
        } else {
            showAuthError(result.error || '登录失败，请检查邮箱和密码');
        }
    } catch (error) {
        console.error('登录错误:', error);
        showAuthError('登录失败，请稍后重试');
    } finally {
        // 恢复按钮状态
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// 处理注册表单提交
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const agreeTerms = document.getElementById('agreeTerms').checked;
    
    // 基本验证
    if (!name || !email || !password || !confirmPassword) {
        showAuthError('请填写所有必填字段');
        return;
    }
    
    if (!isValidEmail(email)) {
        showAuthError('请输入有效的邮箱地址');
        return;
    }
    
    if (password.length < 6) {
        showAuthError('密码长度至少为6位');
        return;
    }
    
    if (password !== confirmPassword) {
        showAuthError('两次输入的密码不一致');
        return;
    }
    
    if (!agreeTerms) {
        showAuthError('请同意用户协议和隐私政策');
        return;
    }
    
    // 显示加载状态
    const submitButton = event.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.innerHTML = '<span class="loading-spinner"></span>注册中...';
    submitButton.disabled = true;
    
    hideAuthMessages();
    
    try {
        // 调用注册API
        const result = await auth.signUp(email, password, { name });
        
        if (result.success) {
            showAuthSuccess('注册成功！请检查邮箱验证链接');
            
            // 延迟切换到登录标签
            setTimeout(() => {
                showLoginTab();
                document.getElementById('loginEmail').value = email;
            }, 2000);
        } else {
            showAuthError(result.error || '注册失败，请稍后重试');
        }
    } catch (error) {
        console.error('注册错误:', error);
        showAuthError('注册失败，请稍后重试');
    } finally {
        // 恢复按钮状态
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }
}

// 邮箱格式验证
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 标签切换函数
function switchAuthTab(tabName) {
    const loginTab = document.getElementById('modal-login-tab');
    const registerTab = document.getElementById('modal-register-tab');
    const tabButtons = document.querySelectorAll('.tab-button');
    
    // 移除所有活动状态
    tabButtons.forEach(btn => btn.classList.remove('active'));
    loginTab.classList.remove('active');
    registerTab.classList.remove('active');
    
    if (tabName === 'login') {
        loginTab.classList.add('active');
        tabButtons[0].classList.add('active');
    } else if (tabName === 'register') {
        registerTab.classList.add('active');
        tabButtons[1].classList.add('active');
    }
}

// 关闭登录模态框
function closeLoginModal() {
    hideAuthModal();
}

// 暴露函数到全局作用域，供HTML onclick事件使用
window.showHome = showHome;
window.showResumeAnalysis = showResumeAnalysis;
window.showInterviewAnalysis = showInterviewAnalysis;
window.showAuthModal = showAuthModal;
window.showModalForgotPassword = showModalForgotPassword;
window.handleLogout = handleLogout;
window.analyzeResume = analyzeResume;
window.analyzeInterview = analyzeInterview;
window.resetResumeAnalysis = resetResumeAnalysis;
window.resetInterviewAnalysis = resetInterviewAnalysis;
window.saveReportToSupabase = saveReportToSupabase;
window.downloadResult = downloadResult;
window.downloadResultDocx = downloadResultDocx;
window.switchAuthTab = switchAuthTab;
window.closeLoginModal = closeLoginModal;
window.closeResetModal = closeResetModal;
window.handlePasswordUpdate = handlePasswordUpdate;
window.showMyReports = showMyReports;
window.switchReportsTab = switchReportsTab;
window.loadResumeHistory = loadResumeHistory;
window.loadInterviewHistory = loadInterviewHistory;
window.changeResumePage = changeResumePage;
window.changeInterviewPage = changeInterviewPage;
window.loadMyReports = loadMyReports;
window.fileToBase64 = fileToBase64;
window.copyText = copyText;

// ===== 简历历史记录管理器 =====
class ResumeHistoryManager {
    constructor() {
        this.records = [];
        this.filteredRecords = [];
        this.currentFilter = {
            status: 'all',
            dateRange: 'all',
            search: ''
        };
        this.currentSort = {
            field: 'createdAt',
            order: 'desc'
        };
    }

    async init() {
        await this.loadRecords();
        this.bindEvents();
        this.applyFilters();
        this.updateStats();
    }

    // 从Supabase加载记录
    async loadRecords() {
        try {
            this.showLoading();
            
            if (!auth.isAuthenticated()) {
                this.showError('请先登录后查看历史记录');
                return;
            }

            const user = auth.getCurrentUser();
            if (!user?.id) {
                this.showError('未获取到用户信息');
                return;
            }

            // 暂时使用模拟数据，避免Supabase连接问题
            console.log('使用模拟数据进行演示');
            
            // 生成一些模拟的简历历史记录
            const mockData = [
                {
                    id: 'mock-1',
                    title: '软件工程师简历分析',
                    position: '高级前端开发工程师',
                    created_at: new Date(Date.now() - 86400000).toISOString(), // 1天前
                    status: 'completed',
                    analysis_result: {
                        overall_score: 85,
                        strengths: ['技术栈丰富', '项目经验充足'],
                        improvements: ['需要更多领导经验'],
                        recommendations: ['考虑学习新技术栈']
                    }
                },
                {
                    id: 'mock-2',
                    title: '产品经理简历分析',
                    position: '产品经理',
                    created_at: new Date(Date.now() - 172800000).toISOString(), // 2天前
                    status: 'completed',
                    analysis_result: {
                        overall_score: 78,
                        strengths: ['用户体验理解深入'],
                        improvements: ['数据分析能力需加强'],
                        recommendations: ['学习更多数据分析工具']
                    }
                },
                {
                    id: 'mock-3',
                    title: 'UI设计师简历分析',
                    position: 'UI/UX设计师',
                    created_at: new Date(Date.now() - 259200000).toISOString(), // 3天前
                    status: 'completed',
                    analysis_result: {
                        overall_score: 92,
                        strengths: ['设计理念先进', '作品集丰富'],
                        improvements: ['技术实现能力需提升'],
                        recommendations: ['学习前端基础知识']
                    }
                }
            ];

            this.records = mockData.map(record => ({
                id: record.id,
                fileName: record.title || '简历分析',
                position: record.position || '未指定职位',
                createdAt: record.created_at,
                status: record.status || 'completed',
                score: record.analysis_result?.overall_score || Math.floor(Math.random() * 30) + 70,
                analysis: record.analysis_result || this.generateDefaultAnalysis(),
                tags: record.tags || []
            }));

            this.hideLoading();
            this.renderRecords();
            this.updateStats();
        } catch (error) {
            console.error('加载简历历史记录失败:', error);
            this.showError('加载历史记录失败：' + (error.message || '未知错误'));
        }
    }

    // 生成默认分析结果
    generateDefaultAnalysis() {
        return {
            keywordMatch: Math.floor(Math.random() * 30) + 70,
            experienceMatch: Math.floor(Math.random() * 30) + 70,
            skillMatch: Math.floor(Math.random() * 30) + 70,
            strengths: ['工作经验丰富', '技能匹配度高', '学历背景良好'],
            weaknesses: ['部分技能需要加强', '项目经验可以更丰富'],
            suggestions: ['建议补充相关项目经验', '可以考虑学习新技术栈', '优化简历格式和内容']
        };
    }

    // 绑定事件
    bindEvents() {
        // 筛选器事件
        const statusFilter = document.getElementById('statusFilter');
        if (statusFilter) {
            statusFilter.addEventListener('change', (e) => {
                this.currentFilter.status = e.target.value;
                this.applyFilters();
            });
        }

        const dateFilter = document.getElementById('dateFilter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.currentFilter.dateRange = e.target.value;
                this.applyFilters();
            });
        }

        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.currentFilter.search = e.target.value;
                this.applyFilters();
            });
        }

        // 排序事件
        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                const [field, order] = e.target.value.split('-');
                this.currentSort = { field, order };
                this.applyFilters();
            });
        }

        // 模态框关闭事件
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }

        const closeBtn = document.querySelector('#detailModal .modal-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }
    }

    // 应用筛选和排序
    applyFilters() {
        this.filteredRecords = [...this.records];

        // 状态筛选
        if (this.currentFilter.status !== 'all') {
            this.filteredRecords = this.filteredRecords.filter(record => 
                record.status === this.currentFilter.status
            );
        }

        // 日期筛选
        if (this.currentFilter.dateRange !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (this.currentFilter.dateRange) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
            }

            if (startDate) {
                this.filteredRecords = this.filteredRecords.filter(record => {
                    const recordDate = new Date(record.createdAt);
                    return recordDate >= startDate;
                });
            }
        }

        // 搜索筛选
        if (this.currentFilter.search) {
            const searchTerm = this.currentFilter.search.toLowerCase();
            this.filteredRecords = this.filteredRecords.filter(record => {
                const searchableText = `${record.fileName} ${record.position}`.toLowerCase();
                return searchableText.includes(searchTerm);
            });
        }

        // 排序
        this.filteredRecords.sort((a, b) => {
            let aValue = a[this.currentSort.field];
            let bValue = b[this.currentSort.field];

            if (this.currentSort.field === 'createdAt') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (this.currentSort.order === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        this.renderRecords();
    }

    // 更新统计信息
    updateStats() {
        const totalCount = this.records.length;
        const completedCount = this.records.filter(r => r.status === 'completed').length;
        const avgScore = completedCount > 0 ? 
            Math.round(this.records.filter(r => r.status === 'completed')
                .reduce((sum, r) => sum + r.score, 0) / completedCount) : 0;

        // 更新统计卡片
        const totalElement = document.querySelector('#resume-history-content .stat-card:nth-child(1) .stat-info h3');
        const completedElement = document.querySelector('#resume-history-content .stat-card:nth-child(2) .stat-info h3');
        const avgScoreElement = document.querySelector('#resume-history-content .stat-card:nth-child(3) .stat-info h3');

        if (totalElement) totalElement.textContent = totalCount;
        if (completedElement) completedElement.textContent = completedCount;
        if (avgScoreElement) avgScoreElement.textContent = avgScore;
    }

    // 渲染记录列表
    renderRecords() {
        const container = document.getElementById('resumeRecordsContainer');
        if (!container) return;

        if (this.filteredRecords.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">📄</div>
                    <h3>暂无分析记录</h3>
                    <p>您还没有进行过简历分析，快去分析一份简历吧！</p>
                    <button class="btn btn-primary" onclick="showResumeAnalysis()">开始分析</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredRecords.map(record => `
            <div class="record-item" onclick="window.resumeHistoryManager.viewDetail('${record.id}')">
                <div class="record-header">
                    <div>
                        <h3 class="record-title">${record.fileName}</h3>
                        <div class="record-meta">
                            <span>📋 ${record.position}</span>
                            <span>📅 ${this.formatDate(record.createdAt)}</span>
                        </div>
                    </div>
                    <span class="record-status status-${record.status}">
                        ${this.getStatusText(record.status)}
                    </span>
                </div>
                <div class="record-content">
                    <div class="record-details">
                        <p><strong>分析结果：</strong>${this.getAnalysisSummary(record)}</p>
                        <div class="record-actions">
                            <button class="btn-small btn-view" onclick="event.stopPropagation(); window.resumeHistoryManager.viewDetail('${record.id}')">
                                查看详情
                            </button>
                            <button class="btn-small btn-download" onclick="event.stopPropagation(); window.resumeHistoryManager.downloadReport('${record.id}')">
                                下载报告
                            </button>
                            <button class="btn-small btn-delete" onclick="event.stopPropagation(); window.resumeHistoryManager.deleteRecord('${record.id}')">
                                删除
                            </button>
                        </div>
                    </div>
                    ${record.status === 'completed' ? `<div class="record-score">${record.score}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    // 显示加载状态
    showLoading() {
        const container = document.getElementById('resumeRecordsContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>正在加载历史记录...</p>
                </div>
            `;
        }
    }

    // 隐藏加载状态
    hideLoading() {
        const container = document.getElementById('resumeRecordsContainer');
        if (container && container.querySelector('.loading-state')) {
            container.innerHTML = '';
        }
    }

    // 显示错误信息
    showError(message) {
        const container = document.getElementById('resumeRecordsContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>加载失败</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.resumeHistoryManager.loadRecords()">重新加载</button>
                </div>
            `;
        }
    }

    // 查看详情
    viewDetail(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        const modal = document.getElementById('detailModal');
        const modalBody = document.querySelector('#detailModal .modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="detail-content">
                    <h3>${record.fileName}</h3>
                    <div class="detail-meta">
                        <p><strong>职位：</strong>${record.position}</p>
                        <p><strong>分析时间：</strong>${this.formatDate(record.createdAt)}</p>
                        <p><strong>状态：</strong><span class="record-status status-${record.status}">${this.getStatusText(record.status)}</span></p>
                        ${record.status === 'completed' ? `<p><strong>综合评分：</strong><span style="font-size: 1.5rem; color: var(--primary-blue); font-weight: bold;">${record.score}分</span></p>` : ''}
                    </div>
                    
                    ${record.status === 'completed' ? `
                        <div class="analysis-details">
                            <h4>📊 匹配度分析</h4>
                            <div class="match-scores">
                                <div class="match-item">
                                    <span>关键词匹配度</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.keywordMatch}%"></div>
                                        <span class="progress-text">${record.analysis.keywordMatch}%</span>
                                    </div>
                                </div>
                                <div class="match-item">
                                    <span>经验匹配度</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.experienceMatch}%"></div>
                                        <span class="progress-text">${record.analysis.experienceMatch}%</span>
                                    </div>
                                </div>
                                <div class="match-item">
                                    <span>技能匹配度</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.skillMatch}%"></div>
                                        <span class="progress-text">${record.analysis.skillMatch}%</span>
                                    </div>
                                </div>
                            </div>
                            
                            <h4>✅ 优势分析</h4>
                            <ul>
                                ${record.analysis.strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                            
                            <h4>⚠️ 待改进项</h4>
                            <ul>
                                ${record.analysis.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                            </ul>
                            
                            <h4>💡 优化建议</h4>
                            <ul>
                                ${record.analysis.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                            </ul>
                        </div>
                    ` : record.status === 'processing' ? `
                        <div class="processing-info">
                            <div class="loading-spinner"></div>
                            <p>正在分析中，请稍候...</p>
                        </div>
                    ` : `
                        <div class="error-info">
                            <p>❌ 分析失败，请重新上传简历进行分析</p>
                        </div>
                    `}
                </div>
            `;
        }

        if (modal) {
            modal.style.display = 'flex';
            modal.dataset.recordId = recordId; // 存储记录ID
        }
    }

    // 关闭模态框
    closeModal() {
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 下载报告
    downloadReport(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record || record.status !== 'completed') {
            showToast('只有分析完成的记录才能下载报告', 'warning');
            return;
        }

        // 生成报告内容
        const reportContent = this.generateReportContent(record);
        
        // 创建下载链接
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `简历分析报告_${record.fileName}_${this.formatDate(record.createdAt, 'file')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('报告下载成功', 'success');
    }

    // 生成报告内容
    generateReportContent(record) {
        return `
简历分析报告
=====================================

基本信息：
- 文件名：${record.fileName}
- 目标职位：${record.position}
- 分析时间：${this.formatDate(record.createdAt)}
- 综合评分：${record.score}分

匹配度分析：
- 关键词匹配度：${record.analysis.keywordMatch}%
- 经验匹配度：${record.analysis.experienceMatch}%
- 技能匹配度：${record.analysis.skillMatch}%

优势分析：
${record.analysis.strengths.map(item => `- ${item}`).join('\n')}

待改进项：
${record.analysis.weaknesses.map(item => `- ${item}`).join('\n')}

优化建议：
${record.analysis.suggestions.map(item => `- ${item}`).join('\n')}

=====================================
报告生成时间：${new Date().toLocaleString()}
        `.trim();
    }

    // 删除记录
    async deleteRecord(recordId) {
        if (!confirm('确定要删除这条分析记录吗？删除后无法恢复。')) {
            return;
        }

        try {
            // 从数据库删除
            const supabase = window.Auth?.getClient?.();
            if (supabase) {
                const { error } = await supabase
                    .from('reports')
                    .delete()
                    .eq('id', recordId);
                
                if (error) throw error;
            }

            // 从本地记录中删除
            this.records = this.records.filter(r => r.id !== recordId);
            this.applyFilters();
            this.updateStats();
            
            showToast('记录删除成功', 'success');
        } catch (error) {
            console.error('删除记录失败:', error);
            showToast('删除记录失败：' + (error.message || '未知错误'), 'error');
        }
    }

    // 格式化日期
    formatDate(dateString, format = 'display') {
        const date = new Date(dateString);
        
        if (format === 'file') {
            return date.toISOString().slice(0, 10).replace(/-/g, '');
        }
        
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            completed: '已完成',
            processing: '分析中',
            failed: '失败'
        };
        return statusMap[status] || status;
    }

    // 获取分析摘要
    getAnalysisSummary(record) {
        if (record.status === 'completed') {
            return `综合评分 ${record.score}分，匹配度良好`;
        } else if (record.status === 'processing') {
            return '正在分析中...';
        } else {
            return '分析失败，请重新尝试';
        }
    }
}

// 创建全局简历历史记录管理器实例
window.resumeHistoryManager = new ResumeHistoryManager();

// 面试分析历史记录管理器
class InterviewHistoryManager {
    constructor() {
        this.records = [];
        this.filteredRecords = [];
        this.currentPage = 1;
        this.recordsPerPage = 10;
        this.currentFilter = 'all';
        this.currentSort = 'date-desc';
        this.searchQuery = '';
        this.isLoading = false;
        
        this.init();
    }

    async init() {
        this.bindEvents();
        await this.loadRecords();
        this.renderRecords();
        this.updateStats();
    }

    // 加载历史记录数据
    async loadRecords() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoading();
            
            // 检查用户是否已登录
            const user = window.auth?.getCurrentUser();
            if (!user) {
                this.hideLoading();
                this.records = [];
                this.filteredRecords = [];
                this.updateStats();
                this.showError('请先登录');
                return;
            }
            
            // 暂时使用模拟数据，避免Supabase连接问题
            console.log('使用模拟面试数据进行演示');
            
            // 生成一些模拟的面试历史记录
            const mockData = [
                {
                    id: 'interview-mock-1',
                    sessionName: '前端开发工程师面试分析',
                    position: '前端开发工程师',
                    interviewType: '技术面试',
                    status: 'completed',
                    score: 88,
                    duration: 1800, // 30分钟
                    createdAt: new Date(Date.now() - 86400000).toISOString(), // 1天前
                    analysis: {
                        strengths: ['技术基础扎实', '表达清晰', '思路清楚'],
                        improvements: ['需要更多实战经验', '算法能力需提升'],
                        recommendations: ['多做项目实践', '加强算法学习']
                    },
                    markdownOutput: '# 面试分析报告\n\n## 总体评分：88分\n\n### 优势\n- 技术基础扎实\n- 表达清晰\n- 思路清楚\n\n### 改进建议\n- 需要更多实战经验\n- 算法能力需提升',
                    debugUrl: '',
                    interviewAnalysisId: 'analysis-1'
                },
                {
                    id: 'interview-mock-2',
                    sessionName: '产品经理面试分析',
                    position: '产品经理',
                    interviewType: '综合面试',
                    status: 'completed',
                    score: 82,
                    duration: 2400, // 40分钟
                    createdAt: new Date(Date.now() - 172800000).toISOString(), // 2天前
                    analysis: {
                        strengths: ['产品思维敏锐', '用户体验理解深入'],
                        improvements: ['数据分析能力需加强', '技术理解需提升'],
                        recommendations: ['学习数据分析工具', '了解技术实现原理']
                    },
                    markdownOutput: '# 面试分析报告\n\n## 总体评分：82分\n\n### 优势\n- 产品思维敏锐\n- 用户体验理解深入\n\n### 改进建议\n- 数据分析能力需加强\n- 技术理解需提升',
                    debugUrl: '',
                    interviewAnalysisId: 'analysis-2'
                }
            ];
            
            this.records = mockData.map(record => ({
                id: record.id,
                sessionName: record.sessionName,
                position: record.position,
                interviewType: record.interviewType,
                status: record.status,
                score: record.score,
                duration: record.duration,
                createdAt: record.createdAt,
                analysis: record.analysis,
                markdownOutput: record.markdownOutput,
                debugUrl: record.debugUrl,
                interviewAnalysisId: record.interviewAnalysisId
            }));
            
            this.filteredRecords = [...this.records];
            this.hideLoading();
            this.updateStats();
            this.renderRecords();
            
        } catch (error) {
            console.error('加载历史记录失败:', error);
            this.hideLoading();
            this.showError('加载历史记录失败，请刷新页面重试');
            this.records = [];
            this.filteredRecords = [];
            this.updateStats();
        } finally {
            this.isLoading = false;
        }
    }

    // 生成示例数据
    generateSampleData() {
        const sampleData = [];
        const statuses = ['completed', 'processing', 'failed'];
        const positions = ['前端开发工程师', '后端开发工程师', '产品经理', '数据分析师', 'UI设计师'];
        const interviewTypes = ['技术面试', '行为面试', '综合面试', '终面'];
        
        for (let i = 0; i < 8; i++) {
            const date = new Date();
            date.setDate(date.getDate() - Math.floor(Math.random() * 30));
            
            sampleData.push({
                id: `interview_${Date.now()}_${i}`,
                sessionName: `${positions[Math.floor(Math.random() * positions.length)]}_面试_${i + 1}`,
                position: positions[Math.floor(Math.random() * positions.length)],
                interviewType: interviewTypes[Math.floor(Math.random() * interviewTypes.length)],
                status: statuses[Math.floor(Math.random() * statuses.length)],
                score: Math.floor(Math.random() * 40) + 60, // 60-100分
                duration: Math.floor(Math.random() * 30) + 15, // 15-45分钟
                createdAt: date.toISOString(),
                analysis: {
                    strengths: ['回答逻辑清晰', '技术基础扎实', '沟通表达良好'],
                    weaknesses: ['某些技术点回答不够深入', '紧张情绪影响发挥'],
                    suggestions: ['加强技术深度学习', '多练习面试技巧', '提升自信心'],
                    communicationScore: Math.floor(Math.random() * 30) + 70,
                    technicalScore: Math.floor(Math.random() * 30) + 70,
                    logicScore: Math.floor(Math.random() * 30) + 70,
                    confidenceScore: Math.floor(Math.random() * 30) + 70,
                    keyInsights: [
                        '候选人在技术问题上表现出色',
                        '沟通能力需要进一步提升',
                        '对项目经验描述详细'
                    ]
                }
            });
        }
        
        return sampleData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    // 保存记录到localStorage
    saveRecords() {
        localStorage.setItem('interviewAnalysisHistory', JSON.stringify(this.records));
    }

    // 绑定事件
    bindEvents() {
        // 筛选器事件
        const statusFilter = document.getElementById('interviewStatusFilter');
        const dateFilter = document.getElementById('interviewDateFilter');
        const searchInput = document.getElementById('interviewSearchInput');
        const searchBtn = document.getElementById('interviewSearchBtn');

        if (statusFilter) {
            statusFilter.addEventListener('change', () => {
                this.currentFilter = statusFilter.value;
                this.applyFilters();
            });
        }

        if (dateFilter) {
            dateFilter.addEventListener('change', () => {
                this.currentFilter.dateRange = dateFilter.value;
                this.applyFilters();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value;
                this.applyFilters();
            });
        }

        if (searchBtn) {
            searchBtn.addEventListener('click', () => {
                this.applyFilters();
            });
        }

        // 模态框关闭事件
        const modal = document.getElementById('detailModal');
        const closeBtn = document.querySelector('#detailModal .modal-close');
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.closeModal();
            });
        }

        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeModal();
                }
            });
        }
    }

    // 应用筛选器
    applyFilters() {
        this.filteredRecords = this.records.filter(record => {
            // 状态筛选
            if (this.currentFilter !== 'all' && record.status !== this.currentFilter) {
                return false;
            }

            // 搜索筛选
            if (this.searchQuery) {
                const searchTerm = this.searchQuery.toLowerCase();
                const searchableText = `${record.sessionName} ${record.position} ${record.interviewType}`.toLowerCase();
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }

            return true;
        });

        this.renderRecords();
        this.updateStats();
    }

    // 更新统计信息
    updateStats() {
        const totalCount = this.records.length;
        const completedCount = this.records.filter(r => r.status === 'completed').length;
        const avgScore = completedCount > 0 ? 
            Math.round(this.records.filter(r => r.status === 'completed')
                .reduce((sum, r) => sum + r.score, 0) / completedCount) : 0;

        // 更新统计卡片
        const totalElement = document.querySelector('#interview-history .stat-card:nth-child(1) .stat-info h3');
        const completedElement = document.querySelector('#interview-history .stat-card:nth-child(2) .stat-info h3');
        const avgScoreElement = document.querySelector('#interview-history .stat-card:nth-child(3) .stat-info h3');

        if (totalElement) totalElement.textContent = totalCount;
        if (completedElement) completedElement.textContent = completedCount;
        if (avgScoreElement) avgScoreElement.textContent = avgScore;
    }

    // 渲染记录列表
    renderRecords() {
        const container = document.getElementById('interviewRecordsContainer');
        if (!container) return;

        if (this.filteredRecords.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🎤</div>
                    <h3>暂无面试记录</h3>
                    <p>您还没有进行过面试分析，快去开始一次面试分析吧！</p>
                    <button class="btn btn-primary" onclick="window.showInterviewAnalysis()">开始面试分析</button>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredRecords.map(record => `
            <div class="record-item" onclick="window.interviewHistoryManager.viewDetail('${record.id}')">
                <div class="record-header">
                    <div>
                        <h3 class="record-title">${record.sessionName}</h3>
                        <div class="record-meta">
                            <span>💼 ${record.position}</span>
                            <span>🎯 ${record.interviewType}</span>
                            <span>📅 ${this.formatDate(record.createdAt)}</span>
                        </div>
                    </div>
                    <span class="record-status status-${record.status}">
                        ${this.getStatusText(record.status)}
                    </span>
                </div>
                <div class="record-content">
                    <div class="record-details">
                        <p><strong>分析结果：</strong>${this.getAnalysisSummary(record)}</p>
                        <div class="record-actions">
                            <button class="btn-small btn-view" onclick="event.stopPropagation(); window.interviewHistoryManager.viewDetail('${record.id}')">
                                查看详情
                            </button>
                            <button class="btn-small btn-download" onclick="event.stopPropagation(); window.interviewHistoryManager.downloadReport('${record.id}')">
                                下载报告
                            </button>
                            <button class="btn-small btn-delete" onclick="event.stopPropagation(); window.interviewHistoryManager.deleteRecord('${record.id}')">
                                删除
                            </button>
                        </div>
                    </div>
                    ${record.status === 'completed' ? `<div class="record-score">${record.score}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    // 显示加载状态
    showLoading() {
        const container = document.getElementById('interviewRecordsContainer');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>正在加载历史记录...</p>
                </div>
            `;
        }
    }

    // 隐藏加载状态
    hideLoading() {
        const container = document.getElementById('interviewRecordsContainer');
        if (container && container.querySelector('.loading-state')) {
            container.innerHTML = '';
        }
    }

    // 显示错误信息
    showError(message) {
        const container = document.getElementById('interviewRecordsContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">❌</div>
                    <h3>加载失败</h3>
                    <p>${message}</p>
                    <button class="btn btn-primary" onclick="window.interviewHistoryManager.loadRecords()">重新加载</button>
                </div>
            `;
        }
    }

    // 查看详情
    viewDetail(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record) return;

        const modal = document.getElementById('detailModal');
        const modalBody = document.querySelector('#detailModal .modal-body');
        
        if (modalBody) {
            modalBody.innerHTML = `
                <div class="detail-content">
                    <h3>${record.sessionName}</h3>
                    <div class="detail-meta">
                        <p><strong>职位：</strong>${record.position}</p>
                        <p><strong>面试类型：</strong>${record.interviewType}</p>
                        <p><strong>分析时间：</strong>${this.formatDate(record.createdAt)}</p>
                        <p><strong>状态：</strong><span class="record-status status-${record.status}">${this.getStatusText(record.status)}</span></p>
                        ${record.status === 'completed' ? `<p><strong>综合评分：</strong><span style="font-size: 1.5rem; color: var(--primary-blue); font-weight: bold;">${record.score}分</span></p>` : ''}
                    </div>
                    
                    ${record.status === 'completed' ? `
                        <div class="analysis-details">
                            <h4>📊 能力评估</h4>
                            <div class="match-scores">
                                <div class="match-item">
                                    <span>沟通表达</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.communicationScore}%"></div>
                                        <span class="progress-text">${record.analysis.communicationScore}%</span>
                                    </div>
                                </div>
                                <div class="match-item">
                                    <span>技术能力</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.technicalScore}%"></div>
                                        <span class="progress-text">${record.analysis.technicalScore}%</span>
                                    </div>
                                </div>
                                <div class="match-item">
                                    <span>逻辑思维</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.logicScore}%"></div>
                                        <span class="progress-text">${record.analysis.logicScore}%</span>
                                    </div>
                                </div>
                                <div class="match-item">
                                    <span>自信程度</span>
                                    <div class="progress-bar">
                                        <div class="progress-fill" style="width: ${record.analysis.confidenceScore}%"></div>
                                        <span class="progress-text">${record.analysis.confidenceScore}%</span>
                                    </div>
                                </div>
                            </div>
                            
                            <h4>🔍 关键洞察</h4>
                            <ul>
                                ${record.analysis.keyInsights.map(insight => `<li>${insight}</li>`).join('')}
                            </ul>
                            
                            <h4>✅ 表现优势</h4>
                            <ul>
                                ${record.analysis.strengths.map(strength => `<li>${strength}</li>`).join('')}
                            </ul>
                            
                            <h4>⚠️ 待改进项</h4>
                            <ul>
                                ${record.analysis.weaknesses.map(weakness => `<li>${weakness}</li>`).join('')}
                            </ul>
                            
                            <h4>💡 改进建议</h4>
                            <ul>
                                ${record.analysis.suggestions.map(suggestion => `<li>${suggestion}</li>`).join('')}
                            </ul>
                        </div>
                    ` : record.status === 'processing' ? `
                        <div class="processing-info">
                            <div class="loading-spinner"></div>
                            <p>正在分析中，请稍候...</p>
                        </div>
                    ` : `
                        <div class="error-info">
                            <p>❌ 分析失败，请重新进行面试分析</p>
                        </div>
                    `}
                </div>
            `;
        }

        if (modal) {
            modal.style.display = 'flex';
            modal.dataset.recordId = recordId; // 存储记录ID
        }
    }

    // 关闭模态框
    closeModal() {
        const modal = document.getElementById('detailModal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    // 下载报告
    downloadReport(recordId) {
        const record = this.records.find(r => r.id === recordId);
        if (!record || record.status !== 'completed') {
            showToast('只有分析完成的记录才能下载报告', 'warning');
            return;
        }

        // 生成报告内容
        const reportContent = this.generateReportContent(record);
        
        // 创建下载链接
        const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `面试分析报告_${record.sessionName}_${this.formatDate(record.createdAt, 'file')}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 生成报告内容
    generateReportContent(record) {
        return `
面试分析报告
=====================================

基本信息：
- 面试名称：${record.sessionName}
- 目标职位：${record.position}
- 面试类型：${record.interviewType}
- 分析时间：${this.formatDate(record.createdAt)}
- 综合评分：${record.score}分

能力评估：
- 沟通表达：${record.analysis.communicationScore}%
- 技术能力：${record.analysis.technicalScore}%
- 逻辑思维：${record.analysis.logicScore}%
- 自信程度：${record.analysis.confidenceScore}%

关键洞察：
${record.analysis.keyInsights.map(item => `- ${item}`).join('\n')}

表现优势：
${record.analysis.strengths.map(item => `- ${item}`).join('\n')}

待改进项：
${record.analysis.weaknesses.map(item => `- ${item}`).join('\n')}

改进建议：
${record.analysis.suggestions.map(item => `- ${item}`).join('\n')}

=====================================
报告生成时间：${new Date().toLocaleString()}
        `.trim();
    }

    // 删除记录
    async deleteRecord(recordId) {
        if (!confirm('确定要删除这条面试记录吗？删除后无法恢复。')) {
            return;
        }

        try {
            // 从数据库删除
            const supabase = window.Auth?.getClient?.();
            if (supabase) {
                const { error } = await supabase
                    .from('reports')
                    .delete()
                    .eq('id', recordId);
                
                if (error) {
                    throw error;
                }
            }

            // 从本地数组删除
            this.records = this.records.filter(r => r.id !== recordId);
            this.applyFilters();
            this.updateStats();
            
            showToast('记录删除成功', 'success');
        } catch (error) {
            console.error('删除记录失败:', error);
            showToast('删除记录失败，请重试', 'error');
        }
    }

    // 格式化日期
    formatDate(dateString, format = 'display') {
        const date = new Date(dateString);
        
        if (format === 'file') {
            return date.toISOString().slice(0, 10).replace(/-/g, '');
        }
        
        return date.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    // 获取状态文本
    getStatusText(status) {
        const statusMap = {
            completed: '已完成',
            processing: '分析中',
            failed: '失败'
        };
        return statusMap[status] || status;
    }

    // 获取分析摘要
    getAnalysisSummary(record) {
        if (record.status === 'completed') {
            return `综合评分 ${record.score}分，面试表现${record.score >= 80 ? '优秀' : record.score >= 70 ? '良好' : '一般'}`;
        } else if (record.status === 'processing') {
            return '正在分析中...';
        } else {
            return '分析失败，请重新尝试';
        }
    }
    
    // 格式化时长
    formatDuration(seconds) {
        if (!seconds || seconds === 0) return '0分钟';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        
        if (minutes === 0) {
            return `${remainingSeconds}秒`;
        } else if (remainingSeconds === 0) {
            return `${minutes}分钟`;
        } else {
            return `${minutes}分${remainingSeconds}秒`;
        }
    }

    // 从Markdown内容中提取评分
    extractScoreFromMarkdown(markdown) {
        if (!markdown) return 0;
        
        // 尝试匹配各种评分格式
        const scorePatterns = [
            /综合评分[：:]\s*(\d+)/,
            /总分[：:]\s*(\d+)/,
            /评分[：:]\s*(\d+)/,
            /(\d+)分/,
            /(\d+)%/
        ];
        
        for (const pattern of scorePatterns) {
            const match = markdown.match(pattern);
            if (match) {
                return parseInt(match[1]) || 0;
            }
        }
        
        return 0;
    }

    // 解析Markdown分析内容
    parseMarkdownAnalysis(markdown) {
        if (!markdown) {
            return {
                strengths: [],
                weaknesses: [],
                suggestions: [],
                communicationScore: 0,
                technicalScore: 0,
                logicScore: 0,
                confidenceScore: 0,
                keyInsights: []
            };
        }
        
        const analysis = {
            strengths: this.extractListFromMarkdown(markdown, ['优势', '优点', '表现优秀']),
            weaknesses: this.extractListFromMarkdown(markdown, ['劣势', '缺点', '待改进', '不足']),
            suggestions: this.extractListFromMarkdown(markdown, ['建议', '改进建议', '提升建议']),
            communicationScore: this.extractScoreFromSection(markdown, ['沟通', '表达']),
            technicalScore: this.extractScoreFromSection(markdown, ['技术', '专业']),
            logicScore: this.extractScoreFromSection(markdown, ['逻辑', '思维']),
            confidenceScore: this.extractScoreFromSection(markdown, ['自信', '信心']),
            keyInsights: this.extractListFromMarkdown(markdown, ['洞察', '关键发现', '总结'])
        };
        
        return analysis;
    }

    // 从Markdown中提取列表项
    extractListFromMarkdown(markdown, keywords) {
        const items = [];
        const lines = markdown.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检查是否是相关章节的标题
            const isRelevantSection = keywords.some(keyword => 
                line.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (isRelevantSection) {
                // 查找后续的列表项
                for (let j = i + 1; j < lines.length && j < i + 10; j++) {
                    const nextLine = lines[j].trim();
                    if (nextLine.startsWith('-') || nextLine.startsWith('•') || nextLine.match(/^\d+\./)) {
                        items.push(nextLine.replace(/^[-•\d.]\s*/, ''));
                    } else if (nextLine === '' || nextLine.startsWith('#')) {
                        break;
                    }
                }
            }
        }
        
        return items.length > 0 ? items : ['暂无相关信息'];
    }

    // 从特定章节提取评分
    extractScoreFromSection(markdown, keywords) {
        const lines = markdown.split('\n');
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // 检查是否包含关键词
            const hasKeyword = keywords.some(keyword => 
                line.toLowerCase().includes(keyword.toLowerCase())
            );
            
            if (hasKeyword) {
                // 在当前行和后续几行中查找评分
                for (let j = i; j < lines.length && j < i + 3; j++) {
                    const scoreLine = lines[j];
                    const scoreMatch = scoreLine.match(/(\d+)(?:分|%)/);
                    if (scoreMatch) {
                        return parseInt(scoreMatch[1]) || 0;
                    }
                }
            }
        }
        
        return 0;
    }
    
    // 格式化分析结果
    formatAnalysisResult(cozeResult) {
        if (!cozeResult || typeof cozeResult !== 'object') return null;
        
        return {
            strengths: cozeResult.strengths || [],
            weaknesses: cozeResult.weaknesses || [],
            suggestions: cozeResult.suggestions || [],
            summary: cozeResult.summary || '',
            communicationScore: cozeResult.communicationScore || null,
            technicalScore: cozeResult.technicalScore || null,
            overallScore: cozeResult.overallScore || null
        };
    }
    
    // 显示加载状态
    showLoadingState() {
        const container = document.querySelector('.records-container');
        if (container) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-spinner"></div>
                    <p>正在加载历史记录...</p>
                </div>
            `;
        }
    }
    
    // 隐藏加载状态
    hideLoadingState() {
        const loadingState = document.querySelector('.loading-state');
        if (loadingState) {
            loadingState.remove();
        }
    }
    
    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动关闭
        setTimeout(() => {
            notification.remove();
        }, 5000);
        
        // 点击关闭
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
    }
}

// 创建全局面试历史记录管理器实例
window.interviewHistoryManager = new InterviewHistoryManager();

// 全局函数：关闭详情模态框
window.closeDetailModal = function() {
    const modal = document.getElementById('detailModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// 全局函数：下载报告
window.downloadReport = function() {
    const modal = document.getElementById('detailModal');
    const recordId = modal ? modal.dataset.recordId : null;
    
    if (!recordId) {
        showToast('无法获取记录信息', 'error');
        return;
    }
    
    // 根据当前页面确定使用哪个管理器
    if (window.location.pathname.includes('resume-history') && window.resumeHistoryManager) {
        window.resumeHistoryManager.downloadReport(recordId);
    } else if (window.location.pathname.includes('interview-history') && window.interviewHistoryManager) {
        window.interviewHistoryManager.downloadReport(recordId);
    }
};

// 暴露保存的报告相关函数为全局函数
window.downloadSavedMarkdown = downloadSavedMarkdown;
window.viewSavedMarkdown = viewSavedMarkdown;
window.downloadSavedDocx = downloadSavedDocx;

// 删除报告功能
async function deleteReport(reportId, reportTitle) {
    // 显示确认对话框
    const confirmed = confirm(`确定要删除报告"${reportTitle}"吗？\n\n此操作不可撤销。`);
    
    if (!confirmed) {
        return;
    }

    try {
        // 检查用户登录状态
        if (!isLoggedIn) {
            showToast('请先登录', 'error');
            return;
        }

        // 获取当前用户
        const user = auth.getCurrentUser();
        if (!user) {
            showToast('用户信息获取失败', 'error');
            return;
        }

        // 显示删除中的提示
        showToast('正在删除报告...', 'info');

        // 调用删除API
        const response = await fetch('/api/delete-report', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                reportId: reportId,
                userId: user.id
            })
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || '删除失败');
        }

        // 删除成功
        showToast('报告删除成功', 'success');
        
        // 刷新报告列表
        await loadMyReports();

    } catch (error) {
        console.error('删除报告失败:', error);
        showToast('删除报告失败: ' + error.message, 'error');
    }
}

// 批量删除报告功能（可选扩展功能）
async function deleteMultipleReports(reportIds) {
    if (!reportIds || reportIds.length === 0) {
        showToast('请选择要删除的报告', 'warning');
        return;
    }

    const confirmed = confirm(`确定要删除选中的 ${reportIds.length} 个报告吗？\n\n此操作不可撤销。`);
    
    if (!confirmed) {
        return;
    }

    try {
        // 检查用户登录状态
        if (!isLoggedIn) {
            showToast('请先登录', 'error');
            return;
        }

        // 获取当前用户
        const user = auth.getCurrentUser();
        if (!user) {
            showToast('用户信息获取失败', 'error');
            return;
        }

        showToast('正在批量删除报告...', 'info');

        let successCount = 0;
        let failCount = 0;

        // 逐个删除报告
        for (const reportId of reportIds) {
            try {
                const response = await fetch('/api/delete-report', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        reportId: reportId,
                        userId: user.id
                    })
                });

                if (response.ok) {
                    successCount++;
                } else {
                    failCount++;
                }
            } catch (error) {
                console.error(`删除报告 ${reportId} 失败:`, error);
                failCount++;
            }
        }

        // 显示结果
        if (failCount === 0) {
            showToast(`成功删除 ${successCount} 个报告`, 'success');
        } else {
            showToast(`删除完成：成功 ${successCount} 个，失败 ${failCount} 个`, 'warning');
        }
        
        // 刷新报告列表
        await loadMyReports();

    } catch (error) {
        console.error('批量删除报告失败:', error);
        showToast('批量删除失败: ' + error.message, 'error');
    }
}

// 将删除功能暴露到全局
window.deleteReport = deleteReport;
window.deleteMultipleReports = deleteMultipleReports;