const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const { OUTPUTS_DIR } = require('../utils/config');

module.exports = (app) => {
  app.post('/api/add-thumbnail', async (req, res) => {
    const { videoFilename, imageFilename } = req.body;

    if (!videoFilename || !imageFilename) {
      return res.status(400).json({ error: 'Missing videoFilename or imageFilename.' });
    }

    const videoPath = path.join(OUTPUTS_DIR, videoFilename);
    const imagePath = path.join(__dirname, '../test_files', imageFilename);

    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: `Input video not found: ${videoFilename}` });
    }
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: `Input image not found: ${imageFilename}` });
    }

    const id = crypto.randomBytes(8).toString('hex');
    const outputFilename = `video-with-thumbnail-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(videoPath)
          .input(imagePath)
          .outputOptions([
            '-map 0',
            '-map 1',
            '-c copy',
            '-c:v:1 png',
            '-disposition:v:1 attached_pic'
          ])
          .on('end', resolve)
          .on('error', (err) => reject(new Error(`ffmpeg failed: ${err.message}`)))
          .save(outputPath);
      });

      res.status(200).json({
        message: 'Successfully added thumbnail to video.',
        id: id,
        outputFilename: outputFilename
      });

    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to add thumbnail to video.', details: e.message });
    }
  });
};