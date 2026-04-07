## 问题诊断
- 报告页仍提示“请先登录”：iframe 中的 `report.html` 加载较早，`window.Auth.getSession()` 尚未返回，`fetchReport` 立即判断为未登录。
- “下载”下拉不显示：可能是事件未绑定或样式层级不足导致展示失败。
- 列表卡片下载为独立按钮：不含 PDF 导出且交互不统一。

## 目标
- 报告页在用户已登录时能正确读取 Supabase 报告，不再误提示未登录。
- 报告页“下载”下拉稳定显示，并包含 Markdown/Word/PDF。
- “我的报告”列表卡片的下载改为下拉按钮，并新增 PDF 导出。

## 实施方案
1) 报告页登录提示修复
- 在 `js/report.js`（以及 `public/js/report.js`）中：
  - `fetchReport` 先调用 `window.Auth.getClient()?.auth.getSession()` 获取会话；若暂无用户，挂载一次性 `auth-changed` 监听器，待会话就绪后自动重试。
  - 保留 `local=1` 逻辑，未登录时展示登录提示。

2) 报告页下拉下载稳定性
- 确认并强化事件绑定：点击“下载”切换 `.dropdown.open`，文档级点击在外部时关闭；
- 样式：提高 `.dropdown-menu` 的 `z-index` 并确保父容器 `position: relative`，避免被遮挡。

3) 列表卡片下拉下载与 PDF
- 在 `js/main.js` 和 `public/js/main.js` 的“我的报告”渲染模板中，将两颗下载按钮替换为一个下拉（Markdown/Word/PDF）；
- 在 `index.html` 和 `public/index.html` 引入 `html2pdf` CDN；
- 新增 `downloadSavedPdf(title, content)`：将 Markdown 渲染为 HTML（用现有 `renderMarkdown`），用 `html2pdf` 生成并保存 PDF；
- 为动态生成的下拉项使用内联 `onclick` 调现有 `downloadSavedMarkdown/Docx/Pdf`，无需额外事件委托。

4) 验证
- 登录后从列表点击“查看报告”，弹窗报告页正常显示数据，无“请先登录”；
- 报告页“下载”下拉展开正常，三项功能可用；
- 列表卡片“下载”下拉包含三项并正常导出。

## 影响范围
- 仅前端页面与脚本，后端/数据库不变；符合当前项目结构和样式体系。

## 备注
- 如需保留更严格的远程注销，可继续使用之前的“本地优先、远程可选”方案（已说明）。