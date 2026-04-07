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
    const isRtf = ext.endsWith('.rtf') || mime === 'text/rtf' || mime === 'application/rtf';
    const isImage = (mime || '').startsWith('image/') || ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg');

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

    const parsePdfText = async () => {
      try {
        const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.js');
        const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
        const pageCount = doc.numPages || 0;
        const maxPages = Math.min(30, pageCount);
        let text = '';
        for (let i = 1; i <= maxPages; i++) {
          try {
            const page = await doc.getPage(i);
            const content = await page.getTextContent({ normalizeWhitespace: true });
            const s = String((content.items || []).map(it => it.str).join(' ')).trim();
            if (s) text += s + '\n\n';
          } catch {}
        }
        return text.trim();
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
            const xobjIndices = ops.fnArray
              .map((f, idx) => (f === pdfjsLib.OPS.paintImageXObject || f === pdfjsLib.OPS.paintJpegXObject) ? idx : null)
              .filter((x) => x !== null);
            const inlineIndices = ops.fnArray
              .map((f, idx) => (f === pdfjsLib.OPS.paintInlineImageXObject) ? idx : null)
              .filter((x) => x !== null);
            let foundAnyImage = false;
            for (const idx of xobjIndices) {
              const name = ops.argsArray[idx][0];
              const img = await new Promise((resolve) => page.objs.get(name, (arg) => resolve(arg)));
              if (!img || !img.width || !img.height || !img.data) continue;
              foundAnyImage = true;
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
            // 处理内联图片
            for (const idx of inlineIndices) {
              const arg = ops.argsArray[idx];
              let w = 0, h = 0, data = null;
              // 常见结构：arg[0] 为对象 { width, height, data }
              if (arg && arg[0] && typeof arg[0] === 'object') {
                w = Number(arg[0].width || 0);
                h = Number(arg[0].height || 0);
                data = arg[0].data || null;
              } else if (arg && typeof arg === 'object') {
                w = Number(arg.width || 0);
                h = Number(arg.height || 0);
                data = arg.data || null;
              }
              if (w > 0 && h > 0 && data && data.length) {
                foundAnyImage = true;
                const png = new PNG({ width: w, height: h });
                const dst = png.data;
                // 尝试 RGB 或 RGBA 两种布局
                if (data.length === w * h * 3) {
                  let s = 0; let d = 0;
                  while (s < data.length) {
                    dst[d++] = data[s++];
                    dst[d++] = data[s++];
                    dst[d++] = data[s++];
                    dst[d++] = 255;
                  }
                } else if (data.length === w * h * 4) {
                  dst.set(data);
                } else {
                  continue;
                }
                const buf = PNG.sync.write(png);
                let lang = 'chi_sim+eng';
                let ocr = await Tesseract.recognize(buf, lang, { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' }).catch(async () => {
                  lang = 'eng';
                  return await Tesseract.recognize(buf, lang, { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' });
                });
                const imgText = String(ocr?.data?.text || '').trim();
                if (imgText) text += imgText + '\n\n';
              }
            }
            // 若本页未识别到图片，尝试直接获取文字内容
            if (!foundAnyImage) {
              try {
                const content = await page.getTextContent({ normalizeWhitespace: true });
                const s = String((content.items || []).map(it => it.str).join(' ')).trim();
                if (s) text += s + '\n\n';
              } catch {}
            }
          } catch {}
        }
        return text.trim();
      } catch (e) {
        return '';
      }
    };

    const parseImage = async () => {
      try {
        const Tesseract = (await import('tesseract.js')).default;
        let lang = 'chi_sim+eng';
        let ocr = await Tesseract.recognize(buffer, lang, { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' }).catch(async () => {
          lang = 'eng';
          return await Tesseract.recognize(buffer, lang, { logger: () => {}, langPath: 'https://tessdata.projectnaptha.com/4.0.0' });
        });
        const imgText = String(ocr?.data?.text || '').trim();
        return imgText;
      } catch (e) {
        return '';
      }
    };

    const parseRtf = async () => {
      try {
        const s = buffer.toString('latin1');
        let t = s.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => Buffer.from(hex, 'hex').toString('utf8'));
        t = t.replace(/\\par[d]?/g, '\n');
        t = t.replace(/\\u-?\d+/g, '');
        t = t.replace(/\\[a-z]+-?\d*/gi, '');
        t = t.replace(/[{}]/g, '');
        t = t.replace(/\n{2,}/g, '\n');
        return t.trim();
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
    let hint = '';
    let usedOcr = false;
    if (isTxt) text = await parseTxt();
    else if (isPdf) {
      text = await parsePdf();
      if (!text || !text.trim()) {
        text = await parsePdfText();
      }
      if (!text || !text.trim()) {
        text = await parsePdfOcr();
        usedOcr = !!text && !!text.trim();
      }
    }
    else if (isDocx) text = await parseDocx();
    else if (isRtf) text = await parseRtf();
    else if (isImage) text = await parseImage();
    else if (ext.endsWith('.doc') || mime === 'application/msword') { text = ''; hint = 'DOC 格式为旧版二进制文档，建议转换为 DOCX 再上传'; }
    else text = '';

    if (!text || !text.trim()) {
      return res.status(422).json({ error: 'Parse failed', hint: hint || '请使用 DOCX/TXT 或文本型 PDF；扫描件将走 OCR，清晰度需足够' });
    }
    return res.status(200).json({ text, meta: { filename, mime, length: text.length, ocr: usedOcr } });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Internal Server Error' });
  }
}
