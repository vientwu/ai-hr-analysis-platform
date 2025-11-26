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
let reportMetaOverrides = {};

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
  try {
    const mod = document.getElementById('my-reports-module');
    if (mod && mod.style.display !== 'none') { loadMyReports(); }
  } catch {}
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
    if (!fileInput) return;
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            handler(file);
        }
    });
    if (!uploadArea) return;
    const dropArea = uploadArea.querySelector && uploadArea.querySelector('.upload-area');
    if (!dropArea) return;
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
    const nameEl = document.getElementById('interviewee-name');
    // 若不在首页的面试模块上下文（进入面试独立页），直接返回，交由 interview.js 控制按钮
    if (!analyzeBtn && !nameEl) return;
    const hasFile = interviewFile !== null;
    const hasName = nameEl ? (nameEl.value.trim().length > 0) : true;
    if (analyzeBtn) {
        analyzeBtn.disabled = !(hasFile && hasName);
    }
}

// UI导航函数
function showHome() {
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    var fc = document.getElementById('features'); if (fc) fc.style.display = 'block';
}

function showResumeAnalysis() {
    var fc = document.getElementById('features'); if (fc) fc.style.display = 'none';
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    document.getElementById('resume-module').style.display = 'block';
    try {
        try {
            document.querySelectorAll('script[src*="new-analysis.js"]').forEach(function(node){ node.parentNode && node.parentNode.removeChild(node); });
        } catch {}
        if (!window._newResumeInitDone) {
            initNewResumeFallback();
            window._newResumeInitDone = true;
        }
    } catch {}
}

// 新简历分析模块降级初始化（不依赖 new-analysis.js）
function initNewResumeFallback() {
    try {
        const fileInput = document.getElementById('new-resume-files');
        const fileInfo = document.getElementById('new-resume-files-info');
        const jdTextarea = document.getElementById('new-job-description');
        const jdCount = document.getElementById('new-jd-count');
        const startBtn = document.getElementById('start-local-analysis');
        const resultPanel = document.getElementById('new-result');
        const resultContent = document.getElementById('new-result-content');
        const saveBtn = document.getElementById('save-new-report');
        const dlDocxBtn = document.getElementById('download-new-docx');
        const dlMdBtn = document.getElementById('download-new-md');
        const uploadArea = document.querySelector('#resume-module .upload-area');

        if (jdTextarea && jdCount) {
            const updateCount = () => { try { jdCount.textContent = (jdTextarea.value || '').length; } catch {} };
            jdTextarea.addEventListener('input', updateCount);
            updateCount();
        }

        let selectedFiles = [];
        if (fileInput) {
            fileInput.addEventListener('change', function(e){
                selectedFiles = Array.from(e.target.files || []);
                if (fileInfo) {
                    if (selectedFiles.length === 0) { fileInfo.style.display = 'none'; fileInfo.textContent = ''; }
                    else {
                        const lines = selectedFiles.map(f => `${f.name} (${(f.size/1024/1024).toFixed(2)}MB)`);
                        fileInfo.textContent = lines.join('\n');
                        fileInfo.style.display = 'block';
                    }
                }
            });
        }

        if (uploadArea && fileInput) {
            ['dragenter','dragover','dragleave','drop'].forEach(evt=>uploadArea.addEventListener(evt,(e)=>{e.preventDefault();e.stopPropagation();}));
            ['dragenter','dragover'].forEach(evt=>uploadArea.addEventListener(evt,()=>uploadArea.classList.add('dragover')));
            ['dragleave','drop'].forEach(evt=>uploadArea.addEventListener(evt,()=>uploadArea.classList.remove('dragover')));
            uploadArea.addEventListener('drop',(e)=>{ const files = e.dataTransfer.files; if (fileInput) { fileInput.files = files; fileInput.dispatchEvent(new Event('change')); }});
        }

        async function runAnalysis() {
            const jd = (jdTextarea && jdTextarea.value) ? jdTextarea.value : '';
            if (!selectedFiles || selectedFiles.length === 0) { showToast('请先选择至少一个简历文件'); return; }
            try {
                showLoadingState(true);
                const promptMatchEl = document.getElementById('prompt-match');
                let settings = null;
                try { settings = await (window.getUserKey ? window.getUserKey() : null); } catch { settings = null; }
                const savedPromptMatch = (settings && settings.prompts && settings.prompts.matchInterview) ? String(settings.prompts.matchInterview || '').trim() : '';
                const promptMatch = (promptMatchEl && String(promptMatchEl.value || '').trim()) ? String(promptMatchEl.value || '').trim() : savedPromptMatch;
                const provider = (settings && settings.provider) ? settings.provider : 'openrouter';
                const modelBase = (settings && settings.model) ? settings.model : 'anthropic/claude-3.5-sonnet';
                const customModel = (settings && settings.customModel) ? settings.customModel : '';
                const model = customModel || modelBase;
                const key = (settings && settings.keys && settings.keys[provider]) ? settings.keys[provider] : (settings && settings.apiKey) ? settings.apiKey : '';
                if (!promptMatch) { showToast('请在设置中填写提示词'); return; }
                if (!key) { showToast('请在设置中填写 API 密钥'); return; }

                const texts = [];
                const errHints = [];
                const base = (typeof window !== 'undefined' && window.API_BASE) ? window.API_BASE : '';
                const urlParse = base ? (base + '/api/parse-doc') : '/api/parse-doc';
                const urlChat = base ? (base + '/api/llm-chat') : '/api/llm-chat';
                const readPdfLocal = async (file) => {
                    try {
                        const pdfjs = window.pdfjsLib; const Tesseract = window.Tesseract; if (!pdfjs || !Tesseract) return '';
                        const url = URL.createObjectURL(file);
                        const doc = await pdfjs.getDocument(url).promise;
                        let out = '';
                        const pages = Math.min(5, doc.numPages || 0);
                        const start = Date.now();
                        for (let i = 1; i <= pages; i++) {
                            const page = await doc.getPage(i);
                            try {
                                const tc = await page.getTextContent();
                                const fast = (tc && tc.items) ? tc.items.map(it => it.str).join('\n') : '';
                                if (fast && fast.trim().length > 40) { out += fast.trim() + '\n\n'; continue; }
                            } catch {}
                            const viewport = page.getViewport({ scale: 1.25 });
                            const canvas = document.createElement('canvas');
                            const ctx = canvas.getContext('2d');
                            canvas.width = Math.ceil(viewport.width);
                            canvas.height = Math.ceil(viewport.height);
                            await page.render({ canvasContext: ctx, viewport }).promise;
                            let res = await Tesseract.recognize(canvas, 'eng', { logger: () => {} }).catch(() => null);
                            let text = (res && res.data && res.data.text ? res.data.text : '');
                            if (!text || text.trim().length < 20) {
                                res = await Tesseract.recognize(canvas, 'chi_sim+eng', { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' }).catch(() => null);
                                text = (res && res.data && res.data.text ? res.data.text : '');
                            }
                            out += (res && res.data && res.data.text ? res.data.text : '') + '\n\n';
                            if (Date.now() - start > 25000) break;
                        }
                        URL.revokeObjectURL(url);
                        return out.trim();
                    } catch { return ''; }
                };
                const readImageLocal = async (file) => {
                    try {
                        const Tesseract = window.Tesseract; if (!Tesseract) return '';
                        const url = URL.createObjectURL(file);
                        let res = await Tesseract.recognize(url, 'chi_sim+eng', { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' }).catch(async () => {
                            return await Tesseract.recognize(url, 'eng', { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' });
                        });
                        URL.revokeObjectURL(url);
                        return String(res && res.data && res.data.text ? res.data.text : '').trim();
                    } catch { return ''; }
                };
                for (let i = 0; i < selectedFiles.length; i++) {
                    const f = selectedFiles[i];
                    try {
                        const base64 = await fileToBase64(f);
                        const pResp = await fetch(urlParse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: f.name, mime: f.type || '', dataBase64: base64 }) });
                        let txt = '';
                        let pj = null;
                        try { pj = await pResp.json(); } catch {}
                        if (pResp.ok) {
                            txt = String(pj && pj.text ? pj.text : '').trim();
                            if (!txt) {
                                const name = (f.name || '').toLowerCase();
                                if (name.endsWith('.pdf')) txt = await readPdfLocal(f);
                                else if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) txt = await readImageLocal(f);
                            }
                        } else {
                            if (pj && pj.hint) errHints.push(pj.hint);
                            const name = (f.name || '').toLowerCase();
                            if (name.endsWith('.pdf')) txt = await readPdfLocal(f);
                            else if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg')) txt = await readImageLocal(f);
                            if (!txt && pj && pj.error) throw new Error(pj.error);
                        }
                        texts.push({ name: f.name, text: txt });
                    } catch (e) {
                        texts.push({ name: f.name, text: '' });
                    }
                }

                const validTexts = texts.filter(t => (String(t.text || '').trim().length >= 30));
                if (validTexts.length === 0) {
                    try {
                        showToast('文本解析失败，切换为直接文件分析');
                        const first = selectedFiles[0];
                        const result = await window.API.callResumeAnalysisAPI(first, jd, promptMatch);
                        const raw = (result && (result.data ?? result.result ?? result.output)) || result;
                        const markdown = (() => {
                            try {
                                const seen = typeof WeakSet !== 'undefined' ? new WeakSet() : { add() {}, has() { return false; } };
                                function find(obj) {
                                    if (!obj || typeof obj !== 'object') return '';
                                    if (seen.has(obj)) return '';
                                    seen.add(obj);
                                    if (typeof obj.markdown === 'string') return obj.markdown;
                                    if (typeof obj.text === 'string') return obj.text;
                                    if (typeof obj.content === 'string') return obj.content;
                                    if (Array.isArray(obj.output_list)) return obj.output_list.map(find).filter(Boolean).join('\n\n');
                                    if (Array.isArray(obj)) return obj.map(find).filter(Boolean).join('\n\n');
                                    for (const k of Object.keys(obj)) { const v = obj[k]; const f = find(v); if (f) return f; }
                                    return '';
                                }
                                const out = find(raw);
                                return typeof out === 'string' && out.trim() ? out : (typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2));
                            } catch { return (typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)); }
                        })();
                        const merged = String(markdown || '').trim() || '分析结果为空';
                        resumeMarkdown = merged;
                        window.resumeMarkdown = merged;
                        if (resultContent && resultPanel) {
                            resultContent.innerHTML = renderMarkdown(merged);
                            enhanceReportContainer(resultContent, 'resume');
                            resultPanel.style.display = 'block';
                        }
                        showToast('分析完成');
                    } catch (e) {
                        const hint = errHints.filter(Boolean)[0] || '请使用 DOCX/TXT/PDF/RTF/PNG/JPG；扫描件需清晰';
                        showToast('所有简历解析失败：' + hint);
                    }
                    return;
                }
                const resumeBlock = validTexts.map((t, i) => `【候选人${i+1}: ${t.name}】\n${t.text}`).join('\n\n');
                const userMsg = `${promptMatch}\n\n【简历集合】\n${resumeBlock}\n\n【岗位JD】\n${jd}`;
                const resp = await fetch(urlChat, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Provider': provider, 'X-Provider-Key': key }, body: JSON.stringify({ provider, model, messages: [{ role: 'system', content: '你是资深招聘分析专家，严格按用户提示词生成中文报告，仅优化格式，不缩短内容。' }, { role: 'user', content: userMsg }], temperature: 0.05, max_tokens: 8000 }) });
                const rawText = await resp.text();
                let json = null; try { json = JSON.parse(rawText); } catch {}
                if (!resp.ok) {
                    const msg = (json && json.error && (json.error.message || json.error)) || (json && json.message) || rawText || 'LLM 调用失败';
                    throw new Error(String(msg));
                }
                const out = String((json && json.text) ? json.text : '');
                const merged = out || '分析结果为空';

                resumeMarkdown = merged;
                window.resumeMarkdown = merged;
                if (resultContent && resultPanel) {
                    resultContent.innerHTML = renderMarkdown(merged);
                    enhanceReportContainer(resultContent, 'resume');
                    resultPanel.style.display = 'block';
                }
                showToast('分析完成');
            } catch (e) {
                console.error('分析失败', e);
                showToast('分析失败：' + (e && e.message ? e.message : e));
            } finally { showLoadingState(false); }
        }

        if (startBtn) { startBtn.addEventListener('click', runAnalysis); }

        async function saveNewReport() {
            try {
                const md = String(window.resumeMarkdown || '').trim();
                if (!md) { showToast('没有可保存的分析结果'); return; }
                await saveReportToSupabase('resume');
            } catch (e) {
                console.error('保存失败', e);
                showToast('保存失败：' + (e && e.message ? e.message : e));
            }
        }
        if (saveBtn) { saveBtn.addEventListener('click', saveNewReport); }

        if (dlDocxBtn) { dlDocxBtn.addEventListener('click', function(){ try { downloadResultDocx('resume'); } catch (e) { showToast('下载失败'); } }); }
        if (dlMdBtn) { dlMdBtn.addEventListener('click', function(){ try { downloadResult('resume'); } catch (e) { showToast('下载失败'); } }); }
    } catch (e) {
        console.error('初始化新简历分析降级模块失败', e);
    }
}

