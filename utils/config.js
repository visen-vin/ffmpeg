const path = require('path');
const fs = require('fs');

const ROOT_DIR = __dirname.replace(/\/(utils)$/, '');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');
const PORT = 3000;

[UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

module.exports = { ROOT_DIR, UPLOADS_DIR, OUTPUTS_DIR, PORT };