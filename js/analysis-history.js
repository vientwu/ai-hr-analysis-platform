/**
 * 分析记录页面管理器
 * 负责加载、显示和管理所有类型的分析记录
 */
class AnalysisHistoryManager {
    constructor() {
        this.records = [];
        this.filteredRecords = [];
        this.currentPage = 1;
        this.pageSize = 12;
        this.currentView = 'grid';
        this.filters = {
            type: 'all',
            time: 'all',
            search: ''
        };
        this.isLoading = false;
        this.initialized = false;
    }

    // 初始化页面
    async init() {
        if (this.initialized) return;
        
        try {
            this.bindEvents();
            await this.loadRecords();
            this.applyFilters();
            this.renderRecords();
            this.updateStats();
            this.initialized = true;
        } catch (error) {
            console.error('分析记录页面初始化失败:', error);
            this.showError('页面初始化失败，请刷新页面重试');
        }
    }

    // 绑定事件监听器
    bindEvents() {
        // 筛选器事件
        const typeFilter = document.getElementById('typeFilter');
        const timeFilter = document.getElementById('timeFilter');
        const searchInput = document.getElementById('searchInput');

        if (typeFilter) {
            typeFilter.addEventListener('change', (e) => {
                this.filters.type = e.target.value;
                this.applyFilters();
                this.renderRecords();
                this.updateStats();
            });
        }

        if (timeFilter) {
            timeFilter.addEventListener('change', (e) => {
                this.filters.time = e.target.value;
                this.applyFilters();
                this.renderRecords();
                this.updateStats();
            });
        }

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.trim();
                this.applyFilters();
                this.renderRecords();
                this.updateStats();
            });
        }

        // 视图切换事件
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.target.closest('.view-btn').dataset.view;
                this.switchView(view);
            });
        });

        // 分页事件
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (this.currentPage > 1) {
                    this.currentPage--;
                    this.renderRecords();
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                const totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
                if (this.currentPage < totalPages) {
                    this.currentPage++;
                    this.renderRecords();
                }
            });
        }
    }

    // 加载分析记录数据
    async loadRecords() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoading();
            
            console.log('开始加载分析记录...');
            
            // 检查用户是否已登录
            const user = window.auth?.getCurrentUser?.() || null;
            console.log('当前用户:', user);
            
            if (!user) {
                console.log('用户未登录');
                this.hideLoading();
                this.records = [];
                this.filteredRecords = [];
                this.showError('请先登录查看分析记录');
                return;
            }
            
            // 获取Supabase客户端
            const supabase = window.Auth?.getClient?.();
            console.log('Supabase客户端:', supabase);
            
            if (!supabase) {
                throw new Error('Supabase 客户端未初始化');
            }
            
            // 从reports表查询所有分析记录
            console.log('查询用户ID:', user.id);
            
            const { data, error } = await supabase
                .from('reports')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            
            console.log('数据库查询结果:', { data, error });
            
            if (error) {
                console.error('数据库查询错误:', error);
                throw error;
            }
            
            console.log('查询到的记录数量:', data?.length || 0);
            
            // 处理数据
            this.records = (data || []).map(record => ({
                id: record.id,
                type: record.report_type,
                title: this.generateTitle(record),
                jobDescription: record.job_description || '',
                createdAt: new Date(record.created_at),
                debugUrl: record.debug_url || '',
                markdownOutput: record.markdown_output || '',
                resumeAnalysisId: record.resume_analysis_id,
                interviewAnalysisId: record.interview_analysis_id,
                score: this.extractScore(record.markdown_output)
            }));
            
            this.hideLoading();
            
        } catch (error) {
            console.error('加载分析记录失败:', error);
            this.hideLoading();
            this.showError('加载分析记录失败: ' + (error.message || '未知错误'));
        } finally {
            this.isLoading = false;
        }
    }

    // 生成记录标题
    generateTitle(record) {
        const typeMap = {
            'resume': '简历分析',
            'interview': '面试分析'
        };
        
        const baseTitle = typeMap[record.report_type] || '分析记录';
        const date = new Date(record.created_at).toLocaleDateString();
        
        if (record.job_description) {
            const shortDesc = record.job_description.length > 20 
                ? record.job_description.substring(0, 20) + '...'
                : record.job_description;
            return `${baseTitle} - ${shortDesc}`;
        }
        
        return `${baseTitle} - ${date}`;
    }

    // 从Markdown内容中提取评分
    extractScore(markdownContent) {
        if (!markdownContent) return null;
        
        // 尝试匹配各种评分格式
        const scorePatterns = [
            /总分[：:]\s*(\d+(?:\.\d+)?)/i,
            /评分[：:]\s*(\d+(?:\.\d+)?)/i,
            /得分[：:]\s*(\d+(?:\.\d+)?)/i,
            /(\d+(?:\.\d+)?)\s*分/,
            /(\d+(?:\.\d+)?)\/10/,
            /(\d+(?:\.\d+)?)\/100/
        ];
        
        for (const pattern of scorePatterns) {
            const match = markdownContent.match(pattern);
            if (match) {
                return parseFloat(match[1]);
            }
        }
        
        return null;
    }

    // 应用筛选条件
    applyFilters() {
        this.filteredRecords = this.records.filter(record => {
            // 类型筛选
            if (this.filters.type !== 'all' && record.type !== this.filters.type) {
                return false;
            }
            
            // 时间筛选
            if (this.filters.time !== 'all') {
                const now = new Date();
                const recordDate = record.createdAt;
                
                switch (this.filters.time) {
                    case 'today':
                        if (recordDate.toDateString() !== now.toDateString()) {
                            return false;
                        }
                        break;
                    case 'week':
                        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        if (recordDate < weekAgo) {
                            return false;
                        }
                        break;
                    case 'month':
                        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        if (recordDate < monthAgo) {
                            return false;
                        }
                        break;
                }
            }
            
            // 搜索筛选
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                const searchableText = [
                    record.title,
                    record.jobDescription,
                    record.markdownOutput
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }
            
            return true;
        });
        
        // 重置到第一页
        this.currentPage = 1;
    }

    // 渲染记录列表
    renderRecords() {
        const container = document.getElementById('recordsContainer');
        if (!container) return;
        
        // 计算分页
        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageRecords = this.filteredRecords.slice(startIndex, endIndex);
        
        if (pageRecords.length === 0) {
            this.showEmptyState();
            this.hidePagination();
            return;
        }
        
        this.hideEmptyState();
        
        // 根据当前视图模式渲染
        if (this.currentView === 'grid') {
            container.className = 'records-grid';
            container.innerHTML = pageRecords.map(record => this.renderGridItem(record)).join('');
        } else {
            container.className = 'records-list';
            container.innerHTML = pageRecords.map(record => this.renderListItem(record)).join('');
        }
        
        this.updatePagination();
    }

    // 渲染网格视图项目
    renderGridItem(record) {
        const typeIcon = record.type === 'resume' ? 'fa-user-tie' : 'fa-comments';
        const typeLabel = record.type === 'resume' ? '简历分析' : '面试分析';
        const scoreDisplay = record.score !== null ? `${record.score}分` : '未评分';
        
        return `
            <div class="record-card" onclick="showRecordDetail('${record.id}')">
                <div class="record-header">
                    <div class="record-type">
                        <i class="fas ${typeIcon}"></i>
                        <span>${typeLabel}</span>
                    </div>
                    <div class="record-score">${scoreDisplay}</div>
                </div>
                <div class="record-content">
                    <h3 class="record-title">${record.title}</h3>
                    <p class="record-description">${record.jobDescription || '无职位描述'}</p>
                    <div class="record-meta">
                        <span class="record-date">
                            <i class="fas fa-calendar"></i>
                            ${record.createdAt.toLocaleDateString()}
                        </span>
                    </div>
                </div>
                <div class="record-actions">
                    <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); downloadRecord('${record.id}')">
                        <i class="fas fa-download"></i>
                        下载
                    </button>
                    ${record.debugUrl ? `
                        <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.open('${record.debugUrl}', '_blank')">
                            <i class="fas fa-external-link-alt"></i>
                            调试
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // 渲染列表视图项目
    renderListItem(record) {
        const typeIcon = record.type === 'resume' ? 'fa-user-tie' : 'fa-comments';
        const typeLabel = record.type === 'resume' ? '简历分析' : '面试分析';
        const scoreDisplay = record.score !== null ? `${record.score}分` : '未评分';
        
        return `
            <div class="record-row" onclick="showRecordDetail('${record.id}')">
                <div class="record-info">
                    <div class="record-type">
                        <i class="fas ${typeIcon}"></i>
                        <span>${typeLabel}</span>
                    </div>
                    <div class="record-details">
                        <h3 class="record-title">${record.title}</h3>
                        <p class="record-description">${record.jobDescription || '无职位描述'}</p>
                    </div>
                </div>
                <div class="record-meta">
                    <div class="record-score">${scoreDisplay}</div>
                    <div class="record-date">${record.createdAt.toLocaleDateString()}</div>
                </div>
                <div class="record-actions">
                    <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); downloadRecord('${record.id}')">
                        <i class="fas fa-download"></i>
                    </button>
                    ${record.debugUrl ? `
                        <button class="btn-secondary btn-sm" onclick="event.stopPropagation(); window.open('${record.debugUrl}', '_blank')">
                            <i class="fas fa-external-link-alt"></i>
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // 更新统计信息
    updateStats() {
        const totalCount = this.filteredRecords.length;
        const resumeCount = this.filteredRecords.filter(r => r.type === 'resume').length;
        const interviewCount = this.filteredRecords.filter(r => r.type === 'interview').length;
        
        // 计算平均评分
        const scoredRecords = this.filteredRecords.filter(r => r.score !== null);
        const avgScore = scoredRecords.length > 0 
            ? (scoredRecords.reduce((sum, r) => sum + r.score, 0) / scoredRecords.length).toFixed(1)
            : 0;
        
        // 更新DOM
        const totalEl = document.getElementById('totalCount');
        const resumeEl = document.getElementById('resumeCount');
        const interviewEl = document.getElementById('interviewCount');
        const avgScoreEl = document.getElementById('avgScore');
        
        if (totalEl) totalEl.textContent = totalCount;
        if (resumeEl) resumeEl.textContent = resumeCount;
        if (interviewEl) interviewEl.textContent = interviewCount;
        if (avgScoreEl) avgScoreEl.textContent = avgScore;
    }

    // 切换视图模式
    switchView(view) {
        this.currentView = view;
        
        // 更新按钮状态
        const viewBtns = document.querySelectorAll('.view-btn');
        viewBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });
        
        // 重新渲染
        this.renderRecords();
    }

    // 更新分页信息
    updatePagination() {
        const totalPages = Math.ceil(this.filteredRecords.length / this.pageSize);
        const pagination = document.getElementById('pagination');
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (totalPages <= 1) {
            this.hidePagination();
            return;
        }
        
        if (pagination) pagination.style.display = 'flex';
        if (pageInfo) pageInfo.textContent = `第 ${this.currentPage} 页，共 ${totalPages} 页`;
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }

    // 显示/隐藏状态方法
    showLoading() {
        const loading = document.getElementById('loadingState');
        if (loading) loading.style.display = 'block';
        this.hideEmptyState();
    }

    hideLoading() {
        const loading = document.getElementById('loadingState');
        if (loading) loading.style.display = 'none';
    }

    showEmptyState() {
        const empty = document.getElementById('emptyState');
        if (empty) empty.style.display = 'block';
    }

    hideEmptyState() {
        const empty = document.getElementById('emptyState');
        if (empty) empty.style.display = 'none';
    }

    hidePagination() {
        const pagination = document.getElementById('pagination');
        if (pagination) pagination.style.display = 'none';
    }

    showError(message) {
        const container = document.getElementById('recordsContainer');
        if (container) {
            container.innerHTML = `
                <div class="error-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <h3>加载失败</h3>
                    <p>${message}</p>
                    <button class="btn-primary" onclick="location.reload()">重新加载</button>
                </div>
            `;
        }
    }

    // 获取记录详情
    getRecord(id) {
        return this.records.find(r => r.id === id);
    }
}

