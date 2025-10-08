const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR, ROOT_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app) => {
  app.post('/api/merge-with-audio', async (req, res) => {
    const { id, step = '1' } = req.body;
    if (!id) return res.status(400).json({ error: 'Missing id.' });

    const inputFilename = `step${step}-${id}.mp4`;
    const inputPath = path.join(OUTPUTS_DIR, inputFilename);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: `Input video not found: ${inputFilename}` });

    const audioPath = path.join(ROOT_DIR, 'test_files', 'audio1.mp3');
    const outputFilename = `step3-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      await runFFmpegCommand(['-i', inputPath, '-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', outputPath]);
      
      res.status(200).json({ 
        message: 'Step 3 complete. Audio merged.', 
        id: id,
        outputFilename: outputFilename 
      });
    } catch (e) {
      res.status(500).json({ error: 'Failed to merge audio.', details: e.message });
    }
  });
};