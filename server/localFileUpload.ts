import multer from 'multer';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';

export class LocalFileUploadService {
  private uploadPath: string;

  constructor() {
    this.uploadPath = process.env.LOCAL_UPLOAD_PATH || './data/uploads';
    this.ensureUploadDirectory().catch((err) =>
      console.error('Failed to ensure upload directory:', err)
    );
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
      console.log(`Created upload directory: ${this.uploadPath}`);
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
  async deleteFile(filename: string): Promise<boolean> {
    const filePath = path.join(this.uploadPath, filename);
    console.log(`Attempting to delete file: ${filePath}`);
    try {
      await fs.unlink(filePath);
      console.log(`File successfully deleted: ${filePath}`);
      return true;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log(`File does not exist: ${filePath}`);
        return false;
      }
      console.error('Error deleting file:', error);
      console.error('File path attempted:', filePath);
      return false;
    }
  }

  // Check if a file exists locally
  async fileExists(filename: string): Promise<boolean> {
    const filePath = path.join(this.uploadPath, filename);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}