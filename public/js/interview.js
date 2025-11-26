(() => {
  const API_BASE_OVERRIDE = (typeof window !== 'undefined' && window.localStorage)
    ? (window.localStorage.getItem('API_BASE_OVERRIDE') || '')
    : '';
  const API_BASE = API_BASE_OVERRIDE || ((window.location.port === '4321' || window.location.port === '5173') ? 'http://127.0.0.1:4000' : '');
  let user = null;
  let report = null;
  let resumeMarkdown = '';
  let candidateName = '';
  let jobTitle = '';
  let matchScore = null;
  let isRecording = false;
  let isPaused = false;
  let startTime = 0;
  let recognition = null;
  let mediaStream = null;
  let mediaRecorder = null;
  let transcriptItems = [];
  let timerInterval = null;
  let annotationMode = false;
  let resumeAnnotations = [];
  let annotationPopover = null;
  let recordedBlobs = [];
  let audioAttachment = null;
  let usingSR = false;

  function qs(name) {
    const p = new URLSearchParams(window.location.search);
    return p.get(name) || '';
  }

  async function getAuth() {
    try {
      await (window.Auth && typeof window.Auth.initialize === 'function' ? window.Auth.initialize() : null);
      user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
      return user;
    } catch { return null; }
  }

  async function loadReport() {
    const id = qs('report_id');
    if (!id) return;
    try {
      try {
        const raw = localStorage.getItem(`interview_source_${id}`) || '';
        if (raw) {
          const obj = JSON.parse(raw);
          report = { id, content: obj.md || '', candidate_name: obj.candidate_name || '', job_title: obj.job_title || '', match_score: obj.match_score ?? null };
        }
      } catch {}
      if (report) {
        resumeMarkdown = String(report.content || '');
        candidateName = String(report.candidate_name || '');
        jobTitle = String(report.job_title || '');
        matchScore = (report.match_score != null) ? Number(report.match_score) : null;
        if ((!candidateName || !jobTitle) && resumeMarkdown) {
          const parsed = extractSummaryFieldsFromMarkdown(resumeMarkdown);
          candidateName = candidateName || parsed.candidate_name || '';
          jobTitle = jobTitle || parsed.job_title || '';
          if (matchScore == null && parsed.match_score != null) matchScore = parsed.match_score;
        }
        return;
      }
      const client = window.Auth && window.Auth.supabase;
      let token = '';
      try { const { data } = await (client ? client.auth.getSession() : Promise.resolve({ data: null })); token = data?.session?.access_token || ''; } catch {}
      if (client && token) {
        const { data, error } = await client.from('reports').select('*').eq('id', id).limit(1).maybeSingle();
        if (error) throw new Error(error.message || 'load error');
        report = data || null;
      }
    } catch {}
    if (!report) {
      try {
        const cache = (typeof window !== 'undefined') ? (window.reportsCache || {}) : {};
        const cached = cache[String(id)];
        if (cached && typeof cached.md === 'string') {
          report = { id, content: cached.md, candidate_name: cached.candidate_name || '', job_title: cached.job_title || '', match_score: cached.match_score ?? null };
        }
      } catch {}
    }
    if (!report) {
      try {
        const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        const uid = u ? u.id : null;
        if (uid) {
          const key = `demo_reports_${uid}`;
          let items = [];
          try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
          const found = items.find(r => String(r.id) === String(id));
          if (found) report = found;
        }
        if (!report && !API_BASE) {
          const token = await getAuthToken();
          const resp = await fetch('/api/reports-list', {
            method: 'GET',
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (resp.ok) {
            const json = await resp.json();
            const arr = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
            const found2 = arr.find(r => String(r.id) === String(id));
            if (found2) report = found2;
          }
        }
      } catch {}
    }
    if (report) {
      resumeMarkdown = String(report.content || '');
      candidateName = String(report.candidate_name || '');
      jobTitle = String(report.job_title || '');
      matchScore = (report.match_score != null) ? Number(report.match_score) : null;
      if ((!candidateName || !jobTitle) && resumeMarkdown) {
        const parsed = extractSummaryFieldsFromMarkdown(resumeMarkdown);
        candidateName = candidateName || parsed.candidate_name || '';
        jobTitle = jobTitle || parsed.job_title || '';
        if (matchScore == null && parsed.match_score != null) matchScore = parsed.match_score;
      }
    }
  }

  function renderMarkdown(md) {
    try {
      if (!window.marked) return md;
      const raw = window.marked.parse(md || '', { breaks: true });
      if (window.DOMPurify) return window.DOMPurify.sanitize(raw);
      return raw;
    } catch { return md || ''; }
  }

  function setHeaderInfo() {
    const h = document.querySelector('.header-info');
    if (!h) return;
    const name = candidateName || '未命名候选人';
    const jt = jobTitle || '未知岗位';
    const now = new Date();
    const dt = `${now.getFullYear()}/${String(now.getMonth()+1).padStart(2,'0')}/${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
    h.innerHTML = `<span>候选人：${escapeHtml(name)}</span><span>|</span><span>岗位：${escapeHtml(jt)}</span><span>|</span><span>面试时间：${dt}</span><button class="btn btn-secondary" onclick="(function(){window.location.href='/my-reports.html';})()">返回我的报告</button><button class="btn btn-primary" id="saveInterviewBtn">保存</button>`;
    const saveBtn = document.getElementById('saveInterviewBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveInterviewRecord);
  }

  function renderLeftResume() {
    const container = document.getElementById('leftReportContent');
    if (!container) return;
    const html = renderMarkdown(resumeMarkdown || '');
    container.innerHTML = html || '<p>暂无简历分析内容</p>';
    try { enhanceReportContainer(container, 'resume'); } catch {}
  }

  function fmtTime(ms) {
    const s = Math.floor(ms/1000);
    const m = Math.floor(s/60);
    const sec = String(s % 60).padStart(2,'0');
    const min = String(m).padStart(2,'0');
    return `00:${min}:${sec}`;
  }

  function addTranscriptItem(text, speaker) {
    if (!text || !text.trim()) return;
    const timeline = document.getElementById('transcriptContent');
    if (!timeline) return;
    const nowMs = Date.now() - startTime;
    const t = fmtTime(nowMs);
    const div = document.createElement('div');
    div.className = 'transcript-item';
    div.innerHTML = `<div class="transcript-time">${t}</div><div><strong>${speaker || '语音'}：</strong>${escapeHtml(text)}</div>`;
    timeline.appendChild(div);
    timeline.scrollTop = timeline.scrollHeight + 100;
    transcriptItems.push({ time: t, text, speaker: speaker || '' });
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  }

  function getNotes() {
    const ta = document.querySelector('.notes-textarea');
    return ta ? ta.value : '';
  }

  async function ensureUser() {
    if (!user) await getAuth();
    if (!user) throw new Error('未登录');
    return user;
  }

  async function saveInterviewRecord() {
    try {
      const u = await ensureUser();
      let transcriptText = transcriptItems.map(it => `${it.time} ${it.speaker ? '['+it.speaker+'] ' : ''}${it.text}`).join('\n');
      if (!transcriptText || !transcriptText.trim()) {
        try { transcriptText = await buildTranscriptText(); } catch {}
      }
      const notes = getNotes();
      const analysisPanel = document.querySelector('.analysis-result');
      let analysisHtml = analysisPanel ? (analysisPanel.innerText || analysisPanel.textContent || '') : '';
      if (!analysisHtml || !String(analysisHtml).trim()) {
        try {
          const cards = Array.from(document.querySelectorAll('.record-card'));
          for (const card of cards) {
            const titleEl = card.querySelector('.card-title');
            if (titleEl && /AI综合面试分析/.test(String(titleEl.textContent || ''))) {
              const body = card.querySelector('.card-body');
              const sc = body ? body.querySelector('.section-content') : null;
              analysisHtml = sc ? (sc.innerText || sc.textContent || '') : '';
              break;
            }
          }
        } catch {}
      }
      if (!candidateName || !String(candidateName).trim()) {
        try {
          const parsed = extractSummaryFieldsFromMarkdown(resumeMarkdown || '');
          candidateName = parsed.candidate_name || candidateName || (document.querySelector('.header-info')?.textContent || '').split('|')[0].replace('候选人：','').trim();
          jobTitle = parsed.job_title || jobTitle || jobTitle;
          matchScore = matchScore ?? parsed.match_score ?? null;
        } catch {}
      }
      const data = {
        resume_md: resumeMarkdown || '',
        resume_notes_inline_html: (() => { try { const el = document.getElementById('leftReportContent'); return el ? String(el.innerHTML || '') : ''; } catch { return ''; } })(),
        resume_annotations: resumeAnnotations,
        transcript_items: transcriptItems,
        transcript_text: transcriptText,
        notes_text: notes,
        ai_analysis_md: analysisHtml,
        candidate_name: candidateName,
        job_title: jobTitle,
        match_score: matchScore,
        audio_attachment: audioAttachment || null,
      };
      const title = candidateName || (report ? (report.title || '未命名候选人') : '未命名候选人');
      const token = await getAuthToken();
      let savedCloud = false;
      let newIdSaved = '';
      if (token && window.Auth && window.Auth.supabase) {
        try {
          const payload = {
            user_id: u.id,
            title,
            report_type: 'interview',
            content: resumeMarkdown || '',
            markdown_output: JSON.stringify(data),
            candidate_name: candidateName || null,
            job_title: jobTitle || null,
            match_score: matchScore || null,
          };
          const resp = await fetch((API_BASE ? (API_BASE + '/api/reports-save') : '/api/reports-save'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          const text = await resp.text();
          let json = null; try { json = JSON.parse(text); } catch { json = null; }
          if (resp.ok && json && (json.data || json.id)) {
            savedCloud = true;
            const saved = json.data || {};
            newIdSaved = String(Array.isArray(saved) ? (saved[0]?.id || '') : (saved?.id || ''));
            alert('面试记录已保存');
          }
        } catch {}
      }
      if (!savedCloud) {
        const key = `demo_reports_${u.id}`;
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `demo-${Date.now()}`;
        const created_at = new Date().toISOString();
        const record = {
          id,
          user_id: u.id,
          title,
          type: 'interview',
          report_type: 'interview',
          content: resumeMarkdown || '',
          markdown_output: JSON.stringify(data),
          created_at,
          candidate_name: candidateName || null,
          job_title: jobTitle || null,
          match_score: matchScore || null,
        };
        items.unshift(record);
        try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
        newIdSaved = id;
        alert('面试记录已保存（本地演示模式）');
      }
      try {
        const rid = report ? String(report.id || '') : String(qs('report_id') || '');
        if (rid && newIdSaved) {
          try { localStorage.setItem('interview_link_' + rid, String(newIdSaved)); } catch {}
          const c = window.Auth && window.Auth.supabase;
          let token = '';
          try { const { data } = await (c ? c.auth.getSession() : Promise.resolve({ data: null })); token = data?.session?.access_token || ''; } catch {}
          if (c && token) {
            let mo = {};
            try {
              const { data } = await c.from('reports').select('markdown_output').eq('id', rid).limit(1).maybeSingle();
              const raw = String(data?.markdown_output || '');
              if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } }
              else { mo = { md: raw || '' }; }
            } catch { mo = {}; }
            mo.interview_link_id = String(newIdSaved);
            try { await c.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', rid); } catch {}
          }
        }
      } catch {}
    } catch (e) {
      alert('保存失败：' + (e?.message || e));
    }
  }

  async function getAuthToken() {
    try {
      const c = window.Auth && window.Auth.supabase;
      if (!c) return '';
      const { data } = await c.auth.getSession();
      const token = data?.session?.access_token || '';
      return token;
    } catch { return ''; }
  }

  function bindControls() {
    const uploadBtn = document.getElementById('uploadAudioBtn');
    const startBtn = document.getElementById('startRecordBtn');
    const pauseBtn = document.getElementById('pauseRecordBtn');
    const stopBtn = document.getElementById('stopRecordBtn');
    const startAnalysisBtn = document.querySelector('#startAiAnalysisBtn');
    if (uploadBtn) uploadBtn.addEventListener('click', showUploadUI);
    if (startBtn) startBtn.addEventListener('click', startRecording);
    if (pauseBtn) pauseBtn.addEventListener('click', pauseRecording);
    if (stopBtn) stopBtn.addEventListener('click', stopRecording);
    if (startAnalysisBtn) startAnalysisBtn.addEventListener('click', startAnalysis);
    const select = document.getElementById('audioSourceSelect');
    if (select) select.addEventListener('change', () => {});
    const fileInput = document.getElementById('interview-file');
    if (fileInput) fileInput.addEventListener('change', handleFileUploadChange);
    const toggleBtn = document.getElementById('toggleTranscriptBtn');
    if (toggleBtn) toggleBtn.addEventListener('click', toggleTranscriptVisibility);
    const annotateBtn = document.getElementById('annotateToggleBtn');
    if (annotateBtn) annotateBtn.addEventListener('click', toggleAnnotationMode);
    const left = document.getElementById('leftReportContent');
    if (left) {
      left.addEventListener('mouseup', handleSelectionForAnnotation);
      left.addEventListener('click', handleAnnotationElementClick);
    }
    updateStartAnalysisButton();
  }

  async function startRecognitionMic() {
    try {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        recognition = new SR();
        recognition.lang = 'zh-CN';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const res = event.results[i];
            const txt = res[0].transcript;
            if (res.isFinal) addTranscriptItem(txt, '语音');
          }
        };
        recognition.onerror = () => {};
        recognition.start();
        usingSR = true;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          await startRecorder(mediaStream);
        } catch {}
        return true;
      } else {
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        await startRecorder(mediaStream);
        return true;
      }
    } catch { return false; }
  }

  async function startRecognitionSystemAudio() {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ audio: true, video: true });
      mediaStream = stream;
      await startRecorder(stream);
      return true;
    } catch { return false; }
  }

  async function startRecorder(stream) {
    try {
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : 'audio/ogg');
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.ondataavailable = async (e) => {
        if (!e.data || e.data.size < 1024) return;
        try { recordedBlobs.push(e.data); } catch {}
        const key = await getPreferredKey('openai');
        if (!usingSR && key) {
          await transcribeChunk(e.data);
        }
      };
      mediaRecorder.start(4000);
    } catch {}
  }

  async function transcribeChunk(blob) {
    try {
      const name = `chunk_${Date.now()}.webm`;
      const base64 = await blobToBase64(blob);
      const key = await getPreferredKey('openai');
      const resp = await fetch(API_BASE + '/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Provider': 'openai', 'X-Provider-Key': key },
        body: JSON.stringify({ filename: name, mime: blob.type || 'audio/webm', dataBase64: base64, model: 'whisper-1', language: 'zh' })
      });
      const json = await resp.json();
      if (resp.ok) {
        const text = String(json?.text || '').trim();
        if (text) addTranscriptItem(text, '语音');
      }
    } catch {}
  }

  async function getPreferredKey(providerOverride) {
    try {
      const saved = await (window.getUserKey ? window.getUserKey() : null);
      const pv = String(providerOverride || saved?.provider || 'openrouter').toLowerCase();
      const keys = saved?.keys || {};
      let k = keys[pv] || saved?.apiKey || '';
      if (!k) {
        k = keys.openrouter || keys.openai || keys.anthropic || keys.deepseek || '';
      }
      return k || '';
    } catch { return ''; }
  }

  function updateRecStatus(active) {
    const dot = document.getElementById('recStatusDot');
    const text = document.getElementById('recStatusText');
    if (dot) { dot.classList.toggle('active', !!active); }
    if (text) {
      if (!active) { text.textContent = '未录音'; return; }
      const ms = (isRecording ? (Date.now() - startTime) : 0);
      text.textContent = `录音中... ${fmtTime(ms)}`;
    }
    updateStartAnalysisButton();
  }

  function startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => updateRecStatus(true), 1000);
  }
  function stopTimer() { if (timerInterval) { clearInterval(timerInterval); timerInterval = null; } }

  async function startRecording() {
    try {
      if (isRecording) return;
      startTime = Date.now();
      const sel = document.getElementById('audioSourceSelect');
      const source = sel ? sel.value : 'mic';
      if (source === 'system') {
        const hasKey = !!(await getPreferredKey('openai'));
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!hasKey && !SR) {
          alert('系统音频实时转写需要API Key，或请切换“麦克风”使用浏览器语音识别');
        }
      }
      const ok = source === 'system' ? await startRecognitionSystemAudio() : await startRecognitionMic();
      if (!ok) { alert('无法开始录音'); return; }
      isRecording = true;
      isPaused = false;
      document.getElementById('startRecordBtn')?.style.setProperty('display','none');
      document.getElementById('pauseRecordBtn')?.style.setProperty('display','');
      document.getElementById('stopRecordBtn')?.style.setProperty('display','');
      updateRecStatus(true);
      startTimer();
      updateStartAnalysisButton();
    } catch { alert('开始录音失败'); }
  }

  async function pauseRecording() {
    try {
      if (!isRecording) return;
      if (!isPaused) {
        if (recognition) { try { recognition.stop(); } catch {} }
        if (mediaRecorder) { try { mediaRecorder.stop(); } catch {} }
        if (mediaStream) { try { mediaStream.getTracks().forEach(t => t.stop()); } catch {} }
        isPaused = true;
        document.getElementById('pauseRecordBtn').textContent = '继续录音';
        stopTimer();
        updateRecStatus(false);
      } else {
        const sel = document.getElementById('audioSourceSelect');
        const source = sel ? sel.value : 'mic';
        const ok = source === 'system' ? await startRecognitionSystemAudio() : await startRecognitionMic();
        if (!ok) { alert('无法继续录音'); return; }
        isPaused = false;
        document.getElementById('pauseRecordBtn').textContent = '暂停录音';
        startTimer();
        updateRecStatus(true);
      }
      updateStartAnalysisButton();
    } catch { alert('录音控制失败'); }
  }

  async function stopRecording() {
    try {
      if (!isRecording && !isPaused) return;
      if (recognition) { try { recognition.stop(); } catch {} }
      if (mediaRecorder) { try { mediaRecorder.stop(); } catch {} }
      if (mediaStream) { try { mediaStream.getTracks().forEach(t => t.stop()); } catch {} }
      isRecording = false; isPaused = false; usingSR = false;
      document.getElementById('startRecordBtn')?.style.setProperty('display','');
      document.getElementById('pauseRecordBtn')?.style.setProperty('display','none');
      document.getElementById('stopRecordBtn')?.style.setProperty('display','none');
      stopTimer();
      updateRecStatus(false);
      await finalizeAudioRecording();
      updateStartAnalysisButton();
    } catch { alert('结束录音失败'); }
  }

  async function finalizeAudioRecording() {
    try {
      if (!recordedBlobs || recordedBlobs.length === 0) return;
      const mime = (mediaRecorder && mediaRecorder.mimeType) ? mediaRecorder.mimeType : 'audio/webm';
      const blob = new Blob(recordedBlobs, { type: mime });
      const url = URL.createObjectURL(blob);
      const base64 = await blobToBase64(blob);
      const name = `recording_${new Date().toISOString().replace(/[:\.]/g,'-')}.${mime.includes('webm') ? 'webm' : (mime.includes('mp4') ? 'mp4' : 'ogg')}`;
      audioAttachment = { filename: name, mime, size: blob.size, dataBase64: base64 };
      const box = document.getElementById('transcriptContent');
      if (box) {
        const html = `<div style="margin-bottom:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:10px;">
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">录音文件：${name}（${Math.round(blob.size/1024)} KB）</div>
          <audio controls src="${url}" style="width:100%"></audio>
        </div>`;
        box.insertAdjacentHTML('afterbegin', html);
      }
      recordedBlobs = [];
    } catch {}
  }

  function canAnalyze() {
    try {
      const f = (typeof interviewFile !== 'undefined') ? interviewFile : null;
      const hasFile = !!f || !!(document.getElementById('interview-file')?.files?.length);
      const hasTranscript = transcriptItems.length > 0 && !isRecording && !isPaused;
      return hasFile || hasTranscript;
    } catch { return false; }
  }

  function updateStartAnalysisButton() {
    const btn = document.getElementById('startAiAnalysisBtn');
    if (btn) btn.disabled = !canAnalyze();
  }

  async function readFileBase64(file) {
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });
  }

  async function blobToBase64(blob) {
    return await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  async function parseUploadedTranscript(file) {
    try {
      const mime = file.type || '';
      const lower = (file.name || '').toLowerCase();
      const isAudio = (mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|flac|ogg|webm|mp4)$/i.test(lower));
      if (isAudio) {
        const base64 = await readFileBase64(file);
        const key = await getPreferredKey('openai');
        const resp = await fetch(API_BASE + '/api/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Provider': 'openai', 'X-Provider-Key': key },
          body: JSON.stringify({ filename: file.name || 'audio.bin', mime: mime || 'audio/mpeg', dataBase64: base64, model: 'whisper-1', language: 'zh' })
        });
        if (!resp.ok) return '';
        const j = await resp.json();
        return String(j.text || '');
      } else {
        const base64 = await readFileBase64(file);
        const resp = await fetch(API_BASE + '/api/parse-doc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name || 'file.bin', mime: mime || 'application/octet-stream', dataBase64: base64 }) });
        if (!resp.ok) return '';
        const j = await resp.json();
        return String(j.text || '');
      }
    } catch { return ''; }
  }

  async function handleFileUploadChange(e) {
    try {
      const fileInput = e?.target || document.getElementById('interview-file');
      const file = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;
      updateStartAnalysisButton();
      const status = document.getElementById('interview-status-bar');
      if (status) {
        if (file) {
          status.style.display = 'flex';
          const sizeMb = (file.size ? (file.size / (1024 * 1024)) : 0).toFixed(2);
          status.innerHTML = `<div class="file-item"><span class="file-name">${escapeHtml(file.name)}</span><span class="file-size">${sizeMb} MB</span></div>`;
        } else {
          status.style.display = 'none';
          status.innerHTML = '';
        }
      }
      if (!file) return;
      const txt = await parseUploadedTranscript(file);
      const timeline = document.getElementById('transcriptContent');
      if (timeline) {
        if (txt && String(txt).trim()) {
          transcriptItems = [];
          timeline.innerHTML = `<div class="transcript-text-block">${escapeHtml(String(txt)).replace(/\n/g,'<br>')}</div>`;
          timeline.scrollTop = timeline.scrollHeight;
        } else {
          timeline.innerHTML = '<div class="transcript-empty">未能识别到有效文本，请更换清晰音频或文档</div>';
        }
      }
    } catch {}
  }

  async function buildTranscriptText() {
    if (isRecording || isPaused) return '';
    const t = transcriptItems.map(it => `${it.time} ${it.speaker ? '['+it.speaker+'] ' : ''}${it.text}`).join('\n');
    if (t && t.trim()) return t;
    const f = (typeof interviewFile !== 'undefined') ? interviewFile : null;
    if (f) {
      const txt = await parseUploadedTranscript(f);
      return String(txt || '');
    }
    const files = document.getElementById('interview-file')?.files;
    if (files && files.length) {
      const txt = await parseUploadedTranscript(files[0]);
      return String(txt || '');
    }
    return '';
  }

  async function startAnalysis() {
    try {
      if (!canAnalyze()) { alert('请先上传录音文件或完成录音'); return; }
      const overlay = document.getElementById('ai-loading');
      if (overlay) overlay.style.display = 'flex';
      const notes = getNotes();
      const transcriptText = await buildTranscriptText();
      const saved = await (window.getUserKey ? window.getUserKey() : null);
      const custom = String(saved?.prompts?.interviewComprehensive || '').trim();
      const base = custom || `你是资深面试官。基于候选人简历报告、面试实时转写记录与面试官笔记，进行综合评估并输出：\n1) 综合评分与结论\n2) 能力维度评分(产品思维/数据能力/沟通表达/技术理解)\n3) 表现亮点\n4) 需要关注的点\n5) 下一轮重点与薪资建议。`;
      const prompt = `${base}\n\n[简历报告]\n${resumeMarkdown}\n\n[转写记录]\n${transcriptText}\n\n[面试笔记]\n${notes}`;
      const messages = [{ role: 'system', content: '你是资深面试评估专家，输出中文结论，结构化清晰。' }, { role: 'user', content: prompt }];
      const provider = String(saved?.provider || 'openrouter').toLowerCase();
      const model = String((saved?.customModel || saved?.model || 'anthropic/claude-3.5-sonnet'));
      const key = await getPreferredKey(provider);
      if (!key) { throw new Error('未设置API Key或密钥为空，请在设置页面填写后重试'); }
      const resp = await fetch(API_BASE + '/api/llm-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Provider': provider, 'X-Provider-Key': key },
        body: JSON.stringify({ provider, model, messages, temperature: 0.2 })
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error?.message || '分析失败');
      const text = (json?.text || json?.message || json?.choices?.[0]?.message?.content || '').trim();
      if (!text) { throw new Error('分析结果为空，请稍后重试'); }
      const content = document.getElementById('analysisPanelContent');
      const panel = document.getElementById('analysisPanel');
      if (content && panel) {
        content.innerHTML = `<div class="analysis-result"><div class="analysis-section"><h4>分析结果</h4><p>${escapeHtml(text).replace(/\n/g,'<br>')}</p></div></div>`;
        panel.style.display = '';
      }
      await saveAndRedirectToRecord(text);
    } catch (e) {
      const overlay = document.getElementById('ai-loading');
      if (overlay) overlay.style.display = 'none';
      alert('分析失败：' + (e?.message || e));
    }
  }

  async function saveAndRedirectToRecord(analysisText) {
    try {
      const u = await ensureUser();
      let transcriptText = transcriptItems.map(it => `${it.time} ${it.speaker ? '['+it.speaker+'] ' : ''}${it.text}`).join('\n');
      if (!transcriptText || !transcriptText.trim()) {
        try { transcriptText = await buildTranscriptText(); } catch {}
      }
      const notes = getNotes();
      const analysisPanel = document.querySelector('.analysis-result');
      const analysisHtml = analysisText || (analysisPanel ? (analysisPanel.innerText || analysisPanel.textContent || '') : '');
      const data = {
        resume_md: resumeMarkdown || '',
        resume_notes_inline_html: (() => { try { const el = document.getElementById('leftReportContent'); return el ? String(el.innerHTML || '') : ''; } catch { return ''; } })(),
        resume_annotations: resumeAnnotations,
        transcript_items: transcriptItems,
        transcript_text: transcriptText,
        notes_text: notes,
        ai_analysis_md: analysisHtml,
        candidate_name: candidateName,
        job_title: jobTitle,
        match_score: matchScore,
        audio_attachment: audioAttachment || null,
      };
      const title = candidateName || (report ? (report.title || '未命名候选人') : '未命名候选人');
      const token = await getAuthToken();
      let newId = '';
      if (token && window.Auth && window.Auth.supabase) {
        try {
          const payload = {
            user_id: u.id,
            title,
            report_type: 'interview',
            content: resumeMarkdown || '',
            markdown_output: JSON.stringify(data),
            candidate_name: candidateName || null,
            job_title: jobTitle || null,
            match_score: matchScore || null,
          };
          const resp = await fetch((API_BASE ? (API_BASE + '/api/reports-save') : '/api/reports-save'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify(payload),
          });
          const json = await resp.json();
          if (resp.ok) {
            const saved = json?.data || {};
            newId = String(Array.isArray(saved) ? saved[0]?.id : saved?.id || '');
          }
        } catch {}
      }
      if (!newId) {
        const key = `demo_reports_${u.id}`;
        let items = [];
        try { items = JSON.parse(localStorage.getItem(key) || '[]'); } catch {}
        const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : `demo-${Date.now()}`;
        const created_at = new Date().toISOString();
        const record = {
          id,
          user_id: u.id,
          title,
          type: 'interview',
          report_type: 'interview',
          content: resumeMarkdown || '',
          markdown_output: JSON.stringify(data),
          created_at,
          candidate_name: candidateName || null,
          job_title: jobTitle || null,
          match_score: matchScore || null,
        };
        items.unshift(record);
        try { localStorage.setItem(key, JSON.stringify(items)); } catch {}
        newId = id;
      }
      if (newId) {
        const useAlias = (window.location.port === '4000');
        const path = useAlias ? '/interview-record' : '/面试记录-AI招聘分析.html';
        const url = new URL(path, window.location.origin);
        url.searchParams.set('report_id', newId);
        try {
          const rid = report ? String(report.id || '') : String(qs('report_id') || '');
          if (rid) {
            try { localStorage.setItem('interview_link_' + rid, String(newId)); } catch {}
            const c = window.Auth && window.Auth.supabase;
            let token = '';
            try { const { data } = await (c ? c.auth.getSession() : Promise.resolve({ data: null })); token = data?.session?.access_token || ''; } catch {}
            if (c && token) {
              let mo = {};
              try {
                const { data } = await c.from('reports').select('markdown_output').eq('id', rid).limit(1).maybeSingle();
                const raw = String(data?.markdown_output || '');
                if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } }
                else { mo = { md: raw || '' }; }
              } catch { mo = {}; }
              mo.interview_link_id = String(newId);
              try { await c.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', rid); } catch {}
            }
          }
        } catch {}
        window.location.href = url.toString();
      } else {
        alert('保存成功，但未获取到ID');
      }
    } catch (e) {
      const overlay = document.getElementById('ai-loading');
      if (overlay) overlay.style.display = 'none';
      alert('保存并跳转失败：' + (e?.message || e));
    }
  }

  function showUploadUI() {
    try { document.getElementById('interview-file')?.click(); } catch {}
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
      if (/[•\d]\s*[\.)]/.test(t)) return '';
      if (/(匹配度|评估|结论|建议|差距|不足|能力|稳定|经验|画像|要求)/i.test(t)) return '';
      return t;
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
    let scoreStr = grab(/^(?:\s*[-*]?\s*)?(?:综合匹配度|总体匹配度|总匹配度|岗位匹配度|综合评分|综合匹配)\s*[：:]\s*([0-9]{1,3})\s*%/i);
    if (!scoreStr) {
      const cell = grabTable(['综合匹配度','总体匹配度','总匹配度','岗位匹配度','综合评分']);
      if (cell) { const m = cell.match(/([0-9]{1,3})\s*%/); if (m) scoreStr = m[1]; }
    }
    if (!scoreStr) {
      const sectionRe = /评估结论|候选人详细评估|综合评估|Evaluation|Summary/i;
      for (let i = 0; i < lines.length; i++) {
        if (sectionRe.test(lines[i])) {
          for (let j = i; j < Math.min(i + 20, lines.length); j++) {
            const l = lines[j];
            if (/^\|/.test(l)) continue;
            const m = l.match(/(?:综合匹配度|岗位匹配度|匹配度|综合评分)\s*[：:]\s*([0-9]{1,3})\s*%/i);
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
        const m = line.match(/^(?:\s*[-*]?\s*)?(?:匹配度|岗位匹配度|综合匹配|综合评分)\s*[：:]\s*([0-9]{1,3})\s*%/i);
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

  async function initInterviewLivePage() {
    await getAuth();
    await loadReport();
    setHeaderInfo();
    renderLeftResume();
    bindControls();
  }

  async function initInterviewRecordPage() {
    await getAuth();
    const id = qs('report_id');
    let rec = null;
    try {
      const client = window.Auth && window.Auth.supabase;
      if (client) {
        let data = null;
        if (id) {
          const r = await client.from('reports').select('*').eq('id', id).limit(1).maybeSingle();
          data = r?.data || null;
        } else {
          const r = await client
            .from('reports')
            .select('*')
            .eq('user_id', user?.id || '')
            .eq('report_type', 'interview')
            .order('created_at', { ascending: false })
            .limit(1);
          data = (Array.isArray(r?.data) && r.data[0]) ? r.data[0] : null;
        }
        rec = data || null;
      }
    } catch {}
    if (!rec) {
      try {
        const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        const key = u ? `demo_reports_${u.id}` : '';
        if (key) {
          const arr = JSON.parse(localStorage.getItem(key) || '[]');
          if (id) {
            rec = arr.find(r => String(r.id) === String(id)) || rec;
          } else {
            rec = arr.find(r => (r.report_type === 'interview' || r.type === 'interview')) || rec;
          }
        }
      } catch {}
    }
    const headerInfo = document.querySelector('.header-info');
    if (rec) {
      candidateName = String(rec.candidate_name || rec.title || candidateName || '').trim() || '未命名候选人';
      jobTitle = String(rec.job_title || jobTitle || '').trim() || '未知岗位';
      matchScore = (rec.match_score != null) ? Number(rec.match_score) : matchScore;
      currentRecordId = String(rec.id || '');
      currentRecordUserId = String(rec.user_id || '');
    }
    let data = null;
    try { data = JSON.parse(String(rec?.markdown_output || '{}')); } catch { data = null; }
    currentRecordMo = data || {};
    if (!candidateName) candidateName = String((data && data.candidate_name) || '').trim();
    if (!jobTitle) jobTitle = String((data && data.job_title) || '').trim();
    let resumeMd = (data && data.resume_md) ? String(data.resume_md) : '';
    if (!resumeMd && data && typeof data.md === 'string') resumeMd = String(data.md);
    if (!resumeMd) resumeMd = String(rec?.content || '');
    if (!resumeMd) {
      try {
        const client = window.Auth && window.Auth.supabase;
        if (client && candidateName) {
          const { data: rs } = await client.from('reports').select('*').eq('user_id', user?.id || '').eq('report_type', 'resume').eq('candidate_name', candidateName).order('created_at', { ascending: false }).limit(1);
          if (Array.isArray(rs) && rs[0] && rs[0].content) resumeMd = String(rs[0].content);
        }
      } catch {}
    }
    if (!resumeMd) {
      try {
        const token = await getAuthToken();
        const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        if (token && u && API_BASE) {
          const resp = await fetch(API_BASE + `/api/reports-list?user_id=${encodeURIComponent(u.id)}`, { headers: { Authorization: `Bearer ${token}` } });
          if (resp.ok) {
            const json = await resp.json();
            const arr = Array.isArray(json?.data) ? json.data : [];
            let found = null;
            if (candidateName) {
              found = arr.find(r => (r.report_type === 'resume' || r.type === 'resume') && String(r.candidate_name || '').trim() === candidateName);
            }
            if (!found) {
              found = arr.find(r => (r.report_type === 'resume' || r.type === 'resume'));
            }
            if (found && found.content) resumeMd = String(found.content);
          }
        }
      } catch {}
    }
    if (!resumeMd) {
      try {
        const raw = localStorage.getItem(`interview_source_${id}`) || '';
        if (raw) {
          const obj = JSON.parse(raw);
          const md = String(obj.md || '');
          if (md) resumeMd = md;
        }
      } catch {}
    }
    const dt = new Date(rec?.created_at || Date.now());
    const dateStr = `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
    if (headerInfo) {
      headerInfo.innerHTML = `<span>候选人：${escapeHtml(candidateName || '未命名候选人')}</span><span>|</span><span>岗位：${escapeHtml(jobTitle || '未知岗位')}</span><span>|</span><span>面试时间：${dateStr}</span><button class="btn btn-secondary" onclick="(function(){window.location.href='/my-reports.html';})()">返回我的报告</button>`;
    }
    const resumeContainer = document.getElementById('resumeReportContent') || document.querySelector('.container .record-card .card-body');
    if (resumeContainer) {
      const inlineHtml = (data && typeof data.resume_notes_inline_html === 'string') ? data.resume_notes_inline_html : '';
      if (inlineHtml && window.DOMPurify) {
        resumeContainer.innerHTML = window.DOMPurify.sanitize(inlineHtml);
      } else {
        resumeContainer.innerHTML = renderMarkdown(resumeMd || '');
      }
      resumeAnnotations = Array.isArray(data?.resume_annotations) ? data.resume_annotations : buildResumeAnnotationsFromDom();
      const btn = document.getElementById('annotateToggleBtnRecord');
      if (btn) btn.addEventListener('click', toggleAnnotationMode);
      resumeContainer.addEventListener('click', handleAnnotationElementClick);
    }
    const timeline = document.querySelector('.transcript-timeline');
    if (timeline) {
      const items = (data && Array.isArray(data.transcript_items)) ? data.transcript_items : [];
      const aud = (data && data.audio_attachment && typeof data.audio_attachment === 'object') ? data.audio_attachment : null;
      if (aud && aud.dataBase64) {
        const src = `data:${aud.mime || 'audio/webm'};base64,${aud.dataBase64}`;
        const name = String(aud.filename || 'recording');
        timeline.insertAdjacentHTML('afterbegin', `<div style="margin-bottom:12px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;padding:10px;"><div style="font-size:12px;color:#6b7280;margin-bottom:6px;">录音文件：${escapeHtml(name)}</div><audio controls src="${src}" style="width:100%"></audio></div>`);
      }
      if (items.length > 0) {
        timeline.innerHTML = items.map(it => `<div class="transcript-item"><div class="transcript-time">${escapeHtml(it.time || '')}</div><div>${escapeHtml(it.text || '')}</div></div>`).join('');
      } else if (data && data.transcript_text) {
        const safe = escapeHtml(String(data.transcript_text || '')).replace(/\n/g,'<br>');
        timeline.innerHTML = `<div class="transcript-text-block">${safe}</div>`;
      } else {
        timeline.innerHTML = '<div class="transcript-empty">暂无记录</div>';
      }
    }
    try {
      const cards = Array.from(document.querySelectorAll('.record-card'));
      for (const card of cards) {
        const titleEl = card.querySelector('.card-title');
        if (titleEl && /AI综合面试分析/.test(String(titleEl.textContent || ''))) {
          const body = card.querySelector('.card-body');
          const meta = card.querySelector('.card-meta');
          const md = String((data && data.ai_analysis_md) ? data.ai_analysis_md : '').trim();
          if (meta && rec && rec.created_at) {
            const dt = new Date(rec.created_at);
            const dateStr = `${dt.getFullYear()}/${String(dt.getMonth()+1).padStart(2,'0')}/${String(dt.getDate()).padStart(2,'0')} ${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`;
            meta.textContent = `分析时间：${dateStr} | 基于简历+面试+笔记综合评估`;
          }
          if (body) {
            const html = md ? renderMarkdown(md) : '<p>暂无AI分析结果</p>';
            body.innerHTML = `<div class="section full-width"><div class="section-content ai-analysis-content">${html}</div></div>`;
          }
          break;
        }
      }
    } catch {}
    const saveBtn2 = document.getElementById('saveToMyReportsBtn');
    if (saveBtn2) {
      saveBtn2.addEventListener('click', async () => {
        try { await saveInterviewRecord(); alert('已保存到我的报告'); }
        catch { alert('保存失败'); }
      });
    }
    const notesBox = document.querySelector('.notes-box');
    if (notesBox) notesBox.textContent = (data && data.notes_text) ? data.notes_text : '';
    const docxBtn = document.getElementById('exportRecordDocxBtn');
    const pdfBtn = document.getElementById('exportRecordPdfBtn');
    const shareBtn = document.getElementById('shareRecordBtn');
    if (docxBtn) docxBtn.addEventListener('click', exportRecordDocx);
    if (pdfBtn) pdfBtn.addEventListener('click', exportRecordPdf);
    if (shareBtn) shareBtn.addEventListener('click', shareRecordLink);
  }

  function exportRecordDocx() {
    try {
      const container = document.querySelector('.container');
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${container.innerHTML}</body></html>`;
      const blob = window.htmlDocx.asBlob(html);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `面试记录_${candidateName || '候选人'}.docx`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert('导出Word失败'); }
  }

  function exportRecordPdf() {
    try {
      const container = document.querySelector('.container');
      window.html2pdf().from(container).set({ margin: 10, filename: `面试记录_${candidateName || '候选人'}.pdf`, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } }).save();
    } catch { alert('导出PDF失败'); }
  }

  async function shareRecordLink() {
    try {
      const path = '/interview-record';
      const url = new URL(path, 'http://127.0.0.1:4000');
      const id = qs('report_id');
      if (id) url.searchParams.set('report_id', id);
      await navigator.clipboard.writeText(url.toString());
      alert('链接已复制');
    } catch {
      alert('复制失败，请手动复制地址栏链接');
    }
  }
  function toggleAnnotationMode() {
    try {
      annotationMode = !annotationMode;
      const btn1 = document.getElementById('annotateToggleBtn');
      const btn2 = document.getElementById('annotateToggleBtnRecord');
      if (btn1) btn1.classList.toggle('active', annotationMode);
      if (btn2) btn2.classList.toggle('active', annotationMode);
      if (!annotationMode) hideAnnotationPopover();
    } catch {}
  }
  function handleSelectionForAnnotation() {
    try {
      if (!annotationMode) return;
      const root = document.getElementById('leftReportContent');
      if (!root) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      if (!sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const rect = range.getBoundingClientRect();
      showAnnotationPopover(Math.max(12, rect.left + window.scrollX), rect.bottom + window.scrollY + 6, range);
    } catch {}
  }
  function showAnnotationPopover(x, y, range) {
    try {
      hideAnnotationPopover();
      const pop = document.createElement('div');
      pop.className = 'annotation-popover';
      pop.style.left = `${x}px`;
      pop.style.top = `${y}px`;
      pop.innerHTML = `<div style="font-size:12px;color:#374151;margin-bottom:6px;">在选中位置添加备注</div><textarea id="annotationInput"></textarea><div class="actions"><button id="annSave">保存</button><button id="annCancel">取消</button></div>`;
      document.body.appendChild(pop);
      annotationPopover = { el: pop, range };
      const save = pop.querySelector('#annSave');
      const cancel = pop.querySelector('#annCancel');
      const input = pop.querySelector('#annotationInput');
      if (input) input.focus();
      if (save) save.addEventListener('click', () => applyAnnotationNote());
      if (cancel) cancel.addEventListener('click', () => hideAnnotationPopover());
    } catch {}
  }
  function hideAnnotationPopover() {
    try { if (annotationPopover && annotationPopover.el) { annotationPopover.el.remove(); } annotationPopover = null; } catch {}
  }
  function applyAnnotationNote() {
    try {
      if (!annotationPopover || !annotationPopover.range) return;
      const input = annotationPopover.el.querySelector('#annotationInput');
      const raw = input ? String(input.value || '').trim() : '';
      if (!raw) { hideAnnotationPopover(); return; }
      const root = document.getElementById('leftReportContent');
      if (!root) { hideAnnotationPopover(); return; }
      const safe = window.DOMPurify ? window.DOMPurify.sanitize(raw) : raw.replace(/[<>]/g,'');
      const id = (window.crypto && window.crypto.randomUUID) ? window.crypto.randomUUID() : ('ann-' + Date.now());
      const span = document.createElement('mark');
      span.className = 'annotation-target';
      span.setAttribute('data-ann-id', id);
      try { annotationPopover.range.surroundContents(span); } catch { hideAnnotationPopover(); return; }
      const note = document.createElement('span');
      note.className = 'annotation-note';
      note.setAttribute('data-ann-id', id);
      note.innerHTML = safe.replace(/\n/g,'<br>');
      span.parentNode.insertBefore(note, span.nextSibling);
      resumeAnnotations.push({ id, target: String(span.textContent || ''), note: safe });
      if (isRecordPage()) persistRecordAnnotationsUpdate();
      hideAnnotationPopover();
    } catch {}
  }
  function handleAnnotationElementClick(e) {
    try {
      const t = e.target;
      const root = document.getElementById('leftReportContent');
      if (!root || !t) return;
      const isNote = t.classList && t.classList.contains('annotation-note');
      const isMark = t.classList && t.classList.contains('annotation-target');
      if (!isNote && !isMark) return;
      const id = t.getAttribute('data-ann-id');
      if (!id) return;
      const markEl = isMark ? t : Array.from(root.querySelectorAll('mark.annotation-target')).find(el => el.getAttribute('data-ann-id') === id) || null;
      const noteEl = isNote ? t : Array.from(root.querySelectorAll('span.annotation-note')).find(el => el.getAttribute('data-ann-id') === id) || null;
      const rect = t.getBoundingClientRect();
      openAnnotationEditPopover(Math.max(12, rect.left + window.scrollX), rect.bottom + window.scrollY + 6, id, markEl, noteEl);
    } catch {}
  }
  function openAnnotationEditPopover(x, y, id, markEl, noteEl) {
    try {
      hideAnnotationPopover();
      const pop = document.createElement('div');
      pop.className = 'annotation-popover';
      pop.style.left = `${x}px`;
      pop.style.top = `${y}px`;
      pop.innerHTML = `<div style="font-size:12px;color:#374151;margin-bottom:6px;">编辑备注</div><textarea id="annotationEdit"></textarea><div class="actions"><button id="annUpdate">更新</button><button id="annDelete">删除</button><button id="annCancel">取消</button></div>`;
      document.body.appendChild(pop);
      annotationPopover = { el: pop, id, markEl, noteEl };
      const input = pop.querySelector('#annotationEdit');
      const cur = resumeAnnotations.find(a => a.id === id);
      if (input) input.value = cur ? (cur.note || '') : (noteEl ? noteEl.textContent || '' : '');
      const btnU = pop.querySelector('#annUpdate');
      const btnD = pop.querySelector('#annDelete');
      const btnC = pop.querySelector('#annCancel');
      if (btnU) btnU.addEventListener('click', () => {
        const val = input ? String(input.value || '') : '';
        updateAnnotationNote(id, noteEl, val);
      });
      if (btnD) btnD.addEventListener('click', () => deleteAnnotation(id, markEl, noteEl));
      if (btnC) btnC.addEventListener('click', () => hideAnnotationPopover());
    } catch {}
  }
  function updateAnnotationNote(id, noteEl, text) {
    try {
      const safe = window.DOMPurify ? window.DOMPurify.sanitize(text) : String(text || '').replace(/[<>]/g,'');
      if (noteEl) noteEl.innerHTML = safe.replace(/\n/g,'<br>');
      const idx = resumeAnnotations.findIndex(a => a.id === id);
      if (idx >= 0) resumeAnnotations[idx].note = safe;
      hideAnnotationPopover();
      if (isRecordPage()) persistRecordAnnotationsUpdate();
    } catch {}
  }
  function deleteAnnotation(id, markEl, noteEl) {
    try {
      if (noteEl) noteEl.remove();
      if (markEl && markEl.parentNode) {
        const text = document.createTextNode(markEl.textContent || '');
        markEl.parentNode.replaceChild(text, markEl);
      }
      resumeAnnotations = resumeAnnotations.filter(a => a.id !== id);
      hideAnnotationPopover();
      if (isRecordPage()) persistRecordAnnotationsUpdate();
    } catch {}
  }
  function buildResumeAnnotationsFromDom() {
    try {
      const root = document.getElementById('resumeReportContent');
      if (!root) return [];
      const marks = Array.from(root.querySelectorAll('mark.annotation-target'));
      const notes = Array.from(root.querySelectorAll('span.annotation-note'));
      const findNote = (id) => notes.find(n => n.getAttribute('data-ann-id') === id);
      const list = [];
      for (const m of marks) {
        const id = m.getAttribute('data-ann-id');
        const n = id ? findNote(id) : null;
        list.push({ id: id || '', target: String(m.textContent || ''), note: n ? String(n.textContent || '') : '' });
      }
      return list;
    } catch { return []; }
  }
  async function persistRecordAnnotationsUpdate() {
    try {
      const root = document.getElementById('resumeReportContent');
      if (!root || !currentRecordId) return;
      const html = String(root.innerHTML || '');
      const anns = buildResumeAnnotationsFromDom();
      const c = window.Auth && window.Auth.supabase;
      const token = await getAuthToken();
      if (c && token) {
        let mo = {};
        try {
          const { data } = await c.from('reports').select('markdown_output').eq('id', currentRecordId).limit(1).maybeSingle();
          const raw = String(data?.markdown_output || '');
          if (raw.trim().startsWith('{')) { try { mo = JSON.parse(raw); } catch { mo = {}; } } else { mo = { md: raw || '' }; }
        } catch { mo = currentRecordMo || {}; }
        mo.resume_notes_inline_html = html;
        mo.resume_annotations = anns;
        await c.from('reports').update({ markdown_output: JSON.stringify(mo) }).eq('id', currentRecordId);
      } else {
        const u = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
        const key = u ? `demo_reports_${u.id}` : (currentRecordUserId ? `demo_reports_${currentRecordUserId}` : '');
        if (key) {
          let arr = [];
          try { arr = JSON.parse(localStorage.getItem(key) || '[]'); } catch { arr = []; }
          const idx = arr.findIndex(r => String(r.id) === String(currentRecordId));
          if (idx >= 0) {
            let mo = {};
            try { mo = JSON.parse(String(arr[idx].markdown_output || '{}')); } catch { mo = {}; }
            mo.resume_notes_inline_html = html;
            mo.resume_annotations = anns;
            arr[idx].markdown_output = JSON.stringify(mo);
            localStorage.setItem(key, JSON.stringify(arr));
          }
        }
      }
    } catch {}
  }
  function isRecordPage() {
    const p = window.location.pathname;
    return /^\/interview-record$/.test(p) || /面试记录-AI招聘分析\.html$/.test(p) || /%E9%9D%A2%E8%AF%95%E8%AE%B0%E5%BD%95-AI%E6%8B%9B%E8%81%98%E5%88%86%E6%9E%90\.html$/.test(p);
  }

  function boot() {
    const path = window.location.pathname;
    if (/^\/interview$/.test(path) || /^\/interview\.html$/.test(path) || /%E8%BF%9B%E5%85%A5%E9%9D%A2%E8%AF%95-AI%E6%8B%9B%E8%81%98%E5%88%86%E6%9E%90\.html$/.test(path) || /进入面试-AI招聘分析\.html$/.test(path)) {
      initInterviewLivePage();
    } else if (/^\/interview-record$/.test(path) || /%E9%9D%A2%E8%AF%95%E8%AE%B0%E5%BD%95-AI%E6%8B%9B%E8%81%98%E5%88%86%E6%9E%90\.html$/.test(path) || /面试记录-AI招聘分析\.html$/.test(path)) {
      initInterviewRecordPage();
    }
    try { window.startAnalysis = startAnalysis; } catch {}
    try { window.startRecording = startRecording; } catch {}
    try { window.pauseRecording = pauseRecording; } catch {}
    try { window.stopRecording = stopRecording; } catch {}
    try { window.toggleAnnotationMode = toggleAnnotationMode; } catch {}
    try { window.persistRecordAnnotationsUpdate = persistRecordAnnotationsUpdate; } catch {}
  }

document.addEventListener('DOMContentLoaded', boot);
})();
  function toggleTranscriptVisibility() {
    try {
      const box = document.getElementById('transcriptContent');
      const btn = document.getElementById('toggleTranscriptBtn');
      if (!box || !btn) return;
      const collapsed = box.classList.toggle('collapsed');
      btn.textContent = collapsed ? '显示内容' : '隐藏内容';
    } catch {}
  }
