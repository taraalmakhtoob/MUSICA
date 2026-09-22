const express = require("express");
const { execFile } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.PORT || 3000;

const YTDLP_PATH =
  process.env.YTDLP_PATH || "yt-dlp";

const FFMPEG_PATH =
  process.env.FFMPEG_PATH || "/usr/bin/ffmpeg";

const OUTPUT_DIR =
  path.join("/tmp", "musica-output");

const UPLOADS_DIR =
  path.join("/tmp", "musica-uploads");

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());

app.use(
  express.static(
    path.join(__dirname, "frontend", "dist")
  )
);

app.use(
  "/output",
  express.static(OUTPUT_DIR)
);


// ==========================================
// CLEANUP
// ==========================================

function cleanupFile(
  filePath,
  delay = 10 * 60 * 1000
) {
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch {}
  }, delay);
}


// ==========================================
// COMMON YOUTUBE SETTINGS
// ==========================================

// The PO-token provider automatically supplies
// tokens to yt-dlp when required.

const YOUTUBE_ARGS = [
  "--extractor-args",
  "youtube:player_client=mweb",
];


// ==========================================
// METADATA
// ==========================================

function fetchMetadata(url) {
  return new Promise((resolve, reject) => {

    const args = [
      "--no-playlist",
      "--dump-single-json",
      "--no-warnings",

      ...YOUTUBE_ARGS,

      url,
    ];

    execFile(
      YTDLP_PATH,
      args,
      {
        timeout: 60000,
      },
      (error, stdout, stderr) => {

        if (error) {
          return reject(
            new Error(
              stderr ||
              error.message ||
              "Metadata request failed"
            )
          );
        }

        try {

          const info =
            JSON.parse(stdout);

          resolve({
            title:
              info.title ||
              "Untitled",

            thumbnail:
              info.thumbnail ||
              "",

            duration:
              info.duration
                ? String(info.duration)
                : "0",

            channelName:
              info.channel ||
              info.uploader ||
              "",
          });

        } catch {

          reject(
            new Error(
              "Failed to parse video metadata"
            )
          );
        }
      }
    );
  });
}


// ==========================================
// DURATION
// ==========================================

function formatDuration(seconds) {

  const m =
    Math.floor(seconds / 60);

  const s =
    Math.floor(seconds % 60);

  return `${m}:${s
    .toString()
    .padStart(2, "0")}`;
}


// ==========================================
// MP3
// ==========================================

app.post(
  "/api/url-to-mp3",
  async (req, res) => {

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({
        success: false,
        error: "URL is required",
      });
    }

    const id = uuidv4();

    const outputTemplate =
      path.join(
        OUTPUT_DIR,
        `${id}.%(ext)s`
      );

    const finalPath =
      path.join(
        OUTPUT_DIR,
        `${id}.mp3`
      );

    const args = [

      "--no-playlist",

      "-x",

      "--audio-format",
      "mp3",

      "--audio-quality",
      "0",

      "--ffmpeg-location",
      FFMPEG_PATH,

      "-o",
      outputTemplate,

      "--no-warnings",

      "--restrict-filenames",

      ...YOUTUBE_ARGS,

      url,
    ];


    let metadata = null;

    try {

      metadata =
        await fetchMetadata(url);

    } catch (error) {

      console.log(
        "Metadata unavailable:",
        error.message
      );
    }


    execFile(
      YTDLP_PATH,
      args,
      {
        timeout:
          15 * 60 * 1000,
      },

      (error, stdout, stderr) => {

        if (error) {

          const details =
            stderr ||
            error.message ||
            "";

          console.error(
            "yt-dlp error:",
            details
          );

          return res.status(500).json({

            success: false,

            error:
              "YouTube conversion failed.",

            details,
          });
        }


        let actualFile =
          finalPath;


        if (
          !fs.existsSync(actualFile)
        ) {

          const files =
            fs
              .readdirSync(
                OUTPUT_DIR
              )
              .filter(
                file =>
                  file.startsWith(id)
              );


          if (files.length) {

            actualFile =
              path.join(
                OUTPUT_DIR,
                files[0]
              );

            fs.renameSync(
              actualFile,
              finalPath
            );

            actualFile =
              finalPath;
          }
        }


        if (
          !fs.existsSync(actualFile)
        ) {

          return res.status(500).json({

            success: false,

            error:
              "Conversion failed. No output file was generated.",
          });
        }


        const stats =
          fs.statSync(actualFile);


        cleanupFile(actualFile);


        return res.json({

          success: true,

          downloadUrl:
            `/output/${path.basename(
              actualFile
            )}`,

          filename:
            `audio_${id}.mp3`,

          metadata:
            metadata
              ? {
                  ...metadata,

                  duration:
                    formatDuration(
                      Number(
                        metadata.duration
                      )
                    ),
                }
              : null,

          fileSize:
            (
              stats.size /
              (1024 * 1024)
            ).toFixed(1) +
            " MB",
        });
      }
    );
  }
);