function showInterviewAnalysis() {
    var fc = document.getElementById('features'); if (fc) fc.style.display = 'none';
    document.querySelectorAll('.analysis-module').forEach(module => {
        module.style.display = 'none';
    });
    document.getElementById('interview-module').style.display = 'block';
}

function showMyReports() {
  var fc = document.getElementById('features'); if (fc) fc.style.display = 'none';
  document.querySelectorAll('.analysis-module').forEach(module => {
    module.style.display = 'none';
  });
  document.getElementById('my-reports-module').style.display = 'block';
  setupReportFilters();
  // 自动加载报告
  loadMyReports();
}

try { window.showResumeAnalysis = showResumeAnalysis; } catch {}
try { window.showInterviewAnalysis = showInterviewAnalysis; } catch {}
try { window.showMyReports = showMyReports; } catch {}
try { window.showHome = showHome; } catch {}

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
    const statusBar = document.getElementById('interview-status-bar');
    if (statusBar) statusBar.style.display = 'none';
    
    
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
        'text/plain',
        'text/rtf',
        'application/rtf',
        'image/png',
        'image/jpeg'
    ];
    const allowedExts = ['pdf','doc','docx','txt','rtf','png','jpg','jpeg'];
    const mimeOk = allowedTypes.includes(file.type);
    const ext = (file && typeof file.name === 'string') ? (file.name.split('.').pop() || '').toLowerCase() : '';
    const extOk = allowedExts.includes(ext);
    if (!mimeOk && !extOk) {
        showToast('请上传 PDF、DOC、DOCX、TXT、RTF、PNG 或 JPG 文件', 'error');
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
    const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/rtf',
        'application/rtf',
        'image/png',
        'image/jpeg'
    ];
    const allowedExts = ['pdf','doc','docx','txt','rtf','png','jpg','jpeg'];
    const mimeOk = allowedTypes.includes(file.type);
    const ext = (file && typeof file.name === 'string') ? (file.name.split('.').pop() || '').toLowerCase() : '';
    const extOk = allowedExts.includes(ext);
    if (!mimeOk && !extOk) {
        showToast('请上传 PDF、DOC、DOCX、TXT、RTF、PNG 或 JPG 文件', 'error');
        return;
    }
    
    // 验证文件大小 (500MB)
    if (file.size > 500 * 1024 * 1024) {
        showToast('文件大小不能超过 500MB', 'error');
        return;
    }
    
    interviewFile = file;
    const targetId = document.getElementById('interview-status-bar') ? 'interview-status-bar' : 'interview-file-info';
    showFileInfo(targetId, file);
    validateInterviewForm();
}

function showFileInfo(infoId, file) {
    const infoDiv = document.getElementById(infoId);
    if (!infoDiv) return;
    const ext = (file && typeof file.name === 'string') ? (file.name.split('.').pop() || '').toUpperCase() : '';
    if (infoId === 'interview-file-info' || infoId === 'interview-status-bar') {
        infoDiv.innerHTML = `
            <span class="file-name" style="flex:1 1 auto;">${file.name}</span>
            <button class="remove-file" type="button" onclick="removeFile('${infoId}')" aria-label="移除" title="移除" style="background:transparent;border:none;cursor:pointer;color:#6b7280;margin-left:8px;padding:0;line-height:1;display:inline-flex;align-items:center;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M19 7h-1v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7H5a1 1 0 0 1 0-2h4V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1h4a1 1 0 1 1 0 2ZM10 7h4V4h-4v3Zm-1 4a1 1 0 0 1 2 0v6a1 1 0 1 1-2 0v-6Zm6 0a1 1 0 1 1 2 0v6a1 1 0 1 1-2 0v-6Z"/>
              </svg>
            </button>
        `;
    } else {
        infoDiv.innerHTML = `
            <span class="file-name">${file.name}</span>
            <span class="file-size">${formatFileSize(file.size)}</span>
            <button class="remove-file" onclick="removeFile('${infoId}')"><i class="fas fa-times"></i></button>
        `;
    }
    infoDiv.style.display = (infoId === 'interview-status-bar') ? 'flex' : 'block';
    try {
        const container = infoDiv.closest('.file-upload');
        const group = infoDiv.closest('.upload-group');
        if (container) container.style.display = 'flex';
        if (group) group.style.display = '';
    } catch {}
}

function removeFile(infoId) {
    if (infoId === 'resume-file-info') {
        resumeFile = null;
        document.getElementById('resume-file').value = '';
        validateResumeForm();
    } else if (infoId === 'interview-file-info' || infoId === 'interview-status-bar') {
        interviewFile = null;
        document.getElementById('interview-file').value = '';
        validateInterviewForm();
    }
    const infoDiv = document.getElementById(infoId);
    if (infoDiv) infoDiv.style.display = 'none';
    if (infoId === 'interview-file-info' || infoId === 'interview-status-bar') {
        try {
            const container = document.getElementById('interview-upload');
            const group = document.getElementById('audioUploadContainer');
            if (container) container.style.display = 'none';
            if (group) group.style.display = 'none';
        } catch {}
    }
    
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
    if (typeof switchLoginMode === 'function') switchLoginMode('login');
}

