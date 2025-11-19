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
    const headerKey = req.headers['x-openrouter-key'] || '';
    const apiKey = headerKey || process.env.OPENROUTER_API_KEY || '';
    const model = body.model || process.env.OPENROUTER_MODEL || 'anthropic/claude-3.5-sonnet';
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const max_tokens = typeof body.max_tokens === 'number' ? body.max_tokens : 4000;
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.2;
    if (!apiKey) return res.status(500).json({ error: 'OpenRouter API key not configured' });
    if (!messages.length) return res.status(400).json({ error: 'Missing messages' });
    const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
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
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
