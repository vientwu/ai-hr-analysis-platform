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
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const fileSizeMB = file.size / (1024 * 1024);
    
    if (!allowedTypes.includes(fileExtension)) {
        showToast(`不支持的文件格式。请上传 ${allowedTypes.join(', ').toUpperCase()} 格式的文件。`, 'error');
        return false;
    }
    
    if (fileSizeMB > maxSizeMB) {
        showToast(`文件大小超过限制。最大支持 ${maxSizeMB}MB。`, 'error');
        return false;
    }
    
    return true;
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
    // 实时验证
    setInterval(() => {
        if (document.getElementById('resume-module').style.display !== 'none') {
            validateResumeForm();
        }
        if (document.getElementById('interview-module').style.display !== 'none') {
            validateInterviewForm();
        }
    }, 500);
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
    document.querySelector('.feature-cards').style.display = 'none';
    document.getElementById('resume-module').style.display = 'block';
    document.getElementById('resume-module').classList.add('fade-in');
    
    // 重置表单
    resetResumeForm();
}

// 显示面试分析
function showInterviewAnalysis() {
    document.querySelector('.feature-cards').style.display = 'none';
    document.getElementById('interview-module').style.display = 'block';
    document.getElementById('interview-module').classList.add('fade-in');
    
    // 重置表单
    resetInterviewForm();
}

// 显示我的报告
function showMyReports() {
    document.querySelector('.feature-cards').style.display = 'none';
    document.getElementById('resume-module').style.display = 'none';
    document.getElementById('interview-module').style.display = 'none';
    const myReports = document.getElementById('my-reports-module');
    if (myReports) {
        myReports.style.display = 'block';
        myReports.classList.add('fade-in');
        loadMyReports();
    }
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

// 打开/关闭登录弹窗
function openLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'flex';
}
function closeLoginModal() {
    const modal = document.getElementById('login-modal');
    if (modal) modal.style.display = 'none';
}

// 打开/关闭重置密码弹窗
function openResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'flex';
}
function closeResetModal() {
    const modal = document.getElementById('reset-modal');
    if (modal) modal.style.display = 'none';
}

// 登录/注册/退出
function isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
}
async function handleEmailLogin() {
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const loginBtn = document.querySelector('#login-modal .modal-actions .btn-primary');
        if (!email || !password) {
            showToast('请输入邮箱和密码', 'warning');
            return;
        }
        if (!isValidEmail(email)) {
            showToast('邮箱格式不正确', 'warning');
            return;
        }
        if (password.length < 6) {
            showToast('密码至少 6 位', 'warning');
            return;
        }
        if (loginBtn) loginBtn.disabled = true;
        const { error } = await Auth.signInWithEmail(email, password);
        if (error) throw error;
        showToast('登录成功', 'success');
        closeLoginModal();
        loadMyReports();
    } catch (err) {
        showToast('登录失败：' + err.message);
    } finally {
        const loginBtn = document.querySelector('#login-modal .modal-actions .btn-primary');
        if (loginBtn) loginBtn.disabled = false;
    }
}

async function handleEmailSignup() {
    try {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value.trim();
        const signupBtn = document.querySelector('#login-modal .modal-actions .btn-secondary');
        if (!email || !password) {
            showToast('请输入邮箱和密码', 'warning');
            return;
        }
        if (!isValidEmail(email)) {
            showToast('邮箱格式不正确', 'warning');
            return;
        }
        if (password.length < 6) {
            showToast('密码至少 6 位', 'warning');
            return;
        }
        if (signupBtn) signupBtn.disabled = true;
        const { error } = await Auth.signUpWithEmail(email, password);
        if (error) throw error;
        showToast('注册成功，请查收邮件并登录', 'success');
    } catch (err) {
        showToast('注册失败：' + err.message);
    } finally {
        const signupBtn = document.querySelector('#login-modal .modal-actions .btn-secondary');
        if (signupBtn) signupBtn.disabled = false;
    }
}

