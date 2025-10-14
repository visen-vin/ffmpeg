# API Documentation

This document provides details on the available API endpoints for the video creation and manipulation service.

## Base URL

All API endpoints are relative to the base URL where the service is running (e.g., `http://localhost:3000`).

## Common Workflow

The typical workflow involves chaining the APIs in sequence:

1.  **Step 1: Image to Video**: Create a base video from an image. This step returns an `outputFilename`.
2.  **Step 2: Add Text Overlay (Optional)**: Add text to a video by providing its `inputFilename`.
3.  **Step 3: Merge with Audio**: Add a default audio track to a video by providing its `inputFilename`.
4.  **Download**: Use the `/api/download` endpoint to retrieve any of the generated video files.

---

## 1. Step 1: Image to Video

Creates a video from a single image with a zoom-pan effect.

-   **Endpoint**: `/api/image-to-video`
-   **Method**: `POST`
-   **Content-Type**: `multipart/form-data`

### Parameters

| Name      | Type   | In   | Description                                       | Required |
| :-------- | :----- | :--- | :------------------------------------------------ | :------- |
| `image`   | File   | Body | The image file to convert to video.               | Yes      |
| `duration`| Number | Body | The duration of the output video in seconds.      | No (8)   |

### Sample Request

```bash
curl -X POST http://localhost:3000/api/image-to-video \
  -F "image=@/path/to/your/image.jpg" \
  -F "duration=10"
```

### Sample Success Response (200 OK)

The response includes a unique `id` and the `outputFilename` for the generated video.

```json
{
  "message": "Step 1 complete. Video created from image.",
  "id": "a1b2c3d4e5f6a7b8",
  "outputFilename": "step1-a1b2c3d4e5f6a7b8.mp4"
}
```

---

## 2. Step 2: Add Text Overlay

Adds a text overlay to a previously generated video.

-   **Endpoint**: `/api/add-text-overlay`
-   **Method**: `POST`
-   **Content-Type**: `application/json` or `multipart/form-data`

### Parameters

| Name                | Type   | In   | Description                                                                                 | Required |
| :------------------ | :----- | :--- | :------------------------------------------------------------------------------------------ | :------- |
| `inputFilename`     | String | Body | The filename of the video to add the overlay to.                                            | Yes (JSON) / No (multipart) |
| `video`             | File   | Form | Uploaded video file (field name: `video`).                                                  | Yes (multipart) / No (JSON) |
| `text`              | String | Body | The main text content to overlay on the video.                                              | Yes      |
| `attribution`       | String | Body | Optional attribution text, styled differently.                                              | No       |
| `id`                | String | Body | Optional ID to use for the output filename. If not provided, a new one will be generated.   | No       |
| `style`             | String | Body | Overlay style. `reference` = white top bar; any other value = translucent dark overlay. Default: `reference`. | No |
| `visibleLastSeconds`| Number | Body | Overlay timing. Show only during the last N seconds. `0` (or omitted) = full duration.      | No       |
| `compact`           | Boolean | Body | If `true`, returns a minimal response containing only `output.outputFilename`. | No |
| `returnFile`        | Boolean | Body | If `true`, the API returns the rendered MP4 bytes with `Content-Type: video/mp4`. | No |

### Text Overlay Features

- Style options:
  - `reference`: White full-width top bar with centered black quote and red attribution.
  - Other values: Translucent dark overlay behind the text with bold white quote and orange attribution.
- Emoji support: Shortcodes like `:rocket:` and `:smile:` are converted to real emoji.
- HTML safety: HTML is sanitized and not rendered. Tags like `<b>` and `<br>` appear as text.
- Wrapping: Text auto-wraps by words to fit the available width.
- Timing: Overlay is always visible for the full video duration. The `visibleLastSeconds` field is accepted for backward compatibility but currently ignored.

### Sample Requests

**JSON (without providing an ID; generates a new one):**

```bash
# With only text (default style, full duration)
curl -X POST http://localhost:3000/api/add-text-overlay \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step1-a1b2c3d4e5f6a7b8.mp4",
        "text": "Hello, World!",
        "style": "reference",
        "visibleLastSeconds": 0
      }'

# With text and attribution (show overlay only in last 3 seconds)
curl -X POST http://localhost:3000/api/add-text-overlay \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step1-a1b2c3d4e5f6a7b8.mp4",
        "text": "Just like we change old clothes and wear new ones, the soul also leaves an old body behind and takes a new one. Life does not end it simply changes form",
        "attribution": "Bhagavad Gita 2.22",
        "style": "reference",
        "visibleLastSeconds": 3
      }'
```

