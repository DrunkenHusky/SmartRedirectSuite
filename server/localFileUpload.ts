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

  // Configure multer for document imports (CSV, Excel, JSON)
  getDocumentUploadConfig() {
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, this.uploadPath);
      },
      filename: (_req, file, cb) => {
        const fileExtension = path.extname(file.originalname);
        const uniqueName = `import_${randomUUID()}${fileExtension}`;
        cb(null, uniqueName);
      }
    });

    return multer({
      storage,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB limit for imports
      },
      fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.csv', '.xlsx', '.xls', '.json'].includes(ext)) {
          return cb(null, true);
        }
        cb(new Error('Only CSV, Excel, and JSON files are allowed'));
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
    return fs.existsSync(filePath);
  }
}