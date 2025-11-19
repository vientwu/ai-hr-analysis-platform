// 全局变量
let resumeFile = null;
let interviewFile = null;
// 缓存Markdown内容与调试链接，便于下载与查看
let resumeMarkdown = '';
let interviewMarkdown = '';
let resumeDebugUrl = '';
let interviewDebugUrl = '';
let isLoggedIn = false;
// 我的报告筛选状态
let reportFilters = { starredOnly: false, type: 'all' };
let reportFiltersInitialized = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    // 初始化语言（优先使用 i18n.js）
    if (window.i18n && typeof window.i18n.initializeLanguage === 'function') {
        window.i18n.initializeLanguage();
    }
    // 初始化 Supabase Auth
    if (window.Auth) {
        window.Auth.initialize();
    }
    if (window.location && window.location.hash === '#my-reports') {
        showMyReports();
    }
    const reportCloseBtn = document.getElementById('report-close');
    if (reportCloseBtn) {
        reportCloseBtn.addEventListener('click', closeReportModal);
    }
});

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
    const accountBtn = document.getElementById('account-button');
    const accountDropdown = document.getElementById('account-dropdown');
    if (accountBtn && accountDropdown) {
        accountBtn.addEventListener('click', function() { accountDropdown.classList.toggle('open'); });
        document.addEventListener('click', function(e) {
            if (!accountDropdown.contains(e.target)) { accountDropdown.classList.remove('open'); }
        });
    }
}

// 监听登录状态变化，更新UI
window.addEventListener('auth-changed', (e) => {
    const user = e.detail?.user || null;
    isLoggedIn = !!user;
    updateAuthUI(user);
});

function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const accountDropdown = document.getElementById('account-dropdown');
    const accountEmail = document.getElementById('account-email');
    const notice = document.getElementById('reports-notice');
    if (loginBtn) loginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
    if (accountDropdown) accountDropdown.style.display = isLoggedIn ? 'inline-flex' : 'none';
    if (accountEmail) accountEmail.textContent = user?.email || (user?.user_metadata && user.user_metadata.email) || '已登录';
    if (notice) {
        notice.textContent = isLoggedIn ? '已登录，可查看与保存你的报告。' : '请先登录后查看与保存报告。';
    }
}

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
            fileInput.files = files;
            handler(files[0]);
        }
    });
}

// 拖拽辅助函数
function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e) {
    e.currentTarget.classList.add('dragover');
}

function unhighlight(e) {
    e.currentTarget.classList.remove('dragover');
}

// 字符计数更新
function updateCharCount() {
    const textarea = document.getElementById('job-description');
    const counter = document.getElementById('jd-char-count');
    if (textarea && counter) {
        counter.textContent = textarea.value.length;
    }
}

// 表单验证设置
function setupFormValidation() {
    // 简历分析表单验证
    const resumeFileInput = document.getElementById('resume-file');
    const jdInput = document.getElementById('job-description');
    
    if (resumeFileInput) {
        resumeFileInput.addEventListener('change', validateResumeForm);
    }
    if (jdInput) {
        jdInput.addEventListener('input', validateResumeForm);
    }
    
    // 面试分析表单验证
    const interviewFileInput = document.getElementById('interview-file');
    const nameInput = document.getElementById('interviewee-name');
    
    if (interviewFileInput) {
        interviewFileInput.addEventListener('change', validateInterviewForm);
    }
    if (nameInput) {
        nameInput.addEventListener('input', validateInterviewForm);
    }
}

// 简历分析表单验证
function validateResumeForm() {
    const analyzeBtn = document.getElementById('analyze-resume-btn');
    const hasFile = resumeFile !== null;
    const hasJD = document.getElementById('job-description').value.trim().length > 0;
    
    if (analyzeBtn) {
        analyzeBtn.disabled = !(hasFile && hasJD);
    }
}

// 面试分析表单验证
function validateInterviewForm() {
    const analyzeBtn = document.getElementById('analyze-interview-btn');
    const hasFile = interviewFile !== null;
    const hasName = document.getElementById('interviewee-name').value.trim().length > 0;
    
    if (analyzeBtn) {
        analyzeBtn.disabled = !(hasFile && hasName);
    }
}

// UI导航函数
function showHome() {
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    document.querySelector('.feature-cards').style.display = 'grid';
}

function showResumeAnalysis() {
    document.querySelector('.feature-cards').style.display = 'none';
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    document.getElementById('resume-module').style.display = 'block';
}

function showInterviewAnalysis() {
    document.querySelector('.feature-cards').style.display = 'none';
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    document.getElementById('interview-module').style.display = 'block';
}

function showMyReports() {
    document.querySelector('.feature-cards').style.display = 'none';
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    document.getElementById('my-reports-module').style.display = 'block';
    setupReportFilters();
    // 自动加载报告
    loadMyReports();
}

// 重置函数
function resetResumeAnalysis() {
    // 重置文件
    resumeFile = null;
    document.getElementById('resume-file').value = '';
    document.getElementById('resume-file-info').style.display = 'none';
    
    // 重置JD
    document.getElementById('job-description').value = '';
    updateCharCount();
    
    // 重置结果
    document.getElementById('resume-result').style.display = 'none';
    
    // 重置按钮状态
    validateResumeForm();
}

function resetInterviewAnalysis() {
    // 重置文件
    interviewFile = null;
    document.getElementById('interview-file').value = '';
    document.getElementById('interview-file-info').style.display = 'none';
    
    // 重置姓名
    document.getElementById('interviewee-name').value = '';
    
    // 重置URL
    document.getElementById('recording-url').value = '';
    
    // 重置结果
    document.getElementById('interview-result').style.display = 'none';
    
    // 重置按钮状态
    validateInterviewForm();
}

// 文件处理函数
function handleResumeFile(file) {
    // 验证文件类型
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
    ];
    
    if (!allowedTypes.includes(file.type)) {
        showToast('请上传 PDF、DOC、DOCX 或 TXT 格式的文件', 'error');
        return;
    }
    
    // 验证文件大小 (500MB)
    if (file.size > 500 * 1024 * 1024) {
        showToast('文件大小不能超过 500MB', 'error');
        return;
    }
    
    resumeFile = file;
    showFileInfo('resume-file-info', file);
    validateResumeForm();
}

