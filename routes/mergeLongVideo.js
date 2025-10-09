const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { OUTPUTS_DIR } = require('../utils/config');

module.exports = (app, upload) => {
  app.post('/api/long-video', upload.single('audio'), async (req, res) => {
    // Check if audio file is uploaded or audioFilename is provided
    const uploadedAudio = req.file;
    const { videoFilename, audioFilename } = req.body;

    if (!uploadedAudio && !audioFilename) {
      return res.status(400).json({ error: 'Missing audio file. Please upload an audio file or provide audioFilename.' });
    }

    // Use default video file if not provided
    const defaultVideoFile = 'bgvideolong.mp4';
    const actualVideoFilename = videoFilename || defaultVideoFile;
    
    // Check if using custom video file or default from test_files
    const videoPath = videoFilename 
      ? path.join(__dirname, '../videos', videoFilename)
      : path.join(__dirname, '../test_files', defaultVideoFile);
    
    // Use uploaded audio file or fallback to audioFilename from test_files
    const audioPath = uploadedAudio 
      ? uploadedAudio.path 
      : path.join(__dirname, '../test_files', audioFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: `Input video not found: ${actualVideoFilename}` });
    }
    if (!fs.existsSync(audioPath)) {
      const audioSource = uploadedAudio ? 'uploaded audio file' : `audio file: ${audioFilename}`;
      return res.status(404).json({ error: `Input ${audioSource} not found.` });
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
          .on('progress', (progress) => {
            const percent = Math.round(progress.percent || 0);
            console.log(`🎬 Long Video Processing: ${percent}% complete`);
          })
          .on('end', () => {
            console.log('✅ Long video processing completed successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ Long video processing failed:', err.message);
            reject(new Error(`ffmpeg failed: ${err.message}`));
          })
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