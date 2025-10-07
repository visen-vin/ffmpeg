const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const http = require('http'); // For downloading
const https = require('https'); // For downloading
const sharp = require('sharp'); // Add sharp for SVG generation

const app = express();
const port = 3000;

// --- Directory Setup ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const OUTPUTS_DIR = path.join(__dirname, 'outputs');
[UPLOADS_DIR, OUTPUTS_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// --- Multer Configuration for File Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Serve the output files statically
app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Executes an FFmpeg command and returns a promise.
 * @param {string[]} command - An array of strings representing the ffmpeg command.
 * @returns {Promise<void>} A promise that resolves on success and rejects on error.
 */
function runFFmpegCommand(command) {
    return new Promise((resolve, reject) => {
        console.log(`🚀 Executing FFmpeg command...\n   ffmpeg ${command.join(' ')}`);
        const process = spawn('ffmpeg', command);
        let stderr = '';
        process.stderr.on('data', (data) => { stderr += data.toString(); });
        process.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Success!');
                resolve();
            } else {
                console.error(`❌ FFmpeg Error (code ${code}):`, stderr);
                reject(new Error(`FFmpeg failed with code ${code}:\n${stderr}`));
            }
        });
        process.on('error', (err) => {
            console.error('❌ Failed to start FFmpeg process.', err);
            reject(err);
        });
    });
}

/**
 * Downloads a file from a URL to a destination path.
 * @param {string} url The URL of the file to download.
 * @param {string} dest The destination path to save the file.
 * @returns {Promise<void>}
 */
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const doRequest = (currentUrl) => {
            const protocol = currentUrl.startsWith('https') ? https : http;
            const request = protocol.get(currentUrl, (response) => {
                // Follow redirects (3xx)
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    const redirectUrl = new URL(response.headers.location, currentUrl).toString();
                    // Clean up the current file handle before retrying
                    file.close(() => {
                        fs.unlink(dest, () => {
                            doRequest(redirectUrl);
                        });
                    });
                    return;
                }

                if (response.statusCode !== 200) {
                    fs.unlink(dest, () => {}); // Clean up empty file
                    return reject(new Error(`Failed to download file. Status Code: ${response.statusCode}`));
                }
                response.pipe(file);
            });

            file.on('finish', () => {
                file.close(resolve);
            });

            request.on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });

            file.on('error', (err) => {
                fs.unlink(dest, () => reject(err));
            });
        };

        doRequest(url);
    });
}

