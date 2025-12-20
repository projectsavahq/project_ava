import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logWarn, logInfo } from '../utils/logger';

// Extend Express Request to include admin info
declare global {
  namespace Express {
    interface Request {
      admin?: {
        adminId: string;
        email: string;
        role: string;
      };
    }
  }
}

export const adminAuthMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logWarn(`Admin auth failed - missing or invalid authorization header`);
      res.status(401).json({
        success: false,
        message: 'Authorization token is required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove "Bearer " prefix
    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

    // Verify token
    const decoded = jwt.verify(token, jwtSecret) as {
      adminId: string;
      email: string;
      role: string;
    };

    // Check if token is for admin
    if (decoded.role !== 'admin') {
      logWarn(`Admin auth failed - token is not for admin role`);
      res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
      return;
    }

    // Attach admin info to request
    req.admin = decoded;
    logInfo(`Admin authorized: ${decoded.adminId}`);
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      logWarn(`Admin auth failed - token expired`);
      res.status(401).json({
        success: false,
        message: 'Token has expired'
      });
    } else if (error instanceof Error && error.name === 'JsonWebTokenError') {
      logWarn(`Admin auth failed - invalid token`);
      res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    } else {
      logWarn(`Admin auth failed - ${error instanceof Error ? error.message : 'unknown error'}`);
      res.status(401).json({
        success: false,
        message: 'Authentication failed'
      });
    }
  }
};

/**
 * Optional admin auth - doesn't throw if no token, but attaches admin info if valid token is provided
 */
export const optionalAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key';

      const decoded = jwt.verify(token, jwtSecret) as {
        adminId: string;
        email: string;
        role: string;
      };

      if (decoded.role === 'admin') {
        req.admin = decoded;
      }
    }
    
    next();
  } catch (error) {
    // Silently continue if token is invalid
    logWarn(`Optional admin auth - token validation skipped`);
    next();
  }
};
