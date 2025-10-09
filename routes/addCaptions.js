const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { whisper } = require('whisper-node');
const { OUTPUTS_DIR } = require('../utils/config');

module.exports = (app) => {
  app.post('/api/add-captions', async (req, res) => {
    const { videoFilename, audioFilename } = req.body;

    if (!videoFilename || !audioFilename) {
      return res.status(400).json({ error: 'Missing videoFilename or audioFilename.' });
    }

    const videoPath = path.join(__dirname, '../videos', videoFilename);
    const audioPath = path.join(__dirname, '../test_files', audioFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: `Input video not found: ${videoFilename}` });
    }
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: `Input audio not found: ${audioFilename}` });
    }

    const id = crypto.randomBytes(8).toString('hex');
    const tempWavFilename = `temp-audio-${id}.wav`;
    const srtFilename = `${tempWavFilename}.srt`;
    const srtPath = path.join(OUTPUTS_DIR, srtFilename);
    const outputFilename = `video-with-captions-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);
    const tempWavPath = path.join(OUTPUTS_DIR, tempWavFilename);

    try {
      if (!fs.existsSync(OUTPUTS_DIR)) {
        fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
      }

      await new Promise((resolve, reject) => {
        ffmpeg(audioPath)
          .toFormat('wav')
          .audioFrequency(16000)
          .on('error', (err) => {
            console.error('Error converting audio to WAV:', err);
            reject(err);
          })
          .on('end', () => {
            resolve();
          })
          .save(tempWavPath);
      });

      const transcript = await whisper(tempWavPath, {
        modelName: "base.en",
        whisperOptions: {
          gen_file_subtitle: true,
        },
      });

      console.log('Whisper transcript:', transcript);

      if (!fs.existsSync(srtPath)) {
        throw new Error('SRT file was not created.');
      }

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoPath)
          .input(audioPath)
          .videoFilters(`subtitles=${srtPath}`)
          .outputOptions([
            '-map 0:v',
            '-map 1:a',
            '-c:v libx264',
            '-c:a aac',
            '-crf 23',
            '-preset veryfast',
          ])
          .on('error', (err) => {
            console.error('Error processing video with ffmpeg:', err);
            reject(err);
          })
          .on('end', () => {
            resolve();
          })
          .save(outputPath);
      });

      fs.unlinkSync(tempWavPath);
      fs.unlinkSync(srtPath);

      res.json({
        message: 'Captions added to video successfully.',
        outputFilename,
      });
    } catch (error) {
      console.error('Error in add-captions endpoint:', error);
      res.status(500).json({ error: 'Failed to add captions to video.', details: error.message });
    }
  });
};