// Health check endpoint for Vercel Serverless Functions (file route)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  try {
    const time = new Date().toISOString();
    const runtime = process.version;
    const nodeEnv = process.env.NODE_ENV || 'unknown';
    const vercelEnv = process.env.VERCEL_ENV || (process.env.VERCEL ? 'vercel' : 'unknown');
    const version = process.env.APP_VERSION || process.env.npm_package_version || 'unknown';

    return res.status(200).json({
      ok: true,
      message: 'healthy',
      service: 'ai-hr-analysis-platform',
      time,
      version,
      runtime,
      env: nodeEnv,
      vercelEnv,
    });
  } catch (error) {
    return res.status(500).json({ ok: false, message: 'health check failed', error: error?.message });
  }
}