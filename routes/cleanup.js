const fs = require('fs');
const path = require('path');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('../utils/config');

module.exports = (app) => {
  app.delete('/api/cleanup', async (req, res) => {
    try {
      let deletedFiles = [];
      let errors = [];

      // Clean uploads directory
      if (fs.existsSync(UPLOADS_DIR)) {
        const uploadFiles = fs.readdirSync(UPLOADS_DIR);
        for (const file of uploadFiles) {
          try {
            const filePath = path.join(UPLOADS_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              fs.unlinkSync(filePath);
              deletedFiles.push(`uploads/${file}`);
            }
          } catch (error) {
            errors.push(`Failed to delete uploads/${file}: ${error.message}`);
          }
        }
      }

      // Clean outputs directory
      if (fs.existsSync(OUTPUTS_DIR)) {
        const outputFiles = fs.readdirSync(OUTPUTS_DIR);
        for (const file of outputFiles) {
          try {
            const filePath = path.join(OUTPUTS_DIR, file);
            const stats = fs.statSync(filePath);
            if (stats.isFile()) {
              fs.unlinkSync(filePath);
              deletedFiles.push(`outputs/${file}`);
            }
          } catch (error) {
            errors.push(`Failed to delete outputs/${file}: ${error.message}`);
          }
        }
      }

      const response = {
        message: 'Cleanup completed',
        deletedFiles: deletedFiles,
        deletedCount: deletedFiles.length
      };

      if (errors.length > 0) {
        response.errors = errors;
        response.message += ' with some errors';
      }

      console.log(`🧹 Cleanup completed: ${deletedFiles.length} files deleted`);
      if (errors.length > 0) {
        console.log(`⚠️  Cleanup errors: ${errors.length} files failed to delete`);
      }

      res.status(200).json(response);
    } catch (error) {
      console.error('❌ Cleanup failed:', error.message);
      res.status(500).json({ 
        error: 'Cleanup failed', 
        details: error.message 
      });
    }
  });
};