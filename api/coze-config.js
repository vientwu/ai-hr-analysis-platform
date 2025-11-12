export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const pat = process.env.COZE_PAT || '';
    const resumeWorkflowId = process.env.COZE_RESUME_WORKFLOW_ID || '7513777402993016867';
    const interviewWorkflowId = process.env.COZE_INTERVIEW_WORKFLOW_ID || '7514884191588745254';
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ pat, resumeWorkflowId, interviewWorkflowId });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
