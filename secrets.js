// 固定的内部配置（仅用于内部环境）。
// 警告：如将此文件提交到公开仓库，将会泄露敏感信息！
// 如果仅供公司内网或私有仓库使用，可在此填入真实值，项目将以这些值为默认回退。
//
// 使用方式：
// - 后端函数（api/*.js）会优先读取 process.env，若未设置则回退到此处常量；
// - dev-server.js 在本地预览时会将 SUPABASE_URL/ANON_KEY 注入到前端；
// - 前端 js/supabase.js / public/js/supabase.js 也支持静态默认值（无需注入）。

export const STATIC_SECRETS = {
  // Coze 访问令牌（仅用于后端函数，不会暴露到前端）
  COZE_PAT: 'pat_IVdrUr3cpkBnRvGvM4oO6A9OpW8nSGmgWj2DoQzgsaSDVAXYFIWpoOADm0pIZPtF',

  // Supabase 配置（anon key 可公开，受RLS保护；URL 非敏感）
  SUPABASE_URL: 'https://bcsjxvhzoufzqzupygyl.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJjc2p4dmh6b3VmenF6dXB5Z3lsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3MDY3NDIsImV4cCI6MjA3NzI4Mjc0Mn0.hqW92LKNOVDN9QohpyhxdUNt5r1A4FbLzX8Vg-bihZc',

  // 可选：工作流ID（如不设置则使用代码内默认ID）
  COZE_RESUME_WORKFLOW_ID: '7513777402993016867',
  COZE_INTERVIEW_WORKFLOW_ID: '7514884191588745254'
};

export default STATIC_SECRETS;