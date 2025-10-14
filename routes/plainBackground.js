const path = require('path');
const crypto = require('crypto');
const { OUTPUTS_DIR, DEFAULTS } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app) => {
  // Create a solid-color background video for overlay testing
  app.post('/api/plain-background', async (req, res) => {
    try {
      const { duration, color = 'black', id: providedId, width: reqW, height: reqH } = req.body;
      const d = Number(duration) || DEFAULTS.duration;
      const { framerate } = DEFAULTS;
      // Use vertical video defaults to match overlay layout
      const width = Number(reqW) || 1080;
      const height = Number(reqH) || 1920;

      const id = providedId || crypto.randomBytes(8).toString('hex');
      const outputFilename = `plain-${id}.mp4`;
      const outputPath = path.join(OUTPUTS_DIR, outputFilename);

      console.log('🟦 Creating plain background video...');

      await runFFmpegCommand([
        '-f', 'lavfi',
        '-i', `color=c=${color}:s=${width}x${height}:r=${framerate}`,
        '-t', String(d),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-y', outputPath
      ], (timeMs) => {
        const currentTime = timeMs / 1000000;
        const percent = Math.min(100, Math.round((currentTime / d) * 100));
        console.log(`🟦 Plain Background Processing: ${percent}% complete`);
      });

      console.log('✅ Plain background video created');

      res.status(200).json({
        message: 'Plain background video created successfully.',
        id,
        outputFilename
      });
    } catch (e) {
      console.error('❌ Failed to create plain background:', e.message);
      res.status(500).json({ error: 'Failed to create plain background.', details: e.message });
    }
  });
};