#!/usr/bin/env node

/**
 * 本地API开发服务器
 * 用于在开发环境中模拟Vercel Serverless Functions
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

// 加载本地环境变量（支持 .env 文件）
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.API_DEV_PORT || 4000;

// 中间件配置
app.use(cors({
    origin: ['http://localhost:4321', 'http://127.0.0.1:4321'],
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 启动时输出关键环境变量是否已设置，便于排障
const requiredEnv = ['COZE_PAT', 'COZE_RESUME_WORKFLOW_ID', 'COZE_INTERVIEW_WORKFLOW_ID'];
const envReport = requiredEnv.map((key) => `${key}=${process.env[key] ? 'SET' : 'NOT SET'}`).join(' | ');
console.log(`环境变量检查: ${envReport}`);

// 健康检查端点
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'AI Resume Analysis Platform - Dev Server',
        version: '1.0.0',
        environment: 'development'
    });
});

// 动态加载API路由
const apiDir = path.join(__dirname, 'api');

// 加载简历分析API
try {
    const resumeAnalyzeModule = await import('./api/resume-analyze.js');
    app.post('/api/resume-analyze', (req, res) => {
        resumeAnalyzeModule.default(req, res);
    });
    app.get('/api/resume-analyze', (req, res) => {
        resumeAnalyzeModule.default(req, res);
    });
    console.log('✓ 简历分析API已加载');
} catch (error) {
    console.warn('⚠ 简历分析API加载失败:', error.message);
    app.post('/api/resume-analyze', (req, res) => {
        res.status(503).json({ 
            error: '简历分析服务暂时不可用',
            details: error.message 
        });
    });
    app.get('/api/resume-analyze', (req, res) => {
        res.status(503).json({ 
            error: '简历分析服务暂时不可用',
            details: error.message 
        });
    });
}

// 加载面试分析API
try {
    const interviewAnalyzeModule = await import('./api/interview-analyze.js');
    app.post('/api/interview-analyze', (req, res) => {
        interviewAnalyzeModule.default(req, res);
    });
    app.get('/api/interview-analyze', (req, res) => {
        interviewAnalyzeModule.default(req, res);
    });
    console.log('✓ 面试分析API已加载');
} catch (error) {
    console.warn('⚠ 面试分析API加载失败:', error.message);
    app.post('/api/interview-analyze', (req, res) => {
        res.status(503).json({ 
            error: '面试分析服务暂时不可用',
            details: error.message 
        });
    });
    app.get('/api/interview-analyze', (req, res) => {
        res.status(503).json({ 
            error: '面试分析服务暂时不可用',
            details: error.message 
        });
    });
}

// 加载删除报告API
try {
    const deleteReportModule = await import('./api/delete-report.js');
    app.delete('/api/delete-report', (req, res) => {
        deleteReportModule.default(req, res);
    });
    console.log('✓ 删除报告API已加载');
} catch (error) {
    console.warn('⚠ 删除报告API加载失败:', error.message);
    app.delete('/api/delete-report', (req, res) => {
        res.status(503).json({ 
            error: '删除报告服务暂时不可用',
            details: error.message 
        });
    });
}

// 错误处理中间件
app.use((error, req, res, next) => {
    console.error('服务器错误:', error);
    res.status(500).json({
        error: '内部服务器错误',
        message: process.env.NODE_ENV === 'development' ? error.message : '服务暂时不可用'
    });
});

// 404处理
app.use((req, res) => {
    res.status(404).json({
        error: '接口不存在',
        path: req.path,
        method: req.method
    });
});

// 启动服务器
app.listen(PORT, '127.0.0.1', () => {
    console.log(`\n🚀 本地API开发服务器已启动`);
    console.log(`📍 地址: http://127.0.0.1:${PORT}`);
    console.log(`🔗 健康检查: http://127.0.0.1:${PORT}/api/health`);
    console.log(`📝 简历分析: http://127.0.0.1:${PORT}/api/resume-analyze`);
    console.log(`🎤 面试分析: http://127.0.0.1:${PORT}/api/interview-analyze`);
    console.log(`\n按 Ctrl+C 停止服务器\n`);
});

// 优雅关闭
process.on('SIGINT', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n正在关闭服务器...');
    process.exit(0);
});