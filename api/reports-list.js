import { STATIC_SECRETS } from '../secrets.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const auth = req.headers['authorization'] || '';
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    }
    const userId = req.query.user_id || req.query.userId;
    if (!userId) {
      return res.status(400).json({ error: 'Missing user_id' });
    }
    const SUPABASE_URL = process.env.SUPABASE_URL || STATIC_SECRETS.SUPABASE_URL;
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || STATIC_SECRETS.SUPABASE_ANON_KEY;
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Supabase env not configured' });
    }
    const url = `${SUPABASE_URL}/rest/v1/reports?select=*&user_id=eq.${encodeURIComponent(userId)}&order=created_at.desc`;
    const resp = await fetch(url, {
      headers: {
        Authorization: auth,
        apikey: SUPABASE_ANON_KEY,
        Accept: 'application/json',
      },
    });
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
