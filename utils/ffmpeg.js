const { spawn } = require('child_process');

function runFFmpegCommand(args, progressCallback = null) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-progress', 'pipe:1', ...args]);
    
    let progressData = '';
    
    proc.stdout && proc.stdout.on('data', (data) => {
      const chunk = data.toString();
      progressData += chunk;
      
      // Parse progress information
      const lines = progressData.split('\n');
      for (const line of lines) {
        if (line.startsWith('out_time_ms=')) {
          const timeMs = parseInt(line.split('=')[1]);
          if (progressCallback && !isNaN(timeMs)) {
            progressCallback(timeMs);
          }
        }
      }
      
      // Keep only the last incomplete line
      const lastNewlineIndex = progressData.lastIndexOf('\n');
      if (lastNewlineIndex !== -1) {
        progressData = progressData.substring(lastNewlineIndex + 1);
      }
    });
    
    proc.stderr && proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.on('close', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on('error', reject);
  });
}

module.exports = { runFFmpegCommand };