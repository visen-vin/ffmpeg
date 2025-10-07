const { spawn } = require('child_process');

function runFFmpegCommand(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args]);
    proc.stdout && proc.stdout.on('data', (d) => process.stdout.write(d));
    proc.stderr && proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

module.exports = { runFFmpegCommand };