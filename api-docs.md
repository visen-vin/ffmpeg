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
-   **Content-Type**: `application/json`

### Parameters

| Name            | Type   | In   | Description                                     | Required |
| :-------------- | :----- | :--- | :---------------------------------------------- | :------- |
| `inputFilename` | String | Body | The filename of the video to add the overlay to. | Yes      |
| `text`          | String | Body | The text content to overlay on the video.       | Yes      |
| `id`            | String | Body | An optional ID to use for the output filename. If not provided, a new one will be generated. | No       |

### Sample Request

**Without providing an ID (generates a new one):**

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step1-a1b2c3d4e5f6a7b8.mp4",
        "text": "Hello, World!"
      }'
```

**Providing an ID (to maintain a consistent workflow):**

```bash
curl -X POST http://localhost:3000/api/add-text-overlay \
  -H "Content-Type: application/json" \
  -d '{
        "inputFilename": "step1-a1b2c3d4e5f6a7b8.mp4",
        "text": "Hello, World!",
        "id": "a1b2c3d4e5f6a7b8"
      }'
```

### Sample Success Response (200 OK)

```json
{
  "message": "Step 2 complete. Text overlay added.",
  "id": "b2c3d4e5f6a7b8c9",
  "outputFilename": "step2-b2c3d4e5f6a7b8c9.mp4"
}
```

---

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

## 4. Download File

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
```

### Sample Success Response

The server responds with the video file as a downloadable attachment.