const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR, UPLOADS_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');
const { downloadFile } = require('../utils/downloader');

module.exports = (app, upload) => {
  app.post('/api/add-text-overlay', upload.single('font'), async (req, res) => {
    const { videoFilename, text, fontUrl } = req.body;
    if ((!req.file && !fontUrl) || !videoFilename || !text) {
      return res.status(400).json({ error: 'Missing font (file or fontUrl), videoFilename, or text.' });
    }
    const inputVideoPath = path.join(OUTPUTS_DIR, videoFilename);
    if (!fs.existsSync(inputVideoPath)) return res.status(404).json({ error: 'Input video file not found.' });
    const uid = crypto.randomBytes(8).toString('hex');
    const outputFilename = `step2_text_${uid}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);
    let fontPath;
    try {
      if (req.file) fontPath = req.file.path; else { fontPath = path.join(UPLOADS_DIR, `font-${uid}.ttf`); await downloadFile(fontUrl, fontPath); }
      const esc = String(text).replace(/\\/g,'\\\\').replace(/:/g,'\\:').replace(/'/g,"\\'");
      const norm = (c,f)=>{ const s=String(c||f||'white'); if(s.startsWith('#')){const [h,a]=s.split('@'); const b='0x'+h.slice(1); return a?`${b}@${a}`:b;} return s; };
      const pos=(req.body.position||'bottom').toLowerCase(); const align=(req.body.align||'center').toLowerCase();
      const fontSize=Number(req.body.fontSize)||80; const fontColor=norm(req.body.fontColor,'white'); const borderColor=norm(req.body.borderColor,'black');
      const borderw=Number(req.body.borderw)||8; const margin=Number(req.body.margin)||40;
      const safe=req.body.useContentSafeArea===true||req.body.useContentSafeArea==='true';
      const box=req.body.box===true||req.body.box==='true'; const boxColor=norm(req.body.boxColor,'black@0.5'); const boxBorderw=Number(req.body.boxBorderw)||10;
      const shadow=req.body.shadow===true||req.body.shadow==='true'; const shadowColor=norm(req.body.shadowColor,'black'); const shadowX=Number(req.body.shadowX)||2; const shadowY=Number(req.body.shadowY)||2;
      const lineSpacing=Number(req.body.lineSpacing)||0; const fadeInDuration=Number(req.body.fadeInDuration)||0;
      let xExpr = align==='left'?`${margin}`:align==='right'?`w-text_w-${margin}`:`(w-text_w)/2`;
      const top='h*0.2', bottom='h*0.8'; let yExpr;
      if(safe){ yExpr = pos==='top'?`${top}+${margin}`:pos==='middle'?`h*0.2 + (h*0.6 - text_h)/2`:`${bottom}-text_h-${margin}`; }
      else { yExpr = pos==='top'?`${margin}`:pos==='middle'?`(h-text_h)/2`:`h-text_h-${margin}`; }
      const alpha = fadeInDuration>0?`:alpha='if(lt(t,${fadeInDuration}),t/${fadeInDuration},1)'`:'';
      let params = `fontfile=${fontPath}:text='${esc}':fontcolor=${fontColor}:bordercolor=${borderColor}:borderw=${borderw}:fontsize=${fontSize}:x=${xExpr}:y=${yExpr}`;
      if(lineSpacing) params += `:line_spacing=${lineSpacing}`; if(box) params += `:box=1:boxcolor=${boxColor}:boxborderw=${boxBorderw}`; if(shadow) params += `:shadowcolor=${shadowColor}:shadowx=${shadowX}:shadowy=${shadowY}`; params += alpha;
      await runFFmpegCommand(['-i', inputVideoPath, '-vf', `drawtext=${params}`, '-c:v', 'libx264', '-c:a', 'copy', '-pix_fmt', 'yuv420p', '-y', outputPath]);
      res.status(200).json({ message: 'Step 2 complete. Text overlay added.', outputFilename });
    } catch (e) {
      res.status(500).json({ error: 'Failed to add text overlay.', details: e.message });
    } finally { if (fontPath) fs.unlink(fontPath, () => {}); }
  });
};