function closeLoginModal() {
    document.getElementById('login-modal').style.display = 'none';
}

function closeResetModal() {
    document.getElementById('reset-modal').style.display = 'none';
}

function openRegisterModal() {
    const modal = document.getElementById('register-modal');
    if (modal) modal.style.display = 'flex';
    const err = document.getElementById('register-error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
}

function closeRegisterModal() {
    const modal = document.getElementById('register-modal');
    if (modal) modal.style.display = 'none';
}

function openReportModal(reportId, isLocalDemo = false) {
    try {
        const src = `report.html?report_id=${encodeURIComponent(reportId)}`;
        const frame = document.getElementById('report-frame');
        const modal = document.getElementById('report-modal');
        if (!frame || !modal) { viewSavedReport(reportId, isLocalDemo); return; }
        try { window.currentReportPreviewId = String(reportId); } catch {}
        bindReportModalToolbarOnce();
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

function bindReportModalToolbarOnce() {
    const ddBtn = document.getElementById('report-download-dropdown-btn');
    const ddMenu = document.getElementById('report-download-dropdown-menu');
    const ddRoot = document.getElementById('report-download-dropdown');
    const mdBtn = document.getElementById('report-download-md');
    const docxBtn = document.getElementById('report-download-docx');
    const pdfBtn = document.getElementById('report-download-pdf');
    const copyBtn = document.getElementById('report-copy-link');
    const printBtn = document.getElementById('report-print');

    if (ddBtn && ddMenu && ddRoot && !ddBtn.__bound) {
        ddBtn.__bound = true;
        ddBtn.addEventListener('click', () => { ddRoot.classList.toggle('open'); });
        document.addEventListener('click', (e) => { if (!ddRoot.contains(e.target)) ddRoot.classList.remove('open'); });
    }
    const getIdAndTitle = async () => {
        const id = String(window.currentReportPreviewId || '');
        let title = '报告';
        try {
            const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
            if (user && window.Auth && window.Auth.supabase && id) {
                const { data } = await window.Auth.supabase
                    .from('reports')
                    .select('title')
                    .eq('id', id)
                    .limit(1)
                    .maybeSingle();
                if (data && data.title) title = data.title;
            }
        } catch {}
        return { id, title };
    };
    if (mdBtn && !mdBtn.__bound) {
        mdBtn.__bound = true;
        mdBtn.addEventListener('click', async () => {
            const { id, title } = await getIdAndTitle();
            if (!id) { showToast('未找到报告ID', 'error'); return; }
            await downloadSavedMarkdownById(id, title);
            if (ddRoot) ddRoot.classList.remove('open');
        });
    }
    if (docxBtn && !docxBtn.__bound) {
        docxBtn.__bound = true;
        docxBtn.addEventListener('click', async () => {
            const { id, title } = await getIdAndTitle();
            if (!id) { showToast('未找到报告ID', 'error'); return; }
            try { await downloadSavedDocxById(id, title); } catch { showToast('生成Word失败', 'error'); }
            if (ddRoot) ddRoot.classList.remove('open');
        });
    }
    if (pdfBtn && !pdfBtn.__bound) {
        pdfBtn.__bound = true;
        pdfBtn.addEventListener('click', async () => {
            const { id, title } = await getIdAndTitle();
            if (!id) { showToast('未找到报告ID', 'error'); return; }
            try { await downloadSavedPdfById(id, title); } catch { window.print(); }
            if (ddRoot) ddRoot.classList.remove('open');
        });
    }
    if (copyBtn && !copyBtn.__bound) {
        copyBtn.__bound = true;
        copyBtn.addEventListener('click', async () => {
            const id = String(window.currentReportPreviewId || '');
            if (!id) { showToast('未找到报告ID', 'error'); return; }
            const url = new URL('report.html', window.location.origin);
            url.searchParams.set('report_id', id);
            try { await navigator.clipboard.writeText(url.toString()); showToast('链接已复制', 'success'); }
            catch {
                try {
                    const ta = document.createElement('textarea');
                    ta.value = url.toString();
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand('copy');
                    document.body.removeChild(ta);
                    showToast('链接已复制', 'success');
                } catch { showToast('复制失败，请手动复制地址栏链接', 'error'); }
            }
        });
    }
    if (printBtn && !printBtn.__bound) {
        printBtn.__bound = true;
        printBtn.addEventListener('click', () => {
            try {
                const frame = document.getElementById('report-frame');
                const win = frame && frame.contentWindow ? frame.contentWindow : window;
                win.focus();
                win.print();
            } catch { window.print(); }
        });
    }
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

function showRegisterError(message) {
    const errorDiv = document.getElementById('register-error');
    if (errorDiv) {
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    }
}

async function handleEmailSignupRegister() {
    const email = document.getElementById('register-email')?.value?.trim();
    const password = document.getElementById('register-password')?.value || '';
    const confirm = document.getElementById('register-password-confirm')?.value || '';
    if (!email || !password || !confirm) { showRegisterError('请填写邮箱与两次密码'); return; }
    if (!isValidEmail(email)) { showRegisterError('请输入有效的邮箱地址'); return; }
    if (password.length < 6) { showRegisterError('密码至少需要6位'); return; }
    if (password !== confirm) { showRegisterError('两次输入的密码不一致'); return; }
    try {
        if (window.Auth) {
            const result = await window.Auth.signUp(email, password);
            if (result.error) {
                showRegisterError(result.error.message || '注册失败');
            } else {
                closeRegisterModal();
                showToast('注册成功！请检查邮箱验证链接。', 'success');
                openLoginModal();
            }
        } else {
            showRegisterError('认证服务未初始化');
        }
    } catch (error) {
        console.error('Signup error:', error);
        showRegisterError('注册失败，请稍后重试');
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

function switchLoginMode(mode) {
    const pwdGroup = document.getElementById('login-password-group');
    const loginActions = document.getElementById('login-actions');
    const forgotActions = document.getElementById('forgot-actions');
    const subtitle = document.querySelector('#login-modal .modal-subtitle');
    if (mode === 'forgot') {
        if (pwdGroup) pwdGroup.style.display = 'none';
        if (loginActions) loginActions.style.display = 'none';
        if (forgotActions) forgotActions.style.display = 'flex';
        if (subtitle) subtitle.textContent = '输入邮箱以接收重置邮件';
    } else {
        if (pwdGroup) pwdGroup.style.display = '';
        if (loginActions) loginActions.style.display = 'flex';
        if (forgotActions) forgotActions.style.display = 'none';
        if (subtitle) subtitle.textContent = '使用邮箱登录或注册';
    }
}

function openForgotMode() { switchLoginMode('forgot'); }

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
        const u = await waitForUser(1500);
        if (!u) {
            const reportsList = document.getElementById('reports-list');
            if (reportsList) {
                reportsList.innerHTML = '<p class="notice">请先登录后查看报告。</p>';
            }
            return;
        }
        isLoggedIn = true;
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
                try {
                    await trySyncLocalReports(user);
                } catch {}
                let token = '';
                try { const { data } = await window.Auth.getClient().auth.getSession(); token = data?.session?.access_token || ''; } catch {}
                if (token) {
                    const resp = await window.Auth.supabase
                        .from('reports')
                        .select('id,title,type,report_type,created_at,candidate_name,job_title,match_score,is_starred,content,markdown_output')
                        .eq('user_id', user.id)
                        .order('created_at', { ascending: false });
                    reports = resp.data; error = resp.error;
                } else {
                    reports = [];
                    error = null;
                }
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
                    let mergedAll = merged;
                    try {
                        const localKey = `demo_reports_${user.id}`;
                        const localItems = JSON.parse(localStorage.getItem(localKey) || '[]') || [];
                        if (Array.isArray(localItems) && localItems.length) {
                            const ids = new Set(merged.map(r => String(r.id)));
                            for (const it of localItems) { if (!ids.has(String(it.id))) mergedAll.push(it); }
                        }
                    } catch {}
                    const processed = applyFiltersAndSort(mergedAll, starMap, false);
                    let overrides = {};
                    try {
                        overrides = JSON.parse(localStorage.getItem(`report_meta_overrides_${user.id}`) || '{}') || {};
                        reportMetaOverrides = overrides;
                    } catch { overrides = {}; }
                    try { window.reportsCache = window.reportsCache || {}; } catch {}
                    const getMdFromReport = (r) => {
                        try {
                            const raw = String(r.markdown_output || '');
                            if (raw.trim().startsWith('{')) {
                                let obj = null; try { obj = JSON.parse(raw); } catch { obj = null; }
                                if (obj) {
                                    if (typeof obj.resume_md === 'string') return String(obj.resume_md || '');
                                    if (typeof obj.md === 'string') return String(obj.md || '');
                                    if (typeof obj.ai_analysis_md === 'string') return String(obj.ai_analysis_md || '');
                                }
                            }
                            const md = raw || String(r.content || '');
                            return md;
                        } catch { return String(r.content || ''); }
                    };
                    const normName = (s) => String(s || '').replace(/[\s\*＊·•●○☆★]/g,'').toLowerCase();
                    const interviewByName = {};
                    for (const r of mergedAll) {
                        const rt = (r.type ?? r.report_type) || '';
                        if (rt === 'interview') {
                            const mdInt = getMdFromReport(r);
                            const parsedInt = extractSummaryFieldsFromMarkdown(mdInt);
                            const nmRaw = String(parsedInt.candidate_name || r.candidate_name || r.title || '').trim();
                            const nm = normName(nmRaw);
                            if (nm) interviewByName[nm] = r.id;
                        }
                    }
                    const display = processed.filter(r => ((r.type ?? r.report_type) === 'resume'));
                    const pendingLinkReports = [];
                    const html = display.map(report => {
                        const md = getMdFromReport(report);
                        try { window.reportsCache[String(report.id)] = { md }; } catch {}
                        const parsed = extractSummaryFieldsFromMarkdown(md);
                        const clean = (s) => String(s || '').replace(/<br\s*\/>/gi, ' ').replace(/<br>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                        const candidate = clean(parsed.candidate_name || '未命名候选人');
                        const job = clean(parsed.job_title || '未知岗位');
                        let mo = {};
                        try { mo = JSON.parse(String(report.markdown_output || '{}')); } catch { mo = {}; }
                        const rawScore = (parsed.match_score != null ? parsed.match_score : (mo.match_score != null ? mo.match_score : (report.match_score ?? null)));
                        const numScore = (() => {
                            if (rawScore === null || rawScore === undefined || rawScore === '') return null;
                            const n = parseInt(String(rawScore).trim(), 10);
                            if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
                            return null;
                        })();
                        const scoreText = (numScore !== null) ? `${Math.round(numScore)}%` : '未知';
                        const reportTypeText = (report.type ?? report.report_type) === 'resume' ? '简历分析' : '面试分析';
                        const safeTitle = candidate || '未命名候选人';
                        const isStarred = (report.is_starred === true) || Boolean(starMap[report.id]);
                        
                        let status = mo.interview_status || '';
                        let timeStr = mo.interview_time || '';
                        const ov = overrides[String(report.id)] || {};
                        if (ov.interview_status) status = ov.interview_status;
                        if (ov.interview_time) timeStr = ov.interview_time;
                        const getStatusColor = (s) => {
                            if (s === '已面试-通过') return '#10b981';
                            if (s === '已面试-未通过') return '#ef4444';
                            if (s === '已面试-待定') return '#f59e0b';
                            if (s === '未通过') return '#ef4444';
                            if (s === '待面试') return '#f59e0b';
                            if (s === '已面试') return '#10b981';
                            return '#6b7280';
                        };
                        const statusColor = getStatusColor(status);
                        const statusTag = status ? `<span class="status-badge js-status-badge" style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:12px;background:${statusColor};color:white;font-size:12px;">${escapeHtml(status)}</span>` : '';
                        const timeTag = timeStr ? `<span class="time-badge js-time-badge" style="margin-left:8px;color:#6b7280;font-size:12px;">⏰ ${escapeHtml(timeStr)}</span>` : '';
                        let linkedInterviewId = (() => {
                            const key = normName(candidate);
                            return key ? interviewByName[key] : null;
                        })();
                        if (!linkedInterviewId) {
                            let mo = {};
                            try { mo = JSON.parse(String(report.markdown_output || '{}')); } catch { mo = {}; }
                            const lid = mo && mo.interview_link_id ? String(mo.interview_link_id) : '';
                            if (lid) linkedInterviewId = lid;
                        }
                        if (!linkedInterviewId) {
                            try {
                                const lid2 = localStorage.getItem('interview_link_' + String(report.id));
                                if (lid2) linkedInterviewId = String(lid2);
                            } catch {}
                        }
                        return `
                        <div class="report-item ${isStarred ? 'report-card-starred' : ''}" data-report-id="${escapeHtml(String(report.id))}">
                            <div class="report-header">
                                <div class="report-header-left">
                                    <h4>${escapeHtml(safeTitle)}</h4>
                                    <span class="report-summary">岗位：${escapeHtml(job)}｜匹配度：${escapeHtml(scoreText)}</span>
                                </div>
                                <div class="report-header-actions">
                                    <span class="report-type">${reportTypeText}</span>
                                    ${statusTag}${timeTag}
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
                                <div class="dropdown">
                                    <button class="btn-secondary icon-only" title="状态" onclick="(function(btn){btn.parentElement.classList.toggle('open');})(this)">
                                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                            <circle cx="12" cy="12" r="9" />
                                            <path d="M12 7v5l3 3" />
                                        </svg>
                                    </button>
                                    <div class="dropdown-menu">
                                        <button class="dropdown-item" onclick="setInterviewStatus('${report.id}','已面试-通过'); this.closest('.dropdown').classList.remove('open')">已面试-通过</button>
                                        <button class="dropdown-item" onclick="setInterviewStatus('${report.id}','已面试-未通过'); this.closest('.dropdown').classList.remove('open')">已面试-未通过</button>
                                        <button class="dropdown-item" onclick="setInterviewStatus('${report.id}','已面试-待定'); this.closest('.dropdown').classList.remove('open')">已面试-待定</button>
                                        <button class="dropdown-item" onclick="setInterviewStatus('${report.id}','待面试'); this.closest('.dropdown').classList.remove('open')">待面试</button>
                                        <button class="dropdown-item" onclick="setInterviewStatus('${report.id}','未通过'); this.closest('.dropdown').classList.remove('open')">未通过</button>
                                        <button class="dropdown-item" onclick="openInterviewTimePanel('${report.id}', this)">设置面试时间</button>
                                        <button class="dropdown-item" onclick="clearInterviewStatus('${report.id}'); this.closest('.dropdown').classList.remove('open')">清除状态</button>
                                        <button class="dropdown-item" onclick="clearInterviewTime('${report.id}'); this.closest('.dropdown').classList.remove('open')">清除面试时间</button>
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
                                ${linkedInterviewId ? renderInterviewRecordButtonHtml(linkedInterviewId) : renderInterviewRecordButtonHtmlAuto(String(report.id), safeTitle)}
                            </div>
                        </div>`;
                        if (!linkedInterviewId) pendingLinkReports.push({ id: report.id, candidate: safeTitle });
                    }).join('');
                    reportsList.innerHTML = html;
                    try {
                        if (pendingLinkReports.length) {
                            (async () => {
                                try {
                                    await lazyResolveInterviewLinksCloud(pendingLinkReports);
                                } catch {}
                            })();
                        }
                    } catch {}
                    try { myReportsCache = { uid: user.id, html, ts: Date.now() }; } catch {}
                } else {
                    try {
                        const localKey = `demo_reports_${user.id}`;
                        const localItems = JSON.parse(localStorage.getItem(localKey) || '[]') || [];
                        if (Array.isArray(localItems) && localItems.length) {
                            const processed = applyFiltersAndSort(localItems, {}, false);
                            const getMdFromLocal = (r) => {
                                try {
                                    const raw = String(r.markdown_output || '');
                                    if (raw.trim().startsWith('{')) {
                                        let obj = null; try { obj = JSON.parse(raw); } catch { obj = null; }
                                        if (obj) {
                                            if (typeof obj.resume_md === 'string') return String(obj.resume_md || '');
                                            if (typeof obj.md === 'string') return String(obj.md || '');
                                            if (typeof obj.ai_analysis_md === 'string') return String(obj.ai_analysis_md || '');
                                        }
                                    }
                                    const md = raw || String(r.content || '');
                                    return md;
                                } catch { return String(r.content || ''); }
                            };
                            const interviewByNameLocal = {};
                            const normNameLocal = (s) => String(s || '').replace(/[\s\*＊·•●○☆★]/g,'').toLowerCase();
                            for (const r of localItems) {
                                const rt = (r.type ?? r.report_type) || '';
                                if (rt === 'interview') {
                                    const mdInt = getMdFromLocal(r);
                                    const parsedInt = extractSummaryFieldsFromMarkdown(mdInt);
                                    const nmRaw = String(parsedInt.candidate_name || r.candidate_name || r.title || '').trim();
                                    const nm = normNameLocal(nmRaw);
                                    if (nm) interviewByNameLocal[nm] = r.id;
                                }
                            }
                            const displayLocal = processed.filter(r => ((r.type ?? r.report_type) === 'resume'));
                            const pendingLocal = [];
                            const html = displayLocal.map(report => {
                                const md = getMdFromLocal(report);
                                const parsed = extractSummaryFieldsFromMarkdown(md);
                                const clean = (s) => String(s || '').replace(/<br\s*\/>/gi, ' ').replace(/<br>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
                                const candidate = clean(parsed.candidate_name || '未命名候选人');
                                const job = clean(parsed.job_title || '未知岗位');
                                const rawScore = (parsed.match_score != null ? parsed.match_score : (report.match_score ?? null));
                                const numScore = (() => {
                                    if (rawScore === null || rawScore === undefined || rawScore === '') return null;
                                    const n = parseInt(String(rawScore).trim(), 10);
                                    if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
                                    return null;
                                })();
                                const scoreText = (numScore !== null) ? `${Math.round(numScore)}%` : '未知';
                                const reportTypeText = '简历分析';
                                const safeTitle = candidate || '未命名候选人';
                                const normName = (s) => String(s || '').replace(/[\s\*＊·•●○☆★]/g,'').toLowerCase();
                                let linkedInterviewId = (() => {
                                    const key = normName(candidate);
                                    return key ? interviewByNameLocal[key] : null;
                                })();
                                if (!linkedInterviewId) {
                                    let mo = {};
                                    try { mo = JSON.parse(String(report.markdown_output || '{}')); } catch { mo = {}; }
                                    const lid = mo && mo.interview_link_id ? String(mo.interview_link_id) : '';
                                    if (lid) linkedInterviewId = lid;
                                }
                                if (!linkedInterviewId) {
                                    try {
                                        const lid2 = localStorage.getItem('interview_link_' + String(report.id));
                                        if (lid2) linkedInterviewId = String(lid2);
                                    } catch {}
                                }
                                return `
                                <div class="report-item" data-report-id="${escapeHtml(String(report.id))}">
                                    <div class="report-header">
                                        <div class="report-header-left">
                                            <h4>${escapeHtml(safeTitle)}</h4>
                                            <span class="report-summary">岗位：${escapeHtml(job)}｜匹配度：${escapeHtml(scoreText)}</span>
                                        </div>
                                        <div class="report-header-actions">
                                            <span class="report-type">${reportTypeText}</span>
                                        </div>
                                    </div>
                                    <div class="report-meta">
                                        <span class="report-date">${new Date(report.created_at).toLocaleString()}</span>
                                    </div>
                                    <div class="report-actions">
                                        <button class="btn-secondary icon-only btn-outline-blue" title="查看报告" onclick="viewSavedReport('${report.id}', true)">
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
                                        ${linkedInterviewId ? renderInterviewRecordButtonHtml(linkedInterviewId) : renderInterviewRecordButtonHtmlAuto(String(report.id), safeTitle)}
                                        <button class="btn-secondary icon-only btn-danger" title="删除报告" onclick="deleteReport('${report.id}', true)">
                                            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                                <path d="M3 6h18" />
                                                <path d="M8 6v-2h8v2" />
                                                <path d="M19 6l-1 14H6L5 6" />
                                                <path d="M10 11v6" />
                                                <path d="M14 11v6" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>`;
                                if (!linkedInterviewId) pendingLocal.push({ id: report.id, candidate: safeTitle });
                            }).join('');
                            reportsList.innerHTML = html;
                            try {
                                if (pendingLocal.length) {
                                    (async () => {
                                        try { await lazyResolveInterviewLinksLocal(pendingLocal, localItems); } catch {}
                                    })();
                                }
                            } catch {}
                            try { myReportsCache = { uid: user.id, html, ts: Date.now() }; } catch {}
                        } else {
                            reportsList.innerHTML = '<p class="notice">暂无保存的报告。</p>';
                        }
                    } catch {
                        reportsList.innerHTML = '<p class="notice">暂无保存的报告。</p>';
                    }
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

// 新增：进入面试
function enterInterview(reportId) {
  try {
        (async () => {
            try {
                const client = window.Auth && window.Auth.supabase;
                if (client) {
                    const { data } = await client.from('reports').select('*').eq('id', String(reportId)).limit(1).maybeSingle();
                    if (data) {
                        const md = String(data.content || '');
                        let cn = data.candidate_name || '';
                        let jt = data.job_title || '';
                        let ms = data.match_score ?? null;
                        if ((!cn || !jt) && md) {
                            try {
                                const parsed = extractSummaryFieldsFromMarkdown(md);
                                cn = cn || parsed.candidate_name || '';
                                jt = jt || parsed.job_title || '';
                                if (ms == null && parsed.match_score != null) ms = parsed.match_score;
                            } catch {}
                        }
                        try { localStorage.setItem(`interview_source_${reportId}`, JSON.stringify({ md, candidate_name: cn, job_title: jt, match_score: ms })); } catch {}
                    }
                }
            } catch {}
            const useAlias = (window.location.port === '4000');
            const path = useAlias ? '/interview' : '/进入面试-AI招聘分析.html';
            const url = new URL(path, window.location.origin);
            url.searchParams.set('report_id', String(reportId));
            window.location.href = url.toString();
        })();
  } catch {
        showToast('跳转进入面试页面失败', 'error');
  }
}

async function setInterviewStatus(reportId, status) {
    try {
        const client = window.Auth && window.Auth.supabase;
        if (!client) { showToast('未登录', 'error'); return; }
        const { data } = await client.from('reports').select('content,markdown_output').eq('id', reportId).limit(1).maybeSingle();
        let mo = {};
        const raw = String(data?.markdown_output || '');
        if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } } else { mo = { md: raw || String(data?.content || '') }; }
        mo.interview_status = status;
        const { error } = await client.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', reportId);
        if (error) throw new Error(error.message || '更新失败');
        showToast('状态已更新', 'success');
        try {
            let uid = 'guest';
            try { const { data: sess } = await (window.Auth && window.Auth.getClient ? window.Auth.getClient().auth.getSession() : Promise.resolve({ data: null })); uid = sess?.session?.user?.id || uid; } catch {}
            if (uid === 'guest') {
                try { const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null); if (u && u.id) uid = u.id; } catch {}
            }
            reportMetaOverrides[reportId] = { ...(reportMetaOverrides[reportId] || {}), interview_status: status };
            localStorage.setItem(`report_meta_overrides_${uid}`, JSON.stringify(reportMetaOverrides));
        } catch {}
        updateCardStatusLabel(reportId, status);
        await loadMyReports();
    } catch (e) { showToast(e?.message || '更新失败', 'error'); }
}

async function setInterviewTime(reportId, valueOverride) {
    try {
        const val = valueOverride || prompt('输入面试时间，如 2025-11-20 15:30');
        if (!val) return;
        const client = window.Auth && window.Auth.supabase;
        if (!client) { showToast('未登录', 'error'); return; }
        const { data } = await client.from('reports').select('content,markdown_output').eq('id', reportId).limit(1).maybeSingle();
        let mo = {};
        const raw = String(data?.markdown_output || '');
        if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } } else { mo = { md: raw || String(data?.content || '') }; }
        mo.interview_time = val;
        const { error } = await client.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', reportId);
        if (error) throw new Error(error.message || '更新时间失败');
        showToast('面试时间已设置', 'success');
        try {
            let uid = 'guest';
            try { const { data: sess } = await (window.Auth && window.Auth.getClient ? window.Auth.getClient().auth.getSession() : Promise.resolve({ data: null })); uid = sess?.session?.user?.id || uid; } catch {}
            if (uid === 'guest') {
                try { const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null); if (u && u.id) uid = u.id; } catch {}
            }
            reportMetaOverrides[reportId] = { ...(reportMetaOverrides[reportId] || {}), interview_time: val };
            localStorage.setItem(`report_meta_overrides_${uid}`, JSON.stringify(reportMetaOverrides));
        } catch {}
        updateCardStatusLabel(reportId, undefined, val);
        await loadMyReports();
    } catch (e) { showToast(e?.message || '更新时间失败', 'error'); }
}

function openInterviewTimePanel(reportId, btn) {
    try {
        const rect = btn.getBoundingClientRect();
        const panel = document.createElement('div');
        panel.style.position = 'fixed';
        panel.style.left = `${rect.left}px`;
        panel.style.top = `${rect.bottom + 4}px`;
        panel.style.background = '#fff';
        panel.style.boxShadow = '0 8px 24px rgba(0,0,0,0.15)';
        panel.style.borderRadius = '8px';
        panel.style.padding = '10px';
        panel.style.zIndex = '9999';
        panel.innerHTML = `
          <div style="display:flex;align-items:center;gap:8px;">
            <input type="datetime-local" id="interviewTimeInput" style="padding:6px;border:1px solid #e0e0e0;border-radius:6px;" />
            <button class="btn-secondary icon-only" id="interviewTimeSave" title="保存" style="padding:4px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16v16H4z" />
                <path d="M7 7h10v5H7z" />
                <path d="M9 16h6" />
              </svg>
            </button>
            <button class="btn-secondary icon-only" id="interviewTimeCancel" title="取消" style="padding:4px;">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          </div>
        `;
        document.body.appendChild(panel);
        const cleanup = () => { try { document.body.removeChild(panel); } catch {} document.removeEventListener('click', outside); };
        const outside = (e) => { if (!panel.contains(e.target) && e.target !== btn) cleanup(); };
        document.addEventListener('click', outside);
        panel.querySelector('#interviewTimeSave').addEventListener('click', async () => {
            const input = panel.querySelector('#interviewTimeInput');
            const val = input.value ? input.value.replace('T', ' ') : '';
            if (!val) { showToast('请选择时间', 'error'); return; }
            await setInterviewTime(reportId, val);
            try { const dd = btn.closest('.dropdown'); if (dd) dd.classList.remove('open'); } catch {}
            cleanup();
        });
        panel.querySelector('#interviewTimeCancel').addEventListener('click', () => { try { const dd = btn.closest('.dropdown'); if (dd) dd.classList.remove('open'); } catch {} cleanup(); });
    } catch {}
}

function renderStatusBadge(status) {
    if (!status) return '';
    const getStatusColor = (s) => {
        if (s === '已面试-通过') return '#10b981';
        if (s === '已面试-未通过') return '#ef4444';
        if (s === '已面试-待定') return '#f59e0b';
        if (s === '未通过') return '#ef4444';
        if (s === '待面试') return '#f59e0b';
        if (s === '已面试') return '#10b981';
        return '#6b7280';
    };
    const color = getStatusColor(status);
    return `<span class="status-badge js-status-badge" style="display:inline-block;margin-left:8px;padding:2px 8px;border-radius:12px;background:${color};color:white;font-size:12px;">${escapeHtml(status)}</span>`;
}

function renderTimeBadge(timeStr) {
    if (!timeStr) return '';
    return `<span class="time-badge js-time-badge" style="margin-left:8px;color:#374151;background:#eef2ff;border:1px solid #e5e7eb;padding:2px 8px;border-radius:12px;font-size:12px;">⏰ ${escapeHtml(timeStr)}</span>`;
}

function renderInterviewRecordButtonHtml(id) {
    if (!id) return '';
    const escId = String(id).replace(/"/g, '&quot;').replace(/'/g, "\\'");
    return '<button class="btn-secondary icon-only btn-outline-purple" title="面试记录" onclick="viewInterviewRecord(\'' + escId + '\')">\n'
         + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">\n'
         + '<path d="M4 4h16v16H4z" />\n'
         + '<path d="M8 8h8v2H8z" />\n'
         + '<path d="M8 12h8v2H8z" />\n'
         + '<path d="M8 16h6v2H8z" />\n'
         + '</svg>\n'
         + '</button>';
}

function renderInterviewRecordButtonHtmlAuto(resumeId, candidate) {
    const escResumeId = String(resumeId).replace(/"/g, '&quot;').replace(/'/g, "\\'");
    const escCand = String(candidate || '').replace(/"/g, '&quot;').replace(/'/g, "\\'");
    return '<button class="btn-secondary icon-only btn-outline-purple" title="面试记录" onclick="openInterviewRecordAuto(\'' + escResumeId + '\', \'' + escCand + '\')">\n'
         + '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">\n'
         + '<path d="M4 4h16v16H4z" />\n'
         + '<path d="M8 8h8v2H8z" />\n'
         + '<path d="M8 12h8v2H8z" />\n'
         + '<path d="M8 16h6v2H8z" />\n'
         + '</svg>\n'
         + '</button>';
}

function updateCardStatusLabel(reportId, status, timeStr) {
    try {
        const esc = (s) => { try { return CSS.escape(s); } catch { return String(s).replace(/"/g, '\"'); } };
        const card = document.querySelector(`.report-item[data-report-id="${esc(String(reportId))}"]`);
        if (!card) { console.warn('updateCardStatusLabel card missing', { reportId }); return; }
        const actions = card.querySelector('.report-header-actions');
        if (!actions) { console.warn('updateCardStatusLabel header actions missing', { reportId }); return; }
        if (typeof status === 'string') {
            const cur = actions.querySelector('.js-status-badge');
            if (!status) { if (cur) cur.remove(); }
            else {
                const html = renderStatusBadge(status);
                if (cur) { cur.outerHTML = html; } else { actions.insertAdjacentHTML('beforeend', html); }
            }
        }
        if (typeof timeStr === 'string') {
            const curT = actions.querySelector('.js-time-badge');
            if (!timeStr) { if (curT) curT.remove(); }
            else {
                const html = renderTimeBadge(timeStr);
                if (curT) { curT.outerHTML = html; } else { actions.insertAdjacentHTML('beforeend', html); }
            }
        }
    } catch {}
}

async function clearInterviewStatus(reportId) {
    try {
        const client = window.Auth && window.Auth.supabase;
        if (!client) { showToast('未登录', 'error'); return; }
        const { data } = await client.from('reports').select('content,markdown_output').eq('id', reportId).limit(1).maybeSingle();
        let mo = {};
        const raw = String(data?.markdown_output || '');
        if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } } else { mo = { md: raw || String(data?.content || '') }; }
        delete mo.interview_status;
        const { error } = await client.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', reportId);
        if (error) throw new Error(error.message || '清除失败');
        try {
            let uid = 'guest';
            try { const { data: sess } = await (window.Auth && window.Auth.getClient ? window.Auth.getClient().auth.getSession() : Promise.resolve({ data: null })); uid = sess?.session?.user?.id || uid; } catch {}
            if (uid === 'guest') {
                try { const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null); if (u && u.id) uid = u.id; } catch {}
            }
            const ov = reportMetaOverrides[reportId] || {};
            delete ov.interview_status;
            reportMetaOverrides[reportId] = ov;
            localStorage.setItem(`report_meta_overrides_${uid}`, JSON.stringify(reportMetaOverrides));
        } catch {}
        updateCardStatusLabel(reportId, '');
        showToast('状态已清除', 'success');
        await loadMyReports();
    } catch (e) { showToast(e?.message || '清除失败', 'error'); }
}

async function clearInterviewTime(reportId) {
    try {
        const client = window.Auth && window.Auth.supabase;
        if (!client) { showToast('未登录', 'error'); return; }
        const { data } = await client.from('reports').select('content,markdown_output').eq('id', reportId).limit(1).maybeSingle();
        let mo = {};
        const raw = String(data?.markdown_output || '');
        if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } } else { mo = { md: raw || String(data?.content || '') }; }
        delete mo.interview_time;
        const { error } = await client.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', reportId);
        if (error) throw new Error(error.message || '清除失败');
        try {
            let uid = 'guest';
            try { const { data: sess } = await (window.Auth && window.Auth.getClient ? window.Auth.getClient().auth.getSession() : Promise.resolve({ data: null })); uid = sess?.session?.user?.id || uid; } catch {}
            if (uid === 'guest') {
                try { const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null); if (u && u.id) uid = u.id; } catch {}
            }
            const ov = reportMetaOverrides[reportId] || {};
            delete ov.interview_time;
            reportMetaOverrides[reportId] = ov;
            localStorage.setItem(`report_meta_overrides_${uid}`, JSON.stringify(reportMetaOverrides));
        } catch {}
        updateCardStatusLabel(reportId, undefined, '');
        showToast('面试时间已清除', 'success');
        await loadMyReports();
    } catch (e) { showToast(e?.message || '清除失败', 'error'); }
}
function viewInterviewRecord(reportId) {
    try {
        const base = 'http://127.0.0.1:4000';
        const path = '/interview-record';
        const url = new URL(path, base);
        url.searchParams.set('report_id', String(reportId));
        window.location.href = url.toString();
    } catch {
        showToast('打开面试记录页面失败', 'error');
    }
}

async function openInterviewRecordAuto(resumeId, candidate) {
    try {
        const client = window.Auth && window.Auth.supabase;
        const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        const norm = (s) => String(s || '').replace(/[\s\*＊·•●○☆★]/g,'').toLowerCase();
        let idFound = '';
        if (client && user) {
            try {
                let all = null; let err = null;
                {
                    const resp = await client
                        .from('reports')
                        .select('id,user_id,report_type,candidate_name,title,created_at,markdown_output,content')
                        .eq('user_id', user.id)
                        .eq('report_type', 'interview')
                        .order('created_at', { ascending: false });
                    all = resp.data; err = resp.error;
                }
                if ((!all || all.length === 0) && err && (String(err.code) === '42703' || /column .* does not exist/i.test(err.message || ''))) {
                    const resp2 = await client
                        .from('reports')
                        .select('id,user_id,type,candidate_name,title,created_at,markdown_output,content')
                        .eq('user_id', user.id)
                        .eq('type', 'interview')
                        .order('created_at', { ascending: false });
                    all = resp2.data;
                }
                const getMd = (r) => {
                    try {
                        const raw = String(r.markdown_output || '');
                        if (raw.trim().startsWith('{')) {
                            let obj = null; try { obj = JSON.parse(raw); } catch { obj = null; }
                            if (obj) {
                                if (typeof obj.resume_md === 'string') return String(obj.resume_md || '');
                                if (typeof obj.md === 'string') return String(obj.md || '');
                                if (typeof obj.ai_analysis_md === 'string') return String(obj.ai_analysis_md || '');
                            }
                        }
                        const md = raw || String(r.content || '');
                        return md;
                    } catch { return String(r.content || ''); }
                };
                const candKey = norm(candidate);
                for (const r of (all || [])) {
                    let cn = String(r.candidate_name || '');
                    if (!cn) {
                        try { const p = extractSummaryFieldsFromMarkdown(getMd(r)); cn = p.candidate_name || ''; } catch {}
                    }
                    const key = norm(cn || r.title || '');
                    if (key && key === candKey) { idFound = String(r.id); break; }
                }
            } catch {}
            if (idFound) {
                try {
                    const { data } = await client.from('reports').select('markdown_output,content').eq('id', resumeId).limit(1).maybeSingle();
                    let mo = {};
                    const raw = String(data?.markdown_output || '');
                    if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } }
                    else { mo = { md: raw || String(data?.content || '') }; }
                    mo.interview_link_id = String(idFound);
                    await client.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', resumeId);
                } catch {}
                return viewInterviewRecord(idFound);
            }
        }
        // Local fallback
        try {
            const u = user || await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
            const keyLS = u ? `demo_reports_${u.id}` : '';
            let arr = []; try { arr = keyLS ? JSON.parse(localStorage.getItem(keyLS) || '[]') : []; } catch {}
            const candKey = norm(candidate);
            for (const r of arr) {
                if ((r.type ?? r.report_type) !== 'interview') continue;
                let md = '';
                try {
                    const raw = String(r.markdown_output || '');
                    if (raw.trim().startsWith('{')) { let obj = JSON.parse(raw); md = String(obj.resume_md || obj.ai_analysis_md || obj.md || ''); }
                } catch {}
                let cn = String(r.candidate_name || '');
                if (!cn && md) { try { const p = extractSummaryFieldsFromMarkdown(md); cn = p.candidate_name || ''; } catch {} }
                const key = norm(cn || r.title || '');
                if (key && key === candKey) { idFound = String(r.id); break; }
            }
            if (idFound) {
                try {
                    const idx = arr.findIndex(r => String(r.id) === String(resumeId));
                    if (idx >= 0) {
                        let mo = {}; try { mo = JSON.parse(String(arr[idx].markdown_output || '{}')); } catch { mo = {}; }
                        mo.interview_link_id = String(idFound);
                        arr[idx].markdown_output = JSON.stringify(mo);
                        localStorage.setItem(keyLS, JSON.stringify(arr));
                    }
                    localStorage.setItem('interview_link_' + String(resumeId), String(idFound));
                } catch {}
                return viewInterviewRecord(idFound);
            }
        } catch {}
        showToast('未找到面试记录', 'warning');
    } catch { showToast('打开面试记录失败', 'error'); }
}

