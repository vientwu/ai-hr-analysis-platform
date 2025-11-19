(() => {
  try { window._newAnalysisLoaded = true; } catch {}
  const fileInput = document.getElementById('new-resume-files');
  const fileInfo = document.getElementById('new-resume-files-info');
  const uploadArea = document.querySelector('#resume-module .upload-area');
  const jdInput = document.getElementById('new-job-description');
  const jdCount = document.getElementById('new-jd-count');
  const startBtn = document.getElementById('start-local-analysis');
  const resultSection = document.getElementById('new-result');
  const resultContent = document.getElementById('new-result-content');
  const loadingOverlay = document.getElementById('new-loading');
  const loadingTitle = document.getElementById('new-loading-title');
  const promptStatus = document.getElementById('prompt-status');
  const saveBtn = document.getElementById('save-new-report');
  const dlDocxBtn = document.getElementById('download-new-docx');
  const dlMdBtn = document.getElementById('download-new-md');
  const openSettingsBtn = document.getElementById('open-settings');
  const settingsModal = document.getElementById('settings-modal');
  const settingsClose = document.getElementById('settings-close');
  const keyInput = document.getElementById('openrouter-key');
  const modelSelect = document.getElementById('model-select');
  const providerSelect = document.getElementById('provider-select');
  const customModelInput = document.getElementById('custom-model');
  const promptResumeInput = document.getElementById('prompt-resume');
  const promptJdInput = document.getElementById('prompt-jd');
  const promptMatchInput = document.getElementById('prompt-match');
  const loadDefaultPromptsBtn = document.getElementById('load-default-prompts');
  const settingsSave = document.getElementById('settings-save');
  const testConnBtn = document.getElementById('test-conn');
  const connStatus = document.getElementById('conn-status');
  let resumeTexts = [];
  let resumeMarkdown = '';
  let prompts = { resumeInfo: '', matchInterview: '', jdPortrait: '' };
  const defaultModel = 'anthropic/claude-3.5-sonnet';
  let userSettings = { provider: 'openrouter', apiKey: '', keys: { openrouter: '', openai: '', anthropic: '', deepseek: '' }, model: defaultModel, customModel: '', prompts: { resumeInfo: '', matchInterview: '', jdPortrait: '' } };
  const API_BASE = (window.location.port === '4321') ? 'http://127.0.0.1:4000' : '';
  const MODEL_CATALOG = [
    { v: 'anthropic/claude-3.5-sonnet', t: 'Anthropic: Claude 3.5 Sonnet' },
    { v: 'anthropic/claude-3.7-sonnet', t: 'Anthropic: Claude 3.7 Sonnet' },
    { v: 'anthropic/claude-3-haiku', t: 'Anthropic: Claude 3 Haiku' },
    { v: 'anthropic/claude-3-opus', t: 'Anthropic: Claude 3 Opus' },
    { v: 'deepseek/deepseek-chat', t: 'DeepSeek Chat' },
    { v: 'deepseek/deepseek-r1', t: 'DeepSeek R1' },
    { v: 'openai/gpt-4o', t: 'OpenAI GPT-4o' },
    { v: 'openai/gpt-4.1', t: 'OpenAI GPT-4.1' },
    { v: 'google/gemini-1.5-pro', t: 'Gemini 1.5 Pro' },
    { v: 'mistralai/mixtral-8x7b', t: 'Mistral Mixtral 8x7B' },
    { v: 'qwen/qwen2.5-7b-instruct', t: 'Qwen2.5 7B Instruct' }
  ];

  const getUserKey = async () => {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    const uid = user ? user.id : 'guest';
    const key = `openrouter_settings_${uid}`;
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  };

  const setUserKey = async (obj) => {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    const uid = user ? user.id : 'guest';
    const key = `openrouter_settings_${uid}`;
    try { localStorage.setItem(key, JSON.stringify(obj || {})); } catch {}
  };

  const showToast = (msg, ms = 6000) => {
    const el = document.getElementById('new-toast');
    if (!el) return;
    try {
      if (el.parentNode !== document.body) document.body.appendChild(el);
      el.innerText = String(msg || '');
      el.style.display = 'block';
      el.style.position = 'fixed';
      el.style.top = '16px';
      el.style.right = '16px';
      el.style.left = 'auto';
      el.style.maxWidth = '480px';
      el.style.zIndex = '9999';
      setTimeout(() => { el.style.display = 'none'; }, ms);
    } catch {}
  };

  const setButtonLoading = (loading) => {
    if (loading) {
      startBtn.disabled = true;
      const icon = startBtn.querySelector('i');
      if (icon) { icon.className = 'fas fa-cog fa-spin'; }
      startBtn.style.opacity = '0.85';
    } else {
      startBtn.disabled = false;
      const icon = startBtn.querySelector('i');
      if (icon) { icon.className = 'fas fa-play'; }
      startBtn.style.opacity = '1';
    }
  };

  const showLoading = (title) => {
    if (title) { loadingTitle.textContent = title; }
    loadingOverlay.style.display = 'flex';
    setButtonLoading(true);
  };

  const hideLoading = () => {
    loadingOverlay.style.display = 'none';
    setButtonLoading(false);
  };

  const DEFAULT_PROMPTS = {};

  const fetchPrompt = async (p) => {
    try {
      const r = await fetch(encodeURI('/' + p), { cache: 'no-store' });
      if (r.ok) return await r.text();
    } catch {}
    return '';
  };

  const loadPrompts = async () => {
    try {
      const saved = await getUserKey();
      if (saved && saved.prompts && (saved.prompts.resumeInfo || saved.prompts.matchInterview || saved.prompts.jdPortrait)) {
        prompts.resumeInfo = saved.prompts.resumeInfo || '';
        prompts.matchInterview = saved.prompts.matchInterview || '';
        prompts.jdPortrait = saved.prompts.jdPortrait || '';
        if (promptStatus) promptStatus.innerText = '已加载（自定义）';
        return;
      }
      prompts.resumeInfo = '';
      prompts.matchInterview = '';
      prompts.jdPortrait = '';
      if (promptStatus) promptStatus.innerText = '未设置';
    } catch {
      if (promptStatus) promptStatus.innerText = '加载失败';
    }
  };
  try { window.loadPrompts = loadPrompts; } catch {}

  const openSettings = async () => {
    if (!settingsModal || !providerSelect || !keyInput || !modelSelect || !customModelInput) {
      if (settingsModal) settingsModal.style.display = 'block';
      return;
    }
    const saved = await getUserKey();
    userSettings = saved || userSettings;
    if (!userSettings.keys || typeof userSettings.keys !== 'object') {
      userSettings.keys = { openrouter: userSettings.apiKey || '', openai: '', anthropic: '', deepseek: '' };
    }
    if (!userSettings.provider) userSettings.provider = 'openrouter';
    if (providerSelect) {
      providerSelect.value = userSettings.provider || 'openrouter';
    }
    const currentProvider = providerSelect ? providerSelect.value : (userSettings.provider || 'openrouter');
    if (keyInput) {
      keyInput.value = (userSettings.keys && userSettings.keys[currentProvider]) ? userSettings.keys[currentProvider] : (userSettings.apiKey || '');
    }
    if (modelSelect) {
      modelSelect.value = userSettings.model || defaultModel;
    }
    if (customModelInput) {
      customModelInput.value = userSettings.customModel || '';
    }
    if (promptResumeInput) {
      promptResumeInput.value = (userSettings.prompts && userSettings.prompts.resumeInfo) ? userSettings.prompts.resumeInfo : prompts.resumeInfo;
    }
    if (promptJdInput) {
      promptJdInput.value = (userSettings.prompts && userSettings.prompts.jdPortrait) ? userSettings.prompts.jdPortrait : prompts.jdPortrait;
    }
    if (promptMatchInput) {
      promptMatchInput.value = (userSettings.prompts && userSettings.prompts.matchInterview) ? userSettings.prompts.matchInterview : prompts.matchInterview;
    }
    if (settingsModal) settingsModal.style.display = 'block';
    try {
      settingsModal.style.background = 'rgba(0,0,0,0.25)';
      const panel = settingsModal.querySelector('.modal-panel');
      if (panel) {
        panel.style.position = 'relative';
        panel.style.margin = '24px auto';
      }
    } catch {}
  };
  try { window.openSettings = openSettings; } catch {}

  const closeSettings = () => { settingsModal.style.display = 'none'; };

  if (openSettingsBtn) openSettingsBtn.addEventListener('click', openSettings);
  if (settingsClose) settingsClose.addEventListener('click', closeSettings);
  if (settingsSave) settingsSave.addEventListener('click', async () => {
    userSettings.apiKey = keyInput.value.trim();
    if (!userSettings.keys || typeof userSettings.keys !== 'object') {
      userSettings.keys = { openrouter: '', openai: '', anthropic: '', deepseek: '' };
    }
    userSettings.provider = providerSelect.value;
    userSettings.keys[userSettings.provider] = userSettings.apiKey;
    userSettings.model = modelSelect.value;
    userSettings.customModel = customModelInput.value.trim();
    userSettings.prompts = {
      resumeInfo: promptResumeInput.value,
      jdPortrait: promptJdInput.value,
      matchInterview: promptMatchInput.value
    };
    await setUserKey(userSettings);
    prompts.resumeInfo = userSettings.prompts.resumeInfo || prompts.resumeInfo;
    prompts.jdPortrait = userSettings.prompts.jdPortrait || prompts.jdPortrait;
    prompts.matchInterview = userSettings.prompts.matchInterview || prompts.matchInterview;
    closeSettings();
    showToast('已保存设置');
  });

  // 居中由 CSS 控制，无需窗口尺寸计算

  if (loadDefaultPromptsBtn) loadDefaultPromptsBtn.addEventListener('click', () => {
    promptResumeInput.value = '';
    promptMatchInput.value = '';
    promptJdInput.value = '';
    if (promptStatus) promptStatus.innerText = '未设置';
  });

  const readTxt = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });

  const readDocx = async (file) => {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const resp = await fetch(`${API_BASE}/api/parse-doc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name || 'file.docx', mime: file.type || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', dataBase64: base64 })
      });
      if (!resp.ok) return '';
      const j = await resp.json();
      return String(j.text || '');
    } catch { return ''; }
  };

  const readPdf = async (file) => {
    try {
      const base64 = await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      const resp = await fetch(`${API_BASE}/api/parse-doc`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name || 'file.pdf', mime: file.type || 'application/pdf', dataBase64: base64 })
      });
      let txt = '';
      if (resp.ok) {
        const j = await resp.json();
        txt = String(j.text || '');
      }
      if (txt && txt.trim()) return txt;
      const ocr = await (async () => {
        try {
          const pdfjs = window.pdfjsLib;
          const Tesseract = window.Tesseract;
          if (!pdfjs || !Tesseract) return '';
          const url = URL.createObjectURL(file);
          const doc = await pdfjs.getDocument(url).promise;
          let out = '';
          const pages = Math.min(3, doc.numPages || 0);
          showToast(`正在识别PDF（共${doc.numPages}页，处理前${pages}页）`);
          const start = Date.now();
          for (let i = 1; i <= pages; i++) {
            const page = await doc.getPage(i);
            // 先尝试读取文本层（比OCR更快）
            try {
              const tc = await page.getTextContent();
              const textFast = (tc && tc.items) ? tc.items.map(it => it.str).join('\n') : '';
              if (textFast && textFast.trim().length > 40) {
                out += textFast.trim() + '\n\n';
                showToast('已提取文本层，跳过OCR');
                continue;
              }
            } catch {}
            const viewport = page.getViewport({ scale: 1.25 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            // 快速模式：优先英文，结果过短时再尝试中英混合（可能下载语言包，速度较慢）
            let res = await Tesseract.recognize(canvas, 'eng', { logger: () => {} }).catch(() => null);
            let text = (res && res.data && res.data.text ? res.data.text : '');
            if (!text || text.trim().length < 20) {
              res = await Tesseract.recognize(canvas, 'chi_sim+eng', { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' }).catch(() => null);
              text = (res && res.data && res.data.text ? res.data.text : '');
            }
            out += (res && res.data && res.data.text ? res.data.text : '') + '\n\n';
            showToast(`OCR第${i}/${pages}页完成`);
            // 快速超时保护
            if (Date.now() - start > 18000) break;
          }
          URL.revokeObjectURL(url);
          return out.trim();
        } catch { return ''; }
      })();
      return ocr || '';
    } catch { return ''; }
  };

  const parseFile = async (file) => {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.txt')) return await readTxt(file);
    if (name.endsWith('.docx')) return await readDocx(file);
    if (name.endsWith('.pdf')) return await readPdf(file);
    return '';
  };

  const tokenize = (s) => {
    return String(s || '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .split(/\s+/)
      .filter(x => x && x.length >= 2)
      .map(x => x.toLowerCase());
  };

  const topKeywords = (s, n = 30) => {
    const arr = tokenize(s);
    const stop = new Set(['的','和','与','及','在','为','并','或','和','是','了','及其','以及','the','and','for','with','you','are','this','that','from','into','out','your','our']);
    const freq = new Map();
    for (const w of arr) {
      if (stop.has(w)) continue;
      freq.set(w, (freq.get(w) || 0) + 1);
    }
    return Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0,n).map(([w])=>w);
  };

  

  const highlightKeywordsInElement = (root, keywords) => {
    try {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      const nodes = [];
      let n; while ((n = walker.nextNode())) { nodes.push(n); }
      const patterns = keywords.map(k => new RegExp(`(${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
      for (const node of nodes) {
        let text = node.nodeValue;
        let changed = false;
        for (const re of patterns) {
          if (re.test(text)) {
            changed = true;
            text = text.replace(re, '<mark class="kw-highlight">$1</mark>');
          }
        }
        if (changed) {
          const span = document.createElement('span');
          span.innerHTML = DOMPurify.sanitize(text);
          node.parentNode.replaceChild(span, node);
        }
      }
    } catch {}
  };

  const applyReportTheme = () => {
    resultContent.classList.add('resume-report');
    const tables = resultContent.querySelectorAll('table');
    tables.forEach(t => {
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      t.parentNode.insertBefore(wrapper, t);
      wrapper.appendChild(t);
    });
  };

  const renderMarkdownChunked = (md, keywords) => {
    resultContent.innerHTML = '';
    const parts = String(md || '').split(/\n(?=### )|^\s*---\s*$/gm); // 仅在独立分隔线或标题处分块，避免表格内 '---'
    let idx = 0;
    const renderNext = () => {
      if (idx >= parts.length) {
        applyReportTheme();
        if (keywords && keywords.length) highlightKeywordsInElement(resultContent, keywords);
        return;
      }
      const chunk = parts[idx++];
      const html = marked.parse(chunk || '');
      const safe = DOMPurify.sanitize(html);
      const div = document.createElement('div');
      div.innerHTML = safe;
      resultContent.appendChild(div);
      requestAnimationFrame(renderNext);
    };
    renderNext();
  };

  

  const callLLM = async (provider, messages, useKey, useModel, maxTokens = 12000) => {
    const url = API_BASE ? `${API_BASE}/api/llm-chat` : '/api/llm-chat';
    try {
      const resp = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Provider-Key': useKey },
        body: JSON.stringify({ provider, model: useModel, messages, max_tokens: maxTokens, temperature: 0.2 })
      });
      if (!resp.ok) { const t = await resp.text(); throw new Error(t || 'LLM调用失败'); }
      const json = await resp.json();
      const choice = (json.choices && json.choices[0]) ? json.choices[0] : null;
      const md = choice && choice.message && choice.message.content ? choice.message.content : '';
      const finish = choice && choice.finish_reason ? choice.finish_reason : (json.finish_reason || '');
      return { md, finish };
    } catch (e) {
      showToast(`LLM调用失败：${e?.message || '未知错误'}`);
      throw e;
    }
  };

  const setConnStatus = (ok, msg) => {
    if (!connStatus) return;
    connStatus.textContent = ok ? (msg || '已连接') : (msg || '连接失败');
    connStatus.style.color = ok ? '#059669' : '#dc2626';
  };

  const testConnectivity = async () => {
    try {
      if (!providerSelect) { showToast('设置未初始化'); return; }
      const provider = providerSelect.value;
      const model = modelSelect.value || defaultModel;
      const key = keyInput.value.trim();
      if (!key) { showToast('请先填写 API Key'); return; }
      if (testConnBtn) { testConnBtn.disabled = true; }
      setConnStatus(false, '测试中...');
      const messages = [
        { role: 'system', content: '你是连接性检测助手，只需返回“ok”。' },
        { role: 'user', content: 'ping' }
      ];
      // 优先走后端代理，最低开销
      const url = API_BASE ? `${API_BASE}/api/llm-chat` : '/api/llm-chat';
      const resp = await fetch(url, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Provider-Key': key },
        body: JSON.stringify({ provider, model, messages, max_tokens: 8, temperature: 0 })
      });
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || '代理调用失败');
      }
      const json = await resp.json();
      const ok = !!(json && json.choices && json.choices.length > 0);
      setConnStatus(ok);
      showToast(ok ? '连接成功' : '连接失败');
    } catch (e) {
      setConnStatus(false, '连接失败');
      showToast('连接失败');
    } finally {
      if (testConnBtn) { testConnBtn.disabled = false; }
    }
  };

  const fixMarkdownTables = (md) => {
    const lines = String(md || '').split(/\n/);
    const out = [];
    let inTable = false;
    let headerProcessed = false;
    const isRowLine = (s) => /^\|[^\n]*\|$/.test(s);
    const isSepLine = (s) => /^\|\s*-+\s*(\|\s*-+\s*)+\|$/.test(s);
    const isAlignRow = (s) => {
      if (!isRowLine(s)) return false;
      const cells = s.slice(1, -1).split('|').map(x => x.trim());
      return cells.every(c => /^:?[-]{2,}:?$/.test(c));
    };
    const isHyphenOnlyRow = (s) => {
      if (!isRowLine(s)) return false;
      const cells = s.slice(1, -1).split('|').map(x => x.trim());
      return cells.every(c => /^[-]{2,}$/.test(c));
    };
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (isRowLine(line)) {
        if (!inTable) {
          // header row
          out.push(line);
          const next = lines[i + 1] || '';
          if (isSepLine(next) || isAlignRow(next)) {
            // normalize alignment/separator row to standard sep
            const bars = (line.match(/\|/g) || []).length;
            const cells = Math.max(1, bars - 1);
            const sep = '|' + Array.from({ length: cells }).map(() => '---').join('|') + '|';
            out.push(sep);
            // consume align row if present
            if (isAlignRow(next)) i++;
          } else {
            // missing separator, insert one
            const bars = (line.match(/\|/g) || []).length;
            const cells = Math.max(1, bars - 1);
            const sep = '|' + Array.from({ length: cells }).map(() => '---').join('|') + '|';
            out.push(sep);
          }
          inTable = true;
          headerProcessed = true;
        } else {
          // skip rows that are only hyphens (LLM占位符)
          if (isHyphenOnlyRow(line)) continue;
          out.push(line);
        }
      } else if (isSepLine(line)) {
        // normalize single separator placement: only keep immediately after header
        if (!headerProcessed) {
          out.push(line);
          headerProcessed = true;
        }
        inTable = true;
      } else {
        out.push(line);
        inTable = false;
        headerProcessed = false;
      }
    }
    return out.join('\n');
  };

  const callOpenRouter = async (messages, useKey, useModel) => {
    const url = API_BASE ? `${API_BASE}/api/openrouter-chat` : '/api/openrouter-chat';
    const resp = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-OpenRouter-Key': useKey },
      body: JSON.stringify({ model: useModel, messages, max_tokens: 8000, temperature: 0.2 })
    });
    if (!resp.ok) { const t = await resp.text(); throw new Error(t || 'LLM调用失败'); }
    const json = await resp.json();
    const choice = (json.choices && json.choices[0]) ? json.choices[0] : null;
    const md = choice && choice.message && choice.message.content ? choice.message.content : '';
    const finish = choice && choice.finish_reason ? choice.finish_reason : (json.finish_reason || '');
    return { md, finish };
  };

  const downloadWord = (title, md) => {
    const style = `<style>
    body { font-family: 'Segoe UI', Arial, sans-serif; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; }
    th { background: #eef2ff; color: #3730a3; }
    .kw-highlight { background: #fde68a; color: #92400e; padding: 0 2px; border-radius: 3px; }
    </style>`;
    const html = `<html><head><meta charset="utf-8">${style}</head><body>${DOMPurify.sanitize(marked.parse(md || ''))}</body></html>`;
    const blob = window.htmlDocx.asBlob(html);
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || '报告'}.docx`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadMd = (title, md) => {
    const blob = new Blob([md || ''], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${title || '报告'}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const extractSummary = (md) => {
    const text = String(md || '').replace(/\r/g, '');
    const lines = text.split('\n');
    let candidate_name = null;
    let job_title = null;
    let match_score = null;
    const grabLine = (regex) => {
      for (const line of lines) {
        const m = line.match(regex);
        if (m && m[1]) return m[1].trim();
      }
      return '';
    };
    candidate_name = grabLine(/^(?:\s*[-*]?\s*)?(?:姓名|候选人|面试者|Name|Candidate|Interviewee)\s*[：:]\s*([^\n]+)/i) || (text.match(/(?:面试者|姓名|Name|Interviewee)\s*[:：]\s*([^\n]+)/i)?.[1] || '').trim() || null;
    job_title = grabLine(/^(?:\s*[-*]?\s*)?(?:岗位|职位|岗位名称|职位名称|Job\s*Title|Position|Role)\s*[：:]\s*([^\n]+)/i) || (text.match(/(?:岗位|职位|Job\s*Title|Position|Role)\s*[:：]\s*([^\n]+)/i)?.[1] || '').trim() || null;
    let scoreStr = grabLine(/^(?:\s*[-*]?\s*)?(?:综合匹配度|总体匹配度|总匹配度|综合匹配)\s*[：:]\s*([0-9]{1,3})\s*%/i);
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
  };

  const saveReport = async (md) => {
    try {
      const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
      if (!user) { showToast('请先登录'); return; }
      const summary = extractSummary(md);
      const title = summary.candidate_name || '未命名候选人';
      if (window.Auth && window.Auth.supabase) {
        const base = { user_id: user.id, title, report_type: 'resume', content: md, markdown_output: md, created_at: new Date().toISOString() };
        let payload = { ...base, candidate_name: summary.candidate_name || null, job_title: summary.job_title || null, match_score: summary.match_score };
        let { error } = await window.Auth.supabase
          .from('reports')
          .insert([payload]);
        if (error && (String(error.code) === '42703' || /column .* does not exist/i.test(error.message || ''))) {
          const resp2 = await window.Auth.supabase
            .from('reports')
            .insert([base]);
          error = resp2.error;
        }
        if (error) { throw new Error(error.message || '保存失败'); }
        showToast('已保存到我的报告');
      } else {
        const key = `demo_reports_${user.id}`;
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `demo-${Date.now()}`;
        const created_at = new Date().toISOString();
        const record = { id, user_id: user.id, title, type: 'resume', report_type: 'resume', content: md, markdown_output: md, created_at, candidate_name: summary.candidate_name || null, job_title: summary.job_title || null, match_score: summary.match_score };
        items.unshift(record);
        try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
        showToast('已保存到本地“我的报告”（演示模式）');
      }
    } catch (e) {
      showToast('保存失败');
    }
  };

  if (uploadArea) {
    ['dragenter','dragover','dragleave','drop'].forEach(evt=>uploadArea.addEventListener(evt,(e)=>{e.preventDefault();e.stopPropagation();}));
    ['dragenter','dragover'].forEach(evt=>uploadArea.addEventListener(evt,()=>uploadArea.classList.add('dragover')));
    ['dragleave','drop'].forEach(evt=>uploadArea.addEventListener(evt,()=>uploadArea.classList.remove('dragover')));
    uploadArea.addEventListener('drop',(e)=>{ const files = e.dataTransfer.files; if (fileInput) { fileInput.files = files; fileInput.dispatchEvent(new Event('change')); }});
  }

  if (fileInput) fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) { fileInfo.style.display='none'; return; }
    fileInfo.style.display = 'block';
    const results = [];
    resumeTexts = [];
    for (const f of files) {
      let txt = '';
      try { txt = await parseFile(f); } catch { txt = ''; }
      resumeTexts.push(txt);
      const len = (txt || '').trim().length;
      results.push(`${f.name} (${Math.round(f.size/1024)}KB) → ${len > 0 ? `解析成功，${len} 字符` : '解析失败，请使用 DOCX/TXT 或文本型 PDF'}`);
    }
    fileInfo.innerText = results.join('\n');
    showToast(`已选择 ${files.length} 个文件`);
  });

  if (jdInput) jdInput.addEventListener('input', () => {
    const v = jdInput.value || '';
    jdCount.innerText = String(v.length);
  });

  const composeThreeStepReport = async (jd, validTexts, provider, useKey, useModel) => {
    const sys = '严格按照提示词执行，基于证据，不要编造；Markdown结构清晰。';
    const resumePayload = [
      { role: 'system', content: sys },
      { role: 'user', content: `${prompts.resumeInfo}\n\n简历集合:\n${validTexts.map((t,i)=>`【候选人${i+1}】\n${t}`).join('\n\n')}` }
    ];
    const { md: resumeInfo } = await callLLM(provider, resumePayload, useKey, useModel, 12000);
    const jdPayload = [
      { role: 'system', content: sys },
      { role: 'user', content: `${prompts.jdPortrait}\n\nJD:\n${jd}` }
    ];
    const { md: jdPortrait } = await callLLM(provider, jdPayload, useKey, useModel, 12000);
    const matchPayload = [
      { role: 'system', content: sys },
      { role: 'user', content: `${prompts.matchInterview}\n\n${resumeInfo}\n\n${jdPortrait}` }
    ];
    const { md: finalMd } = await callLLM(provider, matchPayload, useKey, useModel, 16000);
    return { resumeInfo, jdPortrait, finalMd };
  };

  if (startBtn) startBtn.addEventListener('click', async () => {
    const jd = jdInput.value.trim();
    if (!jd) { showToast('请输入JD'); return; }
    const validTexts = (resumeTexts || []).filter(t => t && t.trim().length > 0);
    if (!validTexts.length) { showToast('简历解析失败，请上传DOCX/TXT或可复制文本的PDF'); return; }
    showLoading('AI 正在分析...');
    try {
      const saved = await getUserKey();
      if (saved && saved.prompts) {
        prompts.resumeInfo = saved.prompts.resumeInfo || '';
        prompts.jdPortrait = saved.prompts.jdPortrait || '';
        prompts.matchInterview = saved.prompts.matchInterview || '';
      }
      const provider = (saved && saved.provider) ? saved.provider : 'openrouter';
      const useModel = (saved && saved.customModel) ? saved.customModel : (saved && saved.model) ? saved.model : defaultModel;
      const useKey = saved && saved.keys && saved.keys[provider] ? saved.keys[provider] : (saved && saved.apiKey ? saved.apiKey : '');
      if (!useKey) { hideLoading(); showToast('请在设置中填写并保存 API Key'); try { openSettings(); } catch {} return; }
      if (!prompts.resumeInfo || !prompts.jdPortrait || !prompts.matchInterview) { hideLoading(); showToast('请在设置中填写三类提示词'); try { openSettings(); } catch {} return; }
      const { finalMd } = await composeThreeStepReport(jd, validTexts, provider, useKey, useModel);
      if (String(finalMd || '').trim()) {
        resumeMarkdown = fixMarkdownTables(String(finalMd || '').trim());
        const kws = topKeywords(jd, 20);
        renderMarkdownChunked(resumeMarkdown, kws);
        resultSection.style.display = 'block';
        showToast('分析完成');
        hideLoading();
        return;
      }
      showToast('分析失败');
      hideLoading();
    } catch {
      showToast('分析失败');
      hideLoading();
    }
  });

  if (saveBtn) saveBtn.addEventListener('click', async () => {
    if (!resumeMarkdown) { showToast('没有可保存内容'); return; }
    await saveReport(resumeMarkdown);
  });

  if (dlDocxBtn) dlDocxBtn.addEventListener('click', () => {
    if (!resumeMarkdown) { showToast('没有可下载内容'); return; }
    downloadWord('新简历分析', resumeMarkdown);
  });

  if (dlMdBtn) dlMdBtn.addEventListener('click', () => {
    if (!resumeMarkdown) { showToast('没有可下载内容'); return; }
    downloadMd('新简历分析', resumeMarkdown);
  });

  if (window.pdfjsLib && window.pdfjsLib.GlobalWorkerOptions) {
    window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  }
  if (modelSelect) {
    modelSelect.innerHTML = MODEL_CATALOG.map(m=>`<option value="${m.v}">${m.t}</option>`).join('');
  }
  loadPrompts();
  if (testConnBtn) {
    testConnBtn.addEventListener('click', testConnectivity);
  }
  if (providerSelect) {
    providerSelect.addEventListener('change', () => {
      const p = providerSelect.value;
      const catalogs = {
        openrouter: MODEL_CATALOG,
        openai: [
          { v: 'gpt-4o', t: 'OpenAI GPT-4o' },
          { v: 'gpt-4.1', t: 'OpenAI GPT-4.1' },
          { v: 'gpt-3.5-turbo', t: 'OpenAI GPT-3.5 Turbo' }
        ],
        anthropic: [
          { v: 'claude-3.5-sonnet', t: 'Claude 3.5 Sonnet' },
          { v: 'claude-3-opus', t: 'Claude 3 Opus' },
          { v: 'claude-3-haiku', t: 'Claude 3 Haiku' }
        ],
        deepseek: [
          { v: 'deepseek-chat', t: 'DeepSeek Chat' },
          { v: 'deepseek-r1', t: 'DeepSeek R1' }
        ]
      };
      const list = catalogs[p] || MODEL_CATALOG;
      modelSelect.innerHTML = list.map(m=>`<option value="${m.v}">${m.t}</option>`).join('');
      const savedKey = (userSettings.keys && userSettings.keys[p]) ? userSettings.keys[p] : '';
      keyInput.value = savedKey || '';
    });
  }
})();
  
