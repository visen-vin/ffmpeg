const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { OUTPUTS_DIR } = require('../utils/config');

module.exports = (app) => {
  app.post('/api/long-video', async (req, res) => {
    const { videoFilename, audioFilename } = req.body;

    if (!audioFilename) {
      return res.status(400).json({ error: 'Missing audioFilename.' });
    }

    // Use default video file if not provided
    const defaultVideoFile = 'videoplaybacklong.mp4';
    const actualVideoFilename = videoFilename || defaultVideoFile;
    
    // Check if using custom video file or default from test_files
    const videoPath = videoFilename 
      ? path.join(__dirname, '../videos', videoFilename)
      : path.join(__dirname, '../test_files', defaultVideoFile);
    
    const audioPath = path.join(__dirname, '../test_files', audioFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: `Input video not found: ${actualVideoFilename}` });
    }
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: `Input audio not found: ${audioFilename}` });
    }

    const id = crypto.randomBytes(8).toString('hex');
    const outputFilename = `long-video-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoPath)
          .inputOptions(['-stream_loop -1']) // Loop video infinitely
          .input(audioPath)
          .outputOptions([
            '-map 0:v:0',  // Map video stream
            '-map 1:a:0',  // Map audio stream
            '-c:v libx264', // Video codec
            '-c:a aac',     // Audio codec
            '-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2', // YouTube long video dimensions with padding
            '-r 30',        // Frame rate
            '-shortest'     // Stop when shortest input ends (audio length)
          ])
          .on('end', resolve)
          .on('error', (err) => reject(new Error(`ffmpeg failed: ${err.message}`)))
          .save(outputPath);
      });

      res.status(200).json({
        message: 'Successfully created long video with looped playback matching audio duration.',
        id: id,
        outputFilename: outputFilename
      });

    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to merge video and audio.', details: e.message });
    }
  });
};