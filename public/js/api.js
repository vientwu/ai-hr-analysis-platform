const API_BASE_OVERRIDE = (typeof window !== 'undefined' && window.localStorage)
  ? (window.localStorage.getItem('API_BASE_OVERRIDE') || '')
  : '';
const API_BASE = API_BASE_OVERRIDE || ((typeof window !== 'undefined' && window.location && (window.location.port === '4321' || window.location.port === '4000'))
  ? 'http://127.0.0.1:4000'
  : '');

const API_CONFIG = {
  endpoints: {
    parse: `${API_BASE}/api/parse-doc`,
    chat: `${API_BASE}/api/llm-chat`
  }
};

if (typeof window !== 'undefined') {
  try { window.API_BASE = API_BASE; } catch {}
  try { window.API_URL = function(path) { return API_BASE ? (API_BASE + path) : path; }; } catch {}
}

async function callResumeAnalysisAPI(resumeFile, jobDescription, promptText = '') {
  try {
    checkFileSizeLimit(resumeFile);
    const uid = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser().then(u=>u?.id).catch(()=>null) : null);
    let settings = null;
    try { settings = await (window.getUserKey ? window.getUserKey() : null); } catch { settings = null; }
    if (!settings) {
      try {
        const k = uid ? `openrouter_settings_${uid}` : 'openrouter_settings_guest';
        settings = JSON.parse(localStorage.getItem(k) || 'null');
      } catch { settings = null; }
    }
    const provider = String(settings?.provider || 'openrouter');
    const model = String((settings?.customModel || settings?.model || 'anthropic/claude-3.5-sonnet'));
    const key = String((settings?.keys && settings?.keys[provider]) || settings?.apiKey || '');
    if (!key) throw new Error('未设置API Key或密钥为空');
    const fileBase64 = await window.fileToBase64(resumeFile);
    const parseResp = await fetch(API_CONFIG.endpoints.parse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: resumeFile.name, mime: resumeFile.type || '', dataBase64: fileBase64 }) });
    let parsed = null; try { parsed = await parseResp.json(); } catch { parsed = null; }
    if (!parseResp.ok) throw new Error((parsed && parsed.error) || '解析失败');
    const resumeText = String(parsed?.text || '');
    const basePrompt = promptText || '';
    const msg = `${basePrompt}\n\n【简历】\n${resumeText}\n\n【岗位JD】\n${jobDescription || ''}`;
    const messages = [{ role: 'system', content: '你是资深招聘分析专家，输出结构化中文报告。' }, { role: 'user', content: msg }];
    const chatResp = await fetch(API_CONFIG.endpoints.chat, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Provider': provider, 'X-Provider-Key': key }, body: JSON.stringify({ provider, model, messages, temperature: 0.05, max_tokens: 8000 }) });
    const json = await chatResp.json();
    if (!chatResp.ok) throw new Error(json?.error?.message || '分析失败');
    const text = String(json?.text || '').trim();
    const data = { text };
    return { success: true, data };
  } catch (error) {
    console.error('简历分析API调用失败:', error);
    throw error;
  }
}

