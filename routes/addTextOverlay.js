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
    let { inputFilename, text, attribution, id: providedId } = req.body; // Use let
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

    try {
      const videoWidth = 1080;
      const sideMargin = videoWidth * 0.15;
      const textAreaWidth = videoWidth - (2 * sideMargin);
      const fontSize = Math.round(textAreaWidth / 20);
      const maxCharsPerLine = Math.floor(textAreaWidth / (fontSize * 0.6));

      // 1. Wrap the text that now contains real emojis
      const wrappedText = wrapText(textWithEmojis, maxCharsPerLine);
      
      if (wrappedText.length === 0) {
        return res.status(400).json({ error: 'Text content is empty after processing.' });
      }
      
      const lastLineY = 1200 + ((wrappedText.length - 1) * (fontSize + 10));
      const attributionY = lastLineY + (fontSize + 30);
      const padding = Math.round(fontSize * 0.6);
      const mainTextTop = 1200 - fontSize;
      const rectY = mainTextTop - padding;
      const rectHeight = (attributionY - mainTextTop) + padding * 1.5;
      const textCenterX = sideMargin + (textAreaWidth / 2);
      const rectX = 0;
      const rectWidth = videoWidth;

      // 3. Map wrapped text to <tspan> elements, sanitizing each line
      const textLines = wrappedText.map((line, index) => {
        const y = 1200 + (index * (fontSize + 10));
        return `<tspan x="${textCenterX}" y="${y}">${sanitizeForSvg(line)}</tspan>`;
      }).join('');
      
      const sanitizedAttribution = sanitizeForSvg(attributionWithEmojis);

      // 4. Construct the final SVG string
      const textSvg = `
        <svg width="1080" height="1920">
          <style>
            .main-text { font-family: "Roboto", "Noto Color Emoji"; font-size: ${fontSize}px; font-weight: bold; fill: white; text-anchor: middle; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.8)); }
            .attr-text { font-family: "Roboto", "Noto Color Emoji"; font-size: ${Math.round(fontSize * 0.7)}px; font-weight: bold; fill: #FFA500; text-anchor: middle; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.7)); }
          </style>
          <rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="rgba(0,0,0,0.4)" />
          <text class="main-text">
            ${textLines}
          </text>
          ${sanitizedAttribution ? `
          <text class="attr-text" x="${textCenterX}" y="${attributionY}">
            -${sanitizedAttribution}-
          </text>
          ` : ''}
        </svg>
      `;
      
      // --- The rest of the function remains the same ---
      
      await sharp(Buffer.from(textSvg)).toFile(textImage);

      await new Promise((resolve, reject) => {
        ffmpeg()
          .input(inputPath)
          .input(textImage)
          .complexFilter('[0:v][1:v] overlay=(W-w)/2:(H-h)/2')
          .outputOptions(['-c:a copy'])
          .on('end', resolve)
          .on('error', (err) => reject(new Error(`ffmpeg failed: ${err.message}`)))
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