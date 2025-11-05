// Vercel Serverless Function: 简历分析
// 接收 { fileBase64, fileName, jd }，将文件上传到 Coze，并触发工作流

// 统一设置 CORS，支持从 4321 端口页面跨域请求到 3000 端口函数
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// 封装带超时的 fetch，避免外部服务（Coze）网络阻塞导致请求长期挂起
// 默认超时从环境变量读取：
// - COZE_UPLOAD_TIMEOUT_MS：文件上传超时（默认 60000ms）
// - COZE_WORKFLOW_TIMEOUT_MS：工作流运行超时（默认 120000ms）
// 如未指定则可以在调用处传入具体值。
function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const opts = { ...options, signal: controller.signal };
  return fetch(url, opts).finally(() => clearTimeout(timer));
}

export default async function handler(req, res) {
  try {
    setCORSHeaders(res);
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    // 允许直接 GET 获取健康检查，避免用户误访问时误解
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, message: 'resume-analyze is alive. Use POST.' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST,OPTIONS,GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    // 读取请求体：优先使用 Express 已解析的 req.body，避免因上游中间件已消费流而挂起
    let payload = {};
    if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
      payload = req.body;
    } else {
      const rawBody = await readRequestBody(req);
      try {
        payload = rawBody ? JSON.parse(rawBody) : {};
      } catch (err) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const { fileBase64, fileName = 'resume.pdf', jd = '' } = payload;
    // 可选：开启 MOCK_MODE 时直接返回模拟结果，便于前端联调不依赖外部服务
    if (process.env.MOCK_MODE === 'true') {
      return res.status(200).json({
        success: true,
        data: {
          summary: 'Mock 简历分析结果',
          match_score: 0.86,
          strengths: ['熟悉 JavaScript', '有 React 项目经验'],
          weaknesses: ['缺少 TypeScript 系统化经验'],
        },
        message: '简历分析完成 (MOCK_MODE)',
        debug: { mock: true }
      });
    }
    // 请求到达日志（便于定位卡住点，不打印内容，仅打印长度与文件名）
    console.log('resume-analyze: request received', {
      fileName,
      jdLen: typeof jd === 'string' ? jd.length : 0,
      base64Len: typeof fileBase64 === 'string' ? fileBase64.length : 0,
    });
    if (!process.env.COZE_PAT) {
      return res.status(500).json({ error: 'COZE_PAT is not set in environment variables' });
    }
    if (!fileBase64) {
      return res.status(400).json({ error: 'fileBase64 is required' });
    }

    // 将 base64 转为 Blob 并上传到 Coze
    const blob = base64ToBlob(fileBase64);
    const formData = new FormData();
    formData.append('file', blob, fileName);

    // 从环境变量读取更长的上传与工作流超时，避免 504（外部服务慢/文件较大时）
    const UPLOAD_TIMEOUT_MS = Number(process.env.COZE_UPLOAD_TIMEOUT_MS || process.env.UPLOAD_TIMEOUT_MS || 60000);
    const WORKFLOW_TIMEOUT_MS = Number(process.env.COZE_WORKFLOW_TIMEOUT_MS || process.env.WORKFLOW_TIMEOUT_MS || 120000);

    let uploadResp;
    try {
      uploadResp = await fetchWithTimeout('https://api.coze.cn/v1/files/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.COZE_PAT}` },
        body: formData,
      }, UPLOAD_TIMEOUT_MS);
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return res.status(504).json({ error: 'Upload timeout', details: 'Coze files/upload timed out' });
      }
      throw e;
    }

    if (!uploadResp.ok) {
      const err = await uploadResp.text();
      return res.status(uploadResp.status).json({ error: 'Upload failed', details: err });
    }
    const uploadJson = await uploadResp.json();
    const fileId = uploadJson?.data?.file_id || uploadJson?.data?.id || uploadJson?.file_id || uploadJson?.id;
    if (!fileId) {
      return res.status(502).json({ error: 'No file_id returned from upload' });
    }

    // 触发工作流（简历分析）
    const resumeWorkflowId = process.env.COZE_RESUME_WORKFLOW_ID || '7513777402993016867';
    const requestData = {
      workflow_id: resumeWorkflowId,
      parameters: {
        files: [JSON.stringify({ file_id: fileId })],
        JD: jd,
      },
    };

    let runResp;
    try {
      runResp = await fetchWithTimeout('https://api.coze.cn/v1/workflow/run', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.COZE_PAT}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(requestData),
      }, WORKFLOW_TIMEOUT_MS);
    } catch (e) {
      if (e && e.name === 'AbortError') {
        return res.status(504).json({ error: 'Workflow run timeout', details: 'Coze workflow/run timed out' });
      }
      throw e;
    }

    if (!runResp.ok) {
      const text = await runResp.text();
      return res.status(runResp.status).json({ error: 'Workflow run failed', details: text });
    }

    const runJson = await runResp.json();
    // 尽量兼容前端解析：将主要内容放在 data 字段
    const data = runJson?.data || runJson?.result || runJson?.output || runJson;
    return res.status(200).json({ 
      success: true, 
      data, 
      message: '简历分析完成',
      saveToDatabase: {
        fileName: fileName,
        jobDescription: jd,
        workflowRunId: runJson?.execute_id || runJson?.id,
        conversationId: runJson?.conversation_id,
        result: data
      },
      debug: { workflow_id: resumeWorkflowId, file_id: fileId } 
    });
  } catch (err) {
    console.error('resume-analyze error:', {
      message: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}

// 工具函数：读取请求体
function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// 将 base64 转 Blob（Node 18 支持 Blob/FormData）
function base64ToBlob(base64) {
  const buffer = Buffer.from(base64, 'base64');
  return new Blob([buffer]);
}