const path = require('path');
const fs = require('fs');
const { OUTPUTS_DIR } = require('../utils/config');

module.exports = (app) => {
  app.get('/api/download', (req, res) => {
    const { filename } = req.query;
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ error: 'Invalid or missing filename.' });
    }
    const filePath = path.join(OUTPUTS_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
    res.download(filePath, filename);
  });
};