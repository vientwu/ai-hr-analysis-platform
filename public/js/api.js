// API 配置：本地联调优先走备用后端；线上默认直连 Coze（使用服务端提供的配置或本地保存的 PAT）
const API_BASE_OVERRIDE = (typeof window !== 'undefined' && window.localStorage)
  ? (window.localStorage.getItem('API_BASE_OVERRIDE') || '')
  : '';
// 在本地静态页（4321）场景下，默认将后端指向 4000（备用 API 服务），避免 3000 聚合器异常影响联调
const API_BASE = API_BASE_OVERRIDE || ((typeof window !== 'undefined' && window.location && window.location.port === '4321')
  ? 'http://127.0.0.1:4000'
  : '');

const API_CONFIG = {
  endpoints: {
    resume: `${API_BASE}/api/resume-analyze`,
    interview: `${API_BASE}/api/interview-analyze`
  }
};

function getCozePAT() {
  try {
    const lsPat = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage.getItem('COZE_PAT') || '' : '';
    const injected = (typeof window !== 'undefined') ? (window.__COZE_CONFIG || {}) : {};
    return lsPat || injected.pat || '';
  } catch { return ''; }
}
function getWorkflowIds() {
  const resumeDefault = '7513777402993016867';
  const interviewDefault = '7514884191588745254';
  try {
    const ls = (typeof window !== 'undefined' && window.localStorage) ? window.localStorage : null;
    const injected = (typeof window !== 'undefined') ? (window.__COZE_CONFIG || {}) : {};
    return {
      resume: (ls && ls.getItem('COZE_RESUME_WORKFLOW_ID')) || injected.resumeWorkflowId || resumeDefault,
      interview: (ls && ls.getItem('COZE_INTERVIEW_WORKFLOW_ID')) || injected.interviewWorkflowId || interviewDefault,
    };
  } catch { return { resume: resumeDefault, interview: interviewDefault }; }
}
async function ensureCozeConfigLoaded() {
  if (typeof window === 'undefined') return;
  if (window.__COZE_CONFIG && (window.__COZE_CONFIG.pat || window.__COZE_CONFIG.resumeWorkflowId)) return;
  try {
    const resp = await fetch('/api/coze-config');
    if (resp.ok) { window.__COZE_CONFIG = await resp.json(); }
  } catch {}
}

async function uploadToCoze(file, pat) {
  if (!pat) throw new Error('未设置 Coze PAT，请联系管理员或在本机保存 COZE_PAT');
  const base64 = await window.fileToBase64(file);
  const blob = base64ToBlob(base64);
  const form = new FormData();
  form.append('file', blob, file.name || 'file.bin');
  const resp = await fetch('https://api.coze.cn/v1/files/upload', { method: 'POST', headers: { Authorization: `Bearer ${pat}` }, body: form });
  if (!resp.ok) throw new Error(`文件上传失败：${resp.status}`);
  const json = await resp.json();
  return json?.data?.file_id || json?.data?.id || json?.file_id || json?.id;
}
async function runWorkflowResume(fileId, jd, pat) {
  const wf = getWorkflowIds().resume;
  const payload = { workflow_id: wf, parameters: { files: [JSON.stringify({ file_id: fileId })], JD: jd || '' } };
  const resp = await fetch('https://api.coze.cn/v1/workflow/run', { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error(`工作流触发失败：${resp.status}`);
  return await resp.json();
}
async function runWorkflowInterview(fileId, name, recordingUrl, pat) {
  const wf = getWorkflowIds().interview;
  const payload = { workflow_id: wf, parameters: { recording_file: JSON.stringify({ file_id: fileId }), name: name || '', recording_url: recordingUrl || '' } };
  const resp = await fetch('https://api.coze.cn/v1/workflow/run', { method: 'POST', headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
  if (!resp.ok) throw new Error(`工作流触发失败：${resp.status}`);
  return await resp.json();
}
function base64ToBlob(base64) {
  const buffer = typeof Buffer !== 'undefined' ? Buffer.from(base64, 'base64') : atob(base64);
  try { return new Blob([buffer]); } catch { return new Blob([new Uint8Array(buffer)]); }
}

// 调用简历分析（线上直连 Coze；本地联调走后端）
async function callResumeAnalysisAPI(resumeFile, jobDescription) {
    try {
        checkFileSizeLimit(resumeFile);
        if (!API_BASE) {
            await ensureCozeConfigLoaded();
            const pat = getCozePAT();
            const fileId = await uploadToCoze(resumeFile, pat);
            const run = await runWorkflowResume(fileId, jobDescription, pat);
            const data = run?.data || run?.result || run?.output || run;
            return { success: true, data, debug: { file_id: fileId } };
        } else {
            const fileBase64 = await window.fileToBase64(resumeFile);
            const response = await fetch(API_CONFIG.endpoints.resume, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: resumeFile.name, fileBase64, jd: jobDescription }) });
            if (!response.ok) { throw new Error(`API请求失败: ${response.status} ${response.statusText}`); }
            return await response.json();
        }
    } catch (error) { console.error('简历分析API调用失败:', error); throw error; }
}

// 调用面试分析（线上直连 Coze；本地联调走后端）
async function callInterviewAnalysisAPI(transcriptFile, intervieweeInfo, recordingLink = '') {
    try {
        checkFileSizeLimit(transcriptFile);
        if (!API_BASE) {
            await ensureCozeConfigLoaded();
            const pat = getCozePAT();
            const fileId = await uploadToCoze(transcriptFile, pat);
            const run = await runWorkflowInterview(fileId, intervieweeInfo, recordingLink, pat);
            const data = run?.data || run?.result || run?.output || run;
            return { success: true, data, debug: { file_id: fileId } };
        } else {
            const fileBase64 = await window.fileToBase64(transcriptFile);
            const response = await fetch(API_CONFIG.endpoints.interview, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileName: transcriptFile.name, fileBase64, name: intervieweeInfo, recordingUrl: recordingLink || '' }) });
            if (!response.ok) { throw new Error(`API请求失败: ${response.status} ${response.statusText}`); }
            return await response.json();
        }
    } catch (error) { console.error('面试分析API调用失败:', error); throw error; }
}

// 测试API连接（后端函数）
async function testAPIConnection() {
    try {
        const response = await fetch(API_CONFIG.endpoints.resume, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName: 'test.txt', fileBase64: '', jd: 'ping' })
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

window.API = { callResumeAnalysisAPI, callInterviewAnalysisAPI, testAPIConnection, handleAPIError, validateAPIResponse, formatAPIResponse, retryAPICall, checkFileSizeLimit, checkFileType };