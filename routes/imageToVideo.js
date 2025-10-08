const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app, upload) => {
  app.post('/api/image-to-video', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Missing image file.' });

    const id = crypto.randomBytes(8).toString('hex');
    const imagePath = req.file.path;
    const duration = Number(req.body.duration) || 8;
    const [width, height] = [1080, 1920];
    const outputFilename = `step1-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      const scale_w = Math.round(width * 1.5);
      const frames = duration * 30;
      const halfFrames = Math.floor(frames / 2);
      const halfDuration = duration / 2;
      const baseEase = `1.05+0.20*(0.5-0.5*cos(PI*on/${frames}))`;
      const secondHalfBoost = `0.10*if(gt(on,${halfFrames}),(on-${halfFrames})/${halfFrames},0)`;
      const zoomExpr = `min(1.35,${baseEase}+${secondHalfBoost})`;
      const content_h = Math.round(height * 0.60);
      const pad_y = Math.round(height * 0.20);
      const vf = `scale=${scale_w}:-1,zoompan=z='${zoomExpr}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${content_h},pad=${width}:${height}:0:${pad_y}:color=black,gblur=sigma=8:steps=2:enable='between(t,0,${halfDuration})',fade=t=in:st=0:d=${halfDuration},noise=c0s=8:c1s=8:c2s=8:allf=t,eq=contrast=1.05:saturation=0.95,vignette`;
      
      await runFFmpegCommand(['-loop','1','-framerate','30','-i',imagePath,'-vf',vf,'-c:v','libx264','-t',String(duration),'-pix_fmt','yuv420p','-y',outputPath]);
      
      res.status(200).json({ 
        message: 'Step 1 complete. Video created from image.', 
        id: id,
        outputFilename: outputFilename 
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed during video creation.', details: e.message });
    } finally { 
      fs.unlink(imagePath, () => {}); 
    }
  });
};