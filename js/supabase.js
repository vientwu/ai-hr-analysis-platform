// Supabase 初始化与认证封装（真实注册/登录流程）
// 说明：anon key 可放前端（受RLS保护），敏感后端密钥不要放这里。

(function() {
  // Supabase 项目配置
  // 项目名称：ai-hr-analysis-platform
  // 从环境变量或全局配置中获取配置信息
  const SUPABASE_URL = window.ENV?.SUPABASE_URL || 'https://bcsjxvhzoufzqzupygyl.supabase.co';
  const SUPABASE_ANON_KEY = window.ENV?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2p4dmh6b3VmenF6dXB5Z3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MDY3NDIsImV4cCI6MjA3NzI4Mjc0Mn0.hqW92LKNOVDN9QohpyhxdUNt5r1A4FbLzX8Vg-bihZc';

  let client = null;
  let currentUser = null;
  let currentPersistSetting = null; // 记录当前的持久化设置
  let authStateSubscription = null; // 记录认证状态订阅

  function initialize() {
    if (!window.supabase) {
      console.error('Supabase JS 未加载');
      return;
    }
    
    // 避免重复初始化
    if (client) {
      console.warn('Supabase 客户端已初始化，跳过重复初始化');
      return;
    }
    
  // 会话持久化策略
  // 为了确保登录后返回主页仍能保持登录状态，这里默认启用持久化。
  // 如需关闭持久化，可在未来提供设置页面统一切换，而不是在初始化时强制登出。
  const rememberMe = localStorage.getItem('rememberMe');
  const usePersist = (rememberMe === null) ? true : (rememberMe === 'true');
  currentPersistSetting = usePersist;

  const authConfig = {
    persistSession: usePersist,
    autoRefreshToken: true,
    detectSessionInUrl: true
  };
    
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        ...authConfig,
        flowType: 'pkce'
      }
    });

    // 初始化时尝试获取当前用户（无论是否持久化）
    client.auth.getUser().then(({ data }) => {
      currentUser = data?.user || null;
      dispatchAuthChanged();
    }).catch((err) => {
      console.warn('获取当前用户失败：', err?.message || err);
      dispatchAuthChanged();
    });

    authStateSubscription = client.auth.onAuthStateChange((event, session) => {
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

  function setRememberMe(remember) {
    try {
      localStorage.setItem('rememberMe', remember.toString());
      // 如果持久化设置发生变化，重建客户端以使其立即生效
      if (currentPersistSetting !== remember) {
        currentPersistSetting = remember;
        // 只有在 Supabase 已加载时才重建
        if (window.supabase && typeof window.supabase.createClient === 'function') {
          // 重建客户端，应用新的持久化策略
          try {
            // 清理旧的认证状态订阅
            if (authStateSubscription && typeof authStateSubscription.unsubscribe === 'function') {
              authStateSubscription.unsubscribe();
            }
            
            client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
              auth: {
                persistSession: currentPersistSetting,
                autoRefreshToken: true,
                detectSessionInUrl: true,
                flowType: 'pkce'
              }
            });

            // 重新绑定状态监听
            authStateSubscription = client.auth.onAuthStateChange((event, session) => {
              currentUser = session?.user || null;
              dispatchAuthChanged();
              if (event === 'PASSWORD_RECOVERY') {
                try { window.dispatchEvent(new CustomEvent('password-recovery')); } catch {}
              }
            });
          } catch (e) {
            console.warn('重建 Supabase 客户端失败：', e);
          }
        }
      }
    } catch (e) {
      console.warn('设置记住我失败：', e);
    }
  }

  function getRememberMe() {
    return localStorage.getItem('rememberMe') === 'true';
  }

  function clearRememberMe() {
    localStorage.removeItem('rememberMe');
  }

  async function signInWithEmail(email, password) {
    if (!client) return { data: null, error: new Error('认证未初始化') };
    try {
      return await client.auth.signInWithPassword({ email, password });
    } catch (err) {
      return { data: null, error: err };
    }
  }

  async function signUpWithEmail(email, password) {
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
    // 清除记住我选项
    clearRememberMe();
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

  const supabaseAuth = {
    initialize,
    signInWithEmail,
    signUpWithEmail,
    signOut,
    resetPassword,
    updatePassword,
    getClient,
    getUser,
    setRememberMe,
    getRememberMe,
    clearRememberMe
  };

  // 全局导出（兼容性）
  window.Auth = supabaseAuth;
  
  // ES6 模块导出
  if (typeof window !== 'undefined') {
    window.supabaseAuth = supabaseAuth;
  }
})();

// ES6 模块导出：返回真实的 Supabase 客户端（而不是封装对象）
export const supabase = (typeof window !== 'undefined' && window.Auth && typeof window.Auth.getClient === 'function')
  ? window.Auth.getClient()
  : null;

// 便捷函数：在运行时获取最新的 Supabase 客户端
export function getSupabase() {
  return (typeof window !== 'undefined' && window.Auth && typeof window.Auth.getClient === 'function')
    ? window.Auth.getClient()
    : null;
}