function handleInterviewFile(file) {
    // 验证文件类型（支持 PDF/DOC/DOCX）
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowedTypes.includes(file.type)) {
        showToast('请上传 PDF、DOC 或 DOCX 格式的文件', 'error');
        return;
    }
    
    // 验证文件大小 (500MB)
    if (file.size > 500 * 1024 * 1024) {
        showToast('文件大小不能超过 500MB', 'error');
        return;
    }
    
    interviewFile = file;
    showFileInfo('interview-file-info', file);
    validateInterviewForm();
}

function showFileInfo(infoId, file) {
    const infoDiv = document.getElementById(infoId);
    if (infoDiv) {
        infoDiv.innerHTML = `
            <div class="file-item">
                <i class="fas fa-file"></i>
                <span class="file-name">${file.name}</span>
                <span class="file-size">${formatFileSize(file.size)}</span>
                <button class="remove-file" onclick="removeFile('${infoId}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        infoDiv.style.display = 'block';
    }
}

function removeFile(infoId) {
    if (infoId === 'resume-file-info') {
        resumeFile = null;
        document.getElementById('resume-file').value = '';
        validateResumeForm();
    } else if (infoId === 'interview-file-info') {
        interviewFile = null;
        document.getElementById('interview-file').value = '';
        validateInterviewForm();
    }
    
    document.getElementById(infoId).style.display = 'none';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 模态框操作
function openLoginModal() {
    document.getElementById('login-modal').style.display = 'flex';
    // 清空之前的错误信息
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.style.display = 'none';
        errorDiv.textContent = '';
    }
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function closeResetModal() {
    document.getElementById('reset-modal').style.display = 'none';
}

function openReportModal(reportId, isLocalDemo = false) {
    try {
        const src = `report.html?report_id=${encodeURIComponent(reportId)}`;
        const frame = document.getElementById('report-frame');
        const modal = document.getElementById('report-modal');
        if (!frame || !modal) { viewSavedReport(reportId, isLocalDemo); return; }
        frame.src = src;
        modal.style.display = 'flex';
    } catch (err) {
        showToast('无法打开报告弹窗', 'error');
    }
}

function closeReportModal() {
    const modal = document.getElementById('report-modal');
    const frame = document.getElementById('report-frame');
    if (modal) modal.style.display = 'none';
    if (frame) frame.src = '';
}

// 认证相关函数
async function handleEmailLogin() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    if (!email || !password) {
        showLoginError('请填写邮箱和密码');
        return;
    }
    
    if (!isValidEmail(email)) {
        showLoginError('请输入有效的邮箱地址');
        return;
    }
    
    if (password.length < 6) {
        showLoginError('密码至少需要6位');
        return;
    }
    
    try {
        if (window.Auth) {
            const result = await window.Auth.signIn(email, password);
            if (result.error) {
                showLoginError(result.error.message || '登录失败，请检查邮箱和密码');
            } else {
                closeLoginModal();
                showToast('登录成功！', 'success');
            }
        } else {
            showLoginError('认证服务未初始化');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('登录失败，请稍后重试');
    }
}

async function handleEmailSignup() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    
    if (!email || !password) {
        showLoginError('请填写邮箱和密码');
        return;
    }
    
    if (!isValidEmail(email)) {
        showLoginError('请输入有效的邮箱地址');
        return;
    }
    
    if (password.length < 6) {
        showLoginError('密码至少需要6位');
        return;
    }
    
    try {
        if (window.Auth) {
            const result = await window.Auth.signUp(email, password);
            if (result.error) {
                showLoginError(result.error.message || '注册失败');
            } else {
                closeLoginModal();
                showToast('注册成功！请检查邮箱验证链接。', 'success');
            }
        } else {
            showLoginError('认证服务未初始化');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showLoginError('注册失败，请稍后重试');
    }
}

async function handleForgotPassword() {
    const email = document.getElementById('login-email').value.trim();
    
    if (!email) {
        showLoginError('请先输入邮箱地址');
        return;
    }
    
    if (!isValidEmail(email)) {
        showLoginError('请输入有效的邮箱地址');
        return;
    }
    
    try {
        if (window.Auth) {
            const result = await window.Auth.resetPassword(email);
            if (result.error) {
                showLoginError(result.error.message || '发送重置邮件失败');
            } else {
                closeLoginModal();
                showToast('密码重置邮件已发送，请检查邮箱', 'success');
            }
        } else {
            showLoginError('认证服务未初始化');
        }
    } catch (error) {
        console.error('Reset password error:', error);
        showLoginError('发送重置邮件失败，请稍后重试');
    }
}

async function handlePasswordUpdate() {
    const newPassword = document.getElementById('reset-password').value;
    const confirmPassword = document.getElementById('reset-password-confirm').value;
    
    if (!newPassword || !confirmPassword) {
        showToast('请填写新密码和确认密码', 'error');
        return;
    }
    
    if (newPassword.length < 6) {
        showToast('密码至少需要6位', 'error');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        showToast('两次输入的密码不一致', 'error');
        return;
    }
    
    try {
        if (window.Auth) {
            const result = await window.Auth.updatePassword(newPassword);
            if (result.error) {
                showToast(result.error.message || '密码更新失败', 'error');
            } else {
                closeResetModal();
                showToast('密码更新成功！', 'success');
            }
        } else {
            showToast('认证服务未初始化', 'error');
        }
    } catch (error) {
        console.error('Update password error:', error);
        showToast('密码更新失败，请稍后重试', 'error');
    }
}

async function handleLogout() {
    try {
        if (window.Auth) {
            await window.Auth.signOut();
            showToast('已退出登录', 'success');
        }
    } catch (error) {
        console.error('Logout error:', error);
        showToast('退出登录失败', 'error');
    }
}

function showLoginError(message) {
    const errorDiv = document.getElementById('login-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// 分析函数
async function analyzeResume() {
    if (!resumeFile) {
        showToast('请先上传简历文件', 'error');
        return;
    }
    
    const jobDescription = document.getElementById('job-description').value.trim();
    if (!jobDescription) {
        showToast('请输入岗位职责描述', 'error');
        return;
    }
    
    const analyzeBtn = document.getElementById('analyze-resume-btn');
    const spinner = analyzeBtn.querySelector('.fa-spin');
    const btnText = analyzeBtn.querySelector('span');
    
    try {
        // 显示加载状态
        showLoading();
        analyzeBtn.disabled = true;
        spinner.style.display = 'inline-block';
        const t = window.i18n?.t || (k => k);
        btnText.textContent = t('analyzing');
        
        // 通过封装的 API 调用后端（统一字段：fileName、fileBase64、jd）
        const result = await window.API.callResumeAnalysisAPI(resumeFile, jobDescription);
        // 显示结果
        displayResumeResult(result);
        
    } catch (error) {
        console.error('Resume analysis error:', error);
        showToast(error.message || '分析失败，请稍后重试', 'error');
    } finally {
        // 恢复按钮状态
        hideLoading();
        analyzeBtn.disabled = false;
        spinner.style.display = 'none';
        const t = window.i18n?.t || (k => k);
        btnText.textContent = t('analyze-resume-btn');
    }
}

async function analyzeInterview() {
    if (!interviewFile) {
        showToast('请先上传面试转写文档（PDF/DOC/DOCX）', 'error');
        return;
    }
    
    const intervieweeName = document.getElementById('interviewee-name').value.trim();
    if (!intervieweeName) {
        showToast('请输入面试者姓名', 'error');
        return;
    }
    
    const recordingUrl = document.getElementById('recording-url').value.trim();
    const analyzeBtn = document.getElementById('analyze-interview-btn');
    const spinner = analyzeBtn.querySelector('.fa-spin');
    const btnText = analyzeBtn.querySelector('span');
    
    try {
        // 显示加载状态
        showLoading();
        analyzeBtn.disabled = true;
        spinner.style.display = 'inline-block';
        const t = window.i18n?.t || (k => k);
        btnText.textContent = t('analyzing');
        
        // 通过封装的 API 调用后端（统一字段：fileName、fileBase64、name、recordingUrl）
        const result = await window.API.callInterviewAnalysisAPI(interviewFile, intervieweeName, recordingUrl);
        // 显示结果
        displayInterviewResult(result);
        
    } catch (error) {
        console.error('Interview analysis error:', error);
        showToast(error.message || '分析失败，请稍后重试', 'error');
    } finally {
        // 恢复按钮状态
        hideLoading();
        analyzeBtn.disabled = false;
        spinner.style.display = 'none';
        const t = window.i18n?.t || (k => k);
        btnText.textContent = t('analyze-interview-btn');
    }
}

// 结果显示函数
function displayResumeResult(result) {
    const resultSection = document.getElementById('resume-result');
    const resultContent = document.getElementById('resume-result-content');
    
    const payload = result?.data ?? result?.result ?? result;
    if (payload) {
        // 提取并缓存Markdown内容（兼容 {success, data} 响应结构）
        resumeMarkdown = extractMarkdownFromResult(payload);
        
        // 渲染Markdown
        resultContent.innerHTML = renderMarkdown(resumeMarkdown);
        // 应用样式与表格包装
        enhanceReportContainer(resultContent, 'resume');
        resultSection.style.display = 'block';
        
        // 滚动到结果区域
        resultSection.scrollIntoView({ behavior: 'smooth' });
        
        showToast('简历分析完成！', 'success');
    } else {
        showToast('分析结果为空', 'error');
    }
}

function displayInterviewResult(result) {
    const resultSection = document.getElementById('interview-result');
    const resultContent = document.getElementById('interview-result-content');
    
    const payload = result?.data ?? result?.result ?? result;
    if (payload) {
        // 提取并缓存Markdown内容（兼容 {success, data} 响应结构）
        interviewMarkdown = extractMarkdownFromResult(payload);
        
        // 渲染Markdown
        resultContent.innerHTML = renderMarkdown(interviewMarkdown);
        // 应用样式与表格包装
        enhanceReportContainer(resultContent, 'interview');
        resultSection.style.display = 'block';
        
        // 滚动到结果区域
        resultSection.scrollIntoView({ behavior: 'smooth' });
        
        showToast('面试分析完成！', 'success');
    } else {
        showToast('分析结果为空', 'error');
    }
}

// 保存报告到Supabase
async function saveReportToSupabase(type) {
    if (!isLoggedIn) {
        showToast('请先登录后保存报告', 'error');
        openLoginModal();
        return;
    }
    
    let markdown = '';
    let title = '';
    let summary = { candidate_name: '', job_title: '', match_score: null };
    
    if (type === 'resume') {
        if (!resumeMarkdown) {
            showToast('没有可保存的简历分析结果', 'error');
            return;
        }
        markdown = resumeMarkdown;
        // 从报告中提取摘要信息（姓名、岗位、匹配度）
        summary = extractSummaryFieldsFromMarkdown(markdown);
        // 统一卡片标题：候选人姓名（若缺失用“未命名候选人”）
        const nameForTitle = summary.candidate_name || '未命名候选人';
        title = `${nameForTitle}`;
    } else if (type === 'interview') {
        if (!interviewMarkdown) {
            showToast('没有可保存的面试分析结果', 'error');
            return;
        }
        markdown = interviewMarkdown;
        // 面试分析也基于报告提取摘要信息
        summary = extractSummaryFieldsFromMarkdown(markdown);
        // 若用户在表单中填写了面试者姓名，优先作为候选人姓名
        const intervieweeName = document.getElementById('interviewee-name')?.value?.trim();
        if (intervieweeName) summary.candidate_name = summary.candidate_name || intervieweeName;
        const nameForTitle = summary.candidate_name || '未命名候选人';
        title = `${nameForTitle}`;
    }
    
    try {
        if (window.Auth && window.Auth.supabase) {
            const user = await window.Auth.getCurrentUser();
            if (!user) {
                showToast('用户未登录', 'error');
                return;
            }
            const base = {
                user_id: user.id,
                title: title,
                report_type: type,
                content: markdown,
                markdown_output: markdown,
                created_at: new Date().toISOString()
            };
            const payload = {
                ...base,
                candidate_name: summary.candidate_name || null,
                job_title: summary.job_title || null,
                match_score: summary.match_score
            };
            const resp1 = await window.Auth.supabase
                .from('reports')
                .insert([payload]);
            let error = resp1.error;
            if (error) {
                const resp2 = await window.Auth.supabase
                    .from('reports')
                    .insert([base]);
                error = resp2.error;
            }
            if (error) {
                console.error('Save report error:', error);
                showToast('保存报告失败：' + (error.message || '未知错误'), 'error');
            } else {
                showToast('报告已保存到我的报告！', 'success');
            }
        } else {
            // 本地演示模式：保存到 localStorage，确保未配置 Supabase 时仍可用
            const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
            if (!user) {
                showToast('用户未登录', 'error');
                return;
            }
            const key = `demo_reports_${user.id}`;
            let items = [];
            try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
            const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `demo-${Date.now()}`;
            const created_at = new Date().toISOString();
            const record = { id, user_id: user.id, title, type, report_type: type, content: markdown, markdown_output: markdown, created_at, candidate_name: summary.candidate_name || null, job_title: summary.job_title || null, match_score: summary.match_score };
            items.unshift(record);
            try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
            showToast('已保存到本地“我的报告”（演示模式）', 'success');
        }
    } catch (error) {
        console.error('Save report error:', error);
        showToast('保存报告失败，请稍后重试', 'error');
    }
}

// 加载我的报告
async function loadMyReports() {
    if (!isLoggedIn) {
        const reportsList = document.getElementById('reports-list');
        if (reportsList) {
            reportsList.innerHTML = '<p class="notice">请先登录后查看报告。</p>';
        }
        return;
    }
    
    try {
        if (window.Auth && window.Auth.supabase) {
            const user = await window.Auth.getCurrentUser();
            if (!user) {
                showToast('用户未登录', 'error');
                return;
            }
            
            let reports = null;
            let error = null;
            {
                const resp = await window.Auth.supabase
                    .from('reports')
                    .select('id,title,type,report_type,created_at,candidate_name,job_title,match_score,is_starred')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                reports = resp.data; error = resp.error;
            }
            if (error && (String(error.code) === '42703' || /column .* does not exist/i.test(error.message || ''))) {
                const resp2 = await window.Auth.supabase
                    .from('reports')
                    .select('*')
                    .eq('user_id', user.id)
                    .order('created_at', { ascending: false });
                reports = resp2.data; error = resp2.error;
            }
            
            if (error) {
                console.warn('云端加载失败，采用降级渲染：', error.message);
                reports = reports || [];
            }
            
            const reportsList = document.getElementById('reports-list');
            if (reportsList) {
                if (reports && reports.length > 0) {
                    // 先应用筛选与排序（星标优先，其次创建时间）
                    const starMap = (getStarMap(user.id) ?? {});
                    const merged = (reports || []).map(r => {
                        const rid = String(r.id);
                        if (starMap && starMap[rid]) return { ...r, is_starred: true };
                        return r;
                    });
                    const processed = applyFiltersAndSort(merged, starMap, false);
                    reportsList.innerHTML = processed.map(report => {
                        const md = report.content ?? report.markdown_output ?? '';
                        const parsed = extractSummaryFieldsFromMarkdown(md);
                        const candidate = report.candidate_name ?? parsed.candidate_name ?? '';
                        const job = report.job_title ?? parsed.job_title ?? '未知岗位';
                        const scoreVal = (report.match_score ?? parsed.match_score);
                        const scoreText = (scoreVal || scoreVal === 0) ? `${Math.round(Number(scoreVal))}%` : '未知';
                        const reportTypeText = (report.type ?? report.report_type) === 'resume' ? '简历分析' : '面试分析';
                        const safeTitle = candidate || report.title || '未命名候选人';
                        const isStarred = (report.is_starred === true) || Boolean(starMap[report.id]);
                        return `
                        <div class="report-item ${isStarred ? 'report-card-starred' : ''}">
                            <div class="report-header">
                                <h4>${escapeHtml(safeTitle)}</h4>
                                <div class="report-header-actions">
                                    <span class="report-type">${reportTypeText}</span>
                                    <button class="btn-secondary icon-only ${isStarred ? 'starred' : ''}" title="${isStarred ? '取消星标' : '设为星标'}" onclick="toggleStarReport('${report.id}', false, this)">
                                        <svg class="star-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M12 17.27L18.18 21 16.54 13.96 22 9.24 14.82 8.63 12 2 9.18 8.63 2 9.24 7.46 13.96 5.82 21z" />
                                        </svg>
                                    </button>
                                    <button class="btn-secondary icon-only btn-danger" title="删除报告" onclick="deleteReport('${report.id}', false)">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M3 6h18" />
                                            <path d="M8 6v-2h8v2" />
                                            <path d="M19 6l-1 14H6L5 6" />
                                            <path d="M10 11v6" />
                                            <path d="M14 11v6" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div class="report-meta">
                                <span class="report-date">${new Date(report.created_at).toLocaleString()}</span>
                                <span class="report-summary">岗位：${escapeHtml(job)}｜匹配度：${escapeHtml(scoreText)}</span>
                            </div>
                            <div class="report-actions">
                                <div class="dropdown">
                                    <button class="btn-secondary icon-only" title="下载" onclick="(function(btn){const root=btn.parentElement;root.classList.toggle('open');})(this)">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="9" />
                                            <text x="12" y="13" text-anchor="middle" dominant-baseline="middle" font-size="14" font-weight="700" fill="currentColor">↓</text>
                                        </svg>
                                    </button>
                                    <div class="dropdown-menu">
                                        <button class="dropdown-item" onclick="downloadSavedMarkdownById('${report.id}', '${escapeHtml(safeTitle)}'); this.closest('.dropdown').classList.remove('open')">
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                                                <text x="12" y="14" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" fill="currentColor">MD</text>
                                            </svg>
                                            Markdown
                                        </button>
                                        <button class="dropdown-item" onclick="downloadSavedDocxById('${report.id}', '${escapeHtml(safeTitle)}'); this.closest('.dropdown').classList.remove('open')">
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                                                <text x="12" y="14" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" fill="currentColor">DOC</text>
                                            </svg>
                                            Word
                                        </button>
                                        <button class="dropdown-item" onclick="downloadSavedPdfById('${report.id}', '${escapeHtml(safeTitle)}'); this.closest('.dropdown').classList.remove('open')">
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                                <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
                                                <text x="12" y="14" text-anchor="middle" dominant-baseline="middle" font-size="10" font-weight="700" fill="currentColor">PDF</text>
                                            </svg>
                                            PDF
                                        </button>
                                    </div>
                                </div>
                                <button class="btn-secondary icon-only btn-outline-blue" title="查看报告" onclick="viewSavedReport('${report.id}')">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
                                        <circle cx="12" cy="12" r="3" />
                                    </svg>
                                </button>
                                <button class="btn-secondary icon-only btn-outline-green" title="进入面试" onclick="enterInterview('${report.id}')">
                                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M3 21V5a2 2 0 0 1 2-2h10" />
                                        <path d="M14 3h7v18H5a2 2 0 0 1-2-2" />
                                        <path d="M15 12h4" />
                                        <path d="M7 12h4" />
                                    </svg>
                                </button>
                            </div>
                        </div>`;
                    }).join('');
                } else {
                    reportsList.innerHTML = '<p class="notice">暂无保存的报告。</p>';
                }
            }
        } else {
            // 本地演示模式：从 localStorage 加载
            const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
            if (!user) {
                const reportsList = document.getElementById('reports-list');
                if (reportsList) {
                    reportsList.innerHTML = '<p class="notice">请先登录后查看报告。</p>';
                }
                return;
            }

            const key = `demo_reports_${user.id}`;
            let reports = [];
            try { reports = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}

            const reportsList = document.getElementById('reports-list');
            if (reportsList) {
                if (reports && reports.length > 0) {
                    reportsList.innerHTML = '<p class="notice">请登录后查看云端报告。</p>';
                } else {
                    reportsList.innerHTML = '<p class="notice">暂无保存的报告。</p>';
                }
            }
        }
    } catch (error) {
        console.error('Load reports error:', error);
        showToast('加载报告失败，请稍后重试', 'error');
    }
}

// 新增：查看报告（新页面打开）
function viewSavedReport(reportId, isLocalDemo = false) {
    openReportModal(reportId, isLocalDemo);
}

// 新增：进入面试（暂不实现跳转）
function enterInterview(reportId) {
    showToast('进入面试功能即将上线', 'info');
}

// 下载保存的报告
function downloadSavedMarkdown(reportId, title, content) {
    // 如果通过 onclick 传入的内容包含 HTML 实体（使用了 escapeHtml），此处需还原
    const raw = decodeHtml(content);
    const blob = new Blob([raw], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadSavedDocx(reportId, title, content) {
    try {
        const raw = decodeHtml(content);
        const htmlContent = renderMarkdown(raw);
        const docxBlob = htmlDocx.asBlob(htmlContent);
        const url = URL.createObjectURL(docxBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.docx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download DOCX error:', error);
        showToast('生成Word文档失败', 'error');
    }
}

function downloadSavedPdf(title, content) {
    try {
        const raw = decodeHtml(content);
        const htmlContent = renderMarkdown(raw);
        const temp = document.createElement('div');
        temp.className = 'markdown-content';
        temp.innerHTML = htmlContent;
        document.body.appendChild(temp);
        if (window.html2pdf) {
            html2pdf().from(temp).set({
                margin: 10,
                filename: `${title || '报告'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            }).save().then(() => {
                document.body.removeChild(temp);
            }).catch(() => { document.body.removeChild(temp); window.print(); });
        } else {
            document.body.removeChild(temp);
            window.print();
        }
    } catch (e) {
        window.print();
    }
}

