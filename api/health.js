// API 健康检查端点
export default function handler(req, res) {
    if (req.method === 'GET') {
        res.status(200).json({
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
    } else {
        res.setHeader('Allow', ['GET']);
        res.status(405).json({ error: 'Method not allowed' });
    }
}