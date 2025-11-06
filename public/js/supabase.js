// Supabase 初始化与认证封装（真实注册/登录流程）
// 说明：anon key 可放前端（受RLS保护），敏感后端密钥不要放这里。

(function() {
  // TODO: 将以下常量替换为您自己的 Supabase 项目配置
  // 获取方式：Supabase 控制台 -> Project Settings -> API
  const SUPABASE_URL = 'https://your-project-ref.supabase.co';
  const SUPABASE_ANON_KEY = 'your_supabase_anon_key_here';

  let client = null;
  let currentUser = null;

  function initialize() {
    if (!window.supabase) {
      console.error('Supabase JS 未加载');
      return;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    client.auth.getUser().then(({ data }) => {
      currentUser = data?.user || null;
      dispatchAuthChanged();
    }).catch((err) => {
      console.warn('获取当前用户失败：', err?.message || err);
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
    if (!client) return { data: null, error: new Error('认证未初始化') };
    try {
      return await client.auth.signInWithPassword({ email, password });
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async function signUp(email, password) {
    if (!client) return { data: null, error: new Error('认证未初始化') };
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
    if (!client) return { data: null, error: new Error('认证未初始化') };
    return client.auth.signOut();
  }

  async function resetPassword(email) {
    if (!client) return { data: null, error: new Error('认证未初始化') };
    return client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
  }

  async function updatePassword(newPassword) {
    if (!client) return { data: null, error: new Error('认证未初始化') };
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
    // 暴露 Supabase 客户端以供直接查询（如 window.Auth.supabase.from(...)
    get supabase() { return client; }
  };
})();