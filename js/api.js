// API配置（改为调用 Vercel Serverless Functions，前端不再使用 PAT）
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
  },
  // 以下为调试工具（debug.js）使用的占位配置，避免页面运行时报错
  // 生产环境不使用这些字段，保持占位即可
  token: 'pat_xxx',
  spaceId: 'xxx',
  workflows: {
    resume: 'xxx',
    interview: 'xxx'
  }
};

// 注意：前端不再直接上传到 Coze，改为由后端函数处理。

// 调用简历分析（通过后端函数）
async function callResumeAnalysisAPI(resumeFile, jobDescription) {
    try {
        checkFileSizeLimit(resumeFile); // 仍保留前端尺寸校验
        const fileBase64 = await window.fileToBase64(resumeFile);
        const response = await fetch(API_CONFIG.endpoints.resume, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: resumeFile.name,
                fileBase64,
                jd: jobDescription
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
        }
        const result = await response.json();
        return result; // 保持 { success, data, debug_url? } 结构
    } catch (error) {
        console.error('简历分析API调用失败:', error);
        throw error;
    }
}

// 调用面试分析（通过后端函数）
async function callInterviewAnalysisAPI(transcriptFile, intervieweeInfo, recordingLink = '') {
    try {
        checkFileSizeLimit(transcriptFile);
        const fileBase64 = await window.fileToBase64(transcriptFile);
        const response = await fetch(API_CONFIG.endpoints.interview, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                fileName: transcriptFile.name,
                fileBase64,
                name: intervieweeInfo,
                recordingUrl: recordingLink || ''
            })
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
        }
        const result = await response.json();
        return result; // 保持 { success, data, debug_url? } 结构
    } catch (error) {
        console.error('面试分析API调用失败:', error);
        throw error;
    }
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

// 处理API错误
function handleAPIError(error) {
    let errorMessage = '服务暂时不可用，请稍后重试';
    
    if (error.message.includes('401')) {
        errorMessage = 'API认证失败，请检查访问令牌';
    } else if (error.message.includes('403')) {
        errorMessage = '没有访问权限，请检查工作流权限';
    } else if (error.message.includes('404')) {
        errorMessage = '工作流不存在，请检查工作流ID';
    } else if (error.message.includes('429')) {
        errorMessage = '请求过于频繁，请稍后重试';
    } else if (error.message.includes('500')) {
        errorMessage = '服务器内部错误，请联系技术支持';
    } else if (error.message.includes('network')) {
        errorMessage = '网络连接失败，请检查网络设置';
    }
    
    return errorMessage;
}

// 验证API响应
function validateAPIResponse(response) {
    if (!response) {
        throw new Error('API响应为空');
    }
    
    if (response.error) {
        throw new Error(`API错误: ${response.error.message || response.error}`);
    }
    
    return true;
}

// 格式化API响应数据
function formatAPIResponse(response) {
    try {
        // 根据实际API响应结构调整
        if (response.data) {
            return {
                success: true,
                data: response.data,
                message: response.message || '分析完成'
            };
        } else if (response.result) {
            return {
                success: true,
                data: response.result,
                message: '分析完成'
            };
        } else {
            return {
                success: true,
                data: JSON.stringify(response, null, 2),
                message: '分析完成'
            };
        }
    } catch (error) {
        console.error('格式化API响应失败:', error);
        return {
            success: false,
            data: '响应格式化失败',
            message: '处理结果时出现错误'
        };
    }
}

// 重试机制
async function retryAPICall(apiFunction, maxRetries = 3, delay = 1000) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await apiFunction();
        } catch (error) {
            console.log(`API调用失败，第${i + 1}次重试:`, error.message);
            
            if (i === maxRetries - 1) {
                throw error;
            }
            
            // 等待后重试
            await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
    }
}

// 检查文件大小限制
function checkFileSizeLimit(file, maxSizeMB = 500) {
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
        throw new Error(`文件大小超过限制。最大支持 ${maxSizeMB}MB，当前文件 ${fileSizeMB.toFixed(2)}MB`);
    }
    return true;
}

// 检查文件类型
function checkFileType(file, allowedTypes) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
        throw new Error(`不支持的文件格式。请上传 ${allowedTypes.join(', ').toUpperCase()} 格式的文件`);
    }
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