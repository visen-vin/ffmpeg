const express = require('express');
const multer = require('multer');
const path = require('path');
const { PORT, UPLOADS_DIR, OUTPUTS_DIR } = require('./utils/config');

const app = express();
app.use('/outputs', express.static(OUTPUTS_DIR));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage });

require('./routes/imageToVideo')(app, upload);
require('./routes/addTextOverlay')(app, upload);
require('./routes/mergeWithAudio')(app);
require('./routes/mergeLongVideo')(app, upload);
require('./routes/addThumbnail')(app);
require('./routes/addCaptions')(app);

app.listen(PORT, () => {
  console.log(`✅ Server is running on http://localhost:${PORT}`);
});



