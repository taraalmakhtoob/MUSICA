import { useState, useRef, type FormEvent, type DragEvent } from 'react';
import type { ConverterState } from '../lib/types';
import { isValidVideoFile } from '../lib/utils';

type InputMode = 'url' | 'upload';
type OutputFormat = 'mp3' | 'mp4';

const MP3_QUALITIES = ['128', '192', '256', '320'];
const MP4_QUALITIES = ['360', '480', '720', '1080'];

export default function Converter() {
  const [inputMode, setInputMode] = useState<InputMode>('url');
  const [format, setFormat] = useState<OutputFormat>('mp3');
  const [url, setUrl] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const [quality, setQuality] = useState('320');
  const [state, setState] = useState<ConverterState>('idle');
  const [progress, setProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  const [filename, setFilename] = useState('');
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const qualities =
    format === 'mp3' ? MP3_QUALITIES : MP4_QUALITIES;

  const reset = () => {
    setState('idle');
    setUrl('');
    setSelectedFile(null);
    setFileName('');
    setProgress(0);
    setDownloadUrl('');
    setFilename('');
    setError('');
    setDragOver(false);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (file: File) => {
    setError('');

    if (!isValidVideoFile(file)) {
      setError('Only video files are allowed');
      setSelectedFile(null);
      setFileName('');
      return;
    }

    setSelectedFile(file);
    setFileName(file.name);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);

    if (e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUrlSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const cleanUrl = url.trim();

    if (!cleanUrl) {
      return;
    }

    setError('');
    setState('processing');
    setProgress(0);

    const timer = setInterval(() => {
      setProgress((current) => {
        const next = current + Math.random() * 4 + 1;
        return next > 95 ? 95 : Math.round(next);
      });
    }, 350);

    try {
      const endpoint =
        format === 'mp3'
          ? '/api/url-to-mp3'
          : '/api/url-to-mp4';

      const body =
        format === 'mp3'
          ? { url: cleanUrl }
          : { url: cleanUrl, quality };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      });

      const responseText = await response.text();

      let data: {
        success?: boolean;
        downloadUrl?: string;
        filename?: string;
        error?: string;
        details?: string;
      };

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Server returned an invalid response (${response.status})`
        );
      }

      if (!response.ok || !data.success) {
        throw new Error(
          data.details ||
            data.error ||
            `Conversion failed (${response.status})`
        );
      }

      if (!data.downloadUrl) {
        throw new Error('Conversion finished but no download was returned.');
      }

      clearInterval(timer);
      setProgress(100);

      setTimeout(() => {
        setDownloadUrl(data.downloadUrl || '');
        setFilename(
          data.filename ||
            (format === 'mp3' ? 'audio.mp3' : 'video.mp4')
        );
        setState('complete');
      }, 400);
    } catch (err: unknown) {
      clearInterval(timer);

      console.error('Conversion error:', err);

      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.'
      );

      setState('error');
    }
  };

  const handleUploadSubmit = async () => {
    if (!selectedFile) {
      return;
    }

    setError('');
    setState('processing');
    setProgress(0);

    const formData = new FormData();
    formData.append('video', selectedFile);

    try {
      const data = await new Promise<{
        success: boolean;
        downloadUrl: string;
        filename: string;
        error?: string;
      }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            setProgress(
              Math.round((e.loaded / e.total) * 80)
            );
          }
        });

        xhr.onload = () => {
          try {
            const response = JSON.parse(xhr.responseText);

            if (
              xhr.status >= 200 &&
              xhr.status < 300 &&
              response.success
            ) {
              resolve(response);
            } else {
              reject(
                new Error(
                  response.error || 'Conversion failed'
                )
              );
            }
          } catch {
            reject(
              new Error(
                `Server returned an invalid response (${xhr.status})`
              )
            );
          }
        };

        xhr.onerror = () => {
          reject(new Error('Network error'));
        };

        xhr.open('POST', '/api/video-to-mp3');
        xhr.send(formData);
      });

      setProgress(100);

      setTimeout(() => {
        setDownloadUrl(data.downloadUrl);
        setFilename(data.filename || 'audio.mp3');
        setState('complete');
      }, 400);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong.'
      );

      setState('error');
    }
  };

  const canSubmit =
    inputMode === 'url'
      ? url.trim().length > 0
      : selectedFile !== null;

  return (
    <div className="rounded-[2rem] border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.02)] backdrop-blur-sm p-10">

      {/* Tabs */}
      <div className="flex p-1.5 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.04)] mb-7">
        {(['url', 'upload'] as InputMode[]).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => {
              reset();
              setInputMode(mode);
            }}
            className={`flex-1 py-4 rounded-xl text-lg font-medium transition-all duration-200 cursor-pointer border-0 ${
              inputMode === mode
                ? 'bg-[rgba(255,255,255,0.08)] text-white shadow-sm'
                : 'bg-transparent text-[#52525b] hover:text-[#71717a]'
            }`}
          >
            {mode === 'url' ? 'Link' : 'File'}
          </button>
        ))}
      </div>

      {/* Format + Quality */}
      <div className="flex gap-3 mb-6">
        {(['mp3', 'mp4'] as OutputFormat[]).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => {
              setQuality(f === 'mp3' ? '320' : '1080');
              setFormat(f);
            }}
            className={`px-6 py-3 rounded-xl text-base font-mono font-bold tracking-wider cursor-pointer transition-all duration-200 border-0 ${
              format === f
                ? 'bg-white text-black'
                : 'bg-[rgba(255,255,255,0.04)] text-[#52525b] hover:text-[#a1a1aa]'
            }`}
          >
            .{f}
          </button>
        ))}

        <div className="flex-1" />

        {qualities.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => setQuality(q)}
            className={`px-4 py-3 rounded-xl text-sm font-mono cursor-pointer transition-all duration-200 border-0 ${
              quality === q
                ? 'bg-[rgba(255,255,255,0.1)] text-white'
                : 'bg-transparent text-[#3f3f46] hover:text-[#71717a]'
            }`}
          >
            {q}
            {format === 'mp3' ? 'k' : 'p'}
          </button>
        ))}
      </div>

      {/* IDLE */}
      {state === 'idle' && (
        <>
          {inputMode === 'url' && (
            <form onSubmit={handleUrlSubmit}>
              <div className="relative mb-6">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="paste a link..."
                  className="w-full px-6 py-5 rounded-2xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.06)] text-white text-lg outline-none placeholder:text-[#27272a] focus:border-[rgba(139,92,246,0.3)] transition-colors"
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className={`w-full py-5 rounded-2xl text-lg font-semibold tracking-wide transition-all duration-200 border-0 cursor-pointer ${
                  canSubmit
                    ? 'bg-white text-black hover:bg-[#e4e4e7] active:scale-[0.98]'
                    : 'bg-[rgba(255,255,255,0.03)] text-[#27272a] cursor-not-allowed'
                }`}
              >
                Convert
              </button>
            </form>
          )}

          {inputMode === 'upload' && (
            <div>
              <div
                className={`border border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all duration-200 mb-6 ${
                  dragOver
                    ? 'border-[rgba(139,92,246,0.4)] bg-[rgba(139,92,246,0.04)]'
                    : 'border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)]'
                }`}
                onDrop={handleDrop}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={(e) => {
                    if (
                      e.target.files &&
                      e.target.files.length > 0
                    ) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />

                {fileName ? (
                  <p className="text-lg text-[#a1a1aa] break-all">
                    {fileName}
                  </p>
                ) : (
                  <>
                    <div className="text-[#27272a] text-5xl mb-4">
                      &#8593;
                    </div>

                    <p className="text-lg text-[#3f3f46]">
                      drop video or{' '}
                      <span className="text-[#71717a] underline">
                        browse
                      </span>
                    </p>
                  </>
                )}
              </div>

              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleUploadSubmit}
                className={`w-full py-5 rounded-2xl text-lg font-semibold tracking-wide transition-all duration-200 border-0 cursor-pointer ${
                  canSubmit
                    ? 'bg-white text-black hover:bg-[#e4e4e7] active:scale-[0.98]'
                    : 'bg-[rgba(255,255,255,0.03)] text-[#27272a] cursor-not-allowed'
                }`}
              >
                Convert
              </button>
            </div>
          )}
        </>
      )}

      {/* PROCESSING */}
      {state === 'processing' && (
        <div className="py-24 text-center">
          <div className="text-[5rem] font-mono font-bold text-white tracking-tighter mb-10">
            {progress}
            <span className="text-[#3f3f46]">%</span>
          </div>

          <div className="w-full h-1.5 bg-[rgba(255,255,255,0.04)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[rgba(255,255,255,0.15)] rounded-full transition-[width] duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* COMPLETE */}
      {state === 'complete' && (
        <div className="py-10 space-y-6">
          <div className="flex items-center gap-3 text-[#52525b] text-base">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            conversion complete
          </div>

          <div className="flex gap-4">
            <a
              href={downloadUrl}
              download={filename}
              className="flex-1 py-5 rounded-2xl text-lg font-semibold bg-white text-black text-center no-underline hover:bg-[#e4e4e7] active:scale-[0.98] transition-all duration-200"
            >
              download .{format}
            </a>

            <button
              type="button"
              onClick={reset}
              className="px-8 py-5 rounded-2xl text-lg font-medium bg-[rgba(255,255,255,0.04)] text-[#71717a] hover:text-[#a1a1aa] border-0 cursor-pointer transition-colors"
            >
              again
            </button>
          </div>
        </div>
      )}

      {/* ERROR */}
      {state === 'error' && (
        <div className="py-12 text-center space-y-6">
          <p className="text-base text-[#52525b]">
            {error || 'Something went wrong.'}
          </p>

          <button
            type="button"
            onClick={reset}
            className="px-10 py-4 rounded-2xl text-base font-medium bg-white text-black border-0 cursor-pointer hover:bg-[#e4e4e7] transition-colors"
          >
            try again
          </button>
        </div>
      )}
    </div>
  );
}
