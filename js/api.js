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
  // 注意：这些是占位符，不是真实的敏感信息
  debugToken: 'placeholder_token',
  debugSpaceId: 'placeholder_space',
  debugWorkflows: {
    resume: 'placeholder_workflow',
    interview: 'placeholder_workflow'
  }
};

// 注意：前端不再直接上传到 Coze，改为由后端函数处理。

// 调用简历分析（通过后端函数）
async function callResumeAnalysisAPI(resumeFile, jobDescription) {
    try {
        checkFileSizeLimit(resumeFile); // 仍保留前端尺寸校验
        
        // 使用重试机制
        return await retryAPICall(async () => {
            const fileBase64 = await window.fileToBase64(resumeFile);
            
            // 创建AbortController用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
            
            try {
                const response = await fetch(API_CONFIG.endpoints.resume, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify({
                        fileName: resumeFile.name,
                        fileBase64,
                        jd: jobDescription
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
                }
                
                const result = await response.json();
                return result; // 保持 { success, data, debug_url? } 结构
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('请求超时，请检查网络连接');
                }
                throw fetchError;
            }
        }, 3, 2000); // 最多重试3次，间隔2秒
        
    } catch (error) {
        console.error('简历分析API调用失败:', error);
        throw error;
    }
}

// 调用面试分析（通过后端函数）
async function callInterviewAnalysisAPI(transcriptFile, intervieweeInfo, recordingLink = '') {
    try {
        checkFileSizeLimit(transcriptFile);
        
        // 使用重试机制
        return await retryAPICall(async () => {
            const fileBase64 = await window.fileToBase64(transcriptFile);
            
            // 创建AbortController用于超时控制
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
            
            try {
                const response = await fetch(API_CONFIG.endpoints.interview, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache'
                    },
                    body: JSON.stringify({
                        fileName: transcriptFile.name,
                        fileBase64,
                        name: intervieweeInfo,
                        recordingUrl: recordingLink || ''
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`API请求失败: ${response.status} ${response.statusText}\n${errorText}`);
                }
                
                const result = await response.json();
                return result; // 保持 { success, data, debug_url? } 结构
            } catch (fetchError) {
                clearTimeout(timeoutId);
                if (fetchError.name === 'AbortError') {
                    throw new Error('请求超时，请检查网络连接');
                }
                throw fetchError;
            }
        }, 3, 2000); // 最多重试3次，间隔2秒
        
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
function handleAPIError(error, context = {}) {
    // 使用全局错误处理器
    if (window.ErrorHandler) {
        return window.ErrorHandler.handleAPIError(error, context);
    }
    
    // 降级处理（如果全局错误处理器不可用）
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
    } else if (error.message.includes('超时')) {
        errorMessage = '请求超时，请检查网络连接后重试';
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
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
        const error = new Error(`文件大小超过限制（${maxSizeMB}MB），当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`);
        
        // 使用全局错误处理器
        if (window.ErrorHandler) {
            window.ErrorHandler.handleFileError(error, {
                filename: file.name,
                filesize: file.size,
                filetype: file.type,
                maxSize: maxSizeBytes
            });
        }
        
        throw error;
    }
    return true;
}

// 判断是否是可重试的错误
function isRetryableError(error) {
    // 网络错误、超时错误、服务器错误（5xx）可以重试
    if (error.name === 'AbortError') return false; // 超时不重试
    if (error.message.includes('Failed to fetch')) return true; // 网络错误
    if (error.message.includes('500') || error.message.includes('502') || 
        error.message.includes('503') || error.message.includes('504')) return true; // 服务器错误
    if (error.message.includes('timeout')) return true; // 超时错误
    
    return false; // 其他错误不重试
}

// 检查文件类型
function checkFileType(file, allowedTypes) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
        const error = new Error(`不支持的文件格式。请上传 ${allowedTypes.join(', ').toUpperCase()} 格式的文件`);
        
        // 使用全局错误处理器
        if (window.ErrorHandler) {
            window.ErrorHandler.handleFileError(error, {
                filename: file.name,
                filesize: file.size,
                filetype: file.type,
                allowedTypes: allowedTypes
            });
        }
        
        throw error;
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