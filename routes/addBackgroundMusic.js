const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { UPLOADS_DIR, OUTPUTS_DIR } = require('../utils/config');
const { runFFmpegCommand } = require('../utils/ffmpeg');

module.exports = (app, upload) => {
  app.post('/api/add-background-music', upload.single('video'), async (req, res) => {
    const { id: providedId, volume = 0.3 } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No video file uploaded.' });
    }

    const videoPath = req.file.path;
    const backgroundAudioPath = '/Users/vin/Desktop/ffmpeg-yt/test_files/bgaudio.mp3';
    
    // Check if background audio exists
    if (!fs.existsSync(backgroundAudioPath)) {
      fs.unlinkSync(videoPath); // Clean up uploaded video
      return res.status(404).json({ error: 'Background audio file not found.' });
    }

    const id = providedId || crypto.randomBytes(8).toString('hex');
    const outputFilename = `bg-music-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
      console.log('🎵 Starting background music processing...');
      
      // First, check if the input video has audio
      let hasAudio = false;
      try {
        const probeResult = await runFFmpegCommand([
          '-v', 'error',
          '-select_streams', 'a:0',
          '-show_entries', 'stream=codec_type',
          '-of', 'csv=p=0',
          videoPath
        ], null, true); // Allow errors for probe
        
        hasAudio = probeResult && probeResult.trim() === 'audio';
      } catch (error) {
        // If probe fails, assume no audio
        hasAudio = false;
      }
      
      console.log(`🔍 Video has audio: ${hasAudio}`);
      
      let ffmpegArgs;
      
      if (hasAudio) {
        // Mix original audio with background music
        console.log('🎵 Mixing original audio with background music...');
        ffmpegArgs = [
          '-i', videoPath,
          '-stream_loop', '-1',
          '-i', backgroundAudioPath,
          '-filter_complex', `[0:a][1:a]amix=inputs=2:duration=first:dropout_transition=0,volume=1:${volume}[mixed_audio]`,
          '-map', '0:v',
          '-map', '[mixed_audio]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart',
          '-shortest',
          '-y',
          outputPath
        ];
      } else {
        // Video has no audio, just add background music
        console.log('🎵 Adding background music to video without audio...');
        ffmpegArgs = [
          '-i', videoPath,
          '-stream_loop', '-1',
          '-i', backgroundAudioPath,
          '-filter_complex', `[1:a]volume=${volume}[bg_audio]`,
          '-map', '0:v',
          '-map', '[bg_audio]',
          '-c:v', 'libx264',
          '-c:a', 'aac',
          '-preset', 'medium',
          '-crf', '23',
          '-movflags', '+faststart',
          '-shortest',
          '-y',
          outputPath
        ];
      }
      
      await runFFmpegCommand(ffmpegArgs,
        (timeMs) => {
          // Estimate progress based on processing time
          const estimatedDuration = 30000; // 30 seconds estimated
          const percent = Math.min(Math.round((timeMs / estimatedDuration) * 100), 100);
          console.log(`🎵 Processing background music: ${percent}% complete`);
        }
      );

      console.log('✅ Background music added successfully');

      res.status(200).json({
        message: 'Background music added successfully.',
        id: id,
        outputFilename: outputFilename,
        backgroundVolume: volume
      });

    } catch (error) {
      console.error('❌ Background music processing error:', error.message);
      res.status(500).json({ 
        error: 'Failed to add background music', 
        details: error.message 
      });
    } finally {
      // Clean up uploaded video file
      fs.unlink(videoPath, (err) => {
        if (err) console.error('Failed to clean up uploaded video:', err.message);
      });
    }
  });
};