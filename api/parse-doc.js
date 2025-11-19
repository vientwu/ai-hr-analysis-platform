export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ error: 'Method Not Allowed' });
    }
    const bodyText = await new Promise((resolve) => {
      let data = '';
      req.on('data', (chunk) => { data += chunk; });
      req.on('end', () => resolve(data));
    });
    let payload = {};
    try { payload = JSON.parse(bodyText || '{}'); } catch { payload = {}; }
    const { filename = 'unknown', mime = '', dataBase64 = '' } = payload;
    if (!dataBase64) return res.status(400).json({ error: 'Missing dataBase64' });
    const buffer = Buffer.from(dataBase64, 'base64');

    const ext = (filename || '').toLowerCase();
    const isPdf = ext.endsWith('.pdf') || mime === 'application/pdf';
    const isDocx = ext.endsWith('.docx') || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    const isTxt = ext.endsWith('.txt') || mime === 'text/plain';

    const parseTxt = async () => buffer.toString('utf-8');

    const parsePdf = async () => {
      try {
        const pdfParse = (await import('pdf-parse')).default;
        const result = await pdfParse(buffer);
        return String(result?.text || '');
      } catch (e) {
        return '';
      }
    };

    const parsePdfOcr = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        const { PNG } = await import('pngjs');
        const Tesseract = (await import('tesseract.js')).default;
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const pageCount = doc.numPages || 0;
        const maxPages = Math.min(10, pageCount);
        let text = '';
        for (let i = 1; i <= maxPages; i++) {
          try {
            const page = await doc.getPage(i);
            const ops = await page.getOperatorList();
            const indices = ops.fnArray
              .map((f, idx) => (f === pdfjsLib.OPS.paintImageXObject || f === pdfjsLib.OPS.paintJpegXObject) ? idx : null)
              .filter((x) => x !== null);
            for (const idx of indices) {
              const name = ops.argsArray[idx][0];
              const img = await new Promise((resolve) => page.objs.get(name, (arg) => resolve(arg)));
              if (!img || !img.width || !img.height || !img.data) continue;
              const png = new PNG({ width: img.width, height: img.height });
              const src = img.data;
              const dst = png.data;
              if (src.length === img.width * img.height * 3) {
                let s = 0; let d = 0;
                while (s < src.length) {
                  dst[d++] = src[s++];     // R
                  dst[d++] = src[s++];     // G
                  dst[d++] = src[s++];     // B
                  dst[d++] = 255;          // A
                }
              } else if (src.length === img.width * img.height * 4) {
                dst.set(src);
              } else {
                continue;
              }
              const buf = PNG.sync.write(png);
              let lang = 'chi_sim+eng';
              let ocr = await Tesseract.recognize(buf, lang, {
                logger: () => {},
                langPath: 'https://tessdata.projectnaptha.com/4.0.0'
              }).catch(async () => {
                lang = 'eng';
                return await Tesseract.recognize(buf, lang, {
                  logger: () => {},
                  langPath: 'https://tessdata.projectnaptha.com/4.0.0'
                });
              });
              const imgText = String(ocr?.data?.text || '').trim();
              if (imgText) text += imgText + '\n\n';
            }
          } catch {}
        }
        return text.trim();
      } catch (e) {
        return '';
      }
    };

    const parseDocx = async () => {
      try {
        const mammoth = (await import('mammoth')).default;
        const res = await mammoth.extractRawText({ buffer });
        return String(res?.value || '');
      } catch (e) {
        return '';
      }
    };

    let text = '';
    let usedOcr = false;
    if (isTxt) text = await parseTxt();
    else if (isPdf) {
      text = await parsePdf();
      if (!text || !text.trim()) {
        text = await parsePdfOcr();
        usedOcr = !!text && !!text.trim();
      }
    }
    else if (isDocx) text = await parseDocx();
    else text = '';

    if (!text || !text.trim()) {
      return res.status(422).json({ error: 'Parse failed', hint: 'Prefer DOCX/TXT or text-based PDF; scanned PDFs require OCR' });
    }
    return res.status(200).json({ text, meta: { filename, mime, length: text.length, ocr: usedOcr } });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
