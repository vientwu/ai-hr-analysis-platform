// API调试工具
class APIDebugger {
    constructor() {
        this.logs = [];
        this.isDebugMode = true;
    }

    log(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            data: data ? JSON.stringify(data, null, 2) : null
        };
        
        this.logs.push(logEntry);
        
        if (this.isDebugMode) {
            console.log(`[${timestamp}] ${message}`, data || '');
        }
    }

    error(message, error = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: 'ERROR',
            message,
            error: error ? error.toString() : null,
            stack: error ? error.stack : null
        };
        
        this.logs.push(logEntry);
        console.error(`[${timestamp}] ERROR: ${message}`, error || '');
    }

    // 验证前后端联通性（不再要求前端PAT，改为检测后端函数是否可用）
    validateAPIConfig() {
        this.log('验证后端接口配置...');
        const issues = [];
        if (!API_CONFIG || !API_CONFIG.endpoints || !API_CONFIG.endpoints.resume || !API_CONFIG.endpoints.interview) {
            issues.push('后端接口未正确配置（API_CONFIG.endpoints 缺失）');
        }
        if (issues.length > 0) {
            this.error('接口配置问题:', issues);
            return false;
        }
        this.log('接口配置验证通过');
        return true;
    }

    // 测试API连接
    async testAPIConnection() {
        this.log('开始测试后端API连接...');
        if (!this.validateAPIConfig()) return false;
        try {
            // 构造一个极小的测试文件
            const testContent = 'Ping backend';
            const testFile = new File([testContent], 'ping.txt', { type: 'text/plain' });
            const fileBase64 = await this.fileToBase64(testFile);
            const resp = await fetch(API_CONFIG.endpoints.resume, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileName: 'ping.txt', fileBase64, jd: 'ping' })
            });
            this.log(`后端连接响应状态: ${resp.status}`);
            const text = await resp.text();
            this.log('后端连接响应内容', text);
            return resp.ok;
        } catch (error) {
            this.error('后端连接测试失败', error);
            return false;
        }
    }

    // 测试文件转换
    async testFileConversion() {
        this.log('开始测试文件转换...');
        
        try {
            // 创建一个测试文件
            const testContent = 'This is a test file content for debugging.';
            const testFile = new File([testContent], 'test.txt', { type: 'text/plain' });
            
            this.log('测试文件信息', {
                name: testFile.name,
                size: testFile.size,
                type: testFile.type
            });

            // 测试Base64转换
            const base64Result = await this.fileToBase64(testFile);
            this.log('Base64转换结果', base64Result.substring(0, 100) + '...');
            
            return true;
        } catch (error) {
            this.error('文件转换测试失败', error);
            return false;
        }
    }

    // 文件转Base64（复制主要逻辑）
    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => {
                const result = reader.result.split(',')[1];
                resolve(result);
            };
            reader.onerror = error => reject(error);
        });
    }

    // 完整的API调用测试
    async testCompleteAPICall() {
        this.log('开始完整API调用测试（后端）...');
        try {
            // 简历分析完整调用
            const resumeContent = 'Name: John Doe\nExperience: 5 years in software development\nSkills: JavaScript, React';
            const resumeFile = new File([resumeContent], 'test-resume.txt', { type: 'text/plain' });
            const resumeResult = await window.API.callResumeAnalysisAPI(resumeFile, 'debug JD: senior JS developer');
            this.log('简历分析后端响应', resumeResult);
            const resumeOk = !!(resumeResult && resumeResult.success !== false);

            // 面试分析完整调用
            const interviewContent = 'Interviewer: Alice\nCandidate: Bob\nSummary: Focused on React performance.';
            const interviewFile = new File([interviewContent], 'test-interview.txt', { type: 'text/plain' });
            const interviewResult = await window.API.callInterviewAnalysisAPI(interviewFile, 'Bob / Senior Engineer', 'https://example.com/recording.mp3');
            this.log('面试分析后端响应', interviewResult);
            const interviewOk = !!(interviewResult && interviewResult.success !== false);

            return { resumeOk, interviewOk };
        } catch (error) {
            this.error('完整API调用（后端）测试失败', error);
            return { resumeOk: false, interviewOk: false };
        }
    }

    // 运行所有测试
    async runAllTests() {
        this.log('=== 开始API调试测试 ===');
        
        const results = {
            connection: await this.testAPIConnection(),
            fileConversion: await this.testFileConversion(),
            completeCall: await this.testCompleteAPICall()
        };

        this.log('=== 测试结果汇总 ===', results);
        
        return results;
    }

    // 获取调试日志
    getLogs() {
        return this.logs;
    }

    // 导出日志
    exportLogs() {
        const logsText = this.logs.map(log => {
            let line = `[${log.timestamp}] ${log.level || 'INFO'}: ${log.message}`;
            if (log.data) {
                line += `\nData: ${log.data}`;
            }
            if (log.error) {
                line += `\nError: ${log.error}`;
            }
            if (log.stack) {
                line += `\nStack: ${log.stack}`;
            }
            return line;
        }).join('\n\n');

        const blob = new Blob([logsText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `api-debug-logs-${new Date().toISOString().slice(0, 19)}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// 创建全局调试器实例
window.debugger = new APIDebugger();

// 添加调试按钮到页面
function addDebugButton() {
    const debugButton = document.createElement('button');
    debugButton.textContent = '🔧 API调试';
    debugButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        background: #ff6b6b;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 5px;
        cursor: pointer;
        font-size: 12px;
    `;
    
    debugButton.onclick = async () => {
        debugButton.textContent = '🔧 测试中...';
        debugButton.disabled = true;
        
        const results = await window.debugger.runAllTests();
        
        debugButton.textContent = '🔧 API调试';
        debugButton.disabled = false;
        
        // 显示结果
        let resultMessage = '';
        for (const [key, val] of Object.entries(results)) {
            if (key === 'completeCall' && typeof val === 'object') {
                resultMessage += `resumeComplete: ${val.resumeOk ? '✅' : '❌'}\n`;
                resultMessage += `interviewComplete: ${val.interviewOk ? '✅' : '❌'}\n`;
            } else {
                resultMessage += `${key}: ${val ? '✅' : '❌'}\n`;
            }
        }
        
        alert(`调试测试结果:\n${resultMessage}\n\n查看控制台获取详细信息`);
    };
    
    document.body.appendChild(debugButton);
}

// 页面加载完成后添加调试按钮
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addDebugButton);
} else {
    addDebugButton();
}