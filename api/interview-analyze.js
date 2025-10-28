// Vercel Serverless Function: 面试分析
// 接收 { fileBase64, fileName, name, recordingUrl }，将文件上传到 Coze，并触发面试分析工作流

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
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, message: 'interview-analyze is alive. Use POST.' });
    }
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST,OPTIONS,GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const rawBody = await readRequestBody(req);
    let payload = {};
    try {
      payload = rawBody ? JSON.parse(rawBody) : {};
    } catch (err) {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }

    const { fileBase64, fileName = 'transcript.pdf', name = '', recordingUrl = '' } = payload;
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

    const uploadResp = await fetch('https://api.coze.cn/v1/files/upload', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.COZE_PAT}` },
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

    const runResp = await fetch('https://api.coze.cn/v1/workflow/run', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.COZE_PAT}`,
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
    const data = runJson?.data || runJson?.result || runJson?.output || runJson;
    return res.status(200).json({ success: true, data, debug: { workflow_id: interviewWorkflowId, file_id: fileId } });
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