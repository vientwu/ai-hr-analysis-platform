// Supabase 初始化与认证封装（真实注册/登录流程）
// 说明：anon key 可放前端（受RLS保护），敏感后端密钥不要放这里。

(function() {
  const injected = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG) ? window.__SUPABASE_CONFIG : {};
  const SUPABASE_URL = injected.url;
  const SUPABASE_ANON_KEY = injected.anonKey;
  const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  let client = null;
  let currentUser = null;
  let clientType = 'demo';

  function makeRestClient() {
    const getStore = () => {
      try {
        const a = localStorage.getItem('sb_access_token') || '';
        const r = localStorage.getItem('sb_refresh_token') || '';
        const u = JSON.parse(localStorage.getItem('sb_user') || 'null');
        return { access_token: a, refresh_token: r, user: u };
      } catch { return { access_token: '', refresh_token: '', user: null }; }
    };
    const setStore = (s) => {
      try {
        if (s?.access_token) localStorage.setItem('sb_access_token', s.access_token);
        if (s?.refresh_token) localStorage.setItem('sb_refresh_token', s.refresh_token);
        if (s?.user) localStorage.setItem('sb_user', JSON.stringify(s.user));
      } catch {}
    };
    const auth = {
      async getSession() {
        const s = getStore();
        const session = s.access_token ? { access_token: s.access_token, user: s.user } : null;
        return { data: { session }, error: null };
      },
      async signInWithPassword({ email, password }) {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ email, password })
        });
        if (!resp.ok) {
          const t = await resp.text(); let j = null; try { j = JSON.parse(t); } catch { j = { raw: t }; }
          return { data: null, error: j };
        }
        const j = await resp.json();
        setStore({ access_token: j.access_token, refresh_token: j.refresh_token, user: j.user });
        currentUser = j.user || null;
        dispatchAuthChanged();
        return { data: { user: j.user, session: { access_token: j.access_token, user: j.user } }, error: null };
      },
      async signUp({ email, password, options }) {
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ email, password, data: {} })
        });
        const ok = resp.ok; let j = null; try { j = await resp.json(); } catch { j = null; }
        if (!ok) return { data: null, error: j };
        return { data: { user: j?.user || null }, error: null };
      },
      async signOut() {
        try { localStorage.removeItem('sb_access_token'); localStorage.removeItem('sb_refresh_token'); localStorage.removeItem('sb_user'); } catch {}
        currentUser = null; dispatchAuthChanged();
        return { data: { success: true }, error: null };
      },
      resetPasswordForEmail(email, { redirectTo }) { return Promise.resolve({ data: { sent: true }, error: null }); },
      updateUser({ password }) { return Promise.resolve({ data: { updated: true }, error: null }); },
      onAuthStateChange(cb) { return { data: { subscription: { unsubscribe() {} } }, error: null }; },
    };
    const headersAuth = () => {
      const s = getStore(); const h = { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' }; if (s.access_token) h.Authorization = `Bearer ${s.access_token}`; return h;
    };
    const refreshToken = async () => {
      try {
        const s = getStore();
        const rt = s.refresh_token || '';
        if (!rt) return false;
        const resp = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY }, body: JSON.stringify({ refresh_token: rt }) });
        if (!resp.ok) return false;
        const j = await resp.json();
        setStore({ access_token: j.access_token, refresh_token: j.refresh_token, user: j.user || s.user || null });
        currentUser = j.user || s.user || null;
        return true;
      } catch { return false; }
    };
    const shouldRefresh = (err) => {
      try {
        const code = String(err && err.code || '').toUpperCase();
        const msg = String(err && (err.message || err.error_description || err.msg) || '').toLowerCase();
        return code === 'PGRST303' || /jwt.*expired|invalid.*jwt|token.*expired/.test(msg);
      } catch { return false; }
    };
    const makeBuilder = (table, method = 'GET', body = null) => {
      let sel = '*'; let filters = []; let ord = null; let lim = null; let single = false;
      const composeUrl = () => {
        const params = [`select=${encodeURIComponent(sel)}`].concat(filters);
        if (ord) params.push(`order=${encodeURIComponent(ord.field)}.${ord.ascending ? 'asc' : 'desc'}`);
        if (lim) params.push(`limit=${lim}`);
        return `${SUPABASE_URL}/rest/v1/${table}?${params.join('&')}`;
      };
      const exec = async () => {
        try {
          if (method === 'GET') {
            let resp = await fetch(composeUrl(), { headers: headersAuth() });
            let j = await resp.json();
            if (!resp.ok) {
              if (shouldRefresh(j) && await refreshToken()) {
                resp = await fetch(composeUrl(), { headers: headersAuth() });
                j = await resp.json();
                if (!resp.ok) return { data: null, error: j };
              } else {
                return { data: null, error: j };
              }
            }
            if (single) {
              const d = Array.isArray(j) ? (j[0] || null) : j;
              return { data: d, error: null };
            }
            return { data: j, error: null };
          } else if (method === 'POST') {
            let resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: { ...headersAuth(), Prefer: 'return=representation' }, body: JSON.stringify(body) });
            let j = await resp.json();
            if (!resp.ok) {
              if (shouldRefresh(j) && await refreshToken()) {
                resp = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, { method: 'POST', headers: { ...headersAuth(), Prefer: 'return=representation' }, body: JSON.stringify(body) });
                j = await resp.json();
                if (!resp.ok) return { data: null, error: j };
              } else {
                return { data: null, error: j };
              }
            }
            return { data: j, error: null };
          } else if (method === 'PATCH') {
            const base = `${SUPABASE_URL}/rest/v1/${table}`;
            const url = filters.length ? `${base}?${filters.join('&')}` : base;
            let resp = await fetch(url, { method: 'PATCH', headers: { ...headersAuth(), Prefer: 'return=representation' }, body: JSON.stringify(body) });
            let j = await resp.json();
            if (!resp.ok) {
              if (shouldRefresh(j) && await refreshToken()) {
                resp = await fetch(url, { method: 'PATCH', headers: { ...headersAuth(), Prefer: 'return=representation' }, body: JSON.stringify(body) });
                j = await resp.json();
                if (!resp.ok) return { data: null, error: j };
              } else {
                return { data: null, error: j };
              }
            }
            return { data: j, error: null };
          } else if (method === 'DELETE') {
            const base = `${SUPABASE_URL}/rest/v1/${table}`;
            const url = filters.length ? `${base}?${filters.join('&')}` : base;
            let resp = await fetch(url, { method: 'DELETE', headers: headersAuth() });
            if (!resp.ok) {
              const j = await resp.json();
              if (shouldRefresh(j) && await refreshToken()) {
                resp = await fetch(url, { method: 'DELETE', headers: headersAuth() });
                if (!resp.ok) { const j2 = await resp.json(); return { error: j2 }; }
              } else {
                return { error: j };
              }
            }
            return { error: null };
          }
          return { data: null, error: { message: 'unsupportedMethod' } };
        } catch (e) { return { data: null, error: e }; }
      };
      const b = {
        select(c) { sel = c || '*'; method = 'GET'; return b; },
        eq(f, v) { filters.push(`${encodeURIComponent(f)}=eq.${encodeURIComponent(v)}`); return b; },
        order(f, o) { ord = { field: f, ascending: !!(o && o.ascending) }; return b; },
        limit(n) { lim = n; return b; },
        maybeSingle() { single = true; return exec(); },
        insert(rows) { method = 'POST'; body = rows; return b; },
        update(rows) { method = 'PATCH'; body = rows; return b; },
        delete() { method = 'DELETE'; return b; },
        then(resolve, reject) { return exec().then(resolve, reject); }
      };
      return b;
    };
    return { auth, from: (t) => makeBuilder(t) };
  }

  function initialize() {
    const useCloud = (typeof window !== 'undefined' && window.localStorage && window.localStorage.getItem('use_cloud') === '1');
    if (!isSupabaseConfigured) {
      try { const saved = JSON.parse(localStorage.getItem('demo_user') || 'null'); currentUser = saved || null; } catch {}
      clientType = 'demo';
      dispatchAuthChanged();
      return;
    }
    if (!useCloud) {
      client = makeRestClient();
      clientType = 'rest';
      try { currentUser = JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { currentUser = null; }
      dispatchAuthChanged();
      return;
    }
    if (!window.supabase) {
      client = makeRestClient();
      clientType = 'rest';
      try { currentUser = JSON.parse(localStorage.getItem('sb_user') || 'null'); } catch { currentUser = null; }
      dispatchAuthChanged();
      return;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    clientType = 'supabase';
    client.auth.getSession().then(({ data }) => { currentUser = data?.session?.user || null; dispatchAuthChanged(); }).catch(() => { currentUser = null; dispatchAuthChanged(); });
    client.auth.onAuthStateChange((event, session) => { currentUser = session?.user || null; dispatchAuthChanged(); if (event === 'PASSWORD_RECOVERY') { try { window.dispatchEvent(new CustomEvent('password-recovery')); } catch {} } });
  }

  function dispatchAuthChanged() {
    try {
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: currentUser } }));
    } catch (e) {
      console.warn('auth-changed 事件派发失败', e);
    }
  }

  async function signIn(email, password) {
    if (!isSupabaseConfigured || !client) {
      const user = { id: `demo-${btoa(email).replace(/=/g, '')}`, email };
      currentUser = user;
      try { localStorage.setItem('demo_user', JSON.stringify(user)); } catch {}
      dispatchAuthChanged();
      return { data: { user }, error: null };
    }
    try {
      if (client.auth && typeof client.auth.signInWithPassword === 'function') {
        return await client.auth.signInWithPassword({ email, password });
      }
      return { data: null, error: { message: 'signInNotAvailable' } };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async function signUp(email, password) {
    if (!isSupabaseConfigured || !client) {
      const user = { id: `demo-${btoa(email).replace(/=/g, '')}`, email };
      currentUser = user;
      try { localStorage.setItem('demo_user', JSON.stringify(user)); } catch {}
      dispatchAuthChanged();
      return { data: { user }, error: null };
    }
    try {
      if (client.auth && typeof client.auth.signUp === 'function') {
        return await client.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
      }
      return { data: null, error: { message: 'signUpNotAvailable' } };
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async function signOut() {
    if (!isSupabaseConfigured || !client) {
      currentUser = null;
      try { localStorage.removeItem('demo_user'); } catch {}
      dispatchAuthChanged();
      return { data: { success: true }, error: null };
    }
    try {
      if (client.auth && typeof client.auth.signOut === 'function') {
        const res = await client.auth.signOut({ scope: 'local' });
        currentUser = null; dispatchAuthChanged(); return res;
      }
      try { localStorage.removeItem('sb_access_token'); localStorage.removeItem('sb_refresh_token'); localStorage.removeItem('sb_user'); } catch {}
      currentUser = null; dispatchAuthChanged(); return { data: { success: true }, error: null };
    } catch (err) {
      console.warn('signOut 发生网络错误，已执行本地退出：', err?.message || err);
      try { if (client.auth && typeof client.auth.signOut === 'function') await client.auth.signOut({ scope: 'local' }); } catch {}
      currentUser = null; dispatchAuthChanged(); return { data: { success: true }, error: null };
    }
  }

  async function resetPassword(email) {
    if (!isSupabaseConfigured || !client) {
      return { data: { sent: true }, error: null };
    }
    return client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  }

  async function updatePassword(newPassword) {
    if (!isSupabaseConfigured || !client) {
      return { data: { updated: true }, error: null };
    }
    return client.auth.updateUser({ password: newPassword });
  }

  function getClient() { return client; }
  function getUser() { return currentUser; }
  // 为与 main.js 兼容，提供别名与直接 client 引用
  function getCurrentUser() { return getUser(); }

  window.Auth = {
    initialize,
    signIn,
    signUp,
    signOut,
    resetPassword,
    updatePassword,
    getClient,
    getUser,
    getCurrentUser,
    get mode() { return clientType; },
    get supabase() { return client; }
  };
})();
