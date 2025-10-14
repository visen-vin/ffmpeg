const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const emoji = require('node-emoji'); // ✨ CHANGE: Import the emoji library
const { OUTPUTS_DIR } = require('../utils/config');
const { wrapText } = require('../utils/textWrapper');

const sanitizeForSvg = (str) => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

module.exports = (app) => {
  app.post('/api/add-text-overlay', async (req, res) => {
    let { inputFilename, text, attribution, id: providedId, style, visibleLastSeconds } = req.body; // Use let
    if (!inputFilename || !text) {
      return res.status(400).json({ error: 'Missing inputFilename or text.' });
    }

    // ✨ CHANGE: Convert shortcodes to actual emojis
    const textWithEmojis = text ? emoji.emojify(text) : '';
    const attributionWithEmojis = attribution ? emoji.emojify(attribution) : '';

    const inputPath = path.join(OUTPUTS_DIR, inputFilename);
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: `Input video not found: ${inputFilename}` });
    }

    const id = providedId || crypto.randomBytes(8).toString('hex');
    const outputFilename = `step2-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);
    const textImage = path.join(OUTPUTS_DIR, `text-overlay-${id}.png`);
    const requestedStyle = (style || 'reference').toLowerCase();
    const showLast = Number(visibleLastSeconds) || 0;

    // Helper: ffprobe wrapped in a promise to get video duration
    const ffprobeAsync = (filePath) => new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (err, data) => {
        if (err) return reject(err);
        resolve(data);
      });
    });

    try {
      const videoWidth = 1080;
      const sideMargin = requestedStyle === 'reference' ? videoWidth * 0.08 : videoWidth * 0.15;
      const textAreaWidth = videoWidth - (2 * sideMargin);
      const fontSize = requestedStyle === 'reference' ? Math.round(textAreaWidth / 19) : Math.round(textAreaWidth / 20);
      const maxCharsPerLine = Math.floor(textAreaWidth / (fontSize * 0.6));

      // 1. Wrap the text that now contains real emojis
      const wrappedText = wrapText(textWithEmojis, maxCharsPerLine);
      
      if (wrappedText.length === 0) {
        return res.status(400).json({ error: 'Text content is empty after processing.' });
      }
      
      // Positioning varies by style
      const lineSpacing = fontSize + 10;
      const mainTextTop = requestedStyle === 'reference' ? 160 : (1200 - fontSize);
      const lastLineY = mainTextTop + ((wrappedText.length - 1) * lineSpacing) + fontSize; // baseline of last line
      // Revert: attribution gap returns to prior behavior (fontSize + 24)
      const attributionY = lastLineY + (fontSize + 15);
      const padding = Math.round(fontSize * 0.6);
      const rectY = requestedStyle === 'reference' ? 0 : (mainTextTop - padding);
      const rectHeight = (attributionY - mainTextTop) + padding * 1.5 + (requestedStyle === 'reference' ? mainTextTop : 0);
      const textCenterX = sideMargin + (textAreaWidth / 2);
      const rectX = 0;
      const rectWidth = videoWidth;

      // 3. Map wrapped text to <tspan> elements, sanitizing each line
      const textLines = wrappedText.map((line, index) => {
        const y = mainTextTop + (index * (lineSpacing));
        return `<tspan x="${textCenterX}" y="${y}">${sanitizeForSvg(line)}</tspan>`;
      }).join('');
      
      const sanitizedAttribution = sanitizeForSvg(attributionWithEmojis);

      // 4. Construct the final SVG string
      const textSvg = `
        <svg width="1080" height="1920">
          <style>
            ${requestedStyle === 'reference' ? `
              .main-text { font-family: "Georgia", "Times New Roman", serif; font-size: ${fontSize}px; font-weight: normal; fill: black; text-anchor: middle; }
              .attr-text { font-family: "Georgia", "Times New Roman", serif; font-size: ${Math.round(fontSize * 0.8)}px; font-weight: bold; fill: #D64A27; text-anchor: middle; }
            ` : `
              .main-text { font-family: "Roboto", "Noto Color Emoji"; font-size: ${fontSize}px; font-weight: bold; fill: white; text-anchor: middle; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.8)); }
              .attr-text { font-family: "Roboto", "Noto Color Emoji"; font-size: ${Math.round(fontSize * 0.7)}px; font-weight: bold; fill: #FFA500; text-anchor: middle; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.7)); }
            `}
          </style>
          <rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="${requestedStyle === 'reference' ? 'white' : 'rgba(0,0,0,0.4)'}" />
          <text class="main-text">
            ${textLines}
          </text>
          ${sanitizedAttribution ? `
          <text class="attr-text" x="${textCenterX}" y="${attributionY}">
            ${requestedStyle === 'reference' ? `${sanitizeForSvg(attributionWithEmojis)}` : `-${sanitizeForSvg(attributionWithEmojis)}-`}
          </text>
          ` : ''}
        </svg>
      `;
      
      // --- The rest of the function remains the same ---
      
      await sharp(Buffer.from(textSvg)).toFile(textImage);

      console.log('📝 Starting text overlay processing...');

      // Determine overlay timing (visible only during last N seconds if requested)
      let enableClause = '';
      if (showLast > 0) {
        let durationSec = 0;
        try {
          const probe = await ffprobeAsync(inputPath);
          durationSec = parseFloat(probe?.format?.duration || '0');
        } catch (e) {
          durationSec = 0;
        }
        if (durationSec > 0) {
          const start = Math.max(0, durationSec - showLast);
          enableClause = `:enable='gte(t,${start.toFixed(3)})'`;
        }
      }

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(inputPath)
          .input(textImage)
          .complexFilter(`[0:v][1:v] overlay=(W-w)/2:(H-h)/2${enableClause}`)
          .outputOptions(['-c:a copy'])
          .on('progress', (progress) => {
            const percent = Math.round(progress.percent || 0);
            console.log(`📝 Text Overlay Processing: ${percent}% complete`);
          })
          .on('end', () => {
            console.log('✅ Text overlay processing completed successfully');
            resolve();
          })
          .on('error', (err) => {
            console.error('❌ Text overlay processing failed:', err.message);
            reject(new Error(`ffmpeg failed: ${err.message}`));
          })
          .save(outputPath);
      });

      res.status(200).json({ 
        message: 'Step 2 complete. Text overlay added.', 
        id: id,
        outputFilename: outputFilename 
      });

    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Failed to add text overlay.', details: e.message });
    } finally {
      if (fs.existsSync(textImage)) {
        fs.unlinkSync(textImage);
      }
    }
  });
};