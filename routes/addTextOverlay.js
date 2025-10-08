const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { OUTPUTS_DIR } = require('../utils/config');
const { wrapText } = require('../utils/textWrapper'); // Assuming wrapText is in a utility file

module.exports = (app) => {
  app.post('/api/add-text-overlay', async (req, res) => {
    const { inputFilename, text, attribution, id: providedId } = req.body;
    if (!inputFilename || !text) {
      return res.status(400).json({ error: 'Missing inputFilename or text.' });
    }

    const inputPath = path.join(OUTPUTS_DIR, inputFilename);
    if (!fs.existsSync(inputPath)) {
      return res.status(404).json({ error: `Input video not found: ${inputFilename}` });
    }

    const id = providedId || crypto.randomBytes(8).toString('hex');
    const outputFilename = `step2-${id}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);
    const textImage = path.join(OUTPUTS_DIR, `text-overlay-${id}.png`);

    try {
      // --- Start of SVG Generation Logic from Preview ---

      // 1. Sanitize input and wrap text
      const sanitizedText = text.replace(/"/g, ''); // Remove quotes for wrapping
      const wrappedText = wrapText(sanitizedText, 35);
      
      if (wrappedText.length === 0) {
        return res.status(400).json({ error: 'Text content is empty after processing.' });
      }
      
      // 2. Calculate dynamic positions for attribution and background
      const lastLineY = 1200 + ((wrappedText.length - 1) * 60);
      const attributionY = lastLineY + 80;
      
      const padding = 30;
      const mainTextTop = 1200 - 50; // Approximation of top of first text line
      const rectY = mainTextTop - padding;
      const rectHeight = (attributionY - mainTextTop) + padding * 1.5;
      
      // Define padding and text area
      const leftPadding = 1080 * 0.12;
      const rightPadding = 1080 * 0.15;
      const textAreaWidth = 1080 - leftPadding - rightPadding;
      const textCenterX = leftPadding + (textAreaWidth / 2);

      // Background rectangle should be full width
      const rectX = 0;
      const rectWidth = 1080;

      // 3. Map wrapped text to <tspan> elements
      const textLines = wrappedText.map((line, index) => {
        const y = 1200 + (index * 60);
        const sanitizedLine = line.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<tspan x="${textCenterX}" y="${y}">${sanitizedLine}</tspan>`;
      }).join('');
      
      const sanitizedAttribution = attribution ? attribution.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '';

      // 4. Construct the final SVG string
      const textSvg = `
        <svg width="1080" height="1920">
          <style>
            .main-text { font-family: Roboto; font-size: 50px; font-weight: bold; fill: white; text-anchor: middle; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.8)); }
            .attr-text { font-family: Roboto; font-size: 35px; font-weight: bold; fill: #FFA500; text-anchor: middle; filter: drop-shadow(2px 2px 4px rgba(0,0,0,0.7)); }
          </style>
          <rect x="${rectX}" y="${rectY}" width="${rectWidth}" height="${rectHeight}" fill="rgba(0,0,0,0.4)" />
          <text class="main-text">
            ${textLines}
          </text>
          <text class="attr-text" x="${textCenterX}" y="${attributionY}">
            -${sanitizedAttribution}-
          </text>
        </svg>
      `;
      
      // --- End of SVG Generation Logic ---
      
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

