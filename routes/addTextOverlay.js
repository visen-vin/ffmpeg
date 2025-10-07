const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR, UPLOADS_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');
const { downloadFile } = require('../utils/downloader');
const sharp = require('sharp');

module.exports = (app, upload) => {
  app.post('/api/add-text-overlay', upload.single('font'), async (req, res) => {
    const { videoFilename, text, fontUrl } = req.body;
    if (!videoFilename || !text) {
      return res.status(400).json({ error: 'Missing videoFilename or text.' });
    }
    const inputVideoPath = path.join(OUTPUTS_DIR, videoFilename);
    if (!fs.existsSync(inputVideoPath)) return res.status(404).json({ error: 'Input video file not found.' });
    const uid = crypto.randomBytes(8).toString('hex');
    const outputFilename = `step2_text_${uid}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);
    const overlayPath = path.join(UPLOADS_DIR, `overlay-${uid}.png`);
    let fontPath;
    try {
      // Font handling (optional)
      if (req.file) {
        fontPath = req.file.path;
      } else if (fontUrl) {
        fontPath = path.join(UPLOADS_DIR, `font-${uid}.ttf`);
        await downloadFile(fontUrl, fontPath);
      }

      // Parse styling options
      const W = 1080, H = 1920; // default canvas size (matches step 1 output)
      const pos = String(req.body.position || 'bottom').toLowerCase();
      const align = String(req.body.align || 'center').toLowerCase();
      const margin = Number(req.body.margin) || 40;
      const fontSize = Number(req.body.fontSize) || 80;
      const fontColor = String(req.body.fontColor || '#ffffff');
      const borderColor = String(req.body.borderColor || '#000000');
      const borderw = Number(req.body.borderw) || 8;
      const box = req.body.box === true || req.body.box === 'true';
      const boxColorRaw = String(req.body.boxColor || '#000000@0.5');
      const boxBorderw = Number(req.body.boxBorderw) || 10;
      const shadow = req.body.shadow === true || req.body.shadow === 'true';
      const shadowColor = String(req.body.shadowColor || '#000000');
      const shadowX = Number(req.body.shadowX) || 2;
      const shadowY = Number(req.body.shadowY) || 2;
      const shadowBlur = Number(req.body.shadowBlur) || 4;
      const lineSpacing = Number(req.body.lineSpacing) || 0;
      const fadeInDuration = Number(req.body.fadeInDuration) || 0;
      const safe = req.body.useContentSafeArea === true || req.body.useContentSafeArea === 'true';
      const fontFamily = String(req.body.fontFamily || 'UserFont, Georgia, serif');
      // Add debug overlay export flag
      const debugOverlay = req.body.debugOverlay === true || req.body.debugOverlay === 'true';
      let overlayDebugFilename;

      const toRgba = (c) => {
        const s = String(c || '#ffffff');
        if (s.includes('@')) {
          const [hex, a] = s.split('@');
          if (hex.startsWith('#') && (hex.length === 7 || hex.length === 4)) {
            const h = hex.length === 7 ? hex.slice(1) : s.slice(1).split('').map((ch)=>ch+ch).join('');
            const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
            return `rgba(${r},${g},${b},${Number(a)})`;
          }
        }
        return s; // already a named color or #hex
      };

      // --- UPDATE: Handle multiline text ---
      const sanitizedLines = String(text)
        .split('\n')
        .map(line => line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'));
      
      const numLines = sanitizedLines.length;
      const lineHeight = fontSize * (1.2 + (lineSpacing / 100));
      const totalTextHeight = (numLines > 1) ? (lineHeight * (numLines - 1)) + fontSize : fontSize;
      const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
      const xText = align === 'left' ? margin : align === 'right' ? (W - margin) : (W / 2);
      
      const topY = safe ? (H * 0.2) + margin + fontSize : margin + fontSize;
      const midY = (H / 2) - (totalTextHeight / 2) + fontSize;
      const bottomY = safe ? (H * 0.8) - totalTextHeight + fontSize : H - margin - totalTextHeight + fontSize;
      const yText = pos === 'top' ? topY : pos === 'middle' ? midY : bottomY;

      const textElements = sanitizedLines.map((line, index) => {
        if (index === 0) return line; 
        return `<tspan x="${xText}" dy="${lineHeight}">${line}</tspan>`;
      }).join('');

      const boxWidth = W - (margin * 2);
      const boxHeight = totalTextHeight + (margin / 2);
      const boxX = margin;
      const boxY = yText - fontSize - (margin / 4);
      
      // --- FIX: Embed font as Base64 to ensure visibility ---
      let fontFace = '';
      if (fontPath && fs.existsSync(fontPath)) {
        const fontData = fs.readFileSync(fontPath);
        const fontBase64 = fontData.toString('base64');
        const fontMime = fontPath.endsWith('.otf') ? 'opentype' : 'truetype';
        fontFace = `@font-face { font-family: 'UserFont'; src: url(data:font/${fontMime};base64,${fontBase64}); }`;
      }

      const textShadowFilter = shadow ? `<filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="${shadowX}" dy="${shadowY}" stdDeviation="${shadowBlur}" flood-color="${shadowColor}"/></filter>` : '';
      
      const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">\n` +
        `<defs>\n${textShadowFilter}<style>${fontFace}</style>\n</defs>\n` +
        `<g>` +
          (box ? `<rect x="${boxX}" y="${boxY}" width="${boxWidth}" height="${boxHeight}" rx="16" ry="16" fill="${toRgba(boxColorRaw)}" stroke="${borderColor}" stroke-width="${boxBorderw}"/>` : '') +
          `<text x="${xText}" y="${yText}" font-family="${fontFamily}" font-size="${fontSize}" fill="${fontColor}" stroke="${borderColor}" stroke-width="${borderw}" text-anchor="${anchor}" ${shadow ? 'filter="url(#textShadow)"' : ''}>${textElements}</text>` +
        `</g>\n` +
        `</svg>`;

      // Render SVG to transparent PNG
      await sharp(Buffer.from(svg)).png().toFile(overlayPath);
      // If requested, export a copy of the overlay PNG to outputs for debugging
      if (debugOverlay && fs.existsSync(overlayPath)) {
        overlayDebugFilename = `overlay_debug_${uid}.png`;
        const overlayDebugPath = path.join(OUTPUTS_DIR, overlayDebugFilename);
        fs.copyFileSync(overlayPath, overlayDebugPath);
      }

      // Build FFmpeg filter: apply optional fade-in to overlay, then overlay on video
      const ovChain = fadeInDuration > 0 ? `format=rgba,fade=t=in:st=0:d=${fadeInDuration}:alpha=1` : 'format=rgba';
      const filterComplex = `[1:v]${ovChain}[ov];[0:v][ov]overlay=0:0:format=auto`;

      await runFFmpegCommand(['-i', inputVideoPath, '-loop', '1', '-i', overlayPath, '-filter_complex', filterComplex, '-c:v', 'libx264', '-c:a', 'copy', '-pix_fmt', 'yuv420p', '-shortest', '-y', outputPath]);
      res.status(200).json({ message: 'Step 2 complete. Text overlay added (Sharp SVG).', outputFilename, overlayDebugFilename });
    } catch (e) {
      res.status(500).json({ error: 'Failed to add text overlay.', details: e.message });
    } finally { 
      if (fontPath && fs.existsSync(fontPath)) fs.unlink(fontPath, () => {}); 
      if (fs.existsSync(overlayPath)) fs.unlink(overlayPath, () => {}); 
    }
  });
};