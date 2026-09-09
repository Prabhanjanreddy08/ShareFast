/**
 * Utility formatting helpers for bytes, speed, duration and filenames.
 */

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec: number): string {
  if (bytesPerSec <= 0 || !Number.isFinite(bytesPerSec)) return '0.0 MB/s';
  const mbps = bytesPerSec / (1024 * 1024);
  if (mbps < 0.1) {
    return `${(bytesPerSec / 1024).toFixed(1)} KB/s`;
  }
  return `${mbps.toFixed(1)} MB/s`;
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function sanitizeFileName(name: string): string {
  // Remove directory traversals, control characters, and unsafe chars
  return name.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 255);
}

export function getFileCategory(mimeType: string, filename: string): 'image' | 'video' | 'audio' | 'archive' | 'document' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('zip') ||
    mimeType.includes('tar') ||
    mimeType.includes('rar') ||
    mimeType.includes('7z') ||
    filename.endsWith('.zip') ||
    filename.endsWith('.tar.gz') ||
    filename.endsWith('.rar') ||
    filename.endsWith('.7z')
  ) {
    return 'archive';
  }
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('word') ||
    mimeType.includes('document') ||
    mimeType.includes('text') ||
    filename.endsWith('.pdf') ||
    filename.endsWith('.docx') ||
    filename.endsWith('.txt') ||
    filename.endsWith('.md')
  ) {
    return 'document';
  }
  return 'other';
}
