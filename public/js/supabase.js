// Supabase 初始化与认证封装（真实注册/登录流程）
// 说明：anon key 可放前端（受RLS保护），敏感后端密钥不要放这里。

(function() {
  const injected = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG) ? window.__SUPABASE_CONFIG : {};
  const SUPABASE_URL = injected.url;
  const SUPABASE_ANON_KEY = injected.anonKey;
  const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

  let client = null;
  let currentUser = null;

  function initialize() {
    if (!window.supabase || !isSupabaseConfigured) {
      console.error('Supabase 未配置或库未加载，已进入本地演示模式');
      try {
        const saved = JSON.parse(localStorage.getItem('demo_user') || 'null');
        currentUser = saved || null;
      } catch {}
      dispatchAuthChanged();
      return;
    }
    // 显式开启会话持久化与自动刷新（v2 默认如此，这里加强明确配置）
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });

    // 使用 getSession 获取本地会话，避免在未登录时触发“Invalid Refresh Token”控制台报错
    client.auth.getSession().then(({ data }) => {
      currentUser = data?.session?.user || null;
      dispatchAuthChanged();
    }).catch((err) => {
      const msg = err?.message || '';
      // 当无会话时，Supabase 可能返回 Invalid Refresh Token，这属预期情况，忽略警告
      if (!/Invalid Refresh Token/i.test(msg)) {
        console.warn('获取当前会话失败：', msg || err);
      }
      currentUser = null;
      dispatchAuthChanged();
    });

    client.auth.onAuthStateChange((event, session) => {
      currentUser = session?.user || null;
      dispatchAuthChanged();
      // 当用户通过邮箱链接进入密码重置流程时，触发 UI 弹窗
      if (event === 'PASSWORD_RECOVERY') {
        try { window.dispatchEvent(new CustomEvent('password-recovery')); } catch {}
      }
    });
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
      return await client.auth.signInWithPassword({ email, password });
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
      // 注册后，Supabase 会向该邮箱发送确认邮件。
      return await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin }
      });
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
      const res = await client.auth.signOut({ scope: 'local' });
      currentUser = null;
      dispatchAuthChanged();
      return res;
    } catch (err) {
      console.warn('signOut 发生网络错误，已执行本地退出：', err?.message || err);
      try { await client.auth.signOut({ scope: 'local' }); } catch {}
      currentUser = null;
      dispatchAuthChanged();
      return { data: { success: true }, error: null };
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
    get mode() { return isSupabaseConfigured ? 'supabase' : 'demo'; },
    // 暴露 Supabase 客户端以供直接查询（如 window.Auth.supabase.from(...)
    get supabase() { return client; }
  };
})();