**Providing an ID (to maintain a consistent workflow):**

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step1-a1b2c3d4e5f6a7b8.mp4",
        "text": "Hello, World!",
        "attribution": "Bhagavad Gita 2.22",
        "style": "reference",
        "visibleLastSeconds": 0,
        "id": "a1b2c3d4e5f6a7b8"
      }'
```

### Sample Success Response (200 OK)

```json
{
  "message": "Step 2 complete. Text overlay added.",
  "id": "b2c3d4e5f6a7b8c9",
  "outputFilename": "step2-b2c3d4e5f6a7b8c9.mp4",
  "metadataFile": "step2-b2c3d4e5f6a7b8c9.json",
  "overlay": {
    "style": "reference",
    "visibleLastSeconds": 0,
    "text": "Just like we change old clothes and...",
    "attribution": "Bhagavad Gita 2.22",
    "video": { "width": 1080, "height": 1920, "durationSec": 7 },
    "layout": {
      "fontSize": 48,
      "lineSpacing": 58,
      "mainTextTop": 160,
      "attributionY": 503,
      "rectY": 0,
      "rectHeight": 546.5,
      "sideMargin": 86.4,
      "textAreaWidth": 907.2
    },
    "input": {
      "source": "uploaded",
      "path": "/absolute/path/to/uploads/filename.mp4",
      "originalName": "filename.mp4"
    },
    "output": { "outputFilename": "step2-b2c3d4e5f6a7b8c9.mp4" }
  }
}
```

### Compact Success Response (200 OK)

Returned when the request includes `compact=true` (JSON boolean or multipart form field).

```json
{
  "output": {
    "outputFilename": "step2-b2c3d4e5f6a7b8c9.mp4",
    "outputUrl": "/outputs/step2-b2c3d4e5f6a7b8c9.mp4"
  }
}
```

### Notes on Multipart vs JSON

- When uploading with `multipart/form-data`, include the video file under the `video` field and include the other fields (`text`, `attribution`, `style`, `visibleLastSeconds`, `id`) as regular form fields.
- When using `application/json`, provide `inputFilename` to reference a video already present in the `outputs/` directory.
- The overlay output includes a sidecar JSON file (`metadataFile`) containing all relevant parameters for reproducibility.
- Compact response: Add `compact=true` to the request body (JSON) or as a form field when using multipart to receive only the `output.outputFilename`.
- Timing: The overlay currently renders for the full duration of the video; `visibleLastSeconds` is ignored.
- Inline file: Add `returnFile=true` to stream the video file directly in the response with `Content-Type: video/mp4`. Use `curl -o` or your HTTP client to save the file.

---

## 7. Plain Background Video

Generates a solid-color background video, useful for testing overlays and layouts.

- **Endpoint**: `/api/plain-background`
- **Method**: `POST`
- **Content-Type**: `application/json`

### Parameters

| Name        | Type   | In   | Description                                                  | Required |
| :---------- | :----- | :--- | :----------------------------------------------------------- | :------- |
| `duration`  | Number | Body | Duration of the output in seconds (default: 7).             | No       |
| `color`     | String | Body | Background color name or hex (e.g., `black`, `#FFFFFF`).    | No       |
| `id`        | String | Body | Optional identifier for output filename.                    | No       |
| `width`     | Number | Body | Video width in pixels (default: 1080).                      | No       |
| `height`    | Number | Body | Video height in pixels (default: 1920).                     | No       |

### Sample Request

```bash
# Create a 7-second black background video
curl -X POST http://localhost:3000/api/plain-background \
  -H "Content-Type: application/json" \
  -d '{
        "duration": 7,
        "color": "black"
      }'
```

### Sample Success Response (200 OK)

```json
{
  "message": "Plain background video created successfully.",
  "id": "6fd5b62c8c2bfd25",
  "outputFilename": "plain-6fd5b62c8c2bfd25.mp4"
}
```

### Follow-up: Apply an Overlay to the Plain Background

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "plain-6fd5b62c8c2bfd25.mp4",
        "text": "Just like we change old clothes and wear new ones...",
        "attribution": "Bhagavad Gita 2.22",
        "style": "reference",
        "visibleLastSeconds": 0,
        "id": "6fd5b62c8c2bfd25"
      }'
