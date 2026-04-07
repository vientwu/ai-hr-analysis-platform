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
        const strip = (s) => String(s || '').replace(/<br\s*\/>/gi, ' ').replace(/<br>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        const validJob = (s) => {
            const t = strip(s);
            if (!t) return '';
            if (t.length > 40) return '';
            if (/[•\d]\s*[\.\)]/.test(t)) return '';
            if (/(匹配度|评估|结论|建议|差距|不足|能力|稳定|经验|画像|要求)/i.test(t)) return '';
            return t;
        };
        const grabHtmlTableCell = (keys) => {
            const re = new RegExp(`<tr[\\s\\S]*?<td[\\s\\S]*?>\\s*(?:${keys.join('|')})\\s*<\\/td>\\s*<td[\\s\\S]*?>\\s*([\\s\\S]*?)<\\/td>`, 'i');
            const m = text.match(re);
            if (m && m[1]) { const v = strip(m[1]); if (v) return v; }
            return '';
        };
        const grab = (regex) => {
            for (const line of lines) {
                if (/^\|/.test(line)) continue;
                const m = line.match(regex);
                if (m && m[1]) return strip(m[1]);
            }
            return '';
        };
        const grabTable = (keys) => {
            for (const line of lines) {
                if (!/^\|/.test(line)) continue;
                const cols = line.split('|').map(s => s.trim());
                for (let i = 0; i < cols.length - 1; i++) {
                    const k = cols[i];
                    const v = cols[i + 1];
                    if (new RegExp(`^(?:${keys.join('|')})$`, 'i').test(k)) {
                        const out = strip(v);
                        if (out) return out;
                    }
                }
            }
            return '';
        };
        candidate_name = grab(/^(?:\s*[-*]?\s*)?(?:姓名|候选人|面试者|Name|Candidate|Interviewee)\s*[：:]\s*([^\n]+)/i);
        if (!candidate_name) {
            const t = text.match(/(?:候选人|面试者|姓名|Name|Candidate|Interviewee)\s*[:：]\s*([^\n]+)/i);
            if (t && t[1]) candidate_name = strip(t[1]);
            if (!candidate_name) candidate_name = grabTable(['姓名','候选人','面试者','Name','Candidate','Interviewee']);
        }
        const jobKeys = ['面试岗位','应聘岗位','招聘岗位','岗位名称','职位名称','Job\\s*Title','Position','Role'];
        job_title = grab(new RegExp(`^(?:\\s*[-*]?\\s*)?(?:${jobKeys.join('|')})\\s*[：:]\\s*([^\\n]+)$`, 'i'));
        if (!job_title) job_title = grabTable(['面试岗位','应聘岗位','招聘岗位','岗位名称','职位名称']);
        if (!job_title) {
            const cell = grabHtmlTableCell(['面试岗位','应聘岗位','招聘岗位','岗位名称','职位名称','岗位','Job\\s*Title','Position','Role']);
            if (cell) { const v = validJob(cell); if (v) job_title = v; }
        }
        if (!job_title) {
            for (const line of lines) {
                if (/^\|/.test(line)) continue;
                const h = line.match(/^#{1,6}\s*(.+)$/);
                const src = (h && h[1]) ? h[1] : line;
                const m2 = src.match(/([^\n]+?)\s*岗位(?:人才评估|评估报告|报告|画像)?/);
                if (m2 && validJob(m2[1])) { job_title = validJob(m2[1]); break; }
            }
        }
        if (!job_title) {
            const g = text.match(new RegExp(`(?:${jobKeys.join('|')})\s*[:：]\s*([^\n]+)`, 'i'));
            if (g && g[1]) { const v = validJob(g[1]); if (v) job_title = v; }
        }
        if (!job_title) {
            const mm = Array.from(text.matchAll(new RegExp(`(?:${jobKeys.join('|')})\\s*[:：]?\\s*([^\\n%|]{2,40})`, 'gi'))).map(m => strip(m[1])).filter(x => validJob(x));
            if (mm.length) job_title = mm[mm.length - 1];
        }
        if (!job_title && candidate_name) {
            const mbr = candidate_name.match(/(?:\(|（|\[)\s*([^\)\]）]{2,40})\s*(?:\)|）|\])/);
            if (mbr && mbr[1]) {
                const v = validJob(mbr[1]);
                if (v) {
                    job_title = v;
                    candidate_name = strip(candidate_name.replace(/(?:\(|（|\[)[^\)\]）]{2,40}(?:\)|）|\])/, ''));
                }
            }
        }
    let scoreStr = null;
    {
        const anchorIdx = (() => {
            for (let i = 0; i < lines.length; i++) {
                const l = lines[i];
                if (/招聘决策摘要|第一部分/i.test(l)) return i;
            }
            return -1;
        })();
        if (anchorIdx !== -1) {
            const end = Math.min(lines.length, anchorIdx + 80);
            const subText = lines.slice(anchorIdx, end).join('\n');
            let mHtml = subText.match(/<td[^>]*>\s*匹配度\s*<\/td>\s*<td[^>]*>\s*([0-9]{1,3})\s*[%％]/i);
            if (mHtml && mHtml[1]) { scoreStr = mHtml[1]; }
            if (!scoreStr) {
                for (let j = anchorIdx; j < end; j++) {
                    const l = lines[j];
                    if (/^\|/.test(l)) {
                        const cols = l.split('|').map(s => s.trim());
                        const isSep = cols.some(c => /^-+$/.test(c));
                        if (isSep) continue;
                        for (let i = 0; i < cols.length - 1; i++) {
                            if (/^匹配度$/i.test(cols[i])) {
                                const m = (cols[i + 1] || '').match(/([0-9]{1,3})\s*[%％]/);
                                if (m) { scoreStr = m[1]; break; }
                            }
                        }
                        if (scoreStr) break;
                    } else {
                        const m = l.match(/匹配度\s*[:：]?\s*([0-9]{1,3})\s*[%％]/i);
                        if (m) { scoreStr = m[1]; break; }
                        if (/匹配度/i.test(l)) {
                            for (let k = j + 1; k < Math.min(j + 4, end); k++) {
                                const lk = lines[k];
                                const mk = lk.match(/([0-9]{1,3})\s*[%％]/);
                                if (mk) { scoreStr = mk[1]; break; }
                            }
                            if (scoreStr) break;
                        }
                    }
                }
            }
        }
    }
    if (!scoreStr) scoreStr = grab(/^(?:\s*[-*]?\s*)?(?:综合匹配度|总体匹配度|总匹配度|岗位匹配度|综合评分|综合匹配|匹配度)\s*[：:]\s*([0-9]{1,3})\s*[%％]/i);
        if (!scoreStr) {
            const cell = grabTable(['综合匹配度','总体匹配度','总匹配度','岗位匹配度','综合评分','匹配度']);
            if (cell) { const m = cell.match(/([0-9]{1,3})\s*[%％]/); if (m) scoreStr = m[1]; }
        }
    if (!scoreStr) {
        const mRow = text.match(/(^|\n)\s*\|\s*匹配度\s*\|\s*([0-9]{1,3})\s*[%％]/mi);
        if (mRow && mRow[2]) scoreStr = mRow[2];
    }
        if (!scoreStr) {
            const cell2 = grabHtmlTableCell(['综合匹配度','总体匹配度','总匹配度','岗位匹配度','综合评分','匹配度']);
            if (cell2) { const m2 = cell2.match(/([0-9]{1,3})\s*%/); if (m2) scoreStr = m2[1]; }
        }
        if (!scoreStr) {
            const sectionRe = /评估结论|候选人详细评估|综合评估|Evaluation|Summary/i;
            for (let i = 0; i < lines.length; i++) {
                if (sectionRe.test(lines[i])) {
                    for (let j = i; j < Math.min(i + 20, lines.length); j++) {
                        const l = lines[j];
                        if (/^\|/.test(l)) continue;
                        let m = l.match(/(?:综合匹配度|岗位匹配度|匹配度|综合评分)\s*[：:]\s*([0-9]{1,3})\s*%/i);
                        if (!m) m = l.match(/(?:综合匹配度|岗位匹配度|匹配度|综合评分)\s*([0-9]{1,3})\s*%/i);
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
                let m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*[：:]\s*([0-9]{1,3})\s*%/i);
                if (!m) m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*([0-9]{1,3})\s*%/i);
                if (m && m[1]) { scoreStr = m[1]; break; }
            }
        }
        if (!scoreStr) {
            const all = Array.from(text.matchAll(/(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*[:：]?\s*([0-9]{1,3})\s*%/gi)).map(m => m[1]);
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
                // 如果未登录，则尝试本地演示数据回退
                if (!user) {
                    try {
                        const demo = JSON.parse(localStorage.getItem('demo_user') || 'null');
                        const uid = demo?.id || null;
                        if (uid) {
                            const arr = JSON.parse(localStorage.getItem(`demo_reports_${uid}`) || '[]') || [];
                            const found = arr.find(r => String(r.id) === String(reportId)) || null;
                            if (found) record = found;
                        }
                    } catch {}
                    if (!record) {
                        const retry = async () => { window.removeEventListener('auth-changed', handler); await fetchReport(); };
                        const handler = () => retry();
                        window.addEventListener('auth-changed', handler, { once: true });
                        document.getElementById('report-content').innerHTML = '<p class="notice">请先登录</p>';
                        setupToolbar('', '报告');
                        return;
                    }
                } else {
                    // 已登录：优先通过本地 /api 代理拉取列表；无令牌则跳过云端调用
                    let fetched = null;
                    let token = '';
                    try { const { data } = await window.Auth.getClient().auth.getSession(); token = data?.session?.access_token || ''; } catch {}
                    if (token) {
                        try {
                            const { data, error } = await window.Auth.supabase
                                .from('reports')
                                .select('*')
                                .eq('id', reportId)
                                .limit(1)
                                .maybeSingle();
                            if (!error && data) fetched = data;
                        } catch {}
                    }
                    // 若云端未取到，尝试读取本地演示数据
                    if (!fetched) {
                        try {
                            const arr = JSON.parse(localStorage.getItem(`demo_reports_${user.id}`) || '[]') || [];
                            fetched = arr.find(r => String(r.id) === String(reportId)) || null;
                        } catch {}
                    }
                    record = fetched;
                }
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

        let md = '';
        try {
            const rawPref = (record.markdown_output !== undefined && record.markdown_output !== null) ? record.markdown_output : (record.content ?? '');
            const s = String(rawPref || '').trim();
            if (s.startsWith('{')) {
                let obj = null; try { obj = JSON.parse(s); } catch { obj = null; }
                if (obj) {
                    if (typeof obj.resume_md === 'string') md = obj.resume_md;
                    else if (typeof obj.md === 'string') md = obj.md;
                    else if (typeof obj.ai_analysis_md === 'string') md = obj.ai_analysis_md;
                    else {
                        const find = (o) => {
                            if (!o) return '';
                            if (typeof o === 'string') return o;
                            if (Array.isArray(o)) { for (const it of o) { const v = find(it); if (v) return v; } return ''; }
                            if (typeof o === 'object') {
                                for (const k of ['markdown','content','text','md','resume_md','ai_analysis_md']) { const v = o[k]; if (typeof v === 'string' && v.trim()) return v; }
                                const vals = Object.values(o);
                                for (const v of vals) { const r = find(v); if (r) return r; }
                            }
                            return '';
                        };
                        md = find(obj) || '';
                    }
                } else { md = s; }
            } else { md = s; }
        } catch { md = String(record.content ?? record.markdown_output ?? ''); }
        const parsed = extractSummaryFieldsFromMarkdown(md);
        const pickNonEmpty = (...args) => { for (const a of args) { if (a !== undefined && a !== null) { const s = String(a).trim(); if (s) return s; } } return ''; };
        const candidate = pickNonEmpty(record.candidate_name, parsed.candidate_name, record.title, '未命名候选人');
        const job = pickNonEmpty(record.job_title, parsed.job_title, '未知岗位');
        const rawScore = (parsed.match_score != null ? parsed.match_score : (record.match_score ?? null));
        const numScore = (() => {
            if (rawScore === null || rawScore === undefined || rawScore === '') return null;
            const n = parseInt(String(rawScore).trim(), 10);
            if (Number.isFinite(n)) return Math.max(0, Math.min(100, n));
            return null;
        })();
        const scoreText = (numScore !== null) ? `${Math.round(numScore)}%` : '未知';
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
