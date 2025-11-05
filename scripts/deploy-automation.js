#!/usr/bin/env node

/**
 * 生产环境部署自动化脚本
 * 
 * 功能：
 * 1. 执行部署前检查
 * 2. 构建项目
 * 3. 部署到 Vercel
 * 4. 执行部署后验证
 * 5. 生成部署报告
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

class DeploymentAutomation {
    constructor() {
        this.deploymentId = `deploy-${Date.now()}`;
        this.startTime = new Date();
        this.logs = [];
        this.errors = [];
        this.warnings = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
        
        this.logs.push(logEntry);
        
        switch (type) {
            case 'error':
                this.errors.push(message);
                console.error(`❌ ${message}`);
                break;
            case 'warning':
                this.warnings.push(message);
                console.warn(`⚠️  ${message}`);
                break;
            case 'success':
                console.log(`✅ ${message}`);
                break;
            default:
                console.log(`ℹ️  ${message}`);
        }
    }

    async runCommand(command, description) {
        this.log(`执行: ${description}`);
        this.log(`命令: ${command}`);
        
        try {
            const output = execSync(command, {
                cwd: projectRoot,
                encoding: 'utf8',
                stdio: 'pipe'
            });
            
            this.log(`${description} - 成功`, 'success');
            return { success: true, output };
        } catch (error) {
            this.log(`${description} - 失败: ${error.message}`, 'error');
            return { success: false, error: error.message };
        }
    }

    async checkPrerequisites() {
        this.log('=== 步骤 1/6: 检查部署前提条件 ===');
        
        const checks = [
            {
                name: '检查 Node.js 版本',
                command: 'node --version',
                validator: (output) => {
                    const version = output.trim();
                    const majorVersion = parseInt(version.replace('v', '').split('.')[0]);
                    return majorVersion >= 18;
                }
            },
            {
                name: '检查 npm 版本',
                command: 'npm --version',
                validator: (output) => output.trim().length > 0
            },
            {
                name: '检查 Vercel CLI',
                command: 'vercel --version',
                validator: (output) => output.trim().length > 0
            },
            {
                name: '检查 Git 状态',
                command: 'git status --porcelain',
                validator: (output) => {
                    if (output.trim().length > 0) {
                        this.log('发现未提交的更改，建议先提交代码', 'warning');
                    }
                    return true;
                }
            }
        ];

        let allPassed = true;
        
        for (const check of checks) {
            const result = await this.runCommand(check.command, check.name);
            
            if (!result.success) {
                allPassed = false;
                continue;
            }
            
            if (check.validator && !check.validator(result.output)) {
                this.log(`${check.name} - 验证失败`, 'error');
                allPassed = false;
            }
        }
        
        return allPassed;
    }

    async runPreDeployChecks() {
        this.log('=== 步骤 2/6: 执行部署前检查 ===');
        
        const result = await this.runCommand(
            'node pre-deploy-check.js',
            '运行部署前检查脚本'
        );
        
        return result.success;
    }

    async buildProject() {
        this.log('=== 步骤 3/6: 构建项目 ===');
        
        // 清理构建缓存
        await this.runCommand('npm run clean', '清理构建缓存');
        
        // 安装依赖
        const installResult = await this.runCommand(
            'npm ci',
            '安装项目依赖'
        );
        
        if (!installResult.success) {
            return false;
        }
        
        // 运行构建
        const buildResult = await this.runCommand(
            'npm run build',
            '构建项目'
        );
        
        return buildResult.success;
    }

    async deployToVercel() {
        this.log('=== 步骤 4/6: 部署到 Vercel ===');
        
        // 检查 Vercel 登录状态
        const whoamiResult = await this.runCommand(
            'vercel whoami',
            '检查 Vercel 登录状态'
        );
        
        if (!whoamiResult.success) {
            this.log('请先登录 Vercel: vercel login', 'error');
            return { success: false };
        }
        
        // 执行部署
        const deployResult = await this.runCommand(
            'vercel --prod --yes',
            '部署到 Vercel 生产环境'
        );
        
        if (!deployResult.success) {
            return { success: false };
        }
        
        // 提取部署 URL
        const deployUrl = this.extractDeployUrl(deployResult.output);
        
        if (deployUrl) {
            this.log(`部署成功! URL: ${deployUrl}`, 'success');
            return { success: true, url: deployUrl };
        } else {
            this.log('无法提取部署 URL', 'warning');
            return { success: true, url: null };
        }
    }

    extractDeployUrl(output) {
        const urlMatch = output.match(/https:\/\/[^\s]+\.vercel\.app/);
        return urlMatch ? urlMatch[0] : null;
    }

    async runPostDeployTests(deployUrl) {
        this.log('=== 步骤 5/6: 执行部署后测试 ===');
        
        if (!deployUrl) {
            this.log('跳过部署后测试 - 无部署 URL', 'warning');
            return true;
        }
        
        const tests = [
            {
                name: '网站可访问性测试',
                test: () => this.testWebsiteAccessibility(deployUrl)
            },
            {
                name: 'API 端点测试',
                test: () => this.testApiEndpoints(deployUrl)
            },
            {
                name: '静态资源测试',
                test: () => this.testStaticResources(deployUrl)
            }
        ];
        
        let allPassed = true;
        
        for (const test of tests) {
            try {
                const result = await test.test();
                if (result) {
                    this.log(`${test.name} - 通过`, 'success');
                } else {
                    this.log(`${test.name} - 失败`, 'error');
                    allPassed = false;
                }
            } catch (error) {
                this.log(`${test.name} - 错误: ${error.message}`, 'error');
                allPassed = false;
            }
        }
        
        return allPassed;
    }

    async testWebsiteAccessibility(url) {
        const result = await this.runCommand(
            `curl -I -s -o /dev/null -w "%{http_code}" ${url}`,
            '测试网站可访问性'
        );
        
        return result.success && result.output.trim() === '200';
    }

    async testApiEndpoints(url) {
        // 这里可以添加更详细的 API 测试
        this.log('API 端点测试 - 跳过（需要实际实现）', 'warning');
        return true;
    }

    async testStaticResources(url) {
        const resources = [
            '/styles/main.css',
            '/js/main.js',
            '/js/auth.js'
        ];
        
        let allPassed = true;
        
        for (const resource of resources) {
            const result = await this.runCommand(
                `curl -I -s -o /dev/null -w "%{http_code}" ${url}${resource}`,
                `测试静态资源: ${resource}`
            );
            
            if (!result.success || result.output.trim() !== '200') {
                this.log(`静态资源测试失败: ${resource}`, 'error');
                allPassed = false;
            }
        }
        
        return allPassed;
    }

    async generateDeploymentReport() {
        this.log('=== 步骤 6/6: 生成部署报告 ===');
        
        const endTime = new Date();
        const duration = Math.round((endTime - this.startTime) / 1000);
        
        const report = {
            deploymentId: this.deploymentId,
            startTime: this.startTime.toISOString(),
            endTime: endTime.toISOString(),
            duration: `${duration}秒`,
            status: this.errors.length === 0 ? 'SUCCESS' : 'FAILED',
            summary: {
                totalLogs: this.logs.length,
                errors: this.errors.length,
                warnings: this.warnings.length
            },
            logs: this.logs,
            errors: this.errors,
            warnings: this.warnings
        };
        
        const reportPath = path.join(projectRoot, 'deployment', `deployment-report-${this.deploymentId}.json`);
        
        try {
            // 确保目录存在
            const deploymentDir = path.dirname(reportPath);
            if (!fs.existsSync(deploymentDir)) {
                fs.mkdirSync(deploymentDir, { recursive: true });
            }
            
            fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
            this.log(`部署报告已生成: ${reportPath}`, 'success');
        } catch (error) {
            this.log(`生成部署报告失败: ${error.message}`, 'error');
        }
        
        return report;
    }

    async run() {
        this.log(`开始部署流程 - ID: ${this.deploymentId}`);
        
        try {
            // 步骤 1: 检查前提条件
            const prerequisitesOk = await this.checkPrerequisites();
            if (!prerequisitesOk) {
                throw new Error('前提条件检查失败');
            }
            
            // 步骤 2: 部署前检查
            const preChecksOk = await this.runPreDeployChecks();
            if (!preChecksOk) {
                throw new Error('部署前检查失败');
            }
            
            // 步骤 3: 构建项目
            const buildOk = await this.buildProject();
            if (!buildOk) {
                throw new Error('项目构建失败');
            }
            
            // 步骤 4: 部署到 Vercel
            const deployResult = await this.deployToVercel();
            if (!deployResult.success) {
                throw new Error('Vercel 部署失败');
            }
            
            // 步骤 5: 部署后测试
            const testsOk = await this.runPostDeployTests(deployResult.url);
            if (!testsOk) {
                this.log('部署后测试失败，但部署已完成', 'warning');
            }
            
            // 步骤 6: 生成报告
            const report = await this.generateDeploymentReport();
            
            this.log('=== 部署流程完成 ===', 'success');
            this.log(`状态: ${report.status}`);
            this.log(`耗时: ${report.duration}`);
            this.log(`错误数: ${report.summary.errors}`);
            this.log(`警告数: ${report.summary.warnings}`);
            
            if (deployResult.url) {
                this.log(`部署 URL: ${deployResult.url}`, 'success');
            }
            
            return {
                success: report.status === 'SUCCESS',
                report,
                deployUrl: deployResult.url
            };
            
        } catch (error) {
            this.log(`部署流程失败: ${error.message}`, 'error');
            await this.generateDeploymentReport();
            
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 主函数
async function main() {
    const deployment = new DeploymentAutomation();
    
    console.log('🚀 AI招聘分析平台 - 生产环境部署自动化');
    console.log('================================================');
    
    const result = await deployment.run();
    
    if (result.success) {
        console.log('\n🎉 部署成功完成！');
        if (result.deployUrl) {
            console.log(`🌍 访问地址: ${result.deployUrl}`);
        }
        process.exit(0);
    } else {
        console.log('\n💥 部署失败！');
        console.log('请查看错误日志并修复问题后重试。');
        process.exit(1);
    }
}

// 如果直接运行此脚本
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch(error => {
        console.error('部署脚本执行失败:', error);
        process.exit(1);
    });
}

export default DeploymentAutomation;