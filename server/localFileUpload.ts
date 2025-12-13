import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export class LocalFileUploadService {
  private uploadPath: string;
  private fileCache: Set<string> | null = null;

  constructor() {
    this.uploadPath = process.env.LOCAL_UPLOAD_PATH || './data/uploads';
    this.ensureUploadDirectory();
    // Initialize cache asynchronously to not block startup, or strictly lazy
    this.refreshFileCache();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
      console.log(`Created upload directory: ${this.uploadPath}`);
    }
  }

  private refreshFileCache() {
    try {
      if (fs.existsSync(this.uploadPath)) {
        const files = fs.readdirSync(this.uploadPath);
        this.fileCache = new Set(files);
      } else {
        this.fileCache = new Set();
      }
    } catch (error) {
      console.error('Failed to initialize file cache:', error);
      this.fileCache = new Set();
    }
  }

  public registerFile(filename: string) {
    if (this.fileCache) {
      this.fileCache.add(filename);
    }
  }

  // Configure multer for local file uploads
  getMulterConfig() {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, this.uploadPath);
      },
      filename: (_req, file, cb) => {
        const fileExtension = path.extname(file.originalname);
        const uniqueName = `${randomUUID()}${fileExtension}`;
        cb(null, uniqueName);
      }
    });

    return multer({
      storage,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
      },
      fileFilter: (_req, file, cb) => {
        // Allow common image formats
        const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
          return cb(null, true);
        } else {
          cb(new Error('Only image files are allowed'));
        }
      }
    });
  }

  // Get the public URL for a local file
  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  // Delete a local file
  deleteFile(filename: string): boolean {
    try {
      const filePath = path.join(this.uploadPath, filename);

      // Security check: Prevent path traversal
      const resolvedUploadPath = path.resolve(this.uploadPath);
      const resolvedFilePath = path.resolve(filePath);
      if (!resolvedFilePath.startsWith(resolvedUploadPath)) {
        console.error(`Security Warning: Attempted path traversal in deleteFile: ${filename}`);
        return false;
      }

      console.log(`Attempting to delete file: ${filePath}`);
      
      // Update cache optimistically
      if (this.fileCache) {
        this.fileCache.delete(filename);
      }

      if (fs.existsSync(filePath)) {
        console.log(`File exists, deleting: ${filePath}`);
        fs.unlinkSync(filePath);
        console.log(`File successfully deleted: ${filePath}`);
        return true;
      } else {
        console.log(`File does not exist: ${filePath}`);
        return false;
      }
    } catch (error) {
      console.error('Error deleting file:', error);
      console.error('File path attempted:', path.join(this.uploadPath, filename));
      return false;
    }
  }

  // Check if a file exists locally
  fileExists(filename: string): boolean {
    // Use cache if available
    if (this.fileCache) {
      return this.fileCache.has(filename);
    }

    // Fallback to disk if cache not initialized (shouldn't happen often)
    const filePath = path.join(this.uploadPath, filename);

    // Security check: Prevent path traversal
    const resolvedUploadPath = path.resolve(this.uploadPath);
    const resolvedFilePath = path.resolve(filePath);

    // Ensure the resolved path starts with the upload path + separator to prevent partial matches
    // (e.g. /data/uploads-backup vs /data/uploads)
    if (!resolvedFilePath.startsWith(resolvedUploadPath + path.sep)) {
      console.error(`Security Warning: Attempted path traversal in fileExists: ${filename}`);
      return false;
    }

    return fs.existsSync(filePath);
  }
}