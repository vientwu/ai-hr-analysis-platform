import { STATIC_SECRETS } from '../secrets.js'

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST')
      return res.status(405).json({ error: 'Method Not Allowed' })
    }
    const auth = req.headers['authorization'] || ''
    if (!auth.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Authorization Bearer token' })
    }
    const body = await new Promise((resolve) => {
      let data = ''
      req.on('data', (chunk) => { data += chunk })
      req.on('end', () => {
        try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
      })
    })
    const id = String(body.id || '')
    const user_id = String(body.user_id || '')
    if (!id || !user_id) {
      return res.status(400).json({ error: 'Missing id or user_id' })
    }
    const SUPABASE_URL = process.env.SUPABASE_URL || STATIC_SECRETS.SUPABASE_URL
    const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || STATIC_SECRETS.SUPABASE_ANON_KEY
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      return res.status(500).json({ error: 'Supabase env not configured' })
    }
    const url = `${SUPABASE_URL}/rest/v1/reports?id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(user_id)}`
    const resp = await fetch(url, {
      method: 'DELETE',
      headers: { Authorization: auth, apikey: SUPABASE_ANON_KEY, Accept: 'application/json' }
    })
    if (!resp.ok) {
      const t = await resp.text()
      let json = null; try { json = JSON.parse(t) } catch { json = { raw: t } }
      return res.status(resp.status).json({ error: json })
    }
    return res.status(200).json({ ok: true })
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' })
  }
}