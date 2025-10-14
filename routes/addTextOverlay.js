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

module.exports = (app, upload) => {
  app.post('/api/add-text-overlay', upload.single('video'), async (req, res) => {
    let { inputFilename, text, attribution, id: providedId, style, visibleLastSeconds, compact, returnFile } = req.body; // Use let
    if (!text) {
      return res.status(400).json({ error: 'Missing text.' });
    }

    // ✨ CHANGE: Convert shortcodes to actual emojis
    const textWithEmojis = text ? emoji.emojify(text) : '';
    const attributionWithEmojis = attribution ? emoji.emojify(attribution) : '';

    // Determine input video source: uploaded file or outputs directory
    let inputPath = '';
    let inputSource = '';
    if (req.file && req.file.path) {
      inputPath = req.file.path;
      inputSource = 'uploaded';
    } else {
      if (!inputFilename) {
        return res.status(400).json({ error: 'Missing inputFilename when no video file is uploaded.' });
      }
      inputPath = path.join(OUTPUTS_DIR, inputFilename);
      inputSource = 'outputs';
      if (!fs.existsSync(inputPath)) {
        return res.status(404).json({ error: `Input video not found: ${inputFilename}` });
      }
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
      // Probe input video to get dimensions and duration
      let videoWidth = 1080;
      let videoHeight = 1920;
      let durationSec = 0;
      try {
        const probe = await ffprobeAsync(inputPath);
        const vstream = (probe?.streams || []).find(s => s.codec_type === 'video') || (probe?.streams || [])[0];
        videoWidth = vstream?.width || videoWidth;
        videoHeight = vstream?.height || videoHeight;
        durationSec = parseFloat(probe?.format?.duration || '0');
      } catch (e) {
        // Use defaults
      }
      const sideMargin = requestedStyle === 'reference' ? videoWidth * 0.08 : videoWidth * 0.15;
      const textAreaWidth = videoWidth - (2 * sideMargin);
      const fontSize = requestedStyle === 'reference' ? Math.round(textAreaWidth / 19) : Math.round(textAreaWidth / 20);
      const attrFontSize = Math.round(fontSize * 0.8);
      const maxCharsPerLine = Math.floor(textAreaWidth / (fontSize * 0.6));

      // 1. Wrap the text that now contains real emojis
      let wrappedText = wrapText(textWithEmojis, maxCharsPerLine);
      
      if (wrappedText.length === 0) {
        return res.status(400).json({ error: 'Text content is empty after processing.' });
      }
      
      // Enforce a maximum of 5 lines; append ellipsis to the last line if truncated
      const MAX_LINES = 5;
      let linesToRender = wrappedText.slice(0, MAX_LINES);
      if (wrappedText.length > MAX_LINES) {
        const lastIdx = MAX_LINES - 1;
        linesToRender[lastIdx] = `${linesToRender[lastIdx]}…`;
      }
      const lineCount = linesToRender.length;
      
      // Positioning varies by style
      const lineSpacing = fontSize + 10;
      const baseDarkTop = 1200;
      // Apply fixed overlay padding: 10% top and 2.5% bottom for 'reference' style
      const topPaddingRatio = 0.10;
      const bottomPaddingRatio = 0.025;
      // Header height will be computed from actual text block height later (capped at 32%)
      let headerHeight = 0;
      const mainTextTop = requestedStyle === 'reference'
        ? Math.round(videoHeight * topPaddingRatio)
        : Math.round((baseDarkTop * (videoHeight / 1920)) - fontSize);
      const lastLineY = mainTextTop + ((lineCount ) * lineSpacing) + fontSize - 10; // approximate bottom of last line
      // Compact attribution gap (halved): decrease spacing between text and attribution
      const attrGap = Math.round(fontSize * 0.25);
      let attributionY = lastLineY + attrGap;
      const padding = Math.round(fontSize * 0.6);
      // Keep white bar anchored at the very top; only text gets top padding
      const rectY = requestedStyle === 'reference' ? 0 : (mainTextTop - padding);
      if (requestedStyle === 'reference') {
        const textBottomMargin = Math.round(fontSize * 0.2);
        const attrBottomMargin = Math.round(attrFontSize * 0.4);
        const bottomPaddingPx = Math.round(videoHeight * bottomPaddingRatio);
        const headerHeightPxRaw = attributionY + attrBottomMargin + bottomPaddingPx; // include attribution and bottom padding
        const maxHeaderPx = Math.round(videoHeight * 0.32);
        headerHeight = Math.min(headerHeightPxRaw, maxHeaderPx);
        // Clamp attribution to sit inside the header when capped
        attributionY = Math.min(attributionY, headerHeight - attrBottomMargin);
      }
      const rectHeight = requestedStyle === 'reference'
        ? headerHeight
        : (attributionY - mainTextTop) + padding * 1.5;
      const textCenterX = sideMargin + (textAreaWidth / 2);
      const rectX = 0;
      const rectWidth = videoWidth;

      // 3. Map wrapped text to <tspan> elements, sanitizing each line
      const textLines = linesToRender.map((line, index) => {
        const y = mainTextTop + (index * (lineSpacing));
        return `<tspan x="${textCenterX}" y="${y}">${sanitizeForSvg(line)}</tspan>`;
      }).join('');
      
      const sanitizedAttribution = sanitizeForSvg(attributionWithEmojis);

      // 4. Construct the final SVG string
      const textSvg = `
        <svg width="${videoWidth}" height="${videoHeight}">
          <style>
            ${requestedStyle === 'reference' ? `
              .main-text { font-family: "Georgia", "Times New Roman", serif; font-size: ${fontSize}px; font-weight: normal; fill: black; text-anchor: middle; }
              .attr-text { font-family: "Georgia", "Times New Roman", serif; font-size: ${attrFontSize}px; font-weight: bold; fill: #D64A27; text-anchor: middle; }
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

      // Overlay timing: always visible for the full duration
      let enableClause = '';

      await new Promise((resolve, reject) => {
        // When using the 'reference' style, push the video content down by the
        // computed header height so the video starts at the bottom of the overlay.
        // We do this by cropping off the bottom "headerHeight" pixels and then
        // padding them back on the top as black, which preserves the final canvas
        // size while creating a visual top margin equal to the overlay height.
        const cropPadChain = requestedStyle === 'reference'
          ? `[0:v]crop=${videoWidth}:${Math.max(1, videoHeight - headerHeight)}:0:0,` +
            `pad=${videoWidth}:${videoHeight}:0:${headerHeight}:black[vidBase];` +
            `[vidBase][1:v]overlay=(W-w)/2:(H-h)/2${enableClause}`
          : `[0:v][1:v]overlay=(W-w)/2:(H-h)/2${enableClause}`;

        ffmpeg()
          .input(inputPath)
          .input(textImage)
          .complexFilter(cropPadChain)
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

      // Build overlay metadata and write sidecar JSON for reproducibility/debugging
      const overlayMeta = {
        style: requestedStyle,
        visibleLastSeconds: showLast,
        text: textWithEmojis,
        attribution: attributionWithEmojis,
        video: { width: videoWidth, height: videoHeight, durationSec },
        layout: { fontSize, lineSpacing, mainTextTop, attributionY, rectY, rectHeight, sideMargin, textAreaWidth, headerHeight },
        input: { source: inputSource, path: inputPath, inputFilename: req.file ? undefined : inputFilename, originalName: req.file ? req.file.originalname : undefined },
        output: { outputFilename }
      };
      const metadataFile = path.join(OUTPUTS_DIR, `step2-${id}.json`);
      try {
        fs.writeFileSync(metadataFile, JSON.stringify(overlayMeta, null, 2));
      } catch (e) {
        console.warn('⚠️ Failed to write overlay metadata file:', e.message);
      }

      // Support returning the video bytes directly if requested
      const wantReturnFile = returnFile === true || returnFile === 'true';
      if (wantReturnFile) {
        try {
          res.setHeader('Content-Type', 'video/mp4');
          res.setHeader('Content-Disposition', `inline; filename="${outputFilename}"`);
          const stream = fs.createReadStream(outputPath);
          stream.on('error', (err) => {
            console.error('❌ Failed to stream output file:', err.message);
            if (!res.headersSent) {
              res.status(500).json({ error: 'Failed to stream output file.' });
            } else {
              res.end();
            }
          });
          return stream.pipe(res);
        } catch (e) {
          return res.status(500).json({ error: 'Failed to return video file.', details: e.message });
        }
      }

      // Support compact response shape if requested
      const wantCompact = compact === true || compact === 'true';
      const outputUrl = `/outputs/${outputFilename}`;
      if (wantCompact) {
        return res.status(200).json({
          output: { outputFilename, outputUrl }
        });
      }

      res.status(200).json({ 
        message: 'Step 2 complete. Text overlay added.', 
        id: id,
        outputFilename: outputFilename,
        outputUrl: outputUrl,
        metadataFile: `step2-${id}.json`,
        overlay: overlayMeta
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