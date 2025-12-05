import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { User, IUser } from '../models/schemas/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export interface AuthRequest extends Request {
  user: IUser;
}

/**
 * Authentication middleware
 * Validates JWT token and sets req.user
 */
export const authMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      res.status(401).json({
        success: false,
        message: 'Access token is required'
      });
      return;
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const payload = jwt.verify(token, JWT_SECRET) as any;

      // Find user by ID from token
      const user = await User.findOne({ userId: payload.userId });

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'Invalid token - user not found'
        });
        return;
      }

      if (!user.emailVerified) {
        res.status(401).json({
          success: false,
          message: 'Email verification required'
        });
        return;
      }

      // Check if account is locked
      if (user.lockUntil && user.lockUntil > new Date()) {
        res.status(401).json({
          success: false,
          message: 'Account is temporarily locked'
        });
        return;
      }

      // Add user to request object
      req.user = user;
      next();
    } catch (jwtError) {
      if (jwtError instanceof jwt.TokenExpiredError) {
        res.status(401).json({
          success: false,
          message: 'Token expired'
        });
      } else if (jwtError instanceof jwt.JsonWebTokenError) {
        res.status(401).json({
          success: false,
          message: 'Invalid token'
        });
      } else {
        res.status(401).json({
          success: false,
          message: 'Token validation failed'
        });
      }
      return;
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Authentication middleware error'
    });
  }
};

/**
 * Optional authentication middleware
 * Sets req.user if token is present and valid, but doesn't require it
 */
export const optionalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next(); // Continue without setting req.user
      return;
    }

    const token = authHeader.substring(7);

    if (!token) {
      next(); // Continue without setting req.user
      return;
    }

    try {
      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
      const payload = jwt.verify(token, JWT_SECRET) as any;

      const user = await User.findOne({ userId: payload.userId });

      if (user && user.emailVerified && (!user.lockUntil || user.lockUntil <= new Date())) {
        req.user = user;
      }
    } catch (jwtError) {
      // Ignore token errors for optional auth
    }

    next();
  } catch (error) {
    next(); // Continue on any error
  }
};

/**
 * Role-based authorization middleware factory
 * Note: This is prepared for future use when user roles are implemented
 */
export const requireRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user as IUser;

    if (!user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
      return;
    }

    // TODO: Implement role checking when user roles are added to schema
    // For now, just continue
    next();
  };
};