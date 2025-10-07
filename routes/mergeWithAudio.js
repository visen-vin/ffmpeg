const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR, ROOT_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app, upload) => {
  app.post('/api/merge-with-audio', upload.none(), async (req, res) => {
    const { videoFilename } = req.body;
    if (!videoFilename) return res.status(400).json({ error: 'Missing videoFilename.' });
    // Use default audio file from test_files
    const audioPath = path.join(ROOT_DIR, 'test_files', 'audio1.mp3');
    const inputVideoPath = path.join(OUTPUTS_DIR, videoFilename);
    if (!fs.existsSync(inputVideoPath)) return res.status(404).json({ error: 'Input video file not found.' });
    if (!fs.existsSync(audioPath)) return res.status(404).json({ error: 'Default audio file not found.' });
    const finalOutputName = `final_video_${crypto.randomBytes(8).toString('hex')}.mp4`;
    const finalOutputPath = path.join(OUTPUTS_DIR, finalOutputName);
    try {
      await runFFmpegCommand(['-i', inputVideoPath, '-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0', '-shortest', '-y', finalOutputPath]);
      res.status(200).json({ message: 'Step 3 complete. Video merged with audio.', outputFilename: finalOutputName });
    } catch (e) {
      res.status(500).json({ error: 'Failed to merge audio.', details: e.message });
    }
  });
};