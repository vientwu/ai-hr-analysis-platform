// Vercel Serverless Function: 简历分析
// 接收 { fileBase64, fileName, jd }，将文件上传到 Coze，并触发工作流
import { STATIC_SECRETS } from '../secrets.js';

// 统一设置 CORS，支持从 4321 端口页面跨域请求到 3000 端口函数
function setCORSHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS,GET');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
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

    // 读取原始请求体（避免不同平台解析差异）
    const rawBody = await readRequestBody(req);
    let payload = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { fileBase64, fileName = 'resume.pdf', jd = '', prompt = '' } = payload;
    const COZE_PAT = process.env.COZE_PAT || STATIC_SECRETS.COZE_PAT;
    if (!COZE_PAT) {
      return res.status(500).json({ error: 'COZE_PAT is not set (env or STATIC_SECRETS.COZE_PAT)' });
    }
    if (!fileBase64) {
      return res.status(400).json({ error: 'fileBase64 is required' });
    }

    // 将 base64 转为 Blob 并上传到 Coze
    const blob = base64ToBlob(fileBase64);
    const formData = new FormData();
    formData.append('file', blob, fileName);

    const uploadResp = await fetch('https://api.coze.cn/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${COZE_PAT}` },
      body: formData,
    });

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
    const resumeWorkflowId =
      process.env.COZE_RESUME_WORKFLOW_ID || STATIC_SECRETS.COZE_RESUME_WORKFLOW_ID || '7513777402993016867';
    const requestData = {
      workflow_id: resumeWorkflowId,
      parameters: {
        files: [JSON.stringify({ file_id: fileId })],
        JD: prompt ? `${jd}\n\n[提示词]\n${prompt}` : jd,
        PROMPT: prompt,
        instructions: prompt,
      },
    };

    const runResp = await fetch('https://api.coze.cn/v1/workflow/run', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${COZE_PAT}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestData),
    });

    if (!runResp.ok) {
      const text = await runResp.text();
      return res.status(runResp.status).json({ error: 'Workflow run failed', details: text });
    }

    const runJson = await runResp.json();
    // 尽量兼容前端解析：将主要内容放在 data 字段
    const data = runJson?.data || runJson?.result || runJson?.output || runJson;
    return res.status(200).json({ success: true, data, debug: { workflow_id: resumeWorkflowId, file_id: fileId } });
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
