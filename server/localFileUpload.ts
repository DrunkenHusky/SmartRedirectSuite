import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { randomUUID } from 'crypto';

export class LocalFileUploadService {
  private uploadPath: string;

  constructor() {
    this.uploadPath = process.env.LOCAL_UPLOAD_PATH || './data/uploads';
    this.ensureUploadDirectory();
  }

  private ensureUploadDirectory(): void {
    if (!fs.existsSync(this.uploadPath)) {
      fs.mkdirSync(this.uploadPath, { recursive: true });
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
  deleteFile(filename: string): boolean {
    try {
      const filePath = path.join(this.uploadPath, filename);
      console.log(`Attempting to delete file: ${filePath}`);
      
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
    const filePath = path.join(this.uploadPath, filename);
    return fs.existsSync(filePath);
  }
}