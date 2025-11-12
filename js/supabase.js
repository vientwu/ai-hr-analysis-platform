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
    // 当未配置或库缺失时，进入本地演示模式
    if (!window.supabase || !isSupabaseConfigured) {
      console.error('Supabase 未配置或库未加载，已进入本地演示模式');
      // 读取本地缓存的“演示登录”用户
      try {
        const saved = JSON.parse(localStorage.getItem('demo_user') || 'null');
        currentUser = saved || null;
      } catch {}
      dispatchAuthChanged();
      return;
    }
    // 明确开启持久化与令牌自动刷新，确保浏览器端会话一致
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      }
    });

    // 初始化改为读取本地会话，避免未登录时抛出“Invalid Refresh Token”错误
    client.auth.getSession().then(({ data }) => {
      currentUser = data?.session?.user || null;
      dispatchAuthChanged();
    }).catch((err) => {
      const msg = err?.message || '';
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

  async function signInWithEmail(email, password) {
    // 本地演示登录（未配置 Supabase 时）
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

  async function signUpWithEmail(email, password) {
    // 本地演示注册（未配置 Supabase 时）
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

  // 为与 main.js 保持一致，提供简洁别名
  async function signIn(email, password) {
    return signInWithEmail(email, password);
  }

  async function signUp(email, password) {
    return signUpWithEmail(email, password);
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
      // 演示模式下直接返回成功
      return { data: { sent: true }, error: null };
    }
    return client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  }

  async function updatePassword(newPassword) {
    if (!isSupabaseConfigured || !client) {
      // 演示模式：不真正更新密码
      return { data: { updated: true }, error: null };
    }
    return client.auth.updateUser({ password: newPassword });
  }

  function getClient() { return client; }
  function getUser() { return currentUser; }
  // 与 public 版本保持一致，提供 getCurrentUser 别名
  function getCurrentUser() { return getUser(); }

  window.Auth = {
    initialize,
    // 主用别名（供 main.js 调用）
    signIn,
    signUp,
    // 保留旧函数名，避免其它代码引用失败
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
    getClient,
    getUser,
    getCurrentUser,
    // 当前模式：'supabase' 或 'demo'
    get mode() { return isSupabaseConfigured ? 'supabase' : 'demo'; },
    // 暴露 Supabase 客户端以供直接查询（如 window.Auth.supabase.from(...)
    get supabase() { return client; }
  };
})();