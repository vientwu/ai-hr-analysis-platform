// Health check endpoint for Vercel Serverless Functions
// Unified default export style to match other API routes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    const time = new Date().toISOString();
    const runtime = process.version; // e.g. v22.x
    const nodeEnv = process.env.NODE_ENV || 'unknown';
    const vercelEnv = process.env.VERCEL_ENV || (process.env.VERCEL ? 'vercel' : 'unknown');
    const version = process.env.APP_VERSION || process.env.npm_package_version || 'unknown';

    res.status(200).json({
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
    res.status(500).json({ ok: false, message: 'health check failed', error: error?.message });
  }
}