/**
 * Previews de Google Drive SIN credenciales: solo funcionan si el archivo
 * está compartido públicamente ("cualquiera con el enlace"). Si no, la UI
 * cae a mostrar la ficha del archivo. Nunca se usan tokens de Drive aquí.
 */

const DRIVE_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

export function extractDriveFileId(driveUrl?: string | null, driveFileId?: string | null): string | null {
  if (driveFileId && DRIVE_ID_RE.test(driveFileId)) return driveFileId;
  if (!driveUrl) return null;
  const match = driveUrl.match(/\/d\/([A-Za-z0-9_-]{10,})/) ?? driveUrl.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  return match?.[1] ?? null;
}

export function driveThumbnailUrl(driveUrl?: string | null, driveFileId?: string | null, size = 600): string | null {
  const id = extractDriveFileId(driveUrl, driveFileId);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w${size}` : null;
}

export function driveViewUrl(driveUrl?: string | null, driveFileId?: string | null): string | null {
  if (driveUrl && /^https:\/\//.test(driveUrl)) return driveUrl;
  const id = extractDriveFileId(driveUrl, driveFileId);
  return id ? `https://drive.google.com/file/d/${id}/view` : null;
}

export function driveFolderUrl(folderId?: string | null) {
  return folderId ? `https://drive.google.com/drive/folders/${encodeURIComponent(folderId)}` : null;
}

export function googleSheetUrl(sheetId?: string | null) {
  return sheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(sheetId)}/edit` : null;
}

export function isImage(mediaType?: string | null, mimeType?: string | null) {
  return (mimeType ?? "").startsWith("image/") || (mediaType ?? "").toLowerCase().includes("image");
}

export function isVideo(mediaType?: string | null, mimeType?: string | null) {
  return (mimeType ?? "").startsWith("video/") || (mediaType ?? "").toLowerCase().includes("video");
}
