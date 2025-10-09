const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR, MODES, DEFAULTS } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app, upload) => {
  app.post('/api/image-to-video', upload.single('image'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Missing image file.' });

    const id = crypto.randomBytes(8).toString("hex");
    const imagePath = req.file.path;
    const duration = Number(req.body.duration) || DEFAULTS.duration;
    const mode = req.body.mode || "kenburns";
    const width = 1080;
    const height = 1920;
    const { framerate } = DEFAULTS;
    const outputFilename = `step1-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      const preset = MODES[mode] || MODES.calm;
      const scale_w = Math.round(width * 1.5);
      const frames = duration * framerate;
      const halfFrames = Math.floor(frames / 2);
      const halfDuration = duration / 2;
      const baseEase = `1.05+0.20*(0.5-0.5*cos(PI*on/${frames}))`;
      const secondHalfBoost = `0.10*if(gt(on,${halfFrames}),(on-${halfFrames})/${halfFrames},0)`;
      const zoomExpr = `min(1.35,${baseEase}+${secondHalfBoost})`;
      const content_h = Math.round(height * 0.60);
      const pad_y = Math.round(height * 0.2);
      const blur = preset.blur || 4;

      const vf_chains = [
        `scale=${scale_w}:-1`,
        `zoompan=z='${zoomExpr}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${content_h}`,
        `pad=${width}:${height}:0:${pad_y}:color=black`,
        `gblur=sigma=${blur}:steps=2:enable='between(t,0,${halfDuration})'`,
        `fade=t=in:st=0:d=${halfDuration}`,
      ];

      let eq_chain = `eq=contrast=${preset.contrast}:saturation=${preset.saturation}`;
      if (preset.flicker) {
        eq_chain += `:gamma='1.0+${preset.flicker}*random(n)'`;
      }
      vf_chains.push(eq_chain);

      if (preset.vignette) {
        vf_chains.push('vignette');
      }
      if (preset.sepia) {
        vf_chains.push('colorchannelmixer=.393:.769:.189:0:.349:.686:.168:0:.272:.534:.131');
      }
      if (preset.noise) {
        vf_chains.push(`noise=alls=${preset.noise}:allf=t`);
      }

      const vf = vf_chains.join(',');

      console.log('🖼️ Starting image to video conversion...');
      
      await runFFmpegCommand([
        "-loop", "1",
        "-framerate", framerate,
        "-i", imagePath,
        "-vf", vf,
        "-c:v", "libx264",
        "-t", String(duration),
        "-pix_fmt", "yuv420p",
        "-y", outputPath
      ], (timeMs) => {
        const currentTime = timeMs / 1000000; // Convert microseconds to seconds
        const percent = Math.min(100, Math.round((currentTime / duration) * 100));
        console.log(`🖼️ Image to Video Processing: ${percent}% complete`);
      });
      
      console.log('✅ Image to video conversion completed successfully');
      
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