async function handleForgotPassword() {
    try {
        const email = document.getElementById('login-email').value.trim();
        if (!email) { showToast('请输入邮箱以接收重置邮件', 'warning'); return; }
        if (!isValidEmail(email)) { showToast('邮箱格式不正确', 'warning'); return; }
        const { error } = await Auth.resetPassword(email);
        if (error) throw error;
        showToast('重置邮件已发送，请查收', 'success');
    } catch (err) {
        showToast('重置失败：' + err.message);
    }
}

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
        openLoginModal();
    } catch (err) {
        showToast('更新密码失败：' + err.message);
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
window.openLoginModal = openLoginModal;
window.closeLoginModal = closeLoginModal;
window.openResetModal = openResetModal;
window.closeResetModal = closeResetModal;
window.handleEmailLogin = handleEmailLogin;
window.handleEmailSignup = handleEmailSignup;
window.handleForgotPassword = handleForgotPassword;
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
    
    try {
        // 显示加载状态
        showLoading();
        analyzeBtn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = currentLanguage === 'zh' ? '分析中...' : 'Analyzing...';
        
        // 调用API
        const result = await window.API.callResumeAnalysisAPI(resumeFile, jdText);
        
        // 显示结果
        displayResumeResult(result);
        
        showToast(currentLanguage === 'zh' ? '简历分析完成！' : 'Resume analysis completed!', 'success');
        
    } catch (error) {
        console.error('简历分析失败:', error);
        showToast(currentLanguage === 'zh' ? '分析失败，请重试' : 'Analysis failed, please try again', 'error');
    } finally {
        // 恢复按钮状态
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
        
        // 调用API
        const result = await window.API.callInterviewAnalysisAPI(interviewFile, name, recordingUrl);
        
        // 显示结果
        displayInterviewResult(result);
        
        showToast(currentLanguage === 'zh' ? '面试分析完成！' : 'Interview analysis completed!', 'success');
        
    } catch (error) {
        console.error('面试分析失败:', error);
        showToast(currentLanguage === 'zh' ? '分析失败，请重试' : 'Analysis failed, please try again', 'error');
    } finally {
        // 恢复按钮状态
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
    
    // 提取并渲染Markdown
    const markdown = extractMarkdownFromResult(result, 'interview');
    interviewMarkdown = markdown || '';
    interviewDebugUrl = (result && result.debug_url) ? result.debug_url : '';
    const finalMarkdown = buildReportMarkdown('面试分析报告', interviewMarkdown, interviewDebugUrl);
    renderMarkdown(finalMarkdown, resultContent);
    
    resultSection.style.display = 'block';
    resultSection.scrollIntoView({ behavior: 'smooth' });
}

// 保存报告到 Supabase（按用户隔离）
async function saveReportToSupabase(type) {
    try {
        const user = Auth.getUser();
        if (!user) {
            showToast('请先登录后再保存报告', 'warning');
            openLoginModal();
            return;
        }
        const supabase = Auth.getClient();
        const debugUrl = type === 'resume' ? resumeDebugUrl : interviewDebugUrl;
        const markdown = type === 'resume' ? resumeMarkdown : interviewMarkdown;
        if (!markdown) {
            showToast('尚未生成报告，无法保存');
            return;
        }
        const jd = document.getElementById('job-description')?.value || null;
        const { data, error } = await supabase
            .from('reports')
            .insert({
                user_id: user.id,
                report_type: type,
                job_description: type === 'resume' ? jd : null,
                debug_url: debugUrl || null,
                markdown_output: markdown,
                raw_output: null
            })
            .select();
        if (error) throw error;
        showToast('已保存到“我的报告”', 'success');
    } catch (err) {
        showToast('保存失败：' + err.message);
    }
}

// 加载“我的报告”列表
async function loadMyReports() {
    try {
        const user = Auth.getUser();
        const listEl = document.getElementById('reports-list');
        if (!listEl) return;
        if (!user) {
            listEl.innerHTML = '<p>未登录，无法查看报告。</p>';
            return;
        }
        const supabase = Auth.getClient();
        const { data, error } = await supabase
            .from('reports')
            .select('id, report_type, job_description, created_at, debug_url, markdown_output')
            .order('created_at', { ascending: false });
        if (error) throw error;
        if (!data || data.length === 0) {
            listEl.innerHTML = '<p>暂无报告，先去生成一份吧。</p>';
            return;
        }
        const html = data.map(item => {
            const title = item.report_type === 'resume' ? '简历分析' : '面试分析';
            const created = new Date(item.created_at).toLocaleString();
            return `
                <div class="report-item">
                    <h4>${title} · ${created}</h4>
                    ${item.job_description ? `<p><strong>JD：</strong>${escapeHtml(item.job_description).slice(0, 200)}...</p>` : ''}
                    ${item.debug_url ? `<p><a href="${item.debug_url}" target="_blank">调试链接</a></p>` : ''}
                    <div class="result-actions" style="margin-top:0.5rem">
                        <button class="btn-secondary" onclick='downloadSavedDocx(${JSON.stringify({id:item.id}).replace(/"/g, "&quot;")})'>下载 Word</button>
                        <button class="btn-secondary" onclick='downloadSavedMarkdown(${JSON.stringify({id:item.id}).replace(/"/g, "&quot;")})'>下载.md</button>
                        <button class="btn-primary" onclick='viewSavedMarkdown(${JSON.stringify({id:item.id}).replace(/"/g, "&quot;")})'>查看内容</button>
                    </div>
                </div>
            `;
        }).join('');
        listEl.innerHTML = html;
        // 存入内存以便后续下载和查看
        window._savedReportsCache = data;
    } catch (err) {
        showToast('加载报告失败：' + err.message);
    }
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

// 显示提示消息
function showToast(message, type = 'error') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
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