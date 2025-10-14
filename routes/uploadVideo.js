const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { OUTPUTS_DIR } = require('../utils/config');

module.exports = (app, upload) => {
  // Upload a video for future use; returns only the stored filename
  app.post('/api/upload-video', upload.single('video'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No video file uploaded.' });
      }

      const { id: providedId } = req.body;
      const id = providedId || crypto.randomBytes(8).toString('hex');

      // Determine a safe extension (default to .mp4 if missing)
      const originalName = req.file.originalname || 'video.mp4';
      const ext = path.extname(originalName) || '.mp4';

      // Compose output filename and move file from uploads to outputs
      const outputFilename = `uploaded-${id}${ext}`;
      const outputPath = path.join(OUTPUTS_DIR, outputFilename);

      try {
        fs.renameSync(req.file.path, outputPath);
      } catch (moveErr) {
        // Fallback to copy if rename across devices fails
        try {
          fs.copyFileSync(req.file.path, outputPath);
          fs.unlinkSync(req.file.path);
        } catch (copyErr) {
          return res.status(500).json({ error: 'Failed to store uploaded file.', details: copyErr.message });
        }
      }

      // Respond with only the filename for later download or processing
      return res.status(200).json({ outputFilename });
    } catch (e) {
      console.error('❌ Upload video failed:', e.message);
      return res.status(500).json({ error: 'Upload failed', details: e.message });
    }
  });
};