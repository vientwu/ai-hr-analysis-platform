// 全局变量
let currentLanguage = 'zh';
let resumeFile = null;
let interviewFile = null;
// 缓存Markdown内容与调试链接，便于下载与查看
let resumeMarkdown = '';
let interviewMarkdown = '';
let resumeDebugUrl = '';
let interviewDebugUrl = '';
let isLoggedIn = false;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    updateLanguage();
    // 初始化 Supabase Auth
    if (window.Auth) {
        window.Auth.initialize();
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
}

// 监听登录状态变化，更新UI
window.addEventListener('auth-changed', (e) => {
    const user = e.detail?.user || null;
    isLoggedIn = !!user;
    updateAuthUI(user);
});

function updateAuthUI(user) {
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const notice = document.getElementById('reports-notice');
    if (loginBtn && logoutBtn) {
        loginBtn.style.display = isLoggedIn ? 'none' : 'inline-flex';
        logoutBtn.style.display = isLoggedIn ? 'inline-flex' : 'none';
    }
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
    // 验证文件类型
    if (file.type !== 'application/pdf') {
        showToast('请上传 PDF 格式的文件', 'error');
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
        btnText.textContent = currentLanguage === 'zh' ? '分析中...' : 'Analyzing...';
        
        // 转换文件为Base64
        const resumeBase64 = await fileToBase64(resumeFile);
        
        // 调用API
        const response = await fetch('/api/resume-analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                resumeFile: resumeBase64,
                jobDescription: jobDescription
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '分析失败');
        }
        
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
        btnText.textContent = currentLanguage === 'zh' ? '开始分析简历' : 'Start Resume Analysis';
    }
}

async function analyzeInterview() {
    if (!interviewFile) {
        showToast('请先上传面试录音转文字PDF', 'error');
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
        btnText.textContent = currentLanguage === 'zh' ? '分析中...' : 'Analyzing...';
        
        // 转换文件为Base64
        const interviewBase64 = await fileToBase64(interviewFile);
        
        // 调用API
        const response = await fetch('/api/interview-analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                interviewFile: interviewBase64,
                intervieweeName: intervieweeName,
                recordingUrl: recordingUrl || undefined
            })
        });
        
        const result = await response.json();
        
        if (!response.ok) {
            throw new Error(result.error || '分析失败');
        }
        
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
        btnText.textContent = currentLanguage === 'zh' ? '开始分析面试' : 'Start Interview Analysis';
    }
}

// 结果显示函数
function displayResumeResult(result) {
    const resultSection = document.getElementById('resume-result');
    const resultContent = document.getElementById('resume-result-content');
    
    if (result.result) {
        // 提取并缓存Markdown内容
        resumeMarkdown = extractMarkdownFromResult(result.result);
        
        // 渲染Markdown
        resultContent.innerHTML = renderMarkdown(resumeMarkdown);
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
    
    if (result.result) {
        // 提取并缓存Markdown内容
        interviewMarkdown = extractMarkdownFromResult(result.result);
        
        // 渲染Markdown
        resultContent.innerHTML = renderMarkdown(interviewMarkdown);
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
    
    if (type === 'resume') {
        if (!resumeMarkdown) {
            showToast('没有可保存的简历分析结果', 'error');
            return;
        }
        markdown = resumeMarkdown;
        title = `简历分析报告 - ${new Date().toLocaleDateString()}`;
    } else if (type === 'interview') {
        if (!interviewMarkdown) {
            showToast('没有可保存的面试分析结果', 'error');
            return;
        }
        markdown = interviewMarkdown;
        const intervieweeName = document.getElementById('interviewee-name').value.trim();
        title = `面试分析报告 - ${intervieweeName} - ${new Date().toLocaleDateString()}`;
    }
    
    try {
        if (window.Auth && window.Auth.supabase) {
            const user = await window.Auth.getCurrentUser();
            if (!user) {
                showToast('用户未登录', 'error');
                return;
            }
            
            const { data, error } = await window.Auth.supabase
                .from('reports')
                .insert([
                    {
                        user_id: user.id,
                        title: title,
                        type: type,
                        content: markdown,
                        created_at: new Date().toISOString()
                    }
                ]);
            
            if (error) {
                console.error('Save report error:', error);
                showToast('保存报告失败：' + error.message, 'error');
            } else {
                showToast('报告已保存到我的报告！', 'success');
            }
        } else {
            showToast('数据库服务未初始化', 'error');
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
            
            const { data: reports, error } = await window.Auth.supabase
                .from('reports')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            if (error) {
                console.error('Load reports error:', error);
                showToast('加载报告失败：' + error.message, 'error');
                return;
            }
            
            const reportsList = document.getElementById('reports-list');
            if (reportsList) {
                if (reports && reports.length > 0) {
                    reportsList.innerHTML = reports.map(report => `
                        <div class="report-item">
                            <div class="report-header">
                                <h4>${escapeHtml(report.title)}</h4>
                                <span class="report-type">${report.type === 'resume' ? '简历分析' : '面试分析'}</span>
                            </div>
                            <div class="report-meta">
                                <span class="report-date">${new Date(report.created_at).toLocaleString()}</span>
                            </div>
                            <div class="report-actions">
                                <button class="btn-secondary" onclick="downloadSavedMarkdown('${report.id}', '${escapeHtml(report.title)}', \`${escapeHtml(report.content)}\`)">
                                    <i class="fas fa-download"></i>
                                    下载 Markdown
                                </button>
                                <button class="btn-secondary" onclick="downloadSavedDocx('${report.id}', '${escapeHtml(report.title)}', \`${escapeHtml(report.content)}\`)">
                                    <i class="fas fa-file-word"></i>
                                    下载 Word
                                </button>
                            </div>
                        </div>
                    `).join('');
                } else {
                    reportsList.innerHTML = '<p class="notice">暂无保存的报告。</p>';
                }
            }
        } else {
            showToast('数据库服务未初始化', 'error');
        }
    } catch (error) {
        console.error('Load reports error:', error);
        showToast('加载报告失败，请稍后重试', 'error');
    }
}

// 下载保存的报告
function downloadSavedMarkdown(reportId, title, content) {
    const blob = new Blob([content], { type: 'text/markdown' });
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
        const htmlContent = renderMarkdown(content);
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

function showLoading() {
    document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
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
    // 如果结果已经是Markdown格式，直接返回
    if (typeof result === 'string') {
        return result;
    }
    
    // 如果是对象，尝试提取内容
    if (typeof result === 'object') {
        return result.content || result.markdown || result.text || JSON.stringify(result, null, 2);
    }
    
    return String(result);
}

// 简单语言切换（基于 data-zh / data-en 文本）
function updateLanguage() {
    const toEN = currentLanguage === 'en';
    document.querySelectorAll('[data-zh]').forEach(el => {
        const zh = el.getAttribute('data-zh');
        const en = el.getAttribute('data-en');
        el.textContent = toEN ? (en || zh) : zh;
    });
    // 更新占位符
    document.querySelectorAll('[data-zh-placeholder]').forEach(el => {
        const zh = el.getAttribute('data-zh-placeholder');
        const en = el.getAttribute('data-en-placeholder');
        el.setAttribute('placeholder', toEN ? (en || zh) : zh);
    });
    // 更新语言按钮文字
    const langText = document.getElementById('lang-text');
    if (langText) langText.textContent = toEN ? 'ZH' : 'EN';
}

function toggleLanguage() {
    currentLanguage = currentLanguage === 'zh' ? 'en' : 'zh';
    updateLanguage();
}