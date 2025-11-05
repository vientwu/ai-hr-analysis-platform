/**
 * API集成模块 - 将分析结果保存到Supabase数据库
 * 
 * 功能：
 * 1. 保存简历分析结果
 * 2. 保存面试分析结果
 * 3. 更新分析状态
 * 4. 获取分析历史
 * 5. 错误处理和重试机制
 */

// 运行时获取最新 Supabase 客户端，避免静态导出在初始化前为 null 的问题
import { getSupabase } from './supabase.js';
import { auth } from './auth.js';

class ApiIntegration {
    constructor() {
        this.maxRetries = 3;
        this.retryDelay = 1000;
        this.cache = new Map(); // 添加缓存
        this.cacheTimeout = 5 * 60 * 1000; // 5分钟缓存过期
        this.batchQueue = []; // 批量操作队列
        this.batchTimeout = null;
        this.batchSize = 10; // 批量大小
        this.batchDelay = 2000; // 批量延迟2秒
    }

    /**
     * 保存简历分析结果到数据库
     * 注意：字段名需与数据库 schema 保持一致（见 sql/02_create_resume_analyses_table.sql）
     * @param {Object} analysisData - 分析数据
     * @param {string} analysisData.fileName - 文件名
     * @param {string} analysisData.jd - 职位描述
     * @param {Object} analysisData.result - Coze分析结果（结构化 JSON）
     * @param {string} analysisData.workflowRunId - Coze工作流运行ID（映射到 coze_workflow_id）
     * @param {string} analysisData.conversationId - Coze 对话ID
     * @returns {Promise<Object>} 保存结果
     */
    async saveResumeAnalysis(analysisData) {
        try {
            const user = auth.getCurrentUser();
            if (!user) {
                throw new Error('用户未登录');
            }
            const client = getSupabase();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }

            // 准备数据（严格对齐数据库列名）
            const resumeData = {
                user_id: user.id,
                file_name: analysisData.fileName,
                // 可选：如果已上传到 Storage，可传 file_url / file_size / file_type
                job_description: analysisData.jd || null,
                analysis_result: analysisData.result || {},
                status: this.determineAnalysisStatus(analysisData.result),
                coze_workflow_id: analysisData.workflowRunId || null,
                coze_conversation_id: analysisData.conversationId || null,
                overall_score: this.extractOverallScore(analysisData.result),
                match_score: this.extractMatchScore(analysisData.result),
                tags: this.extractTags(analysisData.result),
                category: this.extractCategory(analysisData.result),
                is_favorite: false,
                notes: null
            };

            // 保存到数据库
            const { data, error } = await client
                .from('resume_analyses')
                .insert([resumeData])
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('简历分析结果保存成功:', data);
            return {
                success: true,
                data: data,
                message: '简历分析结果保存成功'
            };

        } catch (error) {
            console.error('保存简历分析结果失败:', error);
            return {
                success: false,
                error: error.message,
                message: '保存简历分析结果失败'
            };
        }
    }

    /**
     * 保存面试分析结果到数据库
     * 注意：字段名需与数据库 schema 保持一致（见 sql/03_create_interview_analyses_table.sql）
     * @param {Object} analysisData - 分析数据
     * @param {string} analysisData.fileName - 简历文件名（可选）
     * @param {string} analysisData.name - 候选人姓名
     * @param {string} analysisData.recordingUrl - 录音URL
     * @param {Object} analysisData.result - Coze分析结果（结构化 JSON）
     * @param {string} analysisData.workflowRunId - Coze工作流运行ID（映射到 coze_workflow_id）
     * @param {string} analysisData.conversationId - Coze 对话ID
     * @returns {Promise<Object>} 保存结果
     */
    async saveInterviewAnalysis(analysisData) {
        try {
            const user = auth.getCurrentUser();
            if (!user) {
                throw new Error('用户未登录');
            }
            const client = getSupabase();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }

            // 准备数据（严格对齐数据库列名）
            const interviewData = {
                user_id: user.id,
                candidate_name: analysisData.name,
                resume_file_name: analysisData.fileName || null,
                recording_url: analysisData.recordingUrl || null,
                analysis_result: analysisData.result || {},
                status: this.determineAnalysisStatus(analysisData.result),
                coze_workflow_id: analysisData.workflowRunId || null,
                coze_conversation_id: analysisData.conversationId || null,
                overall_score: this.extractOverallScore(analysisData.result),
                communication_score: this.extractCommunicationScore(analysisData.result),
                technical_score: this.extractTechnicalScore(analysisData.result),
                cultural_fit_score: this.extractCulturalFitScore(analysisData.result),
                recommendation: this.extractRecommendation(analysisData.result),
                key_strengths: this.extractKeyStrengths(analysisData.result),
                key_weaknesses: this.extractKeyWeaknesses(analysisData.result),
                improvement_suggestions: this.extractImprovementSuggestions(analysisData.result),
                tags: this.extractTags(analysisData.result),
                interview_level: this.extractInterviewLevel(analysisData.result),
                is_favorite: false,
                notes: null,
                interviewer_notes: this.extractKeyInsights(analysisData.result)
            };

            // 保存到数据库
            const { data, error } = await client
                .from('interview_analyses')
                .insert([interviewData])
                .select()
                .single();

            if (error) {
                throw error;
            }

            console.log('面试分析结果保存成功:', data);
            return {
                success: true,
                data: data,
                message: '面试分析结果保存成功'
            };

        } catch (error) {
            console.error('保存面试分析结果失败:', error);
            return {
                success: false,
                error: error.message,
                message: '保存面试分析结果失败'
            };
        }
    }

    /**
     * 更新分析状态
     * @param {string} type - 分析类型 ('resume' | 'interview')
     * @param {string} id - 记录ID
     * @param {string} status - 新状态
     * @param {Object} additionalData - 额外数据
     * @returns {Promise<Object>} 更新结果
     */
    async updateAnalysisStatus(type, id, status, additionalData = {}) {
        try {
            const tableName = type === 'resume' ? 'resume_analyses' : 'interview_analyses';
            const client = getSupabase();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }
            
            const updateData = {
                status: status,
                updated_at: new Date().toISOString(),
                ...additionalData
            };

            const { data, error } = await client
                .from(tableName)
                .update(updateData)
                .eq('id', id)
                .select()
                .single();

            if (error) {
                throw error;
            }

            return {
                success: true,
                data: data,
                message: '状态更新成功'
            };

        } catch (error) {
            console.error('更新分析状态失败:', error);
            return {
                success: false,
                error: error.message,
                message: '状态更新失败'
            };
        }
    }

    /**
     * 获取分析历史记录（带缓存）
     * @param {Object} options - 查询选项
     * @param {string} options.type - 分析类型 ('resume' | 'interview' | 'all')
     * @param {number} options.limit - 限制数量
     * @param {number} options.offset - 偏移量
     * @param {string} options.sortBy - 排序字段
     * @param {string} options.sortOrder - 排序方向
     * @param {string} options.status - 状态筛选
     * @param {string} options.dateFrom - 开始日期
     * @param {string} options.dateTo - 结束日期
     * @returns {Promise<Object>} 查询结果
     */
    async getAnalysisHistory(options = {}) {
        try {
            const user = auth.getCurrentUser();
            if (!user) {
                throw new Error('用户未登录');
            }

            // 生成缓存键
            const cacheKey = `history_${user.id}_${JSON.stringify(options)}`;
            
            // 检查缓存
            if (this.cache.has(cacheKey)) {
                const cached = this.cache.get(cacheKey);
                if (Date.now() - cached.timestamp < this.cacheTimeout) {
                    console.log('使用缓存的历史数据');
                    return cached.data;
                } else {
                    this.cache.delete(cacheKey);
                }
            }

            const {
                type = 'all',
                limit = 20,
                offset = 0,
                sortBy = 'created_at',
                sortOrder = 'desc',
                status = null,
                dateFrom = null,
                dateTo = null
            } = options;

            let result;

            if (type === 'all') {
                // 并行查询两个表
                const [resumeData, interviewData] = await Promise.all([
                    this.getResumeHistory({ ...options, type: 'resume' }),
                    this.getInterviewHistory({ ...options, type: 'interview' })
                ]);
                
                // 合并并排序
                const allData = [...resumeData.data, ...interviewData.data];
                allData.sort((a, b) => {
                    const aDate = new Date(a.created_at);
                    const bDate = new Date(b.created_at);
                    return sortOrder === 'desc' ? bDate - aDate : aDate - bDate;
                });
                
                result = {
                    success: true,
                    data: allData.slice(offset, offset + limit),
                    total: allData.length
                };
            } else {
                const client = getSupabase();
                if (!client) {
                    throw new Error('Supabase 客户端未初始化');
                }
                let query = client.from(type === 'interview' ? 'interview_analyses' : 'resume_analyses');
                
                // 添加过滤条件
                query = query.eq('user_id', user.id);
                
                if (status) {
                    query = query.eq('status', status);
                }
                
                if (dateFrom) {
                    query = query.gte('created_at', dateFrom);
                }
                
                if (dateTo) {
                    query = query.lte('created_at', dateTo);
                }

                // 添加排序和分页
                query = query
                    .order(sortBy, { ascending: sortOrder === 'asc' })
                    .range(offset, offset + limit - 1);

                const { data, error, count } = await query.select('*', { count: 'exact' });

                if (error) {
                    throw error;
                }

                result = {
                    success: true,
                    data: data || [],
                    total: count || 0
                };
            }

            // 缓存结果
            this.cache.set(cacheKey, {
                data: result,
                timestamp: Date.now()
            });

            return result;

        } catch (error) {
            console.error('获取分析历史失败:', error);
            return {
                success: false,
                error: error.message,
                data: [],
                total: 0
            };
        }
    }

    /**
     * 获取用户统计数据
     * @returns {Promise<Object>} 统计数据
     */
    async getUserStats() {
        try {
            const user = auth.getCurrentUser();
            if (!user) {
                throw new Error('用户未登录');
            }

            // 获取简历分析统计
            const client = getSupabase();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }
            const { data: resumeStats, error: resumeError } = await client
                .from('resume_analyses')
                .select('status, overall_score')
                .eq('user_id', user.id);

            if (resumeError) throw resumeError;

            // 获取面试分析统计
            const { data: interviewStats, error: interviewError } = await client
                .from('interview_analyses')
                .select('status, overall_score')
                .eq('user_id', user.id);

            if (interviewError) throw interviewError;

            // 计算统计数据
            const stats = {
                totalResumeAnalyses: resumeStats.length,
                totalInterviewAnalyses: interviewStats.length,
                completedResumeAnalyses: resumeStats.filter(r => r.status === 'completed').length,
                completedInterviewAnalyses: interviewStats.filter(i => i.status === 'completed').length,
                averageResumeScore: this.calculateAverageScore(resumeStats, 'overall_score'),
                averageInterviewScore: this.calculateAverageScore(interviewStats, 'overall_score'),
                totalAnalyses: resumeStats.length + interviewStats.length,
                successRate: this.calculateSuccessRate(resumeStats, interviewStats)
            };

            return {
                success: true,
                data: stats,
                message: '获取统计数据成功'
            };

        } catch (error) {
            console.error('获取用户统计失败:', error);
            return {
                success: false,
                error: error.message,
                message: '获取统计数据失败'
            };
        }
    }

    /**
     * 重试机制包装器
     * @param {Function} fn - 要重试的函数
     * @param {Array} args - 函数参数
     * @param {number} retries - 重试次数
     * @returns {Promise<any>} 函数结果
     */
    async withRetry(fn, args = [], retries = this.maxRetries) {
        try {
            return await fn.apply(this, args);
        } catch (error) {
            if (retries > 0 && this.isRetryableError(error)) {
                console.warn(`操作失败，${this.retryDelay}ms后重试，剩余重试次数: ${retries - 1}`);
                await this.delay(this.retryDelay);
                return this.withRetry(fn, args, retries - 1);
            }
            throw error;
        }
    }

    /**
     * 判断是否为可重试的错误
     * @param {Error} error - 错误对象
     * @returns {boolean} 是否可重试
     */
    isRetryableError(error) {
        const retryableErrors = [
            'NETWORK_ERROR',
            'TIMEOUT',
            'RATE_LIMIT',
            'TEMPORARY_UNAVAILABLE'
        ];
        
        return retryableErrors.some(type => 
            error.message.includes(type) || 
            error.code === type
        );
    }

    /**
     * 延迟函数
     * @param {number} ms - 延迟毫秒数
     * @returns {Promise<void>}
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * 确定分析状态
     * @param {Object} result - 分析结果
     * @returns {string} 状态
     */
    determineAnalysisStatus(result) {
        if (!result || Object.keys(result).length === 0) {
            return 'pending';
        }
        
        if (result.error) {
            return 'failed';
        }
        
        if (result.status === 'processing') {
            return 'processing';
        }
        
        return 'completed';
    }

    /**
     * 提取分析评分
     * @param {Object} result - 分析结果
     * @returns {number|null} 评分
     */
    extractAnalysisScore(result) {
        if (!result) return null;
        
        // 尝试从不同字段提取评分
        return result.score || 
               result.analysis_score || 
               result.overall_score || 
               result.rating || 
               null;
    }

    /**
     * 提取整体评分
     * @param {Object} result - 分析结果
     * @returns {number|null} 评分
     */
    extractOverallScore(result) {
        if (!result) return null;
        
        return result.overall_score || 
               result.score || 
               result.rating || 
               result.total_score || 
               null;
    }

    /**
     * 提取匹配度评分（简历）
     * @param {Object} result
     * @returns {number|null}
     */
    extractMatchScore(result) {
        if (!result) return null;
        return result.match_score ||
               result.fit_score ||
               result.match ||
               result.similarity_score ||
               null;
    }

    /**
     * 提取标签
     * @param {Object} result - 分析结果
     * @returns {string[]|null} 标签数组
     */
    extractTags(result) {
        if (!result) return null;
        
        const raw = result.tags || result.keywords || result.skills || result.categories;
        if (!raw) return null;

        if (Array.isArray(raw)) {
            return raw.map(t => String(t)).filter(t => t.trim().length > 0);
        }

        if (typeof raw === 'string') {
            const parts = raw.split(/[\s,，、;；]+/).map(s => s.trim()).filter(Boolean);
            return parts.length ? parts : null;
        }

        return null;
    }

    /**
     * 提取分类
     * @param {Object} result - 分析结果
     * @returns {string|null} 分类
     */
    extractCategory(result) {
        if (!result) return null;
        
        return result.category || 
               result.type || 
               result.classification || 
               null;
    }

    /**
     * 提取推荐建议
     * @param {Object} result - 分析结果
     * @returns {string|null} 推荐建议
     */
    extractRecommendations(result) {
        if (!result) return null;
        
        const recommendations = result.recommendations || 
                              result.suggestions || 
                              result.advice || 
                              result.feedback;
        
        if (Array.isArray(recommendations)) {
            return recommendations.join('\n');
        }
        
        return recommendations || null;
    }

    /**
     * 提取关键洞察
     * @param {Object} result - 分析结果
     * @returns {string|null} 关键洞察
     */
    extractKeyInsights(result) {
        if (!result) return null;
        
        const insights = result.key_insights || 
                        result.insights || 
                        result.highlights || 
                        result.summary;
        
        if (Array.isArray(insights)) {
            return insights.join('\n');
        }
        
        return insights || null;
    }

    /**
     * 面试维度评分提取
     */
    extractCommunicationScore(result) {
        if (!result) return null;
        return result.communication_score || result.communication || null;
    }

    extractTechnicalScore(result) {
        if (!result) return null;
        return result.technical_score || result.technical || result.tech_score || null;
    }

    extractCulturalFitScore(result) {
        if (!result) return null;
        return result.cultural_fit_score || result.culture_fit || result.culture_score || null;
    }

    /**
     * 面试建议（单值）
     */
    extractRecommendation(result) {
        if (!result) return 'pending';
        const rec = (result.recommendation || result.decision || '').toString().toLowerCase();
        if (!rec) {
            // 如果没有明确建议，尝试用分数推断
            const score = this.extractOverallScore(result);
            if (typeof score === 'number') {
                if (score >= 80) return 'hire';
                if (score >= 60) return 'maybe';
                return 'no_hire';
            }
            return 'pending';
        }

        if (/hire|录用|推荐/.test(rec)) return 'hire';
        if (/no[_\s-]?hire|不录用|不推荐|拒绝/.test(rec)) return 'no_hire';
        if (/maybe|待定|观望/.test(rec)) return 'maybe';
        return 'pending';
    }

    /**
     * 面试关键项（数组）
     */
    extractKeyStrengths(result) {
        if (!result) return null;
        const raw = result.key_strengths || result.strengths || result.advantages;
        return this.normalizeToArray(raw);
    }

    extractKeyWeaknesses(result) {
        if (!result) return null;
        const raw = result.key_weaknesses || result.weaknesses || result.disadvantages;
        return this.normalizeToArray(raw);
    }

    extractImprovementSuggestions(result) {
        if (!result) return null;
        const raw = result.improvement_suggestions || result.suggestions || result.recommendations;
        return this.normalizeToArray(raw);
    }

    /**
     * 面试级别
     */
    extractInterviewLevel(result) {
        if (!result) return null;
        return result.interview_level || result.level || result.seniority || null;
    }

    /**
     * 将字符串或数组标准化为字符串数组
     */
    normalizeToArray(raw) {
        if (!raw) return null;
        if (Array.isArray(raw)) {
            return raw.map(s => String(s)).filter(s => s.trim().length > 0);
        }
        if (typeof raw === 'string') {
            const parts = raw.split(/[\n,，、;；]+/).map(s => s.trim()).filter(Boolean);
            return parts.length ? parts : null;
        }
        return null;
    }

    /**
     * 计算平均分
     * @param {Array} data - 数据数组
     * @param {string} scoreField - 分数字段名
     * @returns {number} 平均分
     */
    calculateAverageScore(data, scoreField) {
        const validScores = data
            .map(item => item[scoreField])
            .filter(score => score !== null && score !== undefined && !isNaN(score));
        
        if (validScores.length === 0) return 0;
        
        const sum = validScores.reduce((acc, score) => acc + Number(score), 0);
        return Math.round((sum / validScores.length) * 100) / 100;
    }

    /**
     * 计算成功率
     * @param {Array} resumeData - 简历数据
     * @param {Array} interviewData - 面试数据
     * @returns {number} 成功率百分比
     */
    calculateSuccessRate(resumeData, interviewData) {
        const totalAnalyses = resumeData.length + interviewData.length;
        if (totalAnalyses === 0) return 0;
        
        const completedAnalyses = resumeData.filter(r => r.status === 'completed').length +
                                 interviewData.filter(i => i.status === 'completed').length;
        
        return Math.round((completedAnalyses / totalAnalyses) * 100);
    }

    /**
     * 批量保存分析结果
     */
    async batchSaveAnalyses(analyses) {
        try {
            const client = getSupabase();
            if (!client) {
                throw new Error('Supabase 客户端未初始化');
            }
            const resumeAnalyses = analyses.filter(item => item.type === 'resume');
            const interviewAnalyses = analyses.filter(item => item.type === 'interview');

            const promises = [];

            if (resumeAnalyses.length > 0) {
                promises.push(
                    client
                        .from('resume_analyses')
                        .insert(resumeAnalyses.map(item => {
                            const { type, ...data } = item;
                            return data;
                        }))
                );
            }

            if (interviewAnalyses.length > 0) {
                promises.push(
                    client
                        .from('interview_analyses')
                        .insert(interviewAnalyses.map(item => {
                            const { type, ...data } = item;
                            return data;
                        }))
                );
            }

            const results = await Promise.all(promises);
            
            // 清理相关缓存
            this.clearUserCache();

            return {
                success: true,
                data: results,
                message: `成功批量保存 ${analyses.length} 条分析结果`
            };

        } catch (error) {
            console.error('批量保存分析结果失败:', error);
            return {
                success: false,
                error: error.message,
                message: '批量保存分析结果失败'
            };
        }
    }

    /**
     * 清理用户相关缓存
     */
    async clearUserCache(userId = null) {
        try {
            if (!userId) {
                const user = await auth.getCurrentUser();
                userId = user?.id;
            }

            if (!userId) return;

            // 清理该用户相关的所有缓存
            for (const [key] of this.cache) {
                if (key.includes(userId)) {
                    this.cache.delete(key);
                }
            }

            console.log(`已清理用户 ${userId} 的缓存`);
        } catch (error) {
            console.error('清理缓存失败:', error);
        }
    }

    /**
     * 清理过期缓存
     */
    clearExpiredCache() {
        const now = Date.now();
        for (const [key, value] of this.cache) {
            if (now - value.timestamp > this.cacheTimeout) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * 添加到批量队列
     */
    addToBatchQueue(operation) {
        this.batchQueue.push({
            ...operation,
            timestamp: Date.now()
        });

        // 如果队列达到批量大小，立即处理
        if (this.batchQueue.length >= this.batchSize) {
            this.processBatchQueue();
        } else {
            // 否则设置延迟处理
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
            }
            this.batchTimeout = setTimeout(() => {
                this.processBatchQueue();
            }, this.batchDelay);
        }
    }

    /**
     * 处理批量队列
     */
    async processBatchQueue() {
        if (this.batchQueue.length === 0) return;

        const operations = [...this.batchQueue];
        this.batchQueue = [];

        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }

        try {
            // 按操作类型分组
            const groupedOps = operations.reduce((acc, op) => {
                if (!acc[op.type]) acc[op.type] = [];
                acc[op.type].push(op);
                return acc;
            }, {});

            // 并行处理不同类型的操作
            const promises = Object.entries(groupedOps).map(([type, ops]) => {
                switch (type) {
                    case 'save_resume':
                        return this.batchSaveAnalyses(ops.map(op => ({ ...op.data, type: 'resume' })));
                    case 'save_interview':
                        return this.batchSaveAnalyses(ops.map(op => ({ ...op.data, type: 'interview' })));
                    case 'update_status':
                        return this.batchUpdateStatus(ops);
                    default:
                        return Promise.resolve({ success: true });
                }
            });

            await Promise.all(promises);
            console.log(`批量处理完成，共处理 ${operations.length} 个操作`);

        } catch (error) {
            console.error('批量处理失败:', error);
            // 将失败的操作重新加入队列
            this.batchQueue.unshift(...operations);
        }
    }

    /**
     * 批量更新状态
     */
    async batchUpdateStatus(operations) {
        try {
            const promises = operations.map(op => {
                const { type, id, status, additionalData } = op.data;
                return this.updateAnalysisStatus(type, id, status, additionalData);
            });

            const results = await Promise.all(promises);
            return {
                success: true,
                data: results,
                message: `成功批量更新 ${operations.length} 个状态`
            };

        } catch (error) {
            console.error('批量更新状态失败:', error);
            return {
                success: false,
                error: error.message,
                message: '批量更新状态失败'
            };
        }
    }

    /**
     * 获取简历历史记录
     */
    async getResumeHistory(options) {
        const { limit = 20, offset = 0, status = null, dateFrom = null, dateTo = null, sortBy = 'created_at', sortOrder = 'desc' } = options;
        const client = getSupabase();
        if (!client) {
            throw new Error('Supabase 客户端未初始化');
        }
        
        let query = client
            .from('resume_analyses')
            .select('*')
            .eq('user_id', (await auth.getCurrentUser()).id);

        if (status) {
            query = query.eq('status', status);
        }
        
        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        
        if (dateTo) {
            query = query.lte('created_at', dateTo);
        }

        const { data, error } = await query
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return {
            success: true,
            data: (data || []).map(item => ({ ...item, type: 'resume' }))
        };
    }

    /**
     * 获取面试历史记录
     */
    async getInterviewHistory(options) {
        const { limit = 20, offset = 0, status = null, dateFrom = null, dateTo = null, sortBy = 'created_at', sortOrder = 'desc' } = options;
        const client = getSupabase();
        if (!client) {
            throw new Error('Supabase 客户端未初始化');
        }
        
        let query = client
            .from('interview_analyses')
            .select('*')
            .eq('user_id', (await auth.getCurrentUser()).id);

        if (status) {
            query = query.eq('status', status);
        }
        
        if (dateFrom) {
            query = query.gte('created_at', dateFrom);
        }
        
        if (dateTo) {
            query = query.lte('created_at', dateTo);
        }

        const { data, error } = await query
            .order(sortBy, { ascending: sortOrder === 'asc' })
            .range(offset, offset + limit - 1);

        if (error) throw error;

        return {
            success: true,
            data: (data || []).map(item => ({ ...item, type: 'interview' }))
        };
    }
}

// 创建全局实例
const apiIntegration = new ApiIntegration();

// 定期清理过期缓存（每5分钟）
setInterval(() => {
    apiIntegration.clearExpiredCache();
}, 5 * 60 * 1000);

// 导出到全局作用域（兼容性）
if (typeof window !== 'undefined') {
    window.apiIntegration = apiIntegration;
    
    // 页面卸载时处理剩余的批量操作
    window.addEventListener('beforeunload', () => {
        if (apiIntegration.batchQueue.length > 0) {
            apiIntegration.processBatchQueue();
        }
    });
}

// ES6 模块导出
export { apiIntegration };