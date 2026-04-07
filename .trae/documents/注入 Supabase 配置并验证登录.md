## 操作步骤
1) 在页面里注入 Supabase 配置
- 打开 `index.html` 与 `public/index.html`
- 找到引入 `js/supabase.js` 的 `<script>` 标签
- 在其正上方插入如下脚本（使用你的真实 URL 与 anonKey）：
```html
<script>
  window.__SUPABASE_CONFIG = {
    url: 'https://bcsjxvhzoufzqzupygyl.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...hqW92LKNOVDN9QohpyhxdUNt5r1A4FbLzX8Vg-bihZc'
  };
</script>
```

2) 确认 `js/supabase.js` 使用该配置
- 文件顶部应类似：
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
- 若当前文件仍使用默认占位值或常量，请改成以上写法

3) 重新部署到 Vercel
- 执行 `vercel` / `vercel --prod` 或在控制台触发一次重新部署，使线上页面拿到最新脚本

## 验证
- 打开 `https://ai-hr-analysis-platform.vercel.app/`
- 控制台运行：
  - `window.__SUPABASE_CONFIG` 应显示你的 `url/anonKey`
  - `fetch('https://bcsjxvhzoufzqzupygyl.supabase.co/auth/v1/health').then(r=>r.status)` 应返回 `200`
- 右上角登录：应不再出现 `your-project-ref.supabase.co`，请求发往真实域名；登录成功后可保存/查看报告

## 注意
- 仅使用 anon key（安全），不要在前端暴露 service-role key
- 若仍 `Failed to fetch`，优先检查浏览器/网络是否拦截 `*.supabase.co` 域名；可换网络或关闭拦截扩展后重试