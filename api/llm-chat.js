export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
      });
    });
    const provider = String(body.provider || 'openrouter');
    const model = body.model || '';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const max_tokens = typeof body.max_tokens === 'number' ? body.max_tokens : 4000;
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.2;
    const key = req.headers['x-provider-key'] || '';
    if (!messages.length) return res.status(400).json({ error: 'Missing messages' });

    if (provider === 'openrouter') {
      if (!key) return res.status(500).json({ error: 'OpenRouter API key not provided' });
      const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'HTTP-Referer': 'http://localhost:4321/',
          'X-Title': 'AI Recruitment Analyzer',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model, messages, max_tokens, temperature })
      });
      const text = await resp.text();
      let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!resp.ok) return res.status(resp.status).json({ error: json });
      return res.status(200).json(json);
    }

    if (provider === 'openai') {
      if (!key) return res.status(500).json({ error: 'OpenAI API key not provided' });
      const resp = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens, temperature })
      });
      const text = await resp.text();
      let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!resp.ok) return res.status(resp.status).json({ error: json });
      return res.status(200).json(json);
    }

    if (provider === 'deepseek') {
      if (!key) return res.status(500).json({ error: 'DeepSeek API key not provided' });
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages, max_tokens, temperature })
      });
      const text = await resp.text();
      let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!resp.ok) return res.status(resp.status).json({ error: json });
      return res.status(200).json(json);
    }

    if (provider === 'anthropic') {
      if (!key) return res.status(500).json({ error: 'Anthropic API key not provided' });
      const sysMsg = messages.find(m => m.role === 'system');
      const rest = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: [{ type: 'text', text: typeof m.content === 'string' ? m.content : Array.isArray(m.content) ? m.content.map(p => p.text || '').join('\n') : '' }] }));
      const payload = { model, system: sysMsg ? (typeof sysMsg.content === 'string' ? sysMsg.content : '') : undefined, max_tokens, messages: rest, temperature };
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const text = await resp.text();
      let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
      if (!resp.ok) return res.status(resp.status).json({ error: json });
      const contentText = Array.isArray(json.content) ? json.content.map(c => c.text || '').join('\n') : (json.content?.text || '');
      const unified = { choices: [{ message: { role: 'assistant', content: contentText }, finish_reason: json.stop_reason || '' }] };
      return res.status(200).json(unified);
    }

    return res.status(400).json({ error: `Unsupported provider: ${provider}` });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}

