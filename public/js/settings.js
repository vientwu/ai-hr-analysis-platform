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
  const loadDefaultPromptsBtn = document.getElementById('load-default-prompts');
  const saveBtn = document.getElementById('settings-save');
  const testConnBtn = document.getElementById('test-conn');
  const connStatus = document.getElementById('conn-status');
  const promptStatus = document.getElementById('prompt-status');

  const API_BASE = (window.location.port === '4321') ? 'http://127.0.0.1:4000' : '';
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

  const DEFAULT_PROMPTS = {
    '简历信息分析提示词': '你将读取中文或英文简历文本，提取候选人姓名、联系方式、所在地、教育经历（学校、专业、学历、时间）、工作经历（公司、岗位、时间、职责、项目）、技能标签（编程语言、框架、工具、领域）、证书与奖项、个人亮点。输出为结构化 Markdown，使用清晰的标题与列表，保持原文关键信息，不编造。',
    '简历匹配度+面试分析+面试问题生成提示词': '输入为候选人简历与岗位 JD。计算匹配度（0-100），给出依据（技能、经验、行业、教育），输出风险点与补足建议，生成 8-12 个面试问题（基础/项目/行为/挑战/反思），同时提供候选人优势与可能的关切。所有结论基于文本证据，不臆测。Markdown 分段输出。',
    '岗位画像生成提示词': '读取岗位 JD 文本，提炼岗位画像：核心职责、必要技能、加分项、经验年限、学历与证书、行业与领域、通用素质、评估维度与权重、典型面试题。输出为 Markdown，包含清晰小节与要点列表，可直接用于与简历比对。'
  };

  const getUserKey = async () => {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    const uid = user ? user.id : 'guest';
    try { return JSON.parse(localStorage.getItem(`openrouter_settings_${uid}`) || 'null'); } catch { return null; }
  };
  const setUserKey = async (obj) => {
    const user = await (window.Auth && typeof window.Auth.getCurrentUser === 'function' ? window.Auth.getCurrentUser() : null);
    const uid = user ? user.id : 'guest';
    try { localStorage.setItem(`openrouter_settings_${uid}`, JSON.stringify(obj || {})); } catch {}
  };

  const fetchPrompt = async (p) => {
    try {
      const r = await fetch(encodeURI('/' + p), { cache: 'no-store' });
      if (r.ok) return await r.text();
    } catch {}
    return DEFAULT_PROMPTS[p] || '';
  };

  const loadPrompts = async () => {
    try {
      const saved = await getUserKey();
      if (saved && saved.prompts) {
        if (promptResumeInput) promptResumeInput.value = saved.prompts.resumeInfo || '';
        if (promptMatchInput) promptMatchInput.value = saved.prompts.matchInterview || '';
        if (promptJdInput) promptJdInput.value = saved.prompts.jdPortrait || '';
        if (promptStatus) promptStatus.innerText = '已加载（自定义）';
        return;
      }
      if (promptResumeInput) promptResumeInput.value = '';
      if (promptMatchInput) promptMatchInput.value = '';
      if (promptJdInput) promptJdInput.value = '';
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
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Provider-Key': key }, body: JSON.stringify({ provider, model, messages, max_tokens: 8, temperature: 0 }) });
      if (!resp.ok) throw new Error(await resp.text());
      const json = await resp.json();
      const ok = !!(json && json.choices && json.choices.length > 0);
      setConnStatus(ok);
    } catch {
      setConnStatus(false, '连接失败');
    } finally { if (testConnBtn) testConnBtn.disabled = false; }
  };

  const openSettings = async () => {
    if (modal) modal.style.display = 'block';
    const saved = await getUserKey();
    let userSettings = saved || { provider: 'openrouter', apiKey: '', keys: { openrouter: '', openai: '', anthropic: '', deepseek: '' }, model: defaultModel, customModel: '', prompts: { resumeInfo: '', matchInterview: '', jdPortrait: '' } };
    if (!userSettings.keys) userSettings.keys = { openrouter: userSettings.apiKey || '', openai: '', anthropic: '', deepseek: '' };
    if (!userSettings.provider) userSettings.provider = 'openrouter';
    if (providerSelect) providerSelect.value = userSettings.provider;
    const currentProvider = providerSelect ? providerSelect.value : userSettings.provider;
    if (keyInput) keyInput.value = (userSettings.keys && userSettings.keys[currentProvider]) ? userSettings.keys[currentProvider] : (userSettings.apiKey || '');
    if (modelSelect) modelSelect.value = userSettings.model || defaultModel;
    if (customModelInput) customModelInput.value = userSettings.customModel || '';
    // 异步加载提示词
    try { if (typeof window.loadPrompts === 'function') window.loadPrompts(); } catch {}
  };

  try { window.openSettings = openSettings; } catch {}

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
    const userSettings = saved || { provider: 'openrouter', apiKey: '', keys: { openrouter: '', openai: '', anthropic: '', deepseek: '' }, model: defaultModel, customModel: '', prompts: { resumeInfo: '', matchInterview: '', jdPortrait: '' } };
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
      matchInterview: promptMatchInput ? promptMatchInput.value : ''
    };
    await setUserKey(userSettings);
    closeSettings();
    try { if (typeof window.loadPrompts === 'function') window.loadPrompts(); } catch {}
  };

  if (openBtn) openBtn.addEventListener('click', openSettings);
  if (closeBtn) closeBtn.addEventListener('click', closeSettings);
  if (saveBtn) saveBtn.addEventListener('click', saveSettings);
  if (providerSelect) providerSelect.addEventListener('change', refreshModels);
  if (loadDefaultPromptsBtn) loadDefaultPromptsBtn.addEventListener('click', async () => {
    const a = await fetchPrompt('简历信息分析提示词');
    const b = await fetchPrompt('简历匹配度+面试分析+面试问题生成提示词');
    const c = await fetchPrompt('岗位画像生成提示词');
    if (promptResumeInput) promptResumeInput.value = a || '';
    if (promptMatchInput) promptMatchInput.value = b || '';
    if (promptJdInput) promptJdInput.value = c || '';
    if (promptStatus) promptStatus.innerText = (a || b || c) ? '已加载（默认）' : '默认未找到';
  });
  if (testConnBtn) testConnBtn.addEventListener('click', testConnectivity);
  if (modelSelect) refreshModels();
  try { window.openSettings = openSettings; } catch {}
})();
