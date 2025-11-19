import { STATIC_SECRETS } from '../secrets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const auth = req.headers['authorization'] || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }
    const SUPABASE_URL = process.env.SUPABASE_URL || STATIC_SECRETS.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || STATIC_SECRETS.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Supabase env not configured' });
    }
    const body = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => {
        try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
      });
    });
    const base = {
      user_id: body.user_id,
      title: body.title,
      report_type: body.report_type,
      content: body.content,
      markdown_output: body.markdown_output,
      created_at: body.created_at || new Date().toISOString(),
    };
    const full = {
      ...base,
      candidate_name: body.candidate_name ?? null,
      job_title: body.job_title ?? null,
      match_score: body.match_score ?? null,
    };
    let resp = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: 'POST',
      headers: {
        Authorization: auth,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify(full),
    });
    if (!resp.ok) {
      resp = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
        method: 'POST',
        headers: {
          Authorization: auth,
          apikey: SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify(base),
      });
    }
    const text = await resp.text();
    let json = null; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!resp.ok) {
      return res.status(resp.status).json({ error: json });
    }
    return res.status(200).json({ data: json });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
