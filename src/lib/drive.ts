/**
 * Previews de archivos de contenido SIN credenciales.
 * Los archivos nuevos están en el almacenamiento de Metricool (URL directa); los antiguos
 * conservan su enlace de Google Drive, que solo se ve si estaba compartido públicamente.
 */

const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

function driveFileId(url?: string | null): string | null {
  if (!url || !/drive\.google\.com/.test(url)) return null;
  const match = url.match(/\/d\/([A-Za-z0-9_-]{10,})/) ?? url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return match?.[1] && DRIVE_ID_RE.test(match[1]) ? match[1] : null;
}

export function mediaThumbnailUrl(url?: string | null, size = 600): string | null {
  const id = driveFileId(url);
  if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
  return url && /^https:\/\//.test(url) ? url : null;
}

export function mediaViewUrl(url?: string | null): string | null {
  return url && /^https:\/\//.test(url) ? url : null;
}

/** Auditorías: el PDF sigue guardándose en Google Drive. */
export function driveViewUrl(_url?: string | null, fileId?: string | null): string | null {
  return fileId && DRIVE_ID_RE.test(fileId) ? `https://drive.google.com/file/d/${fileId}/view` : null;
}

export function isImage(mediaType?: string | null, mimeType?: string | null) {
  return (mimeType ?? "").startsWith("image/") || (mediaType ?? "").toLowerCase().includes("image");
}

export function isVideo(mediaType?: string | null, mimeType?: string | null) {
  return (mimeType ?? "").startsWith("video/") || (mediaType ?? "").toLowerCase().includes("video");
}
