import { Request, Response, NextFunction } from "express";

/**
 * Middleware to check admin authentication
 */
export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!req.session?.isAdminAuthenticated) {
    return res.status(403).json({ error: "Access denied. Please log in to the admin panel." });
  }
  next();
};
