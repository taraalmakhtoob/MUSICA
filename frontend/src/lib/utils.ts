import clsx from 'clsx';

export function cn(...classes: (string | undefined | null | false)[]) {
  return clsx(classes);
}

const ALLOWED_VIDEO_TYPES = [
  'video/mp4', 'video/x-matroska', 'video/avi', 'video/quicktime',
  'video/webm', 'video/x-flv', 'video/x-ms-wmv', 'video/x-m4v', 'video/3gpp',
];
const ALLOWED_VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv', '.wmv', '.m4v', '.3gp'];

export function isValidVideoFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ALLOWED_VIDEO_TYPES.includes(file.type) || ALLOWED_VIDEO_EXTS.includes(ext);
}
