const express = require("express");
const multer = require("multer");
const { execFile } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

const YTDLP_PATH = path.join(__dirname, "yt-dlp.exe");
const FFMPEG_PATH = "C:\\Users\\SHAIKH~1\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.1-full_build\\bin\\ffmpeg.exe";
const OUTPUT_DIR = path.join(__dirname, "output");
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|mkv|avi|mov|webm|flv|wmv|m4v|3gp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = /video/.test(file.mimetype);
    if (ext || mime) cb(null, true);
    else cb(new Error("Only video files are allowed"));
  },
});

app.use(express.json());
app.use(express.static(path.join(__dirname, "frontend", "dist")));
app.use("/output", express.static(OUTPUT_DIR));

function cleanupFile(filePath, delay = 60000) {
  setTimeout(() => {
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch (e) {}
    }
  }, delay);
}

function fetchMetadata(url) {
  return new Promise((resolve, reject) => {
    const args = [
      "--no-playlist",
      "--dump-json",
      "--no-warnings",
      url,
    ];
    execFile(YTDLP_PATH, args, { timeout: 30000 }, (error, stdout, stderr) => {
      if (error) {
        return reject(new Error(stderr || error.message));
      }
      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || "Untitled",
          thumbnail: info.thumbnail || "",
          duration: info.duration ? String(info.duration) : "0",
          channelName: info.channel || info.uploader || "",
        });
      } catch (e) {
        reject(new Error("Failed to parse video metadata"));
      }
    });
  });
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

app.post("/api/url-to-mp3", (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const id = uuidv4();
  const outputTemplate = path.join(OUTPUT_DIR, `${id}.%(ext)s`);
  const finalPath = path.join(OUTPUT_DIR, `${id}.mp3`);

  const args = [
    "--no-playlist",
    "-x",
    "--audio-format", "mp3",
    "--audio-quality", "0",
    "-o", outputTemplate,
    "--no-warnings",
    "--restrict-filenames",
    url,
  ];

  fetchMetadata(url).then((metadata) => {
    execFile(YTDLP_PATH, args, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error("yt-dlp error:", stderr || error.message);
        return res.status(500).json({
          error: "Failed to download audio. Check the URL and try again.",
          details: stderr || error.message,
        });
      }

      if (!fs.existsSync(finalPath)) {
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(id));
        if (files.length > 0) {
          const actualFile = path.join(OUTPUT_DIR, files[0]);
          const renamedPath = path.join(OUTPUT_DIR, `${id}.mp3`);
          fs.renameSync(actualFile, renamedPath);
          const stats = fs.statSync(renamedPath);
          cleanupFile(renamedPath);
          return res.json({
            success: true,
            downloadUrl: `/output/${id}.mp3`,
            filename: `audio_${id}.mp3`,
            metadata: {
              ...metadata,
              duration: formatDuration(Number(metadata.duration)),
            },
            fileSize: (stats.size / (1024 * 1024)).toFixed(1) + " MB",
          });
        }
        return res.status(500).json({ error: "Conversion failed. No output file generated." });
      }

      const stats = fs.statSync(finalPath);
      cleanupFile(finalPath);
      res.json({
        success: true,
        downloadUrl: `/output/${id}.mp3`,
        filename: `audio_${id}.mp3`,
        metadata: {
          ...metadata,
          duration: formatDuration(Number(metadata.duration)),
        },
        fileSize: (stats.size / (1024 * 1024)).toFixed(1) + " MB",
      });
    });
  }).catch((metaErr) => {
    console.error("Metadata fetch failed, continuing anyway:", metaErr.message);
    execFile(YTDLP_PATH, args, { timeout: 300000 }, (error, stdout, stderr) => {
      if (error) {
        console.error("yt-dlp error:", stderr || error.message);
        return res.status(500).json({
          error: "Failed to download audio. Check the URL and try again.",
          details: stderr || error.message,
        });
      }

      if (!fs.existsSync(finalPath)) {
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(id));
        if (files.length > 0) {
          const actualFile = path.join(OUTPUT_DIR, files[0]);
          const renamedPath = path.join(OUTPUT_DIR, `${id}.mp3`);
          fs.renameSync(actualFile, renamedPath);
          const stats = fs.statSync(renamedPath);
          cleanupFile(renamedPath);
          return res.json({
            success: true,
            downloadUrl: `/output/${id}.mp3`,
            filename: `audio_${id}.mp3`,
            metadata: null,
            fileSize: (stats.size / (1024 * 1024)).toFixed(1) + " MB",
          });
        }
        return res.status(500).json({ error: "Conversion failed. No output file generated." });
      }

      const stats = fs.statSync(finalPath);
      cleanupFile(finalPath);
      res.json({
        success: true,
        downloadUrl: `/output/${id}.mp3`,
        filename: `audio_${id}.mp3`,
        metadata: null,
        fileSize: (stats.size / (1024 * 1024)).toFixed(1) + " MB",
      });
    });
  });
});

