## 将要执行的具体修改
1) 在页面里注入 Supabase 配置
- 编辑 `index.html` 与 `public/index.html`
- 在引入 `js/supabase.js` 的 `<script>` 之前插入：
```html
<script>
  window.__SUPABASE_CONFIG = {
    url: 'https://bcsjxvhzoufzqzupygyl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...hqW92LKNOVDN9QohpyhxdUNt5r1A4FbLzX8Vg-bihZc'
  };
</script>
```

2) 更新 `js/supabase.js` 使用注入值
- 顶部：
```js
const injected = (typeof window !== 'undefined' && window.__SUPABASE_CONFIG) ? window.__SUPABASE_CONFIG : {};
const SUPABASE_URL = injected.url;
const SUPABASE_ANON_KEY = injected.anonKey;
```
- 创建客户端：
```js
client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});
```
- 若缺失配置，给出明确提示（替代“Failed to fetch”）：
```js
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase 未配置：缺少 url 或 anonKey');
  return;
}
```

3) 重新部署到 Vercel（线上环境）
- 执行部署并刷新线上页面，使新脚本生效

## 验证与排查
- 控制台检查：`window.__SUPABASE_CONFIG` 显示真实值
- Health 检查：`fetch('https://bcsjxvhzoufzqzupygyl.supabase.co/auth/v1/health').then(r=>r.status)` 返回 200
- 登录成功后测试：保存报告 → 我的报告 → 查看报告
- 若仍失败，查看 Network 是否仍指向占位域名；如被浏览器/网络拦截，提示更换网络或关闭拦截扩展

## 影响范围与回滚
- 仅前端脚本与页面，后端/数据库不变
- 如需回滚，删除注入脚本并还原 `supabase.js` 的旧读取逻辑即可

确认后我将直接实施上述修改（编辑文件、部署并验证），并把最终登录与报告查看结果反馈给你。