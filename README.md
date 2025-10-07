# Kinetic API - Cinematic Video Processing

A Node.js backend application that creates cinematic 4K videos with professional effects, combining background videos, audio, and text overlays asynchronously.

## Features

- **Asynchronous Processing**: Submit jobs and get immediate responses
- **Cinematic Effects**: Professional video processing with slow motion, color grading, and vignette
- **9:16 Aspect Ratio**: Optimized for vertical video content
- **Text Overlay**: Elegant text with drop shadow and fade-in animation
- **4K Output**: Generates high-quality 4K vertical videos (2160x3840)
- **RESTful API**: Simple endpoints for job submission and status checking

## Prerequisites

- Node.js (v14 or higher)
- FFmpeg installed on your system
- FFprobe (usually comes with FFmpeg)

### Installing FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from https://ffmpeg.org/download.html

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

Or start the production server:
```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### POST /jobs
Create a new video processing job.

**Request:**
- Method: POST
- Content-Type: multipart/form-data
- Fields:
  - `backgroundVideo` (file): Background video file for cinematic processing
  - `audio` (file): Audio file for duration and soundtrack
  - `text` (string): Text to overlay on the video

**Response:**
```json
{
  "jobId": "uuid-string",
  "statusUrl": "/jobs/uuid-string"
}
```

### GET /jobs/:jobId
Check the status of a video processing job.

**Response:**
```json
{
  "jobId": "uuid-string",
  "status": "pending|processing|completed|failed",
  "videoUrl": "/outputs/output-uuid-string.mp4",
  "error": "error message if failed",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

### GET /health
Health check endpoint.

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Usage Example

### Using curl:

1. **Submit a job:**
```bash
curl -X POST http://localhost:3000/jobs \
  -F "backgroundVideo=@/path/to/your/video.mp4" \
  -F "audio=@/path/to/your/audio.mp3" \
  -F "text=Your overlay text here"
```

2. **Check job status:**
```bash
curl http://localhost:3000/jobs/YOUR_JOB_ID
```

3. **Download completed video:**
```bash
curl -O http://localhost:3000/outputs/output-YOUR_JOB_ID.mp4
```

### Using JavaScript (fetch):

```javascript
// Submit a job
const formData = new FormData();
formData.append('backgroundVideo', videoFile);
formData.append('audio', audioFile);
formData.append('text', 'Your overlay text');

const response = await fetch('http://localhost:3000/jobs', {
  method: 'POST',
  body: formData
});

const job = await response.json();
console.log('Job ID:', job.jobId);

// Check status
const statusResponse = await fetch(`http://localhost:3000/jobs/${job.jobId}`);
const status = await statusResponse.json();
console.log('Status:', status.status);
```

## Video Processing Details

The application creates videos with the following specifications:

- **Resolution**: 4K Vertical (2160x3840)
- **Aspect Ratio**: 9:16 (optimized for mobile/vertical viewing)
- **Video Codec**: H.264 (libx264)
- **Audio Codec**: AAC
- **Cinematic Effects**: 
  - Slow motion (25% slowdown)
  - Color grading (increased contrast and saturation)
  - Vignette effect for focus
  - Fade-in from black
- **Text Overlay**: Georgia serif font with drop shadow and fade-in animation
- **Duration**: Matches the input audio file duration

## File Structure

```
kinetic-api/
├── uploads/          # Temporary storage for uploaded files
├── outputs/          # Final rendered videos
├── server.js         # Main application file
├── package.json      # Dependencies and scripts
└── README.md         # This file
```

## Error Handling

The API includes comprehensive error handling:

- File validation (required fields, file types)
- FFmpeg processing errors
- Sharp image processing errors
- Automatic cleanup of temporary files
- Detailed error messages in job status

## Development

The application uses nodemon for development, which automatically restarts the server when files change.

```bash
npm run dev
```

## Production Considerations

For production deployment, consider:

- Using a proper database instead of in-memory storage
- Implementing job persistence and recovery
- Adding authentication and rate limiting
- Using a message queue for job processing
- Implementing proper logging and monitoring
- Adding file size and type validation
- Setting up proper error tracking

## License

MIT
