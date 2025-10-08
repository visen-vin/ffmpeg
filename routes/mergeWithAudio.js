const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app, upload) => {
  app.post('/api/merge-with-audio', upload.single('audio'), async (req, res) => {
    const { id, step = '1' } = req.body;
    if (!id || !req.file) return res.status(400).json({ error: 'Missing id or audio file.' });

    const inputFilename = `step${step}-${id}.mp4`;
    const inputPath = path.join(OUTPUTS_DIR, inputFilename);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: `Input video not found: ${inputFilename}` });

    const audioPath = req.file.path;
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
    } finally {
      fs.unlink(audioPath, () => {});
    }
  });
};