// 全局函数
let analysisHistoryManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
    analysisHistoryManager = new AnalysisHistoryManager();
    await analysisHistoryManager.init();
});

// 显示记录详情
function showRecordDetail(recordId) {
    const record = analysisHistoryManager.getRecord(recordId);
    if (!record) return;
    
    const modal = document.getElementById('detailModal');
    const title = document.getElementById('modalTitle');
    const body = document.getElementById('modalBody');
    
    if (title) title.textContent = record.title;
    if (body) {
        body.innerHTML = `
            <div class="record-detail">
                <div class="detail-meta">
                    <div class="meta-item">
                        <strong>分析类型：</strong>
                        <span>${record.type === 'resume' ? '简历分析' : '面试分析'}</span>
                    </div>
                    <div class="meta-item">
                        <strong>创建时间：</strong>
                        <span>${record.createdAt.toLocaleString()}</span>
                    </div>
                    ${record.score !== null ? `
                        <div class="meta-item">
                            <strong>评分：</strong>
                            <span>${record.score}分</span>
                        </div>
                    ` : ''}
                    ${record.jobDescription ? `
                        <div class="meta-item">
                            <strong>职位描述：</strong>
                            <span>${record.jobDescription}</span>
                        </div>
                    ` : ''}
                </div>
                <div class="detail-content">
                    <h4>分析报告</h4>
                    <div class="markdown-content">${record.markdownOutput || '无内容'}</div>
                </div>
            </div>
        `;
    }
    
    if (modal) modal.style.display = 'block';
    
    // 设置当前记录ID供下载使用
    window.currentRecordId = recordId;
}

// 关闭详情模态框
function closeDetailModal() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.style.display = 'none';
    window.currentRecordId = null;
}

// 下载记录
function downloadRecord(recordId) {
    const record = analysisHistoryManager.getRecord(recordId);
    if (!record) return;
    
    try {
        const blob = new Blob([record.markdownOutput || ''], { 
            type: 'text/markdown;charset=utf-8' 
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${record.title.replace(/[^\w\s-]/g, '')}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        if (window.showToast) {
            window.showToast('报告下载成功', 'success');
        }
    } catch (error) {
        console.error('下载失败:', error);
        if (window.showToast) {
            window.showToast('下载失败: ' + error.message, 'error');
        }
    }
}

// 下载当前模态框中的报告
function downloadReport() {
    if (window.currentRecordId) {
        downloadRecord(window.currentRecordId);
    }
}

// 搜索记录（兼容HTML中的onclick）
function searchRecords() {
    // 搜索功能已通过input事件自动触发，这里可以为空或添加额外逻辑
    console.log('搜索功能已自动触发');
}

// 导出管理器供其他脚本使用
window.analysisHistoryManager = analysisHistoryManager;