export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const provider = req.headers['x-provider'] || 'openrouter';
    const key = req.headers['x-provider-key'] || '';
    const bodyText = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(bodyText || '{}'); } catch { payload = {}; }
    const { model = 'anthropic/claude-3.5-sonnet', messages = [], temperature = 0.2, max_tokens = 1024 } = payload;
    if (!key) return res.status(400).json({ error: { message: 'Missing provider key' } });
    let url = '';
    let headers = {};
    let data = {};
    if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers = {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': (req.headers['referer'] || req.headers['origin'] || 'http://localhost:4321/'),
        'X-Title': 'AI Recruitment Analyzer'
      };
      data = { model, messages, temperature, max_tokens };
    } else if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
      data = { model, messages, temperature, max_tokens };
    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers = { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' };
      const sysMsg = messages.find(m => m.role === 'system');
      const userParts = messages.filter(m => m.role !== 'system').map(m => ({ type: 'text', text: m.content }));
      data = { model, max_tokens, system: sysMsg ? sysMsg.content : '', messages: [{ role: 'user', content: userParts }] };
    } else if (provider === 'deepseek') {
      url = 'https://api.deepseek.com/chat/completions';
      headers = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' };
      data = { model, messages, temperature, max_tokens };
    } else {
      return res.status(400).json({ error: { message: 'Unsupported provider' } });
    }
    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(data) });
    const text = await resp.text();
    let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) {
      const msg = (json?.error && (json.error.message || json.error)) || json?.message || (typeof json === 'string' ? json : JSON.stringify(json));
      return res.status(resp.status).json({ error: { message: String(msg || 'Provider error'), provider }, raw: json });
    }
    let outText = '';
    if (provider === 'anthropic') {
      const blocks = json?.content || [];
      outText = blocks.map(b => b?.text || '').join('\n');
    } else {
      outText = json?.choices?.[0]?.message?.content || '';
    }
    return res.status(200).json({ ok: true, text: outText, raw: json });
  } catch (err) {
    const m = (err && err.message) ? err.message : 'Network or internal error';
    return res.status(502).json({ error: { message: `连接失败：${m}`, provider: (req.headers['x-provider'] || '') } });
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}
