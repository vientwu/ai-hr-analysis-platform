/**
 * 环境配置管理
 * 在生产环境中，这些值将通过构建过程注入
 */

(function() {
  // 默认配置（开发环境）
  const defaultConfig = {
    SUPABASE_URL: 'https://bcsjxvhzoufzqzupygyl.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2p4dmh6b3VmenF6dXB5Z3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MDY3NDIsImV4cCI6MjA3NzI4Mjc0Mn0.hqW92LKNOVDN9QohpyhxdUNt5r1A4FbLzX8Vg-bihZc',
    NODE_ENV: 'development'
  };

  // 生产环境配置将通过 Vercel 环境变量注入
  const productionConfig = {
    SUPABASE_URL: (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_URL : undefined,
    SUPABASE_ANON_KEY: (typeof process !== 'undefined' && process.env) ? process.env.SUPABASE_ANON_KEY : undefined,
    NODE_ENV: (typeof process !== 'undefined' && process.env) ? (process.env.NODE_ENV || 'production') : 'production'
  };

  // 合并配置
  const config = {};
  
  // 如果在 Node.js 环境中（服务端渲染或构建时）
  if (typeof process !== 'undefined' && process.env) {
    Object.keys(defaultConfig).forEach(key => {
      config[key] = process.env[key] || defaultConfig[key];
    });
  } else {
    // 浏览器环境，使用默认配置
    Object.assign(config, defaultConfig);
  }

  // 将配置暴露到全局
  if (typeof window !== 'undefined') {
    window.ENV = config;
  }

  // 如果是模块环境
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  }

  console.log('环境配置已加载:', {
    NODE_ENV: config.NODE_ENV,
    SUPABASE_URL: config.SUPABASE_URL ? '已配置' : '未配置',
    SUPABASE_ANON_KEY: config.SUPABASE_ANON_KEY ? '已配置' : '未配置'
  });
})();