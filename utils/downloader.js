const fs = require('fs');
const http = require('http');
const https = require('https');

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    const doRequest = (currentUrl) => {
      const protocol = currentUrl.startsWith('https') ? https : http;
      const req = protocol.get(currentUrl, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = new URL(res.headers.location, currentUrl).toString();
          file.close(() => {
            fs.unlink(dest, () => doRequest(redirectUrl));
          });
          return;
        }
        if (res.statusCode !== 200) {
          fs.unlink(dest, () => {});
          return reject(new Error(`Failed to download file. Status Code: ${res.statusCode}`));
        }
        res.pipe(file);
      });
      file.on('finish', () => file.close(resolve));
      req.on('error', (err) => fs.unlink(dest, () => reject(err)));
      file.on('error', (err) => fs.unlink(dest, () => reject(err)));
    };
    doRequest(url);
  });
}

module.exports = { downloadFile };