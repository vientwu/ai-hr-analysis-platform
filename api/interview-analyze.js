// Vercel Serverless Function: 面试分析
// 接收 { fileBase64, fileName, name, recordingUrl }，将文件上传到 Coze，并触发面试分析工作流

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
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, message: 'interview-analyze is alive. Use POST.' });
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

    const { fileBase64, fileName = 'transcript.pdf', name = '', recordingUrl = '' } = payload;
    // 可选：开启 MOCK_MODE 时直接返回模拟结果，便于前端联调不依赖外部服务
    if (process.env.MOCK_MODE === 'true') {
      return res.status(200).json({
        success: true,
        data: {
          summary: 'Mock 面试分析结果',
          sentiment: 'positive',
          key_points: ['沟通清晰', '技术理解到位'],
        },
        message: '面试分析完成 (MOCK_MODE)',
        debug: { mock: true }
      });
    }
    if (!process.env.COZE_PAT) {
      return res.status(500).json({ error: 'COZE_PAT is not set in environment variables' });
    }
    if (!fileBase64) {
      return res.status(400).json({ error: 'fileBase64 is required' });
    }

    // 上传面试转写 PDF 到 Coze
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

    // 触发工作流（面试分析）
    const interviewWorkflowId = process.env.COZE_INTERVIEW_WORKFLOW_ID || '7514884191588745254';
    const requestData = {
      workflow_id: interviewWorkflowId,
      parameters: {
        recording_file: JSON.stringify({ file_id: fileId }),
        name,
        recording_url: recordingUrl,
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
    const data = runJson?.data || runJson?.result || runJson?.output || runJson;
    return res.status(200).json({ 
      success: true, 
      data, 
      message: '面试分析完成',
      saveToDatabase: {
        fileName: fileName,
        candidateName: name,
        recordingUrl: recordingUrl,
        workflowRunId: runJson?.workflow_run_id || runJson?.run_id,
        conversationId: runJson?.conversation_id,
        result: data
      },
      debug: { workflow_id: interviewWorkflowId, file_id: fileId } 
    });
  } catch (err) {
    console.error('interview-analyze error:', {
      message: err?.message,
      stack: err?.stack,
    });
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function base64ToBlob(base64) {
  const buffer = Buffer.from(base64, 'base64');
  return new Blob([buffer]);
}