async function getReportContentById(reportId) {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    if (user && window.Auth && window.Auth.supabase) {
        let data = null; let error = null;
        {
            const resp = await window.Auth.supabase
                .from('reports')
                .select('content,markdown_output')
                .eq('id', reportId)
                .limit(1)
                .maybeSingle();
            data = resp.data; error = resp.error;
        }
        if (error && (String(error.code) === '42703' || /column .* does not exist/i.test(error.message || ''))) {
            const resp2 = await window.Auth.supabase
                .from('reports')
                .select('*')
                .eq('id', reportId)
                .limit(1)
                .maybeSingle();
            data = resp2.data; error = resp2.error;
        }
        if (error) throw error;
        return (data && (data.content ?? data.markdown_output)) || '';
    } else {
        const key = `demo_reports_${user?.id || ''}`;
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        const found = items.find(r => r.id === reportId);
        return found ? (found.content ?? found.markdown_output ?? '') : '';
    }
}

async function downloadSavedMarkdownById(reportId, title) {
    const raw = await getReportContentById(reportId);
    const blob = new Blob([raw], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function downloadSavedDocxById(reportId, title) {
    const raw = await getReportContentById(reportId);
    const htmlContent = renderMarkdown(raw);
    const docxBlob = htmlDocx.asBlob(htmlContent);
    const url = URL.createObjectURL(docxBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

async function downloadSavedPdfById(reportId, title) {
    const raw = await getReportContentById(reportId);
    const htmlContent = renderMarkdown(raw);
    const temp = document.createElement('div');
    temp.className = 'markdown-content';
    temp.innerHTML = htmlContent;
    document.body.appendChild(temp);
    if (window.html2pdf) {
        html2pdf().from(temp).set({ margin: 10, filename: `${title || '报告'}.pdf`, image: { type: 'jpeg', quality: 0.98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save().then(() => { document.body.removeChild(temp); }).catch(() => { document.body.removeChild(temp); window.print(); });
    } else { document.body.removeChild(temp); window.print(); }
}

// 星标状态持久化（本地兜底）
function getStarMapKey(userId) {
    return `starred_reports_${userId}`;
}
function getStarMap(userId) {
    try {
        const raw = localStorage.getItem(getStarMapKey(userId));
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed ?? {};
    } catch {
        return {};
    }
}
function setStarMap(userId, map) {
    try { localStorage.setItem(getStarMapKey(userId), JSON.stringify(map ?? {})); } catch {}
}

// 切换星标
async function toggleStarReport(reportId, isLocalDemo = false, btnEl) {
    console.log('点击星标，reportId:', reportId);
    console.log('点击前 starMap:', localStorage.getItem('starredReports'));
    try {
        const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        if (!user) {
            showToast('用户未登录', 'error');
            return;
        }
        // 先基于本地状态进行切换，保证 UI 立即生效
        const localStarMap = (getStarMap(user.id) ?? {});
        const currentLocal = !!localStarMap[reportId];
        const nextLocal = !currentLocal;
        localStarMap[reportId] = nextLocal;
        setStarMap(user.id, localStarMap);

        if (!isLocalDemo && window.Auth && window.Auth.supabase) {
            // 后端操作非阻塞，失败不影响本地 UI 持久化
            window.Auth.supabase
                .from('reports')
                .select('id,is_starred')
                .eq('id', reportId)
                .limit(1)
                .maybeSingle()
                .then(({ data, error }) => {
                    if (error) {
                        console.warn('查询星标状态失败，已使用本地状态:', error.message);
                        // 字段不存在等错误，直接尝试用本地状态写入
                        return window.Auth.supabase
                            .from('reports')
                            .update({ is_starred: nextLocal })
                            .eq('id', reportId);
                    }
                    const currentRemote = data && data.is_starred === true;
                    const nextRemote = !currentRemote;
                    return window.Auth.supabase
                        .from('reports')
                        .update({ is_starred: nextRemote })
                        .eq('id', reportId);
                })
                .catch(err => {
                    console.warn('数据库操作失败，但本地已更新:', err);
                });
            showToast(nextLocal ? '已设为星标' : '已取消星标', 'success');
        } else {
            // 本地演示模式：直接更新 localStorage 里的记录
            const key = `demo_reports_${user.id}`;
            let items = [];
            try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
            items = items.map(r => r.id === reportId ? { ...r, is_starred: !(r.is_starred === true) } : r);
            try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
            showToast('已更新星标', 'success');
        }
        // 立即更新当前卡片的视觉状态，避免等待列表刷新
        try {
            if (btnEl) {
                btnEl.classList.toggle('starred');
                btnEl.title = btnEl.classList.contains('starred') ? '取消星标' : '设为星标';
                const card = btnEl.closest('.report-item');
                if (card) {
                    const shouldStar = btnEl.classList.contains('starred');
                    card.classList.toggle('report-card-starred', shouldStar);
                }
            }
        } catch {}
        // 不刷新全列表，避免覆盖当前即时状态；列表渲染已在 loadMyReports 中合并 starMap
    } catch (err) {
        console.error('Toggle star error:', err);
        showToast('更新星标失败', 'error');
    }
    console.log('点击后 starMap:', localStorage.getItem('starredReports'));
    console.log('按钮元素:', btnEl);
}

// 删除报告
async function deleteReport(reportId, isLocalDemo = false) {
    if (!confirm('确定删除该报告吗？此操作不可撤销。')) return;
    try {
        const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        if (!user) {
            showToast('用户未登录', 'error');
            return;
        }
        if (!isLocalDemo && window.Auth && window.Auth.supabase) {
            let token = '';
            try { const { data } = await window.Auth.getClient().auth.getSession(); token = data?.session?.access_token || ''; } catch {}
            if (token) {
                const resp = await fetch('/api/reports-delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ id: reportId, user_id: user.id })
                });
                if (resp.ok) {
                    showToast('已删除报告', 'success');
                } else {
                    const { error } = await window.Auth.supabase
                        .from('reports')
                        .delete()
                        .eq('id', reportId)
                        .eq('user_id', user.id);
                    if (error) {
                        console.error('Delete report error:', error);
                        showToast('删除失败：' + error.message, 'error');
                        return;
                    }
                    showToast('已删除报告', 'success');
                }
            } else {
                const { error } = await window.Auth.supabase
                    .from('reports')
                    .delete()
                    .eq('id', reportId)
                    .eq('user_id', user.id);
                if (error) {
                    console.error('Delete report error:', error);
                    showToast('删除失败：' + error.message, 'error');
                    return;
                }
                showToast('已删除报告', 'success');
            }
        } else {
            const key = `demo_reports_${user.id}`;
            let items = [];
            try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
            items = items.filter(r => r.id !== reportId);
            try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
            showToast('已删除报告', 'success');
        }
        await loadMyReports();
    } catch (err) {
        console.error('Delete report error:', err);
        showToast('删除报告失败', 'error');
    }
}

// 计算报告类型
function getReportTypeVal(report) {
    const t = (report.type ?? report.report_type);
    return t === 'resume' ? 'resume' : 'interview';
}

// 应用筛选与排序
function applyFiltersAndSort(reports, starMap = {}, isLocalDemo = false) {
    const withFlags = reports.map(r => {
        const isStarred = (r.is_starred === true) || Boolean(starMap[r.id]);
        const typeVal = getReportTypeVal(r);
        return { ...r, __isStarred: isStarred, __typeVal: typeVal };
    });
    const filtered = withFlags.filter(r => {
        const passStar = reportFilters.starredOnly ? r.__isStarred : true;
        const passType = reportFilters.type === 'all' ? true : (r.__typeVal === reportFilters.type);
        return passStar && passType;
    });
    const sorted = filtered.sort((a, b) => {
        // 星标优先，其次按创建时间倒序
        const starDiff = (b.__isStarred === true) - (a.__isStarred === true);
        if (starDiff !== 0) return starDiff;
        const timeDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        return timeDiff;
    });
    return sorted;
}

// 设置筛选事件监听
function setupReportFilters() {
    if (reportFiltersInitialized) return;
    const starredEl = document.getElementById('filter-starred');
    const typeEl = document.getElementById('filter-type');
    const resetBtn = document.getElementById('filter-reset');
    if (!starredEl || !typeEl || !resetBtn) return;
    starredEl.checked = reportFilters.starredOnly;
    typeEl.value = reportFilters.type;
    starredEl.addEventListener('change', () => {
        reportFilters.starredOnly = starredEl.checked;
        loadMyReports();
    });
    typeEl.addEventListener('change', () => {
        reportFilters.type = typeEl.value;
        loadMyReports();
    });
    resetBtn.addEventListener('click', () => {
        reportFilters = { starredOnly: false, type: 'all' };
        starredEl.checked = false;
        typeEl.value = 'all';
        loadMyReports();
    });
    reportFiltersInitialized = true;
}

// 下载结果
function downloadResult(type) {
    let markdown = '';
    let filename = '';
    
    if (type === 'resume') {
        markdown = resumeMarkdown;
        filename = `简历分析报告_${new Date().toISOString().split('T')[0]}.md`;
    } else if (type === 'interview') {
        markdown = interviewMarkdown;
        const intervieweeName = document.getElementById('interviewee-name').value.trim();
        filename = `面试分析报告_${intervieweeName}_${new Date().toISOString().split('T')[0]}.md`;
    }
    
    if (!markdown) {
        showToast('没有可下载的内容', 'error');
        return;
    }
    
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadResultDocx(type) {
    let markdown = '';
    let filename = '';
    
    if (type === 'resume') {
        markdown = resumeMarkdown;
        filename = `简历分析报告_${new Date().toISOString().split('T')[0]}.docx`;
    } else if (type === 'interview') {
        markdown = interviewMarkdown;
        const intervieweeName = document.getElementById('interviewee-name').value.trim();
        filename = `面试分析报告_${intervieweeName}_${new Date().toISOString().split('T')[0]}.docx`;
    }
    
    if (!markdown) {
        showToast('没有可下载的内容', 'error');
        return;
    }
    
    try {
        const htmlContent = renderMarkdown(markdown);
        const docxBlob = htmlDocx.asBlob(htmlContent);
        const url = URL.createObjectURL(docxBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Download DOCX error:', error);
        showToast('生成Word文档失败', 'error');
    }
}

// 工具函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 反转义 HTML 实体，恢复原始文本
function decodeHtml(text) {
    const div = document.createElement('div');
    div.innerHTML = text;
    return div.textContent;
}


function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.style.display = 'block';
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
        toast.style.display = 'none';
    }, 3000);
}

// 文件转Base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            // 移除data:type;base64,前缀
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// 暴露给 API.js 使用
if (typeof window !== 'undefined') {
    window.fileToBase64 = window.fileToBase64 || fileToBase64;
}

// Markdown渲染
function renderMarkdown(markdown) {
    if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
        const html = marked.parse(markdown);
        return DOMPurify.sanitize(html);
    } else {
        // 简单的Markdown渲染fallback
        return markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/\*\*(.*)\*\*/gim, '<strong>$1</strong>')
            .replace(/\*(.*)\*/gim, '<em>$1</em>')
            .replace(/\n/gim, '<br>');
    }
}

// 渲染后增强容器（添加主题类并为表格增加滚动包装）
function enhanceReportContainer(container, type) {
    if (!container) return;
    // 切换主题类
    container.classList.remove('resume-report', 'interview-report');
    if (type === 'resume') {
        container.classList.add('resume-report');
    } else if (type === 'interview') {
        container.classList.add('interview-report');
    }
    // 包装表格，确保在窄屏下可横向滚动
    const tables = Array.from(container.querySelectorAll('table'));
    tables.forEach(table => {
        if (!table.parentElement || !table.parentElement.classList || !table.parentElement.classList.contains('table-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'table-wrapper';
            table.parentNode.insertBefore(wrapper, table);
            wrapper.appendChild(table);
        }
    });
}

// 构建报告Markdown
function buildReportMarkdown(type, data) {
    const timestamp = new Date().toLocaleString();
    let markdown = '';
    
    if (type === 'resume') {
        markdown = `# 简历分析报告\n\n**生成时间**: ${timestamp}\n\n`;
        if (data.result) {
            markdown += data.result;
        }
    } else if (type === 'interview') {
        const intervieweeName = document.getElementById('interviewee-name').value.trim();
        markdown = `# 面试分析报告\n\n**面试者**: ${intervieweeName}\n**生成时间**: ${timestamp}\n\n`;
        if (data.result) {
            markdown += data.result;
        }
    }
    
    return markdown;
}

// 从结果中提取Markdown内容
function extractMarkdownFromResult(result) {
    const keys = ['output', 'output_list', 'outputs', 'content', 'markdown', 'text', 'result', 'message', 'messages', 'rich_text'];
    const tryParseJson = (str) => { try { return JSON.parse(str); } catch { return null; } };
    const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : { add() {}, has() { return false; } };
    const maxDepth = 12;
    const joinStringArray = (arr) => {
        if (!Array.isArray(arr)) return '';
        const parts = arr.map(item => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') {
                if (typeof item.markdown === 'string') return item.markdown;
                if (typeof item.text === 'string') return item.text;
                if (typeof item.content === 'string') return item.content;
                if (Array.isArray(item.output_list)) return joinStringArray(item.output_list);
                const nested = deepFind(item);
                if (nested) return nested;
            }
            return '';
        }).filter(Boolean);
        return parts.length ? parts.join('\n\n') : '';
    };
    const deepFind = (obj, depth = 0) => {
        if (obj == null || depth > maxDepth) return null;
        if (typeof obj === 'object') { try { if (seen.has(obj)) return null; seen.add(obj); } catch {} }
        if (typeof obj === 'string') {
            const s = obj.trim();
            if (s.startsWith('{') || s.startsWith('[')) {
                const parsed = tryParseJson(s);
                if (parsed) {
                    const nestedParsed = deepFind(parsed, depth + 1);
                    if (nestedParsed) return nestedParsed;
                }
            }
            return obj;
        }
        if (Array.isArray(obj)) {
            const joined = joinStringArray(obj);
            if (joined) return joined;
            for (const it of obj) {
                const nested = deepFind(it, depth + 1);
                if (nested) return nested;
            }
            return null;
        }
        if (typeof obj === 'object') {
            for (const k of keys) {
                if (obj[k] !== undefined) {
                    const nested = deepFind(obj[k], depth + 1);
                    if (nested) return nested;
                }
            }
            const containers = ['data', 'choice', 'choices', 'items', 'messages', 'segments', 'list', 'output_list', 'outputs', 'response'];
            for (const c of containers) {
                if (obj[c] !== undefined) {
                    const nested = deepFind(obj[c], depth + 1);
                    if (nested) return nested;
                }
            }
            const strVals = Object.values(obj).filter(v => typeof v === 'string');
            if (strVals.length) return strVals.join('\n\n');
        }
        return null;
    };
    if (typeof result === 'string') {
        const s = result.trim();
        if (s.startsWith('{') || s.startsWith('[')) {
            const parsed = tryParseJson(s);
            const found = deepFind(parsed);
            if (found) return found;
        }
        return result;
    }
    if (typeof result === 'object' && result !== null) {
        const found = deepFind(result);
        if (found) return found;
        return '```json\n' + JSON.stringify(result, null, 2) + '\n```';
    }
    return String(result);
}

// 新增：从Markdown中提取摘要字段（候选人姓名、岗位、匹配度）
function extractSummaryFieldsFromMarkdown(markdown) {
    const text = (markdown || '').replace(/\r/g, '');
    const lines = text.split('\n');
    let candidate_name = '';
    let job_title = '';
    let match_score = null;

    const grab = (regex) => {
        for (const line of lines) {
            const m = line.match(regex);
            if (m && m[1]) {
                return m[1].trim();
            }
        }
        return '';
    };

    // 姓名提取（中英兼容）
    candidate_name = grab(/^(?:\s*[-*]?\s*)?(?:姓名|候选人|面试者|Name|Candidate|Interviewee)\s*[：:]\s*([^\n]+)/i);
    if (!candidate_name) {
        // 从可能的标题中兜底，例如 "# 面试分析报告\n**面试者**: 张三"
        const m = text.match(/(?:面试者|姓名|Name|Interviewee)\s*[:：]\s*([^\n]+)/i);
        if (m) candidate_name = m[1].trim();
    }

    // 岗位/职位提取
    job_title = grab(/^(?:\s*[-*]?\s*)?(?:岗位|职位|岗位名称|职位名称|Job\s*Title|Position|Role)\s*[：:]\s*([^\n]+)/i);
    if (!job_title) {
        const m = text.match(/(?:岗位|职位|Job\s*Title|Position|Role)\s*[:：]\s*([^\n]+)/i);
        if (m) job_title = m[1].trim();
    }

    // 优先提取整体“综合匹配度/总体匹配度/总匹配度”
    let scoreStr = grab(/^(?:\s*[-*]?\s*)?(?:综合匹配度|总体匹配度|总匹配度|综合匹配)\s*[：:]\s*([0-9]{1,3})\s*%/i);
    // 其次在“评估结论/候选人详细评估/综合评估”附近提取
    if (!scoreStr) {
        const sectionRe = /评估结论|候选人详细评估|综合评估|Evaluation|Summary/i;
        for (let i = 0; i < lines.length; i++) {
            if (sectionRe.test(lines[i])) {
                for (let j = i; j < Math.min(i + 20, lines.length); j++) {
                    const l = lines[j];
                    if (/^\|/.test(l)) continue;
                    const m = l.match(/(?:综合匹配度|匹配度)\s*[：:]\s*([0-9]{1,3})\s*%/i);
                    if (m && m[1]) { scoreStr = m[1]; break; }
                }
                if (scoreStr) break;
            }
        }
    }
    // 再次兜底：锚定“匹配度”行且排除易混淆词
    if (!scoreStr) {
        for (const line of lines) {
            if (/^\|/.test(line)) continue;
            if (/命中率|命中数|维度|得分|分值|points|硬性|V-Raise/i.test(line)) continue;
            const m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|综合匹配)\s*[：:]\s*([0-9]{1,3})\s*%/i);
            if (m && m[1]) { scoreStr = m[1]; break; }
        }
    }
    // 最后兜底：全文搜索“匹配度：X%”，取出现最靠后的一个（更接近结论段）
    if (!scoreStr) {
        const all = Array.from(text.matchAll(/(?:匹配度|综合匹配)\s*[:：]\s*([0-9]{1,3})\s*%/gi)).map(m => m[1]);
        if (all.length) scoreStr = all[all.length - 1];
    }
    if (scoreStr) {
        const num = Math.max(0, Math.min(100, parseInt(scoreStr, 10)));
        if (!Number.isNaN(num)) match_score = num;
    }

    return { candidate_name, job_title, match_score };
}

// 语言相关逻辑由 public/js/i18n.js 负责，这里不再重复定义
if (typeof openLoginModal === 'function') window.openLoginModal = openLoginModal;
if (typeof closeLoginModal === 'function') window.closeLoginModal = closeLoginModal;
if (typeof handleEmailLogin === 'function') window.handleEmailLogin = handleEmailLogin;
if (typeof handleEmailSignup === 'function') window.handleEmailSignup = handleEmailSignup;
if (typeof handleForgotPassword === 'function') window.handleForgotPassword = handleForgotPassword;
if (typeof handlePasswordUpdate === 'function') window.handlePasswordUpdate = handlePasswordUpdate;
if (typeof handleLogout === 'function') window.handleLogout = handleLogout;
if (typeof showHome === 'function') window.showHome = showHome;
if (typeof showInterviewAnalysis === 'function') window.showInterviewAnalysis = showInterviewAnalysis;
if (typeof showMyReports === 'function') window.showMyReports = showMyReports;
if (typeof loadMyReports === 'function') window.loadMyReports = loadMyReports;