```

## 3. Step 3: Merge with Audio

Merges a video from a previous step with a default audio file.

-   **Endpoint**: `/api/merge-with-audio`
-   **Method**: `POST`
-   **Content-Type**: `application/json`

### Parameters

| Name            | Type   | In   | Description                                     | Required |
| :-------------- | :----- | :--- | :---------------------------------------------- | :------- |
| `inputFilename` | String | Body | The filename of the video to merge with audio. | Yes      |
| `id`            | String | Body | An optional ID to use for the output filename. If not provided, a new one will be generated. | No       |

### Sample Request

**Without providing an ID (generates a new one):**

```bash
# Using the output from Step 2
curl -X POST http://localhost:3000/api/merge-with-audio \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step2-b2c3d4e5f6a7b8c9.mp4"
      }'
```

**Providing an ID (to maintain a consistent workflow):**

```bash
# Using the output from Step 2 and the ID from Step 1
curl -X POST http://localhost:3000/api/merge-with-audio \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step2-a1b2c3d4e5f6a7b8.mp4",
        "id": "a1b2c3d4e5f6a7b8"
      }'
```

### Sample Success Response (200 OK)

```json
{
  "message": "Step 3 complete. Audio merged.",
  "id": "c3d4e5f6a7b8c9d0",
  "outputFilename": "step3-c3d4e5f6a7b8c9d0.mp4"
}
```

---

## 4. Long Video Creation

Creates a YouTube-style long video (1920x1080) by looping a default video to match the duration of an audio file.

-   **Endpoint**: `/api/long-video`
-   **Method**: `POST`
-   **Content-Type**: `multipart/form-data` (for binary upload) or `application/json` (for filename reference)

### Features

*   **Default Video**: Uses `bgvideolong.mp4` as the default background video
*   **YouTube Dimensions**: Outputs video in 1920x1080 resolution with proper scaling and padding
*   **Audio Synchronization**: Loops the video to match the exact duration of the audio file
*   **Dual Input Methods**: Supports both binary file upload and filename reference

### Parameters (Binary Upload Method)

| Name    | Type | In   | Description                           | Required |
| :------ | :--- | :--- | :------------------------------------ | :------- |
| `audio` | File | Body | The audio file to sync with the video | Yes      |

### Parameters (Filename Reference Method)

| Name            | Type   | In   | Description                                    | Required |
| :-------------- | :----- | :--- | :--------------------------------------------- | :------- |
| `audioFilename` | String | Body | The filename of the audio file in test_files  | Yes      |
| `videoFilename` | String | Body | Optional custom video file (defaults to bgvideolong.mp4) | No |

### Sample Requests

**Binary File Upload (Recommended):**

```bash
curl -X POST http://178.16.137.62:3000/api/long-video \
  -F "audio=@/path/to/your/audio.mp3"
```

**Filename Reference (Backward Compatible):**

```bash
curl -X POST http://localhost:3000/api/long-video \
  -H "Content-Type: application/json" \
  -d '{
        "audioFilename": "1.mp3"
      }'

# With custom video file
curl -X POST http://localhost:3000/api/long-video \
  -H "Content-Type: application/json" \
  -d '{
        "audioFilename": "1.mp3",
        "videoFilename": "custom-video.mp4"
      }'
```

### Sample Success Response (200 OK)

```json
{
  "message": "Successfully created long video with looped playback matching audio duration.",
  "id": "d8860bce359e85de",
  "outputFilename": "long-video-d8860bce359e85de.mp4"
}
```

---

## 5. Upload Video for Future Use

Stores an uploaded video into the `outputs/` directory and returns only the stored filename. Use this filename later with other APIs (e.g., `add-text-overlay` via `inputFilename`) or download via `/api/download`.

-   **Endpoint**: `/api/upload-video`
-   **Method**: `POST`
-   **Content-Type**: `multipart/form-data`

### Parameters

| Name    | Type | In   | Description                                 | Required |
| :------ | :--- | :--- | :------------------------------------------ | :------- |
| `video` | File | Body | The video file to store for future use.     | Yes      |
| `id`    | String | Body | Optional identifier used in stored filename. | No       |

### Sample Request

```bash
curl -X POST http://localhost:3000/api/upload-video \
  -F "video=@/path/to/your/video.mp4" \
  -F "id=my-video"
