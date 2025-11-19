// 报告查看页脚本
(function(){
    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    function escapeHtml(text) {
        if (text === null || text === undefined) return '';
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderMarkdown(md) {
        try {
            if (typeof marked !== 'undefined' && typeof DOMPurify !== 'undefined') {
                const rawHtml = marked.parse(md || '');
                return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
            }
        } catch (e) {
            console.warn('Render markdown failed, fallback to pre text', e);
        }
        return `<pre class="fallback-pre">${escapeHtml(md || '')}</pre>`;
    }

    

    // 与简历/面试分析页一致的容器增强：主题色 + 表格滚动包装
    function enhanceReportContainer(container, type) {
        if (!container) return;
        container.classList.remove('resume-report', 'interview-report');
        if (type === 'resume') {
            container.classList.add('resume-report');
        } else if (type === 'interview') {
            container.classList.add('interview-report');
        }
        // 表格外包裹可滚动容器，避免窄屏溢出
        const tables = Array.from(container.querySelectorAll('table'));
        tables.forEach(table => {
            const p = table.parentElement;
            if (!p || !p.classList || !p.classList.contains('table-wrapper')) {
                const wrapper = document.createElement('div');
                wrapper.className = 'table-wrapper';
                table.parentNode.insertBefore(wrapper, table);
                wrapper.appendChild(table);
            }
        });
    }

    function setupToolbar(md, candidate) {
        const ddBtn = document.getElementById('download-dropdown-btn');
        const ddMenu = document.getElementById('download-dropdown-menu');
        const ddRoot = document.getElementById('download-dropdown');
        const mdOpt = document.getElementById('download-md-option');
        const docxOpt = document.getElementById('download-docx-option');
        const pdfOpt = document.getElementById('download-pdf-option');
        const printBtn = document.getElementById('print-report');
        const copyBtn = document.getElementById('copy-link');
        const navBtn = document.getElementById('nav-dropdown-btn');
        const navRoot = document.getElementById('nav-dropdown');

        if (ddBtn && ddMenu && ddRoot && !ddBtn.__bound) {
            ddBtn.__bound = true;
            ddBtn.addEventListener('click', () => { ddRoot.classList.toggle('open'); });
            document.addEventListener('click', (e) => { if (!ddRoot.contains(e.target)) ddRoot.classList.remove('open'); });
        }
        if (navBtn && navRoot && !navBtn.__bound) {
            navBtn.__bound = true;
            navBtn.addEventListener('click', () => { navRoot.classList.toggle('open'); });
            document.addEventListener('click', (e) => { if (!navRoot.contains(e.target)) navRoot.classList.remove('open'); });
        }
        const ensureContent = () => {
            if (!md || !md.trim()) { alert('暂无可下载内容'); return false; }
            return true;
        };
        if (mdOpt && !mdOpt.__bound) {
            mdOpt.__bound = true;
            mdOpt.addEventListener('click', () => {
                if (!ensureContent()) return;
                const blob = new Blob([md || ''], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${candidate || '报告'}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (ddRoot) ddRoot.classList.remove('open');
            });
        }
        if (docxOpt && !docxOpt.__bound) {
            docxOpt.__bound = true;
            docxOpt.addEventListener('click', () => {
                try {
                    if (!ensureContent()) return;
                    const htmlContent = renderMarkdown(md || '');
                    const docxBlob = htmlDocx.asBlob(htmlContent);
                    const url = URL.createObjectURL(docxBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${candidate || '报告'}.docx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    if (ddRoot) ddRoot.classList.remove('open');
                } catch (error) { alert('生成Word文档失败'); }
            });
        }
        if (pdfOpt && !pdfOpt.__bound) {
            pdfOpt.__bound = true;
            pdfOpt.addEventListener('click', async () => {
                try {
                    if (!ensureContent()) return;
                    const el = document.getElementById('report-content');
                    if (window.html2pdf && el) {
                        await html2pdf().from(el).set({
                            margin: 10,
                            filename: `${candidate || '报告'}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        }).save();
                    } else { window.print(); }
                } catch (e) { window.print(); }
                finally { if (ddRoot) ddRoot.classList.remove('open'); }
            });
        }
        if (printBtn && !printBtn.__bound) {
            printBtn.__bound = true;
            printBtn.addEventListener('click', () => { window.print(); });
        }
        if (copyBtn && !copyBtn.__bound) {
            copyBtn.__bound = true;
            copyBtn.addEventListener('click', async () => {
                try { await navigator.clipboard.writeText(window.location.href); alert('链接已复制到剪贴板'); }
                catch (e) { alert('复制失败，请手动复制地址栏链接'); }
            });
        }
    }

    function extractSummaryFieldsFromMarkdown(markdown) {
        const text = (markdown || '').replace(/\r/g, '');
        const lines = text.split('\n');
        let candidate_name = '';
        let job_title = '';
        let match_score = null;
        const grab = (regex) => {
            for (const line of lines) {
                const m = line.match(regex);
                if (m && m[1]) return m[1].trim();
            }
            return '';
        };
        candidate_name = grab(/^(?:\s*[-*]?\s*)?(?:姓名|候选人|面试者|Name|Candidate|Interviewee)\s*[：:]\s*([^\n]+)/i)
            || (text.match(/(?:面试者|姓名|Name|Interviewee)\s*[:：]\s*([^\n]+)/i)?.[1] || '').trim();
        job_title = grab(/^(?:\s*[-*]?\s*)?(?:岗位|职位|岗位名称|职位名称|Job\s*Title|Position|Role)\s*[：:]\s*([^\n]+)/i)
            || (text.match(/(?:岗位|职位|Job\s*Title|Position|Role)\s*[:：]\s*([^\n]+)/i)?.[1] || '').trim();
        let scoreStr = grab(/^(?:\s*[-*]?\s*)?(?:综合匹配度|总体匹配度|总匹配度|综合匹配)\s*[：:]\s*([0-9]{1,3})\s*%/i);
        if (!scoreStr) {
            const sectionRe = /评估结论|候选人详细评估|综合评估|Evaluation|Summary/i;
            for (let i = 0; i < lines.length; i++) {
                if (sectionRe.test(lines[i])) {
                    for (let j = i; j < Math.min(i + 20, lines.length); j++) {
                        const l = lines[j];
                        if (/^\|/.test(l)) continue;
                        const m = l.match(/(?:综合匹配度|匹配度)\s*[：:]\s*([0-9]{1,3})\s*%/i);
                        if (m && m[1]) { scoreStr = m[1]; break; }
                    }
                    if (scoreStr) break;
                }
            }
        }
        if (!scoreStr) {
            for (const line of lines) {
                if (/^\|/.test(line)) continue;
                if (/命中率|命中数|维度|得分|分值|points|硬性|V-Raise/i.test(line)) continue;
                const m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|综合匹配)\s*[：:]\s*([0-9]{1,3})\s*%/i);
                if (m && m[1]) { scoreStr = m[1]; break; }
            }
        }
        if (!scoreStr) {
            const all = Array.from(text.matchAll(/(?:匹配度|综合匹配)\s*[:：]\s*([0-9]{1,3})\s*%/gi)).map(m => m[1]);
            if (all.length) scoreStr = all[all.length - 1];
        }
        if (scoreStr) {
            const num = Math.max(0, Math.min(100, parseInt(scoreStr, 10)));
            if (!Number.isNaN(num)) match_score = num;
        }
        return { candidate_name, job_title, match_score };
    }

    async function fetchReport() {
        const reportId = getQueryParam('report_id');
        const isLocal = !!getQueryParam('local');
        if (!reportId) {
            document.getElementById('report-content').innerHTML = '<p class="notice">缺少报告ID</p>';
            setupToolbar('', '报告');
            return;
        }

        let record = null;
        try {
            if (!isLocal && window.Auth && window.Auth.supabase) {
                if (typeof window.Auth.initialize === 'function') {
                    try { window.Auth.initialize(); } catch {}
                }
                let user = await window.Auth.getCurrentUser();
                if (!user && window.Auth.getClient && window.Auth.getClient()) {
                    try { const { data } = await window.Auth.getClient().auth.getSession(); user = data?.session?.user || null; } catch {}
                }
                if (!user) {
                    const retry = async () => { window.removeEventListener('auth-changed', handler); await fetchReport(); };
                    const handler = () => retry();
                    window.addEventListener('auth-changed', handler, { once: true });
                    document.getElementById('report-content').innerHTML = '<p class="notice">请先登录</p>';
                    setupToolbar('', '报告');
                    return;
                }
                // 优先尝试通过本地 /api 代理拉取列表（兼容云端部署统一行为）
                let fetched = null;
                try {
                    let token = '';
                    try { const { data } = await window.Auth.getClient().auth.getSession(); token = data?.session?.access_token || ''; } catch {}
                    const apiBase = (window.location && window.location.port === '4321') ? 'http://127.0.0.1:4000' : '';
                    const resp = await fetch(`${apiBase}/api/reports-list?user_id=${encodeURIComponent(user.id)}`, {
                        headers: token ? { Authorization: `Bearer ${token}` } : {}
                    });
                    if (resp.ok) {
                        const json = await resp.json();
                        const list = json?.data || [];
                        fetched = list.find(r => String(r.id) === String(reportId)) || null;
                    }
                } catch {}
                if (!fetched) {
                    // 代理不可用或未返回记录时，直接使用 Supabase 客户端按 id 查询
                    const { data, error } = await window.Auth.supabase
                        .from('reports')
                        .select('*')
                        .eq('id', reportId)
                        .limit(1)
                        .maybeSingle();
                    if (!error && data) fetched = data;
                }
                record = fetched;
            }
        } catch (err) {
            console.error('Fetch report error', err);
        }

        // 云端唯一模式：不再读取本地演示数据

        if (!record) {
            document.getElementById('report-content').innerHTML = '<p class="notice">未找到该报告</p>';
            setupToolbar('', '报告');
            return;
        }

        const md = record.content ?? record.markdown_output ?? '';
        const parsed = extractSummaryFieldsFromMarkdown(md);
        const candidate = record.candidate_name ?? parsed.candidate_name ?? '未命名候选人';
        const job = record.job_title ?? parsed.job_title ?? '未知岗位';
        const scoreVal = (record.match_score ?? parsed.match_score);
        const scoreText = (scoreVal || scoreVal === 0) ? `${Math.round(Number(scoreVal))}%` : '未知';
        const typeText = (record.type ?? record.report_type) === 'resume' ? '简历分析' : '面试分析';

        document.getElementById('report-title').innerText = candidate;
        const bc = document.getElementById('report-title-breadcrumb');
        if (bc) bc.innerText = candidate;
        document.getElementById('report-type').innerText = typeText;
        document.getElementById('report-date').innerText = new Date(record.created_at).toLocaleString();
        document.getElementById('report-summary').innerText = `岗位：${job}｜匹配度：${scoreText}`;
        const container = document.getElementById('report-content');
        container.innerHTML = renderMarkdown(md);
        const typeVal = (record.type ?? record.report_type) === 'interview' ? 'interview' : 'resume';
        enhanceReportContainer(container, typeVal);
        setupToolbar(md, candidate);

        // Download actions
        const ddBtn = document.getElementById('download-dropdown-btn');
        const ddMenu = document.getElementById('download-dropdown-menu');
        const ddRoot = document.getElementById('download-dropdown');
        const mdOpt = document.getElementById('download-md-option');
        const docxOpt = document.getElementById('download-docx-option');
        const pdfOpt = document.getElementById('download-pdf-option');
        if (ddBtn && ddMenu && ddRoot) {
            ddBtn.addEventListener('click', () => {
                ddRoot.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!ddRoot.contains(e.target)) ddRoot.classList.remove('open');
            });
        }
        if (mdOpt) {
            mdOpt.addEventListener('click', () => {
                const blob = new Blob([md || ''], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${candidate}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                if (ddRoot) ddRoot.classList.remove('open');
            });
        }
        if (docxOpt) {
            docxOpt.addEventListener('click', () => {
                try {
                    const htmlContent = renderMarkdown(md || '');
                    const docxBlob = htmlDocx.asBlob(htmlContent);
                    const url = URL.createObjectURL(docxBlob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${candidate}.docx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    if (ddRoot) ddRoot.classList.remove('open');
                } catch (error) {
                    alert('生成Word文档失败');
                }
            });
        }
        if (pdfOpt) {
            pdfOpt.addEventListener('click', async () => {
                try {
                    const el = document.getElementById('report-content');
                    if (window.html2pdf && el) {
                        await html2pdf().from(el).set({
                            margin: 10,
                            filename: `${candidate}.pdf`,
                            image: { type: 'jpeg', quality: 0.98 },
                            html2canvas: { scale: 2 },
                            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
                        }).save();
                    } else {
                        window.print();
                    }
                } catch (e) {
                    window.print();
                } finally {
                    if (ddRoot) ddRoot.classList.remove('open');
                }
            });
        }

        // 工具栏：打印与复制链接
        const printBtn = document.getElementById('print-report');
        const copyBtn = document.getElementById('copy-link');
        if (printBtn) {
            printBtn.addEventListener('click', () => {
                window.print();
            });
        }
        if (copyBtn) {
            copyBtn.addEventListener('click', async () => {
                try {
                    await navigator.clipboard.writeText(window.location.href);
                    alert('链接已复制到剪贴板');
                } catch (e) {
                    alert('复制失败，请手动复制地址栏链接');
                }
            });
        }

        const navBtn = document.getElementById('nav-dropdown-btn');
        const navRoot = document.getElementById('nav-dropdown');
        if (navBtn && navRoot) {
            navBtn.addEventListener('click', () => {
                navRoot.classList.toggle('open');
            });
            document.addEventListener('click', (e) => {
                if (!navRoot.contains(e.target)) navRoot.classList.remove('open');
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        try { if (window.Auth && typeof window.Auth.initialize === 'function') window.Auth.initialize(); } catch {}
        fetchReport();
    });
})();
