const path = require('path');
const fs = require('fs');

const ROOT_DIR = __dirname.replace(/\/(utils)$/, '');
const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');
const PORT = Number(process.env.PORT || 3000);
const DEFAULTS = {
    duration: 10,
    width: 1920,
    height: 1080,
    framerate: 60,
};
const MODES = {
    calm: {
        contrast: 1.05,
        saturation: 1.1,
        vignette: true,
        blur: 6,
    },
    energy: {
        contrast: 1.3,
        saturation: 1.4,
        vignette: false,
        blur: 2,
    },
    grace: {
        contrast: 1.15,
        saturation: 1.25,
        vignette: true,
        blur: 4,
    },
    vintage: {
        contrast: 1.1,
        saturation: 0.8,
        vignette: true,
        blur: 2,
        sepia: true,
        noise: 0.2
    },
    noir: {
        contrast: 1.5,
        saturation: 0,
        vignette: true,
        blur: 1
    },
    dreamy: {
        contrast: 1.1,
        saturation: 1.2,
        vignette: false,
        blur: 15
    },
    shiver: {
        contrast: 1.2,
        saturation: 1.1,
        vignette: true,
        blur: 3,
        flicker: 0.2
    }, 
    kenburns: {
        contrast: 1.1,
        saturation: 1.1,
        vignette: true,
        blur: 2, // A very slight blur for a soft focus
        // We will add custom zoom/pan expressions here
        zoom_expr: "'min(1.20, 1+on*0.0005)'", // Slow, steady zoom capped at 120%
        pan_x_expr: "'iw/2-(iw/zoom/2)'", // Keep it centered
        pan_y_expr: "'ih/2-(ih/zoom/2)'", // Keep it centered
    },
};
[UPLOADS_DIR, OUTPUTS_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

module.exports = { ROOT_DIR, UPLOADS_DIR, OUTPUTS_DIR, PORT, MODES, DEFAULTS };
