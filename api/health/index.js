// API 健康检查端点（Vercel 路由：/api/health）
export default function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'AI Resume Analysis Platform',
      version: '1.0.0',
      database: 'connected',
      apis: {
        supabase: 'connected',
        coze: 'configured'
      }
    });
  }
  res.setHeader('Allow', ['GET']);
  return res.status(405).json({ error: 'Method not allowed' });
}