const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const jobs = {};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/outputs', express.static('./outputs'));

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

app.post('/jobs', upload.fields([
  { name: 'backgroundVideo', maxCount: 1 },
  { name: 'audio', maxCount: 1 }
]), (req, res) => {
  try {
    if (!req.files || !req.files.backgroundVideo || !req.files.audio) {
      return res.status(400).json({
        error: 'Both backgroundVideo and audio files are required'
      });
    }

    if (!req.body.text || req.body.text.trim() === '') {
      return res.status(400).json({
        error: 'Text field is required'
      });
    }

    const jobId = uuidv4();

    jobs[jobId] = {
      jobId: jobId,
      status: 'pending',
      backgroundVideoPath: req.files.backgroundVideo[0].path,
      audioPath: req.files.audio[0].path,
      text: req.body.text.trim(),
      createdAt: new Date().toISOString(),
      videoUrl: null,
      error: null
    };

    res.status(202).json({
      jobId: jobId,
      statusUrl: `/jobs/${jobId}`
    });

    processVideoJob(jobId);

  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;

  if (!jobs[jobId]) {
    return res.status(404).json({
      error: 'Job not found'
    });
  }

  res.json(jobs[jobId]);
});

async function processVideoJob(jobId) {
  const job = jobs[jobId];
  if (!job) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  try {
    job.status = 'processing';
    job.updatedAt = new Date().toISOString();

    console.log(`Starting video processing for job ${jobId}`);

    const audioDuration = await getAudioDuration(job.audioPath);
    console.log(`Audio duration: ${audioDuration} seconds`);

    const textOverlayPath = await generateTextOverlay(job.text, jobId);
    console.log(`Text overlay generated: ${textOverlayPath}`);

    const outputPath = path.join('./outputs', `output-${jobId}.mp4`);
    await createCinematicVideo(job.backgroundVideoPath, job.audioPath, textOverlayPath, outputPath, audioDuration);

    job.status = 'completed';
    job.videoUrl = `/outputs/output-${jobId}.mp4`;
    job.completedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    console.log(`Video processing completed for job ${jobId}`);

    cleanupTempFiles(job.backgroundVideoPath, job.audioPath, textOverlayPath);

  } catch (error) {
    console.error(`Error processing job ${jobId}:`, error);

    job.status = 'failed';
    job.error = error.message;
    job.failedAt = new Date().toISOString();
    job.updatedAt = new Date().toISOString();

    cleanupTempFiles(job.backgroundVideoPath, job.audioPath);
  }
}

function getAudioDuration(audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(audioPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to get audio duration: ${err.message}`));
        return;
      }

      const duration = metadata.format.duration;
      if (!duration) {
        reject(new Error('Could not determine audio duration'));
        return;
      }

      resolve(duration);
    });
  });
}

async function generateTextOverlay(text, jobId) {
  const textOverlayPath = path.join('./uploads', `text-overlay-${jobId}.png`);

  try {
    if (!text || text.trim() === '' || text.trim() === '|') {
      throw new Error("Input text is empty or invalid.");
    }

    const overlayWidth = 2160;
    const overlayHeight = 1000;
    const fontFamily = "Montserrat, sans-serif";

    const textParts = text.split('-');
    const mainQuote = textParts[0].trim();
    const sourceText = textParts.length > 1 ? textParts[1].trim() : '';

    const maxCharsPerLine = 45;
    const wrappedLines = wrapText(mainQuote, maxCharsPerLine);

    const mainFontSize = 85;
    const sourceFontSize = 80;
    const mainLineHeight = mainFontSize * 1.5;
    const verticalPadding = 80;
    const quoteSourceGap = 120;

    const quoteBlockHeight = wrappedLines.length * mainLineHeight;
    const sourceBlockHeight = sourceText ? sourceFontSize + quoteSourceGap : 0;
    const scrimHeight = quoteBlockHeight + sourceBlockHeight + verticalPadding;
    const scrimY = (overlayHeight - scrimHeight) / 2;
    const quoteStartY = scrimY + (verticalPadding / 2);
    const sourceY = quoteStartY + quoteBlockHeight + quoteSourceGap;

    console.log({
      jobId,
      scrimHeight,
      scrimY,
      quoteStartY,
      sourceY,
      lineCount: wrappedLines.length
    });

    const svgOverlay = `
    <svg width="${overlayWidth}" height="${overlayHeight}" xmlns="http://www.w3.org/2000/svg">
        <rect x="5%" y="${scrimY}" width="90%" height="${scrimHeight}"
              fill="rgba(0,0,0,0.6)" rx="30" ry="30" />
        <text y="${quoteStartY}" dominant-baseline="hanging" text-anchor="middle"
              font-family="${fontFamily}" font-size="${mainFontSize}" fill="#FFFFFF" font-weight="bold"
              stroke="#000000" stroke-width="2" paint-order="stroke">
            ${wrappedLines.map((line) =>
      `<tspan x="50%" dy="${mainLineHeight}">${line}</tspan>`
    ).join('')}
        </text>
      ${sourceText ? `
      <text y="${sourceY}" dominant-baseline="hanging" 
            text-anchor="middle" x="50%" font-family="${fontFamily}" font-size="${sourceFontSize}" fill="#FFA500" font-weight="bold"
            stroke="#000000" stroke-width="1.5" paint-order="stroke">
          ${sourceText}
      </text>` : ''}
    </svg>`;

    console.log(svgOverlay);

    await sharp(Buffer.from(svgOverlay))
      .png()
      .toFile(textOverlayPath);

    return textOverlayPath;
  } catch (error) {
    throw new Error(`Failed to generate text overlay: ${error.message}`);
  }
}

function wrapText(text, maxCharsPerLine) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + ' ' + word).length > maxCharsPerLine && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      if (currentLine.length === 0) {
        currentLine = word;
      } else {
        currentLine += ' ' + word;
      }
    }
  }
  lines.push(currentLine);
  return lines;
}

function createCinematicVideo(backgroundVideoPath, audioPath, textOverlayPath, outputPath, duration) {
  return new Promise((resolve, reject) => {
    const totalFrames = 8 * 60; 

    ffmpeg()
      .input(backgroundVideoPath)
      .input(audioPath)
      .input(textOverlayPath)
      .complexFilter([
        `[0:v]crop=ih*9/16:ih,scale=2160:3480,zoompan=z='min(zoom+0.001,1.2)':d=${totalFrames}:s=2160x3480,setsar=1,setpts=1.25*PTS,eq=contrast=1.2:saturation=1.3,vignette=angle=PI/5,fade=type=in:start_time=0:duration=7[content_video]`,
        `[content_video]pad=width=iw:height=ih*1.2:x=0:y=(oh-ih)/2:color=black[padded_video]`,
        `[2:v]scale=2160:-1,format=rgba[text_scaled]`,
        // MODIFIED LINE: Subtracted 20 from the x coordinate to shift it left
        `[padded_video][text_scaled]overlay=x=(W-w)/2-40:y=(H-h)/2+750:format=auto[final]`
      ])
      .outputOptions([
        '-map', '[final]',
        '-map', '1:a',
        '-c:v', 'libx264',
        '-c:a', 'aac',
        '-pix_fmt', 'yuv420p',
        '-r', '60',
        '-t', '8',
        '-shortest',
        '-preset', 'medium',
        '-crf', '23'
      ])
      .output(outputPath)
      .on('start', (commandLine) => {
        console.log('FFmpeg command:', commandLine);
      })
      .on('progress', (progress) => {
        console.log(`Processing: ${progress.percent}% done`);
      })
      .on('end', () => {
        console.log('Cinematic video creation completed');
        resolve();
      })
      .on('error', (err) => {
        console.error('FFmpeg error:', err);
        reject(new Error(`Video creation failed: ${err.message}`));
      })
      .run();
  });
}

function cleanupTempFiles(...filePaths) {
  filePaths.forEach(filePath => {
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(`Cleaned up: ${filePath}`);
      } catch (error) {
        console.error(`Failed to clean up ${filePath}:`, error);
      }
    }
  });
}

app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Kinetic API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Upload endpoint: POST http://localhost:${PORT}/jobs`);
  console.log(`Status endpoint: GET http://localhost:${PORT}/jobs/:jobId`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  process.exit(0);
});