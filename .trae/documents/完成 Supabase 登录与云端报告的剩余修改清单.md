## 必改项（数据库策略）
- 为 `public.reports` 补齐 RLS 策略（截图显示只配了 INSERT/DELETE，缺少 SELECT/UPDATE）：
```sql
alter table public.reports enable row level security;
create policy "users can select own reports" on public.reports
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "users can update own