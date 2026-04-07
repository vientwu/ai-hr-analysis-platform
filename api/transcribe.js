export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const provider = req.headers['x-provider'] || 'openai';
    const key = req.headers['x-provider-key'] || '';
    if (!key) return res.status(400).json({ error: 'Missing provider key' });
    const bodyText = await readBody(req);
    let payload = {};
    try { payload = JSON.parse(bodyText || '{}'); } catch { payload = {}; }
    const { filename = 'audio.webm', mime = 'audio/webm', dataBase64 = '', model = 'whisper-1', language = 'zh' } = payload;
    if (!dataBase64) return res.status(400).json({ error: 'Missing dataBase64' });
    if (provider !== 'openai') return res.status(400).json({ error: 'Unsupported provider for transcription' });
    const buffer = Buffer.from(String(dataBase64), 'base64');
    const blob = new Blob([buffer], { type: mime || 'application/octet-stream' });
    const fd = new FormData();
    fd.append('file', blob, filename);
    fd.append('model', model);
    if (language) fd.append('language', language);
    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}` },
      body: fd
    });
    const text = await resp.text();
    let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) {
      const msg = (json?.error && (json.error.message || json.error)) || json?.message || 'Provider error';
      return res.status(resp.status).json({ error: msg, raw: json });
    }
    const outText = String(json?.text || json?.result || '').trim();
    return res.status(200).json({ text: outText });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
  });
}
