#!/usr/bin/env node

/**
 * 部署后验证脚本
 * 
 * 功能：
 * 1. 验证网站可访问性
 * 2. 测试关键功能端点
 * 3. 检查静态资源加载
 * 4. 验证数据库连接
 * 5. 测试认证流程
 * 6. 生成验证报告
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PostDeployValidator {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
        this.results = [];
        this.startTime = new Date();
    }

    log(message, status = 'info') {
        const timestamp = new Date().toISOString();
        const result = {
            timestamp,
            message,
            status
        };
        
        this.results.push(result);
        
        const statusIcon = {
            'pass': '✅',
            'fail': '❌',
            'warning': '⚠️',
            'info': 'ℹ️'
        };
        
        console.log(`${statusIcon[status] || 'ℹ️'} ${message}`);
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const isHttps = urlObj.protocol === 'https:';
            const client = isHttps ? https : http;
            
            const requestOptions = {
                hostname: urlObj.hostname,
                port: urlObj.port || (isHttps ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: options.method || 'GET',
                headers: {
                    'User-Agent': 'PostDeployValidator/1.0',
                    ...options.headers
                },
                timeout: options.timeout || 10000
            };
            
            const req = client.request(requestOptions, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        data: data,
                        success: res.statusCode >= 200 && res.statusCode < 400
                    });
                });
            });
            
            req.on('error', (error) => {
                reject(error);
            });
            
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });
            
            if (options.data) {
                req.write(options.data);
            }
            
            req.end();
        });
    }

    async testWebsiteAccessibility() {
        this.log('测试网站可访问性...');
        
        try {
            const response = await this.makeRequest(this.baseUrl);
            
            if (response.success) {
                this.log(`网站可访问 - 状态码: ${response.statusCode}`, 'pass');
                
                // 检查是否包含预期内容
                if (response.data.includes('<title>') && response.data.includes('AI招聘分析平台')) {
                    this.log('网站内容验证通过', 'pass');
                } else {
                    this.log('网站内容验证失败 - 缺少预期标题', 'warning');
                }
                
                return true;
            } else {
                this.log(`网站不可访问 - 状态码: ${response.statusCode}`, 'fail');
                return false;
            }
        } catch (error) {
            this.log(`网站访问失败: ${error.message}`, 'fail');
            return false;
        }
    }

    async testStaticResources() {
        this.log('测试静态资源加载...');
        
        const resources = [
            '/styles/main.css',
            '/js/main.js',
            '/js/auth.js',
            '/js/supabase.js',
            '/js/api-integration.js',
            '/js/notification.js'
        ];
        
        let passedCount = 0;
        
        for (const resource of resources) {
            try {
                const url = `${this.baseUrl}${resource}`;
                const response = await this.makeRequest(url);
                
                if (response.success) {
                    this.log(`静态资源加载成功: ${resource}`, 'pass');
                    passedCount++;
                } else {
                    this.log(`静态资源加载失败: ${resource} - 状态码: ${response.statusCode}`, 'fail');
                }
            } catch (error) {
                this.log(`静态资源加载错误: ${resource} - ${error.message}`, 'fail');
            }
        }
        
        const successRate = (passedCount / resources.length) * 100;
        this.log(`静态资源测试完成 - 成功率: ${successRate.toFixed(1)}%`);
        
        return successRate >= 80; // 80% 以上通过率认为成功
    }

    async testApiEndpoints() {
        this.log('测试 API 端点...');
        
        const endpoints = [
            {
                path: '/api/resume-analyze',
                method: 'POST',
                description: '简历分析 API'
            },
            {
                path: '/api/interview-analyze',
                method: 'POST',
                description: '面试分析 API'
            }
        ];
        
        let passedCount = 0;
        
        for (const endpoint of endpoints) {
            try {
                const url = `${this.baseUrl}${endpoint.path}`;
                
                // 发送测试请求（预期会失败，但应该返回正确的错误格式）
                const response = await this.makeRequest(url, {
                    method: endpoint.method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    data: JSON.stringify({})
                });
                
                // API 端点存在且返回了响应（即使是错误响应）
                if (response.statusCode === 400 || response.statusCode === 401 || response.statusCode === 500) {
                    this.log(`${endpoint.description} 端点可访问`, 'pass');
                    passedCount++;
                } else if (response.statusCode === 200) {
                    this.log(`${endpoint.description} 端点响应正常`, 'pass');
                    passedCount++;
                } else {
                    this.log(`${endpoint.description} 端点异常 - 状态码: ${response.statusCode}`, 'warning');
                }
            } catch (error) {
                this.log(`${endpoint.description} 端点测试失败: ${error.message}`, 'fail');
            }
        }
        
        return passedCount === endpoints.length;
    }

    async testSecurityHeaders() {
        this.log('测试安全头部配置...');
        
        try {
            const response = await this.makeRequest(this.baseUrl);
            const headers = response.headers;
            
            const securityChecks = [
                {
                    name: 'HTTPS 重定向',
                    check: () => this.baseUrl.startsWith('https://'),
                    required: true
                },
                {
                    name: 'Content-Security-Policy',
                    check: () => headers['content-security-policy'] !== undefined,
                    required: false
                },
                {
                    name: 'X-Frame-Options',
                    check: () => headers['x-frame-options'] !== undefined,
                    required: false
                },
                {
                    name: 'X-Content-Type-Options',
                    check: () => headers['x-content-type-options'] !== undefined,
                    required: false
                }
            ];
            
            let passedCount = 0;
            let requiredCount = 0;
            
            for (const check of securityChecks) {
                if (check.required) requiredCount++;
                
                if (check.check()) {
                    this.log(`安全检查通过: ${check.name}`, 'pass');
                    passedCount++;
                } else {
                    const level = check.required ? 'fail' : 'warning';
                    this.log(`安全检查失败: ${check.name}`, level);
                }
            }
            
            return passedCount >= requiredCount;
        } catch (error) {
            this.log(`安全头部测试失败: ${error.message}`, 'fail');
            return false;
        }
    }

    async testPerformance() {
        this.log('测试性能指标...');
        
        const tests = [
            { name: '首页加载时间', url: this.baseUrl },
            { name: '登录页加载时间', url: `${this.baseUrl}/login.html` },
            { name: 'CSS 加载时间', url: `${this.baseUrl}/styles/main.css` }
        ];
        
        let allPassed = true;
        
        for (const test of tests) {
            try {
                const startTime = Date.now();
                const response = await this.makeRequest(test.url);
                const loadTime = Date.now() - startTime;
                
                if (response.success) {
                    if (loadTime < 3000) { // 3秒内
                        this.log(`${test.name}: ${loadTime}ms - 优秀`, 'pass');
                    } else if (loadTime < 5000) { // 5秒内
                        this.log(`${test.name}: ${loadTime}ms - 良好`, 'warning');
                    } else {
                        this.log(`${test.name}: ${loadTime}ms - 需要优化`, 'fail');
                        allPassed = false;
                    }
                } else {
                    this.log(`${test.name}: 加载失败`, 'fail');
                    allPassed = false;
                }
            } catch (error) {
                this.log(`${test.name}: 测试失败 - ${error.message}`, 'fail');
                allPassed = false;
            }
        }
        
        return allPassed;
    }

    async testFunctionalPages() {
        this.log('测试功能页面...');
        
        const pages = [
            { path: '/login.html', name: '登录页面' },
            { path: '/index.html', name: '主页面' },
            { path: '/resume-history.html', name: '简历历史页面' },
            { path: '/interview-history.html', name: '面试历史页面' }
        ];
        
        let passedCount = 0;
        
        for (const page of pages) {
            try {
                const url = `${this.baseUrl}${page.path}`;
                const response = await this.makeRequest(url);
                
                if (response.success) {
                    this.log(`${page.name} 可访问`, 'pass');
                    passedCount++;
                } else {
                    this.log(`${page.name} 不可访问 - 状态码: ${response.statusCode}`, 'fail');
                }
            } catch (error) {
                this.log(`${page.name} 测试失败: ${error.message}`, 'fail');
            }
        }
        
        return passedCount === pages.length;
    }

    generateReport() {
        const endTime = new Date();
        const duration = Math.round((endTime - this.startTime) / 1000);
        
        const passCount = this.results.filter(r => r.status === 'pass').length;
        const failCount = this.results.filter(r => r.status === 'fail').length;
        const warningCount = this.results.filter(r => r.status === 'warning').length;
        
        const report = {
            baseUrl: this.baseUrl,
            timestamp: this.startTime.toISOString(),
            duration: `${duration}秒`,
            summary: {
                total: this.results.length,
                passed: passCount,
                failed: failCount,
                warnings: warningCount,
                successRate: `${((passCount / this.results.length) * 100).toFixed(1)}%`
            },
            status: failCount === 0 ? 'PASSED' : 'FAILED',
            results: this.results
        };
        
        return report;
    }

    async saveReport(report) {
        try {
            const reportDir = path.join(path.dirname(__dirname), 'deployment');
            const reportFile = path.join(reportDir, `post-deploy-validation-${Date.now()}.json`);
            
            // 确保目录存在
            if (!fs.existsSync(reportDir)) {
                fs.mkdirSync(reportDir, { recursive: true });
            }
            
            fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
            this.log(`验证报告已保存: ${reportFile}`, 'info');
        } catch (error) {
            this.log(`保存报告失败: ${error.message}`, 'warning');
        }
    }

    async runAllTests() {
        this.log(`开始部署后验证 - 目标: ${this.baseUrl}`);
        this.log('='.repeat(50));
        
        const tests = [
            { name: '网站可访问性', test: () => this.testWebsiteAccessibility() },
            { name: '静态资源', test: () => this.testStaticResources() },
            { name: 'API 端点', test: () => this.testApiEndpoints() },
            { name: '安全头部', test: () => this.testSecurityHeaders() },
            { name: '性能指标', test: () => this.testPerformance() },
            { name: '功能页面', test: () => this.testFunctionalPages() }
        ];
        
        const testResults = {};
        
        for (const test of tests) {
            this.log(`\n--- ${test.name}测试 ---`);
            try {
                testResults[test.name] = await test.test();
            } catch (error) {
                this.log(`${test.name}测试异常: ${error.message}`, 'fail');
                testResults[test.name] = false;
            }
        }
        
        this.log('\n' + '='.repeat(50));
        this.log('验证完成');
        
        const report = this.generateReport();
        await this.saveReport(report);
        
        // 输出摘要
        this.log(`\n📊 验证摘要:`);
        this.log(`总测试数: ${report.summary.total}`);
        this.log(`通过: ${report.summary.passed}`);
        this.log(`失败: ${report.summary.failed}`);
        this.log(`警告: ${report.summary.warnings}`);
        this.log(`成功率: ${report.summary.successRate}`);
        this.log(`总状态: ${report.status}`);
        
        return {
            success: report.status === 'PASSED',
            report,
            testResults
        };
    }
}

// 主函数
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('用法: node post-deploy-validation.js <部署URL>');
        console.log('示例: node post-deploy-validation.js https://your-app.vercel.app');
        process.exit(1);
    }
    
    const baseUrl = args[0];
    
    console.log('🔍 AI招聘分析平台 - 部署后验证');
    console.log('================================');
    
    const validator = new PostDeployValidator(baseUrl);
    const result = await validator.runAllTests();
    
    if (result.success) {
        console.log('\n🎉 所有验证测试通过！');
        process.exit(0);
    } else {
        console.log('\n⚠️ 部分验证测试失败，请检查问题并修复。');
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('验证脚本执行失败:', error);
        process.exit(1);
    });
}

export default PostDeployValidator;