async function lazyResolveInterviewLinksCloud(pendingList) {
    try {
        const client = window.Auth && window.Auth.supabase;
        const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        if (!client || !user) return;
        let all = null; let err = null;
        {
            const resp = await client
                .from('reports')
                .select('id,user_id,report_type,candidate_name,title,created_at,markdown_output,content')
                .eq('user_id', user.id)
                .eq('report_type', 'interview')
                .order('created_at', { ascending: false });
            all = resp.data; err = resp.error;
        }
        if ((!all || all.length === 0) && err && (String(err.code) === '42703' || /column .* does not exist/i.test(err.message || ''))) {
            const resp2 = await client
                .from('reports')
                .select('id,user_id,type,candidate_name,title,created_at,markdown_output,content')
                .eq('user_id', user.id)
                .eq('type', 'interview')
                .order('created_at', { ascending: false });
            all = resp2.data;
        }
        const norm = (s) => String(s || '').replace(/[\s\*＊·•●○☆★]/g,'').toLowerCase();
        const getMdFromAny = (r) => {
            try {
                const raw = String(r.markdown_output || '');
                if (raw.trim().startsWith('{')) {
                    let obj = null; try { obj = JSON.parse(raw); } catch { obj = null; }
                    if (obj) {
                        if (typeof obj.resume_md === 'string') return String(obj.resume_md || '');
                        if (typeof obj.md === 'string') return String(obj.md || '');
                        if (typeof obj.ai_analysis_md === 'string') return String(obj.ai_analysis_md || '');
                    }
                }
                const md = raw || String(r.content || '');
                return md;
            } catch { return String(r.content || ''); }
        };
        const mapByName = {};
        for (const r of (all || [])) {
            const md = getMdFromAny(r);
            let cn = String(r.candidate_name || '');
            if ((!cn || !cn.trim()) && md) {
                try { const p = extractSummaryFieldsFromMarkdown(md); cn = p.candidate_name || ''; } catch {}
            }
            const key = norm(cn || r.title || '');
            if (key && !mapByName[key]) mapByName[key] = String(r.id);
        }
        for (const item of pendingList) {
            const key = norm(item.candidate);
            const foundId = mapByName[key];
            if (foundId) {
                try {
                    // Update DOM
                    const escSel = (s) => { try { return CSS.escape(s); } catch { return String(s).replace(/"|'|\\/g,''); } };
                    const card = document.querySelector(`.report-item[data-report-id="${escSel(String(item.id))}"] .report-actions`);
                    if (card && !card.querySelector('.btn-outline-purple')) {
                        card.insertAdjacentHTML('beforeend', renderInterviewRecordButtonHtml(foundId));
                    }
                } catch {}
                try {
                    // Persist to resume markdown_output for next refresh
                    const { data } = await client.from('reports').select('markdown_output,content').eq('id', item.id).limit(1).maybeSingle();
                    let mo = {};
                    const raw = String(data?.markdown_output || '');
                    if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } }
                    else { mo = { md: raw || String(data?.content || '') }; }
                    mo.interview_link_id = String(foundId);
                    await client.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', item.id);
                } catch {}
            }
        }
    } catch {}
}

async function lazyResolveInterviewLinksLocal(pendingList, localItems) {
    try {
        const norm = (s) => String(s || '').replace(/[\s\*＊·•●○☆★]/g,'').toLowerCase();
        const mapByName = {};
        for (const r of localItems) {
            const rt = (r.type ?? r.report_type) || '';
            if (rt !== 'interview') continue;
            let md = '';
            try {
                const raw = String(r.markdown_output || '');
                if (raw.trim().startsWith('{')) {
                    let obj = null; try { obj = JSON.parse(raw); } catch { obj = null; }
                    if (obj) {
                        md = String(obj.resume_md || obj.ai_analysis_md || obj.md || '');
                    }
                }
                if (!md) md = String(r.content || '');
            } catch { md = String(r.content || ''); }
            let cn = String(r.candidate_name || '');
            if (!cn && md) {
                try { const p = extractSummaryFieldsFromMarkdown(md); cn = p.candidate_name || ''; } catch {}
            }
            const key = norm(cn || r.title || '');
            if (key && !mapByName[key]) mapByName[key] = String(r.id);
        }
        const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        const keyLS = user ? `demo_reports_${user.id}` : '';
        let arr = [];
        try { arr = keyLS ? JSON.parse(localStorage.getItem(keyLS) || '[]') : []; } catch { arr = []; }
        for (const item of pendingList) {
            const foundId = mapByName[norm(item.candidate)];
            if (foundId) {
                try {
                    const escSel = (s) => { try { return CSS.escape(s); } catch { return String(s).replace(/"|'|\\/g,''); } };
                    const card = document.querySelector(`.report-item[data-report-id="${escSel(String(item.id))}"] .report-actions`);
                    if (card && !card.querySelector('.btn-outline-purple')) {
                        card.insertAdjacentHTML('beforeend', renderInterviewRecordButtonHtml(foundId));
                    }
                } catch {}
                try {
                    const idx = arr.findIndex(r => String(r.id) === String(item.id));
                    if (idx >= 0) {
                        let mo = {};
                        try { mo = JSON.parse(String(arr[idx].markdown_output || '{}')); } catch { mo = {}; }
                        mo.interview_link_id = String(foundId);
                        arr[idx].markdown_output = JSON.stringify(mo);
                        localStorage.setItem(keyLS, JSON.stringify(arr));
                    }
                    localStorage.setItem('interview_link_' + String(item.id), String(foundId));
                } catch {}
            }
        }
    } catch {}
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
        const moStr = String(data?.markdown_output || '');
        if (moStr.trim().startsWith('{')) {
            try { const mo = JSON.parse(moStr); if (mo && typeof mo.md === 'string') return mo.md; } catch {}
        }
        return (data && (data.content ?? data.markdown_output)) || '';
    } else {
        const key = `demo_reports_${user?.id || ''}`;
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        const found = items.find(r => r.id === reportId);
        if (!found) return '';
        const moStr = String(found.markdown_output || '');
        if (moStr.trim().startsWith('{')) {
            try { const mo = JSON.parse(moStr); if (mo && typeof mo.md === 'string') return mo.md; } catch {}
        }
        return found.content ?? found.markdown_output ?? '';
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

function showLoadingState(on) {
    try { if (on) { showLoading(); } else { hideLoading(); } } catch {}
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
    const strip = (s) => String(s || '').replace(/<br\s*\/>/gi, ' ').replace(/<br>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    const validJob = (s) => {
        const t = strip(s);
        if (!t) return '';
        if (t.length > 40) return '';
        if (/[•\d]\s*[\.)]/.test(t)) return '';
        if (/(匹配度|评估|结论|建议|差距|不足|能力|稳定|经验|画像|要求)/i.test(t)) return '';
        return t;
    };
    const grabHtmlTableCell = (keys) => {
        const re = new RegExp(`<tr[\\s\\S]*?<td[\\s\\S]*?>\\s*(?:${keys.join('|')})\\s*<\\/td>\\s*<td[\\s\\S]*?>\\s*([\\s\\S]*?)<\\/td>`, 'i');
        const m = text.match(re);
        if (m && m[1]) { const v = strip(m[1]); if (v) return v; }
        return '';
    };
    const grab = (regex) => {
        for (const line of lines) {
            if (/^\|/.test(line)) continue;
            const m = line.match(regex);
            if (m && m[1]) return strip(m[1]);
        }
        return '';
    };
    const grabTable = (keys) => {
        for (const line of lines) {
            if (!/^\|/.test(line)) continue;
            const cols = line.split('|').map(s => s.trim());
            for (let i = 0; i < cols.length - 1; i++) {
                const k = cols[i];
                const v = cols[i + 1];
                if (new RegExp(`^(?:${keys.join('|')})$`, 'i').test(k)) {
                    const out = strip(v);
                    if (out) return out;
                }
            }
        }
        return '';
    };
    candidate_name = grab(/^(?:\s*[-*]?\s*)?(?:姓名|候选人|面试者|Name|Candidate|Interviewee)\s*[：:]\s*([^\n]+)/i);
    if (!candidate_name) {
        const t = text.match(/(?:候选人|面试者|姓名|Name|Candidate|Interviewee)\s*[:：]\s*([^\n]+)/i);
        if (t && t[1]) candidate_name = strip(t[1]);
        if (!candidate_name) candidate_name = grabTable(['姓名','候选人','面试者','Name','Candidate','Interviewee']);
    }
    const jobKeys = ['面试岗位','应聘岗位','招聘岗位','岗位名称','职位名称','Job\\s*Title','Position','Role'];
    job_title = grab(new RegExp(`^(?:\\s*[-*]?\\s*)?(?:${jobKeys.join('|')})\\s*[：:]\\s*([^\\n]+)$`, 'i'));
    if (!job_title) job_title = grabTable(['面试岗位','应聘岗位','招聘岗位','岗位名称','职位名称']);
    if (!job_title) {
        const cell = grabHtmlTableCell(['面试岗位','应聘岗位','招聘岗位','岗位名称','职位名称','岗位','Job\\s*Title','Position','Role']);
        if (cell) { const v = validJob(cell); if (v) job_title = v; }
    }
    if (!job_title) {
        for (const line of lines) {
            if (/^\|/.test(line)) continue;
            const h = line.match(/^#{1,6}\s*(.+)$/);
            const src = (h && h[1]) ? h[1] : line;
            const m2 = src.match(/([^\n]+?)\s*岗位(?:人才评估|评估报告|报告|画像)?/);
            if (m2 && validJob(m2[1])) { job_title = validJob(m2[1]); break; }
        }
    }
    if (!job_title) {
        const g = text.match(new RegExp(`(?:${jobKeys.join('|')})\s*[:：]\s*([^\n]+)`, 'i'));
        if (g && g[1]) {
            const v = validJob(g[1]);
            if (v) job_title = v;
        }
    }
    if (!job_title) {
        const mm = Array.from(text.matchAll(new RegExp(`(?:${jobKeys.join('|')})\\s*[:：]?\\s*([^\\n%|]{2,40})`, 'gi'))).map(m => strip(m[1])).filter(x => validJob(x));
        if (mm.length) job_title = mm[mm.length - 1];
    }
    if (!job_title && candidate_name) {
        const mbr = candidate_name.match(/(?:\(|（|\[)\s*([^\)\]）]{2,40})\s*(?:\)|）|\])/);
        if (mbr && mbr[1]) {
            const v = validJob(mbr[1]);
            if (v) {
                job_title = v;
                candidate_name = strip(candidate_name.replace(/(?:\(|（|\[)[^\)\]）]{2,40}(?:\)|）|\])/, ''));
            }
        }
    }
    let scoreStr = null;
    {
        const anchorIdx = (() => {
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i];
                if (/招聘决策摘要|第一部分/i.test(l)) return i;
            }
            return -1;
        })();
        if (anchorIdx !== -1) {
            const end = Math.min(lines.length, anchorIdx + 80);
            const subText = lines.slice(anchorIdx, end).join('\n');
            let mHtml = subText.match(/<td[^>]*>\s*匹配度\s*<\/td>\s*<td[^>]*>\s*([0-9]{1,3})\s*[%％]/i);
            if (mHtml && mHtml[1]) { scoreStr = mHtml[1]; }
            if (!scoreStr) {
                for (let j = anchorIdx; j < end; j++) {
                    const l = lines[j];
                    if (/^\|/.test(l)) {
                        const cols = l.split('|').map(s => s.trim());
                        const isSep = cols.some(c => /^-+$/.test(c));
                        if (isSep) continue;
                        for (let i = 0; i < cols.length - 1; i++) {
                            if (/^匹配度$/i.test(cols[i])) {
                                const m = (cols[i + 1] || '').match(/([0-9]{1,3})\s*[%％]/);
                                if (m) { scoreStr = m[1]; break; }
                            }
                        }
                        if (scoreStr) break;
                    } else {
                        const m = l.match(/匹配度\s*[:：]?\s*([0-9]{1,3})\s*[%％]/i);
                        if (m) { scoreStr = m[1]; break; }
                        if (/匹配度/i.test(l)) {
                            for (let k = j + 1; k < Math.min(j + 4, end); k++) {
                                const lk = lines[k];
                                const mk = lk.match(/([0-9]{1,3})\s*[%％]/);
                                if (mk) { scoreStr = mk[1]; break; }
                            }
                            if (scoreStr) break;
                        }
                    }
            }
        }
    }
    }
    if (!scoreStr) scoreStr = grab(/^(?:\s*[-*]?\s*)?(?:综合匹配度|总体匹配度|总匹配度|岗位匹配度|综合评分|综合匹配|匹配度)\s*[：:]\s*([0-9]{1,3})\s*[%％]/i);
    if (!scoreStr) {
        const cell = grabTable(['综合匹配度','总体匹配度','总匹配度','岗位匹配度','综合评分','匹配度']);
        if (cell) { const m = cell.match(/([0-9]{1,3})\s*%/); if (m) scoreStr = m[1]; }
    }
    if (!scoreStr) {
        const cell2 = grabHtmlTableCell(['综合匹配度','总体匹配度','总匹配度','岗位匹配度','综合评分','匹配度']);
        if (cell2) { const m2 = cell2.match(/([0-9]{1,3})\s*[%％]/); if (m2) scoreStr = m2[1]; }
    }
    if (!scoreStr) {
        const mRow = text.match(/(^|\n)\s*\|\s*匹配度\s*\|\s*([0-9]{1,3})\s*%/mi);
        if (mRow && mRow[2]) scoreStr = mRow[2];
    }
    if (!scoreStr) {
        const sectionRe = /评估结论|候选人详细评估|综合评估|Evaluation|Summary/i;
        for (let i = 0; i < lines.length; i++) {
            if (sectionRe.test(lines[i])) {
                for (let j = i; j < Math.min(i + 20, lines.length); j++) {
                    const l = lines[j];
                    if (/^\|/.test(l)) continue;
                    let m = l.match(/(?:综合匹配度|岗位匹配度|匹配度|综合评分)\s*[：:]\s*([0-9]{1,3})\s*%/i);
                    if (!m) m = l.match(/(?:综合匹配度|岗位匹配度|匹配度|综合评分)\s*([0-9]{1,3})\s*%/i);
                    if (m && m[1]) { scoreStr = m[1]; break; }
                }
                if (scoreStr) break;
            }
        }
    }
    if (!scoreStr) {
        for (const line of lines) {
            if (/^\|/.test(line)) continue;
            if (/命中率|命中数|维度|得分|分值|points|硬性|V-Raise/i.test(line)) continue;
            let m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*[：:]\s*([0-9]{1,3})\s*%/i);
            if (!m) m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*([0-9]{1,3})\s*%/i);
            if (m && m[1]) { scoreStr = m[1]; break; }
        }
    }
    if (!scoreStr) {
        const all = Array.from(text.matchAll(/(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*[:：]?\s*([0-9]{1,3})\s*%/gi)).map(m => m[1]);
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
async function waitForUser(maxMs = 2000) {
  try {
    const u0 = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    if (u0) return u0;
    return await new Promise((resolve) => {
      let done = false;
      const to = setTimeout(() => { if (!done) { done = true; resolve(null); } }, maxMs);
      const handler = (e) => { if (done) return; done = true; clearTimeout(to); try { window.removeEventListener('auth-changed', handler); } catch {} resolve(e.detail?.user || null); };
      try { window.addEventListener('auth-changed', handler, { once: true }); } catch { resolve(null); }
    });
  } catch { return null; }
}
async function trySyncLocalReports(user) {
    try {
        const client = window.Auth && window.Auth.supabase;
        if (!client || !user) return;
        const syncKey = `demo_sync_done_${user.id}`;
        try { if (localStorage.getItem(syncKey) === 'true') return; } catch {}
        const { data: sessionData } = await client.auth.getSession();
        const token = sessionData?.session?.access_token || '';
        if (!token) return;
        const key = `demo_reports_${user.id}`;
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key) || '[]') || []; } catch { items = []; }
        if (!Array.isArray(items) || items.length === 0) return;
        const remain = [];
        for (const it of items) {
            try {
                const payload = {
                    user_id: user.id,
                    title: it.title,
                    report_type: it.report_type || it.type || 'resume',
                    content: it.content || '',
                    markdown_output: it.markdown_output || '',
                    candidate_name: it.candidate_name ?? null,
                    job_title: it.job_title ?? null,
                    match_score: it.match_score ?? null,
                    created_at: it.created_at || new Date().toISOString(),
                };
                const resp = await fetch('/api/reports-save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(payload),
                });
                if (!resp.ok) { remain.push(it); continue; }
            } catch { remain.push(it); }
        }
        try { localStorage.setItem(key, JSON.stringify(remain)); } catch {}
        try { localStorage.setItem(syncKey, 'true'); } catch {}
    } catch {}
}
