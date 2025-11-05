/**
 * 全局错误处理模块
 * 提供统一的错误处理、日志记录和用户友好的错误提示
 */

class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxLogSize = 100;
        this.setupGlobalErrorHandlers();
    }

    /**
     * 设置全局错误处理器
     */
    setupGlobalErrorHandlers() {
        // 捕获未处理的JavaScript错误
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: new Date().toISOString()
            });
        });

        // 捕获未处理的Promise拒绝
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || '未处理的Promise拒绝',
                reason: event.reason,
                timestamp: new Date().toISOString()
            });
        });

        // 捕获资源加载错误
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'resource',
                    message: `资源加载失败: ${event.target.src || event.target.href}`,
                    element: event.target.tagName,
                    timestamp: new Date().toISOString()
                });
            }
        }, true);
    }

    /**
     * 处理错误
     * @param {Object} errorInfo - 错误信息
     */
    handleError(errorInfo) {
        // 记录错误日志
        this.logError(errorInfo);

        // 根据错误类型显示用户友好的提示
        this.showUserFriendlyError(errorInfo);

        // 在开发环境下输出详细错误信息
        if (this.isDevelopment()) {
            console.error('错误详情:', errorInfo);
        }
    }

    /**
     * 记录错误日志
     * @param {Object} errorInfo - 错误信息
     */
    logError(errorInfo) {
        this.errorLog.push(errorInfo);
        
        // 限制日志大小
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }

        // 可以在这里添加发送错误日志到服务器的逻辑
        this.sendErrorToServer(errorInfo);
    }

    /**
     * 显示用户友好的错误提示
     * @param {Object} errorInfo - 错误信息
     */
    showUserFriendlyError(errorInfo) {
        let userMessage = '';
        let errorType = 'error';

        switch (errorInfo.type) {
            case 'network':
                userMessage = '网络连接异常，请检查您的网络设置后重试';
                break;
            case 'api':
                userMessage = this.getAPIErrorMessage(errorInfo);
                break;
            case 'file':
                userMessage = '文件处理失败，请检查文件格式和大小';
                break;
            case 'auth':
                userMessage = '身份验证失败，请重新登录';
                break;
            case 'database':
                userMessage = this.getDatabaseErrorMessage(errorInfo);
                break;
            case 'validation':
                userMessage = errorInfo.message || '输入数据验证失败';
                errorType = 'warning';
                break;
            case 'resource':
                userMessage = '资源加载失败，请刷新页面重试';
                break;
            case 'system':
                userMessage = errorInfo.message || '系统出现异常，请稍后重试';
                break;
            default:
                userMessage = '系统出现异常，请稍后重试';
        }

        // 显示通知
        if (window.NotificationManager) {
            window.NotificationManager.show(userMessage, errorType);
        } else {
            alert(userMessage);
        }
    }

    /**
     * 获取API错误消息
     * @param {Object} errorInfo - 错误信息
     * @returns {string} 用户友好的错误消息
     */
    getAPIErrorMessage(errorInfo) {
        const status = errorInfo.status;
        const code = errorInfo.code;

        if (status === 400) {
            return '请求参数错误，请检查输入内容';
        } else if (status === 401) {
            return '身份验证失败，请重新登录';
        } else if (status === 403) {
            return '权限不足，无法执行此操作';
        } else if (status === 404) {
            return '请求的资源不存在';
        } else if (status === 429) {
            return '请求过于频繁，请稍后再试';
        } else if (status >= 500) {
            return '服务器内部错误，请稍后重试';
        } else if (code === 'TIMEOUT') {
            return '请求超时，请检查网络连接后重试';
        } else if (code === 'NETWORK_ERROR') {
            return '网络连接失败，请检查网络设置';
        } else {
            return errorInfo.message || 'API调用失败，请稍后重试';
        }
    }

    /**
     * 获取数据库错误消息
     * @param {Object} errorInfo
     * @returns {string}
     */
    getDatabaseErrorMessage(errorInfo) {
        const code = errorInfo.code;
        const message = errorInfo.message || '';

        // 常见 PostgREST / Postgres 错误码处理
        if (code === 'PGRST204') {
            return '数据库列不存在或请求字段与表结构不匹配，请刷新后重试（或联系开发修复字段映射）';
        }
        if (code === 'PGRST205') {
            return '数据库表不存在或未部署，请检查数据库迁移是否完成';
        }
        if (code === '42501') { // insufficient_privilege
            return '没有执行此操作的权限，可能是行级安全策略(RLS)限制或未登录';
        }
        if (code === '23505') { // unique_violation
            return '重复数据冲突（唯一约束违反），请检查是否重复提交';
        }

        // 未识别的错误码，回退到通用消息
        return message || '数据库操作失败，请稍后重试';
    }

    /**
     * 处理API错误
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    handleAPIError(error, context = {}) {
        const errorInfo = {
            type: 'api',
            message: error.message,
            status: error.status || context.status,
            code: error.code || context.code,
            url: context.url,
            method: context.method,
            timestamp: new Date().toISOString(),
            context
        };

        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 处理网络错误
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    handleNetworkError(error, context = {}) {
        const errorInfo = {
            type: 'network',
            message: error.message,
            code: 'NETWORK_ERROR',
            timestamp: new Date().toISOString(),
            context
        };

        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 处理文件错误
     * @param {Error} error - 错误对象
     * @param {Object} context - 错误上下文
     */
    handleFileError(error, context = {}) {
        const errorInfo = {
            type: 'file',
            message: error.message,
            filename: context.filename,
            filesize: context.filesize,
            filetype: context.filetype,
            timestamp: new Date().toISOString(),
            context
        };

        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 处理数据库错误
     * @param {Error|Object} error
     * @param {Object} context
     */
    handleDatabaseError(error, context = {}) {
        const errorInfo = {
            type: 'database',
            message: error?.message || context?.message || '数据库操作失败',
            code: error?.code || context?.code,
            status: error?.status || context?.status,
            details: error?.details || context?.details,
            table: context?.table,
            operation: context?.operation,
            timestamp: new Date().toISOString(),
            context
        };

        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 处理验证错误
     * @param {string} message - 错误消息
     * @param {Object} context - 错误上下文
     */
    handleValidationError(message, context = {}) {
        const errorInfo = {
            type: 'validation',
            message,
            timestamp: new Date().toISOString(),
            context
        };

        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 处理认证错误
     * @param {Error|Object} error
     * @param {Object} context
     */
    handleAuthError(error, context = {}) {
        const errorInfo = {
            type: 'auth',
            message: error?.message || '身份验证失败',
            code: error?.code,
            timestamp: new Date().toISOString(),
            context
        };
        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 处理系统错误（初始化失败等）
     * @param {Error|Object} error
     * @param {string} message
     * @param {Object} context
     */
    handleSystemError(error, message = '系统错误', context = {}) {
        const errorInfo = {
            type: 'system',
            message,
            originalError: error,
            timestamp: new Date().toISOString(),
            context
        };
        this.handleError(errorInfo);
        return errorInfo;
    }

    /**
     * 发送错误日志到服务器
     * @param {Object} errorInfo - 错误信息
     */
    async sendErrorToServer(errorInfo) {
        // 只在生产环境发送错误日志
        if (!this.isProduction()) {
            return;
        }

        try {
            // 这里可以实现发送错误日志到服务器的逻辑
            // 例如发送到日志收集服务
            console.log('发送错误日志到服务器:', errorInfo);
        } catch (error) {
            console.error('发送错误日志失败:', error);
        }
    }

    /**
     * 获取错误日志
     * @returns {Array} 错误日志数组
     */
    getErrorLog() {
        return [...this.errorLog];
    }

    /**
     * 清空错误日志
     */
    clearErrorLog() {
        this.errorLog = [];
    }

    /**
     * 检查是否为开发环境
     * @returns {boolean}
     */
    isDevelopment() {
        return window.location.hostname === 'localhost' || 
               window.location.hostname === '127.0.0.1' ||
               window.location.protocol === 'file:';
    }

    /**
     * 检查是否为生产环境
     * @returns {boolean}
     */
    isProduction() {
        return !this.isDevelopment();
    }

    /**
     * 创建错误重试机制
     * @param {Function} fn - 要重试的函数
     * @param {number} maxRetries - 最大重试次数
     * @param {number} delay - 重试延迟（毫秒）
     * @returns {Function} 包装后的函数
     */
    createRetryWrapper(fn, maxRetries = 3, delay = 1000) {
        return async (...args) => {
            let lastError;
            
            for (let i = 0; i <= maxRetries; i++) {
                try {
                    return await fn(...args);
                } catch (error) {
                    lastError = error;
                    
                    if (i === maxRetries) {
                        this.handleError({
                            type: 'retry_failed',
                            message: `重试${maxRetries}次后仍然失败: ${error.message}`,
                            originalError: error,
                            timestamp: new Date().toISOString()
                        });
                        throw error;
                    }
                    
                    // 等待后重试
                    await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
                }
            }
        };
    }
}

// 创建全局错误处理器实例
window.ErrorHandler = new ErrorHandler();

// 导出错误处理器
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}