async function callInterviewAnalysisAPI(transcriptFile, intervieweeInfo, recordingLink = '') {
  try {
    checkFileSizeLimit(transcriptFile);
    const uid = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser().then(u=>u?.id).catch(()=>null) : null);
    let settings = null;
    try { settings = await (window.getUserKey ? window.getUserKey() : null); } catch { settings = null; }
    if (!settings) {
      try {
        const k = uid ? `openrouter_settings_${uid}` : 'openrouter_settings_guest';
        settings = JSON.parse(localStorage.getItem(k) || 'null');
      } catch { settings = null; }
    }
    const provider = String(settings?.provider || 'openrouter');
    const model = String((settings?.customModel || settings?.model || 'anthropic/claude-3.5-sonnet'));
    const key = String((settings?.keys && settings?.keys[provider]) || settings?.apiKey || '');
    if (!key) throw new Error('未设置API Key或密钥为空');
    const fileBase64 = await window.fileToBase64(transcriptFile);
    const parseResp = await fetch(API_CONFIG.endpoints.parse, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: transcriptFile.name, mime: transcriptFile.type || '', dataBase64: fileBase64 }) });
    let parsed = null; try { parsed = await parseResp.json(); } catch { parsed = null; }
    if (!parseResp.ok) throw new Error((parsed && parsed.error) || '解析失败');
    const transText = String(parsed?.text || '');
    const basePrompt = String((settings?.prompts?.interviewComprehensive || '')).trim();
    const msg = `${basePrompt || '你是资深面试评估专家，输出结构化中文结论。'}\n\n[面试者]\n${intervieweeInfo || ''}\n\n[转写记录]\n${transText}\n\n[录音链接]\n${recordingLink || ''}`;
    const messages = [{ role: 'system', content: '你是资深面试评估专家，输出中文结论。' }, { role: 'user', content: msg }];
    const chatResp = await fetch(API_CONFIG.endpoints.chat, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Provider': provider, 'X-Provider-Key': key }, body: JSON.stringify({ provider, model, messages, temperature: 0.2 }) });
    const json = await chatResp.json();
    if (!chatResp.ok) throw new Error(json?.error?.message || '分析失败');
    const text = String(json?.text || '').trim();
    const data = { text };
    return { success: true, data };
  } catch (error) {
    console.error('面试分析API调用失败:', error);
    throw error;
  }
}

// 测试API连接（后端函数）
async function testAPIConnection() {
    try {
        const response = await fetch(API_CONFIG.endpoints.chat, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Provider': 'openrouter', 'X-Provider-Key': 'test' },
            body: JSON.stringify({ provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet', messages: [{ role: 'user', content: 'ping' }], max_tokens: 8 })
        });
        return response.ok;
    } catch (error) {
        console.error('API连接测试失败:', error);
        return false;
    }
}

function handleAPIError(error) {
    let errorMessage = '服务暂时不可用，请稍后重试';
    if (error.message.includes('401')) { errorMessage = 'API认证失败，请检查访问令牌'; }
    else if (error.message.includes('403')) { errorMessage = '没有访问权限，请检查工作流权限'; }
    else if (error.message.includes('404')) { errorMessage = '工作流不存在，请检查工作流ID'; }
    else if (error.message.includes('429')) { errorMessage = '请求过于频繁，请稍后重试'; }
    else if (error.message.includes('500')) { errorMessage = '服务器内部错误，请联系技术支持'; }
    else if (error.message.includes('network')) { errorMessage = '网络连接失败，请检查网络设置'; }
    return errorMessage;
}

function validateAPIResponse(response) {
    if (!response) throw new Error('API响应为空');
    if (response.error) throw new Error(`API错误: ${response.error.message || response.error}`);
    return true;
}

function formatAPIResponse(response) {
    try {
        if (response.data) { return { success: true, data: response.data, message: response.message || '分析完成' }; }
        else if (response.result) { return { success: true, data: response.result, message: '分析完成' }; }
        else { return { success: true, data: JSON.stringify(response, null, 2), message: '分析完成' }; }
    } catch (error) {
        console.error('格式化API响应失败:', error);
        return { success: false, data: '响应格式化失败', message: '处理结果时出现错误' };
    }
}

async function retryAPICall(apiFunction, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try { return await apiFunction(); }
        catch (error) { console.log(`API调用失败，第${i + 1}次重试:`, error.message); if (i === maxRetries - 1) throw error; await new Promise(resolve => setTimeout(resolve, delay * (i + 1))); }
    }
}

function checkFileSizeLimit(file, maxSizeMB = 500) {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) throw new Error(`文件大小超过限制。最大支持 ${maxSizeMB}MB，当前文件 ${fileSizeMB.toFixed(2)}MB`);
    return true;
}

function checkFileType(file, allowedTypes) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) throw new Error(`不支持的文件格式。请上传 ${allowedTypes.join(', ').toUpperCase()} 格式的文件`);
    return true;
}

// 导出API函数供全局使用
window.API = {
    callResumeAnalysisAPI,
    callInterviewAnalysisAPI,
    testAPIConnection,
    handleAPIError,
    validateAPIResponse,
    formatAPIResponse,
    retryAPICall,
    checkFileSizeLimit,
    checkFileType
};
