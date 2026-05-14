import path from "path";

export const DATABASE_LOGO_URL_PREFIX = "/api/logo/";

const imageMimeTypesByExtension: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

export function buildDatabaseLogoUrl(id: string): string {
  return `${DATABASE_LOGO_URL_PREFIX}${encodeURIComponent(id)}`;
}

export function extractDatabaseLogoId(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.startsWith(DATABASE_LOGO_URL_PREFIX)) {
    return null;
  }

  const encodedId = logoUrl.slice(DATABASE_LOGO_URL_PREFIX.length);
  if (!encodedId || encodedId.includes("/")) {
    return null;
  }

  try {
    return decodeURIComponent(encodedId);
  } catch {
    return null;
  }
}

export function extractLocalUploadFilename(logoUrl: string | null | undefined): string | null {
  if (!logoUrl?.startsWith("/uploads/")) {
    return null;
  }

  const encodedFilename = logoUrl.slice("/uploads/".length);
  if (!encodedFilename || encodedFilename.includes("/")) {
    return null;
  }

  try {
    const filename = decodeURIComponent(encodedFilename);
    if (!filename || filename.includes("/") || filename.includes("\\") || path.basename(filename) !== filename) {
      return null;
    }
    return filename;
  } catch {
    return null;
  }
}

export function getConfiguredUploadPath(): string {
  const configuredUploadPath = process.env.LOCAL_UPLOAD_PATH || "./data/uploads";
  return path.isAbsolute(configuredUploadPath)
    ? path.resolve(configuredUploadPath)
    : path.resolve(process.cwd(), configuredUploadPath);
}

export function resolveLocalUploadFilePath(filename: string, uploadPath = getConfiguredUploadPath()): string | null {
  if (!filename || filename.includes("/") || filename.includes("\\") || path.basename(filename) !== filename) {
    return null;
  }

  const resolvedUploadPath = path.resolve(uploadPath);
  const resolvedFilePath = path.resolve(resolvedUploadPath, filename);
  const uploadPathWithSeparator = resolvedUploadPath.endsWith(path.sep)
    ? resolvedUploadPath
    : `${resolvedUploadPath}${path.sep}`;

  if (!resolvedFilePath.startsWith(uploadPathWithSeparator)) {
    return null;
  }

  return resolvedFilePath;
}

export function detectImageMimeType(filename: string, fallback = "application/octet-stream"): string {
  return imageMimeTypesByExtension[path.extname(filename).toLowerCase()] ?? fallback;
}