app.post("/api/video-to-mp3", upload.single("video"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Video file is required" });

  const id = uuidv4();
  const inputPath = req.file.path;
  const outputPath = path.join(OUTPUT_DIR, `${id}.mp3`);
  const originalName = path.parse(req.file.originalname).name;

  const args = [
    "-i", inputPath,
    "-vn",
    "-acodec", "libmp3lame",
    "-ab", "192k",
    "-ar", "44100",
    "-y",
    outputPath,
  ];

  execFile(FFMPEG_PATH, args, { timeout: 600000 }, (error, stdout, stderr) => {
    cleanupFile(inputPath, 10000);

    if (error) {
      console.error("ffmpeg error:", stderr || error.message);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      return res.status(500).json({
        error: "Failed to convert video. Make sure it's a valid video file.",
        details: stderr || error.message,
      });
    }

    if (!fs.existsSync(outputPath)) {
      return res.status(500).json({ error: "Conversion failed. No output file generated." });
    }

    cleanupFile(outputPath);
    res.json({
      success: true,
      downloadUrl: `/output/${id}.mp3`,
      filename: `${originalName}.mp3`,
    });
  });
});

app.post("/api/url-to-mp4", (req, res) => {
  const { url, quality } = req.body;
  if (!url) return res.status(400).json({ error: "URL is required" });

  const id = uuidv4();
  const outputTemplate = path.join(OUTPUT_DIR, `${id}.%(ext)s`);
  const finalPath = path.join(OUTPUT_DIR, `${id}.mp4`);

  const qualityMap = {
    '360': 'bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]/best[height<=360]',
    '480': 'bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]',
    '720': 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]',
    '1080': 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
  };
  const formatStr = qualityMap[quality] || qualityMap['1080'];

  const args = [
    "--no-playlist",
    "-f", formatStr,
    "--merge-output-format", "mp4",
    "-o", outputTemplate,
    "--no-warnings",
    "--restrict-filenames",
    url,
  ];

  fetchMetadata(url).then((metadata) => {
    execFile(YTDLP_PATH, args, { timeout: 600000 }, (error, stdout, stderr) => {
      if (error) {
        console.error("yt-dlp error:", stderr || error.message);
        return res.status(500).json({
          error: "Failed to download video. Check the URL and try again.",
          details: stderr || error.message,
        });
      }

      if (!fs.existsSync(finalPath)) {
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(id));
        if (files.length > 0) {
          const actualFile = path.join(OUTPUT_DIR, files[0]);
          if (actualFile !== finalPath) {
            fs.renameSync(actualFile, finalPath);
          }
        }
      }

      if (!fs.existsSync(finalPath)) {
        return res.status(500).json({ error: "Conversion failed. No output file generated." });
      }

      const stats = fs.statSync(finalPath);
      cleanupFile(finalPath);
      res.json({
        success: true,
        downloadUrl: `/output/${id}.mp4`,
        filename: `video_${id}.mp4`,
        metadata: {
          ...metadata,
          duration: formatDuration(Number(metadata.duration)),
        },
        fileSize: (stats.size / (1024 * 1024)).toFixed(1) + " MB",
      });
    });
  }).catch((metaErr) => {
    console.error("Metadata fetch failed, continuing anyway:", metaErr.message);
    execFile(YTDLP_PATH, args, { timeout: 600000 }, (error, stdout, stderr) => {
      if (error) {
        console.error("yt-dlp error:", stderr || error.message);
        return res.status(500).json({
          error: "Failed to download video. Check the URL and try again.",
          details: stderr || error.message,
        });
      }

      if (!fs.existsSync(finalPath)) {
        const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith(id));
        if (files.length > 0) {
          const actualFile = path.join(OUTPUT_DIR, files[0]);
          if (actualFile !== finalPath) {
            fs.renameSync(actualFile, finalPath);
          }
        }
      }

      if (!fs.existsSync(finalPath)) {
        return res.status(500).json({ error: "Conversion failed. No output file generated." });
      }

      const stats = fs.statSync(finalPath);
      cleanupFile(finalPath);
      res.json({
        success: true,
        downloadUrl: `/output/${id}.mp4`,
        filename: `video_${id}.mp4`,
        metadata: null,
        fileSize: (stats.size / (1024 * 1024)).toFixed(1) + " MB",
      });
    });
  });
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "dist", "index.html"));
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: "File too large. Maximum size is 2GB." });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
  next();
});

app.listen(PORT, () => {
  console.log(`Musica server running at http://localhost:${PORT}`);
});