// ==========================================
// MP4
// ==========================================

app.post(
  "/api/url-to-mp4",
  async (req, res) => {

    const {
      url,
      quality,
    } = req.body;


    if (!url) {

      return res.status(400).json({

        success: false,

        error:
          "URL is required",
      });
    }


    const id = uuidv4();


    const outputTemplate =
      path.join(
        OUTPUT_DIR,
        `${id}.%(ext)s`
      );


    const finalPath =
      path.join(
        OUTPUT_DIR,
        `${id}.mp4`
      );


    const qualityMap = {

      360:
        "bestvideo[height<=360][ext=mp4]+bestaudio[ext=m4a]/best[height<=360][ext=mp4]",

      480:
        "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]",

      720:
        "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]",

      1080:
        "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]",
    };


    const format =
      qualityMap[
        String(quality)
      ] ||
      qualityMap["720"];


    const args = [

      "--no-playlist",

      "-f",
      format,

      "--merge-output-format",
      "mp4",

      "--ffmpeg-location",
      FFMPEG_PATH,

      "-o",
      outputTemplate,

      "--no-warnings",

      "--restrict-filenames",

      ...YOUTUBE_ARGS,

      url,
    ];


    let metadata = null;


    try {

      metadata =
        await fetchMetadata(url);

    } catch (error) {

      console.log(
        "Metadata unavailable:",
        error.message
      );
    }


    execFile(
      YTDLP_PATH,
      args,
      {
        timeout:
          15 * 60 * 1000,
      },

      (error, stdout, stderr) => {

        if (error) {

          const details =
            stderr ||
            error.message ||
            "";

          console.error(
            "yt-dlp error:",
            details
          );

          return res.status(500).json({

            success: false,

            error:
              "YouTube conversion failed.",

            details,
          });
        }


        let actualFile =
          finalPath;


        if (
          !fs.existsSync(actualFile)
        ) {

          const files =
            fs
              .readdirSync(
                OUTPUT_DIR
              )
              .filter(
                file =>
                  file.startsWith(id)
              );


          if (files.length) {

            actualFile =
              path.join(
                OUTPUT_DIR,
                files[0]
              );


            if (
              actualFile !==
              finalPath
            ) {

              fs.renameSync(
                actualFile,
                finalPath
              );
            }


            actualFile =
              finalPath;
          }
        }


        if (
          !fs.existsSync(actualFile)
        ) {

          return res.status(500).json({

            success: false,

            error:
              "Conversion failed. No output file was generated.",
          });
        }


        const stats =
          fs.statSync(actualFile);


        cleanupFile(actualFile);


        return res.json({

          success: true,

          downloadUrl:
            `/output/${path.basename(
              actualFile
            )}`,

          filename:
            `video_${id}.mp4`,

          metadata:
            metadata
              ? {
                  ...metadata,

                  duration:
                    formatDuration(
                      Number(
                        metadata.duration
                      )
                    ),
                }
              : null,

          fileSize:
            (
              stats.size /
              (1024 * 1024)
            ).toFixed(1) +
            " MB",
        });
      }
    );
  }
);


// ==========================================
// ERROR HANDLER
// ==========================================

app.use(
  (err, req, res, next) => {

    console.error(err);

    res.status(500).json({

      success: false,

      error:
        err.message ||
        "Internal server error",
    });
  }
);


// ==========================================
// START
// ==========================================

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Musica running on port ${PORT}`
    );

    console.log(
      "PO-token provider expected at 127.0.0.1:4416"
    );
  }
);
