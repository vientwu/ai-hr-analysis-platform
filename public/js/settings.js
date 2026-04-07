(() => {
  const openBtn = document.getElementById('open-settings');
  const modal = document.getElementById('settings-modal');
  const closeBtn = document.getElementById('settings-close');
  const providerSelect = document.getElementById('provider-select');
  const keyInput = document.getElementById('openrouter-key');
  const modelSelect = document.getElementById('model-select');
  const customModelInput = document.getElementById('custom-model');
  const promptResumeInput = document.getElementById('prompt-resume');
  const promptJdInput = document.getElementById('prompt-jd');
  const promptMatchInput = document.getElementById('prompt-match');
  const promptInterviewInput = document.getElementById('prompt-interview');
  const loadDefaultPromptsBtn = document.getElementById('load-default-prompts');
  const saveBtn = document.getElementById('settings-save');
  const testConnBtn = document.getElementById('test-conn');
  const connStatus = document.getElementById('conn-status');
  const promptStatus = document.getElementById('prompt-status');

  const API_BASE_OVERRIDE = (typeof window !== 'undefined' && window.localStorage)
    ? (window.localStorage.getItem('API_BASE_OVERRIDE') || '')
    : '';
  const API_BASE = API_BASE_OVERRIDE || ((window.location.port === '4321' || window.location.port === '5173') ? 'http://127.0.0.1:4000' : '');
  const defaultModel = 'anthropic/claude-3.5-sonnet';
  const MODEL_CATALOG = [
    { v: 'anthropic/claude-3.5-sonnet', t: 'Anthropic: Claude 3.5 Sonnet' },
    { v: 'anthropic/claude-3.7-sonnet', t: 'Anthropic: Claude 3.7 Sonnet' },
    { v: 'anthropic/claude-3-opus', t: 'Anthropic: Claude 3 Opus' },
    { v: 'anthropic/claude-3-haiku', t: 'Anthropic: Claude 3 Haiku' },
    { v: 'openai/gpt-4o', t: 'OpenAI GPT-4o' },
    { v: 'openai/gpt-4.1', t: 'OpenAI GPT-4.1' },
    { v: 'deepseek/deepseek-chat', t: 'DeepSeek Chat' },
    { v: 'deepseek/deepseek-r1', t: 'DeepSeek R1' }
  ];

  const DEFAULT_PROMPTS = {};

  const getUserKey = async () => {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    const uid = user ? user.id : 'guest';
    let fromMeta = null;
    try {
      if (user && user.user_metadata && user.user_metadata.openrouter_settings) {
        fromMeta = user.user_metadata.openrouter_settings;
      }
    } catch {}
    if (fromMeta) return fromMeta;
    let ls = null;
    try { ls = JSON.parse(localStorage.getItem(`openrouter_settings_${uid}`) || 'null'); } catch { ls = null; }
    if (!ls && user) {
      try {
        const guestStr = localStorage.getItem('openrouter_settings_guest') || '';
        const guest = guestStr ? JSON.parse(guestStr) : null;
        if (guest) {
          localStorage.setItem(`openrouter_settings_${uid}`, JSON.stringify(guest));
          ls = guest;
          localStorage.removeItem('openrouter_settings_guest');
          const client = window.Auth && typeof window.Auth.getClient === 'function' ? window.Auth.getClient() : null;
          if (client) {
            try { await client.auth.updateUser({ data: { openrouter_settings: guest } }); } catch {}
          }
        }
      } catch {}
    }
    return ls;
  };
  const setUserKey = async (obj) => {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    const uid = user ? user.id : 'guest';
    try { localStorage.setItem(`openrouter_settings_${uid}`, JSON.stringify(obj || {})); } catch {}
    if (!user) {
      try { localStorage.setItem('openrouter_settings_guest', JSON.stringify(obj || {})); } catch {}
      return;
    }
    const client = window.Auth && typeof window.Auth.getClient === 'function' ? window.Auth.getClient() : null;
    if (client) {
      try { await client.auth.updateUser({ data: { openrouter_settings: obj || {} } }); } catch {}
    }
  };

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
      if (saved && saved.prompts) {
        if (promptResumeInput) promptResumeInput.value = saved.prompts.resumeInfo || '';
        if (promptMatchInput) promptMatchInput.value = saved.prompts.matchInterview || '';
        if (promptJdInput) promptJdInput.value = saved.prompts.jdPortrait || '';
        if (promptInterviewInput) promptInterviewInput.value = saved.prompts.interviewComprehensive || '';
        if (promptStatus) promptStatus.innerText = '已加载（自定义）';
        return;
      }
      if (promptResumeInput) promptResumeInput.value = '';
      if (promptMatchInput) promptMatchInput.value = '';
      if (promptJdInput) promptJdInput.value = '';
      if (promptInterviewInput) promptInterviewInput.value = '';
      if (promptStatus) promptStatus.innerText = '未设置';
    } catch { if (promptStatus) promptStatus.innerText = '加载失败'; }
  };

  const setConnStatus = (ok, msg) => {
    if (!connStatus) return;
    connStatus.textContent = ok ? (msg || '已连接') : (msg || '连接失败');
    connStatus.style.color = ok ? '#059669' : '#dc2626';
  };

  const testConnectivity = async () => {
    try {
      if (!providerSelect || !keyInput) return;
      const provider = providerSelect.value;
      const model = (modelSelect && modelSelect.value) ? modelSelect.value : defaultModel;
      const key = keyInput.value.trim();
      if (!key) return;
      if (testConnBtn) testConnBtn.disabled = true;
      setConnStatus(false, '测试中...');
      const messages = [{ role: 'user', content: 'ping' }];
      const url = API_BASE ? `${API_BASE}/api/llm-chat` : '/api/llm-chat';
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Provider': provider, 'X-Provider-Key': key }, body: JSON.stringify({ provider, model, messages, max_tokens: 8, temperature: 0 }) });
      let json = null;
      try { json = await resp.json(); } catch { json = null; }
      if (!resp.ok) {
        const msg = (json && json.error && json.error.message) ? json.error.message : (await resp.text());
        throw new Error(msg || '连接失败');
      }
      const ok = !!(json && (json.ok || (typeof json.text === 'string' && json.text.length > 0)));
      setConnStatus(ok, ok ? '已连接' : '连接失败');
    } catch (e) {
      setConnStatus(false, '连接失败：' + (e && e.message ? e.message : ''));
    } finally { if (testConnBtn) testConnBtn.disabled = false; }
  };

  const openSettings = async () => {
    if (modal) modal.style.display = 'flex';
    const saved = await getUserKey();
    let userSettings = saved || { provider: 'openrouter', apiKey: '', keys: { openrouter: '', openai: '', anthropic: '', deepseek: '' }, model: defaultModel, customModel: '', prompts: { resumeInfo: '', matchInterview: '', jdPortrait: '', interviewComprehensive: '' } };
    if (!userSettings.keys) userSettings.keys = { openrouter: userSettings.apiKey || '', openai: '', anthropic: '', deepseek: '' };
    if (!userSettings.provider) userSettings.provider = 'openrouter';
    if (providerSelect) providerSelect.value = userSettings.provider;
    const currentProvider = providerSelect ? providerSelect.value : userSettings.provider;
    if (keyInput) keyInput.value = (userSettings.keys && userSettings.keys[currentProvider]) ? userSettings.keys[currentProvider] : (userSettings.apiKey || '');
    if (modelSelect) modelSelect.value = userSettings.model || defaultModel;
    if (customModelInput) customModelInput.value = userSettings.customModel || '';
    // 异步加载提示词（使用本模块的实现，避免跨模块覆盖）
    try { await loadPrompts(); } catch {}
    // 自动检测连接（若存在密钥）
    try { if (keyInput && keyInput.value.trim()) { await testConnectivity(); } else { setConnStatus(false, '未检测'); } } catch {}
  };

  try { window.openSettings = openSettings; } catch {}
  try { window.getUserKey = getUserKey; } catch {}

  const closeSettings = () => { if (modal) modal.style.display = 'none'; };

  const catalogsByProvider = {
    openrouter: MODEL_CATALOG,
    openai: [{ v: 'gpt-4o', t: 'OpenAI GPT-4o' }, { v: 'gpt-4.1', t: 'OpenAI GPT-4.1' }, { v: 'gpt-3.5-turbo', t: 'OpenAI GPT-3.5 Turbo' }],
    anthropic: [{ v: 'claude-3.5-sonnet', t: 'Claude 3.5 Sonnet' }, { v: 'claude-3-opus', t: 'Claude 3 Opus' }, { v: 'claude-3-haiku', t: 'Claude 3 Haiku' }],
    deepseek: [{ v: 'deepseek-chat', t: 'DeepSeek Chat' }, { v: 'deepseek-r1', t: 'DeepSeek R1' }]
  };

  const refreshModels = () => {
    if (!providerSelect || !modelSelect) return;
    const list = catalogsByProvider[providerSelect.value] || MODEL_CATALOG;
    modelSelect.innerHTML = list.map(m=>`<option value="${m.v}">${m.t}</option>`).join('');
  };

  const saveSettings = async () => {
    const saved = await getUserKey();
    const userSettings = saved || { provider: 'openrouter', apiKey: '', keys: { openrouter: '', openai: '', anthropic: '', deepseek: '' }, model: defaultModel, customModel: '', prompts: { resumeInfo: '', matchInterview: '', jdPortrait: '', interviewComprehensive: '' } };
    const pv = providerSelect ? providerSelect.value : (userSettings.provider || 'openrouter');
    userSettings.provider = pv;
    userSettings.apiKey = keyInput ? keyInput.value.trim() : '';
    if (!userSettings.keys) userSettings.keys = { openrouter: '', openai: '', anthropic: '', deepseek: '' };
    userSettings.keys[pv] = userSettings.apiKey;
    userSettings.model = modelSelect ? modelSelect.value : defaultModel;
    userSettings.customModel = customModelInput ? customModelInput.value.trim() : '';
    userSettings.prompts = {
      resumeInfo: promptResumeInput ? promptResumeInput.value : '',
      jdPortrait: promptJdInput ? promptJdInput.value : '',
      matchInterview: promptMatchInput ? promptMatchInput.value : '',
      interviewComprehensive: promptInterviewInput ? promptInterviewInput.value : ''
    };
    await setUserKey(userSettings);
    closeSettings();
    try { await loadPrompts(); } catch {}
  };

  if (openBtn) openBtn.addEventListener('click', openSettings);
  if (closeBtn) closeBtn.addEventListener('click', closeSettings);
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  if (providerSelect) providerSelect.addEventListener('change', refreshModels);
  if (loadDefaultPromptsBtn) loadDefaultPromptsBtn.addEventListener('click', () => {
    if (promptResumeInput) promptResumeInput.value = '';
    if (promptMatchInput) promptMatchInput.value = '';
    if (promptJdInput) promptJdInput.value = '';
    if (promptInterviewInput) promptInterviewInput.value = '';
    if (promptStatus) promptStatus.innerText = '未设置';
  });
  if (testConnBtn) testConnBtn.addEventListener('click', testConnectivity);
  if (modelSelect) refreshModels();
  try { window.openSettings = openSettings; } catch {}
  try { document.addEventListener('DOMContentLoaded', function(){ try { loadPrompts(); } catch {} }); } catch {}
  try { window.addEventListener('auth-changed', function(){ try { loadPrompts(); } catch {} }); } catch {}
})();