```

### Sample Success Response (200 OK)

```json
{
  "outputFilename": "uploaded-my-video.mp4"
}
```

---

## 6. Download File

Provides a direct download link for any generated video file.

-   **Endpoint**: `/api/download`
-   **Method**: `GET`

### Parameters

| Name       | In    | Description                               | Required |
| :--------- | :---- | :---------------------------------------- | :------- |
| `filename` | Query | The full filename of the video to download. | Yes      |

### Sample Request

Use the `outputFilename` from any of the previous steps.

```bash
# Download the final video from Step 3
curl -o "final_video.mp4" "http://localhost:3000/api/download?filename=step3-a1b2c3d4e5f6a7b8.mp4"

# Download a long video
curl -o "my_long_video.mp4" "http://localhost:3000/api/download?filename=long-video-d8860bce359e85de.mp4"
```

### Sample Success Response

The server responds with the video file as a downloadable attachment.

---

## 7. Cleanup Temporary Files

Removes all temporary files from the uploads and outputs directories to free up disk space.

-   **Endpoint**: `/api/cleanup`
-   **Method**: `DELETE`

### Parameters

No parameters required.

### Sample Request

```bash
# Clean all temporary files
curl -X DELETE "http://localhost:3000/api/cleanup"
```

### Sample Success Response (200 OK)

```json
{
  "message": "Cleanup completed",
  "deletedFiles": [
    "uploads/1760030962580-1.mp3",
    "uploads/1760031029807-2.mp3",
    "outputs/long-video-72a3824dcbcc38c6.mp4",
    "outputs/step2-7098dabf9ec1e738.mp4"
  ],
  "deletedCount": 4
}
```

### Sample Response with Errors (200 OK)

```json
{
  "message": "Cleanup completed with some errors",
  "deletedFiles": [
    "uploads/file1.mp3",
    "outputs/video1.mp4"
  ],
  "deletedCount": 2,
  "errors": [
    "Failed to delete outputs/locked-file.mp4: EBUSY: resource busy or locked"
  ]
}
```

### Error Response (500 Internal Server Error)

```json
{
  "error": "Cleanup failed",
  "details": "Permission denied"
}
```

---

## 8. Add Background Music

**Endpoint:** `POST /api/add-background-music`

**Description:** Adds looped background music to a video with intelligent audio handling. The system automatically detects if the input video has existing audio and handles it appropriately:
- **Videos with existing audio**: Mixes the original audio with background music, preserving both tracks
- **Videos without audio**: Simply adds the background music as the audio track

The background audio file is automatically looped to match the full duration of the input video.

**Method:** POST

**Content-Type:** multipart/form-data

### Parameters

- `video` (file, required): The video file to add background music to
- `id` (string, optional): Custom identifier for the output file
- `volume` (number, optional): Background music volume (0.0 to 1.0, default: 0.3)

### Sample Request

```bash
# Add background music to a video
curl -X POST "http://localhost:3000/api/add-background-music" \
  -F "video=@/path/to/your/video.mp4" \
  -F "id=my-video-with-music" \
  -F "volume=0.5"
```

### Sample Success Response (200 OK)

```json
{
  "message": "Background music added successfully.",
  "id": "my-video-with-music",
  "outputFilename": "bg-music-my-video-with-music.mp4",
  "videoDuration": 45.2,
  "backgroundVolume": "0.5"
}
```

### Error Responses

**400 Bad Request - No video file:**
```json
{
  "error": "No video file uploaded."
}
```

**404 Not Found - Background audio missing:**
```json
{
  "error": "Background audio file not found."
}
```

**500 Internal Server Error:**
```json
{
  "error": "Failed to add background music",
  "details": "FFmpeg processing error details"
}
```
**Multipart upload (uploading a video file and providing an ID):**

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -F "video=@outputs/plain-6fd5b62c8c2bfd25.mp4" \
  -F "text=Just like we change old clothes and wear new ones..." \
  -F "attribution=Bhagavad Gita 2.22" \
  -F "style=reference" \
  -F "id=6fd5b62c8c2bfd25"
```

**Multipart upload with compact response:**

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -F "video=@outputs/plain-6fd5b62c8c2bfd25.mp4" \
  -F "text=Just like we change old clothes and wear new ones..." \
  -F "attribution=Bhagavad Gita 2.22" \
  -F "style=reference" \
  -F "id=6fd5b62c8c2bfd25" \
  -F "compact=true"
```

**Multipart upload returning the video file directly:**

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -F "video=@outputs/plain-6fd5b62c8c2bfd25.mp4" \
  -F "text=Just like we change old clothes and wear new ones..." \
  -F "attribution=Bhagavad Gita 2.22" \
  -F "style=reference" \
  -F "id=6fd5b62c8c2bfd25" \
  -F "returnFile=true" \
  -o step2-inline.mp4
```