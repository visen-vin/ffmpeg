const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR, ROOT_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app) => {
  app.post('/api/merge-with-audio', async (req, res) => {
    const { inputFilename, id: providedId } = req.body;
    if (!inputFilename) return res.status(400).json({ error: 'Missing inputFilename.' });

    const inputPath = path.join(OUTPUTS_DIR, inputFilename);
    if (!fs.existsSync(inputPath)) return res.status(404).json({ error: `Input video not found: ${inputFilename}` });

    const audioPath = path.join(ROOT_DIR, 'test_files', 'audio1.mp3');
    const id = providedId || crypto.randomBytes(8).toString('hex');
    const outputFilename = `step3-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      console.log('🎵 Starting audio merge processing...');
      
      await runFFmpegCommand(
        ['-i', inputPath, '-i', audioPath, '-c:v', 'copy', '-c:a', 'aac', '-shortest', '-y', outputPath],
        (timeMs) => {
          // Estimate progress based on processing time (rough approximation)
          const estimatedDuration = 30000; // 30 seconds estimated
          const percent = Math.min(Math.round((timeMs / estimatedDuration) * 100), 99);
          console.log(`🎵 Audio Merge Processing: ${percent}% complete`);
        }
      );
      
      console.log('✅ Audio merge processing completed successfully');
      
      res.status(200).json({ 
        message: 'Step 3 complete. Audio merged.', 
        id: id,
        outputFilename: outputFilename 
      });
    } catch (e) {
      console.error('❌ Audio merge processing failed:', e.message);
      res.status(500).json({ error: 'Failed to merge audio.', details: e.message });
    }
  });
};