const path = require('path');
const { OUTPUTS_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app) => {
  app.post('/api/add-text-overlay', async (req, res) => {
    const { id, text } = req.body;
    if (!id || !text) return res.status(400).json({ error: 'Missing id or text.' });

    const inputFilename = `step1-${id}.mp4`;
    const inputPath = path.join(OUTPUTS_DIR, inputFilename);
    const outputFilename = `step2-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      const vf = `drawtext=text='${text}':x=(w-text_w)/2:y=(h-text_h)/2:fontsize=50:fontcolor=white`;
      await runFFmpegCommand(['-i', inputPath, '-vf', vf, '-c:a', 'copy', '-y', outputPath]);
      
      res.status(200).json({ 
        message: 'Step 2 complete. Text overlay added.', 
        id: id,
        outputFilename: outputFilename 
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to add text overlay.', details: e.message });
    }
  });
};