// --- API Endpoint 1: Image to Video ---
app.post('/api/image-to-video', upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Missing image file.' });
    }

    const imagePath = req.file.path;
    const duration = req.body.duration || 7;
    const resolution = "1080x1920";
    const [width, height] = resolution.split('x').map(Number);
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const outputFilename = `step1_video_${uniqueId}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    try {
        console.log("\n--- Step 1: Cinematic style: eased zoom, blur+fade first half, grain, grading, vignette, stronger zoom second half ---");
        const scale_w = Math.round(width * 1.5);
        const frames = Number(duration) * 30;
        const halfFrames = Math.floor(frames / 2);
        const halfDuration = Number(duration) / 2;
        // Eased zoom across duration with extra boost in the second half for a stronger zoomed feel
        const baseEase = `1.05+0.20*(0.5-0.5*cos(PI*on/${frames}))`;
        const secondHalfBoost = `0.10*if(gt(on,${halfFrames}),(on-${halfFrames})/${halfFrames},0)`;
        const zoomExpr = `min(1.35,${baseEase}+${secondHalfBoost})`;
        // Maintain 20% top/bottom padding
        const content_h = Math.round(height * 0.60);
        const pad_y = Math.round(height * 0.20);
        
        // Cinematic chain: scale -> eased zoompan (with second-half boost) -> pad -> gblur(first half) -> fade-in(first half) -> film grain -> grading (contrast/desat) -> vignette
        const videoFilters = `scale=${scale_w}:-1,zoompan=z='${zoomExpr}':d=${frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${width}x${content_h},pad=${width}:${height}:0:${pad_y}:color=black,gblur=sigma=8:steps=2:enable='between(t,0,${halfDuration})',fade=t=in:st=0:d=${halfDuration},noise=c0s=8:c1s=8:c2s=8:allf=t,eq=contrast=1.05:saturation=0.95,vignette`;

        const command = [
            '-loop', '1', '-framerate', '30', '-i', imagePath,
            '-vf', videoFilters, '-c:v', 'libx264', '-t', String(duration),
            '-pix_fmt', 'yuv420p', '-y', outputPath
        ];
        await runFFmpegCommand(command);
        
        res.status(200).json({
            message: 'Step 1 complete. Video created from image.',
            outputFilename: outputPath
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed during video creation.', details: error.message });
    } finally {
        fs.unlink(imagePath, err => { if (err) console.error(`Failed to delete uploaded image: ${imagePath}`); });
    }
});

// --- API Endpoint 2: Add Text Overlay ---
app.post('/api/add-text-overlay', upload.single('font'), async (req, res) => {
    const { videoFilename, text, fontUrl } = req.body;

    // We need either a font file upload or a font URL
    if ((!req.file && !fontUrl) || !videoFilename || !text) {
        return res.status(400).json({ error: 'Missing font (either file or fontUrl), videoFilename, or text field.' });
    }

    let fontPath;
    const inputVideoPath = path.join(OUTPUTS_DIR, videoFilename);
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const outputFilename = `step2_text_${uniqueId}.mp4`;
    const outputPath = path.join(OUTPUTS_DIR, outputFilename);

    if (!fs.existsSync(inputVideoPath)) {
        // If the font was uploaded, we should clean it up before exiting
        if (req.file) {
            fs.unlink(req.file.path, () => {});
        }
        return res.status(404).json({ error: 'Input video file not found on server.' });
    }

    try {
        // --- 1. Get Font Path ---
        if (req.file) {
            fontPath = req.file.path;
        } else {
            console.log(`Downloading font from: ${fontUrl}`);
            const uniqueFontName = `font-${uniqueId}.ttf`;
            fontPath = path.join(UPLOADS_DIR, uniqueFontName);
            await downloadFile(fontUrl, fontPath);
            console.log(`Font downloaded to: ${fontPath}`);
        }

        // --- 2. Add text overlay using FFmpeg drawtext (no SVG decoding required) ---
        console.log("\n--- Step 2: Adding text overlay with drawtext ---");
        // Escape characters that conflict with drawtext's parameter separators
        const escapedText = String(text)
            .replace(/\\/g, "\\\\")  // backslashes
            .replace(/:/g, "\\:")        // colons separate drawtext params
            .replace(/'/g, "\\'");       // single quotes in text

        const fontSize = 80;
        const drawtextFilter = `drawtext=fontfile=${fontPath}:text='${escapedText}':fontcolor=white:bordercolor=black:borderw=8:fontsize=${fontSize}:x=(w-text_w)/2:y=h*0.9-text_h/2`;

        const command = [
            '-i', inputVideoPath,
            '-vf', drawtextFilter,
            '-c:v', 'libx264',
            '-c:a', 'copy',
            '-pix_fmt', 'yuv420p',
            '-y', outputPath
        ];
        await runFFmpegCommand(command);

        res.status(200).json({
            message: 'Step 2 complete. Text overlay added.',
            outputFilename: outputFilename
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add text overlay.', details: error.message });
    } finally {
        // Clean up the font file if it exists
        if (fontPath) {
            fs.unlink(fontPath, err => { if (err) console.error(`Failed to delete font file: ${fontPath}`); });
        }
    }
});


// --- API Endpoint 3: Merge with Audio and Finalize ---
app.post('/api/merge-with-audio', upload.single('audio'), async (req, res) => {
    const { videoFilename, cleanupFilenames } = req.body; // cleanupFilenames is a JSON string array
    if (!req.file || !videoFilename) {
        return res.status(400).json({ error: 'Missing audio file or videoFilename.' });
    }

    const audioPath = req.file.path;
    const inputVideoPath = path.join(OUTPUTS_DIR, videoFilename);
    const uniqueId = crypto.randomBytes(8).toString('hex');
    const finalOutputName = `final_video_${uniqueId}.mp4`;
    const finalOutputPath = path.join(OUTPUTS_DIR, finalOutputName);
    
    if (!fs.existsSync(inputVideoPath)) {
        return res.status(404).json({ error: 'Input video file not found on server.' });
    }

    try {
        console.log("\n--- Step 3: Merging with audio ---");
        const command = [
            '-i', inputVideoPath, '-i', audioPath, '-c:v', 'copy',
            '-c:a', 'aac', '-map', '0:v:0', '-map', '1:a:0',
            '-shortest', '-y', finalOutputPath
        ];
        await runFFmpegCommand(command);

        res.status(200).json({
            message: 'Video created successfully!',
            url: finalOutputName
        });

    } catch (error) {
        res.status(500).json({ error: 'Failed to merge audio.', details: error.message });
    } finally {
        // --- Cleanup ---
        const filesToClean = [audioPath, inputVideoPath];
        if (cleanupFilenames) {
            try {
                const parsedFilenames = JSON.parse(cleanupFilenames);
                if (Array.isArray(parsedFilenames)) {
                    parsedFilenames.forEach(f => filesToClean.push(path.join(OUTPUTS_DIR, f)));
                }
            } catch (e) { console.error("Error parsing cleanup filenames:", e); }
        }
        
        console.log("\n--- Cleaning up files ---");
        filesToClean.forEach(file => {
            fs.unlink(file, err => {
                if (err) console.error(`Failed to delete temp file: ${file}`);
                else console.log(`Deleted ${file}`);
            });
        });
    }
});

// --- API Endpoint 4: Download file from outputs by filename ---
app.get('/api/download', (req, res) => {
    const { filename } = req.query;
    if (!filename) {
        return res.status(400).json({ error: 'Missing filename query parameter.' });
    }

    // Basic path traversal protection: only allow plain filenames
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ error: 'Invalid filename.' });
    }

    const filePath = path.join(OUTPUTS_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found in outputs.' });
    }

    // Force download with the provided filename
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error('Download error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to download file.' });
            }
        }
    });
});

app.listen(port, () => {
    console.log(`✅ Server is running on http://localhost:${port}`);
});



