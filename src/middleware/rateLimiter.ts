import { Request, Response, NextFunction } from "express";

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class SimpleRateLimiter {
  private store: RateLimitStore = {};
  private windowMs: number;
  public maxRequests: number;

  constructor(windowMs: number = 15 * 60 * 1000, maxRequests: number = 100) {
    this.windowMs = windowMs; // 15 minutes by default
    this.maxRequests = maxRequests; // 100 requests per window
  }

  isAllowed(identifier: string): boolean {
    const now = Date.now();
    const userRecord = this.store[identifier];

    if (!userRecord) {
      this.store[identifier] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return true;
    }

    if (now > userRecord.resetTime) {
      // Reset window
      this.store[identifier] = {
        count: 1,
        resetTime: now + this.windowMs,
      };
      return true;
    }

    if (userRecord.count >= this.maxRequests) {
      return false;
    }

    userRecord.count++;
    return true;
  }

  getRemainingRequests(identifier: string): number {
    const userRecord = this.store[identifier];
    if (!userRecord) return this.maxRequests;

    const now = Date.now();
    if (now > userRecord.resetTime) {
      return this.maxRequests;
    }

    return Math.max(0, this.maxRequests - userRecord.count);
  }

  getResetTime(identifier: string): number {
    const userRecord = this.store[identifier];
    return userRecord ? userRecord.resetTime : Date.now() + this.windowMs;
  }
}

// Different rate limiters for different endpoints
const generalLimiter = new SimpleRateLimiter(15 * 60 * 1000, 100); // 100 requests per 15 minutes
const voiceLimiter = new SimpleRateLimiter(60 * 1000, 20); // 20 voice requests per minute
const crisisLimiter = new SimpleRateLimiter(60 * 1000, 50); // 50 crisis checks per minute

export const rateLimiter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const identifier = req.ip || req.socket.remoteAddress || "unknown";

  let limiter = generalLimiter;

  // Use specific limiters for voice and crisis endpoints
  if (req.path.startsWith("/api/voice")) {
    limiter = voiceLimiter;
  } else if (req.path.startsWith("/api/crisis")) {
    limiter = crisisLimiter;
  }

  if (!limiter.isAllowed(identifier)) {
    const resetTime = limiter.getResetTime(identifier);
    const resetDate = new Date(resetTime);

    res.status(429).json({
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
      resetTime: resetDate.toISOString(),
    });
    return;
  }

  // Add rate limit headers
  res.set({
    "X-RateLimit-Limit": limiter.maxRequests.toString(),
    "X-RateLimit-Remaining": limiter
      .getRemainingRequests(identifier)
      .toString(),
    "X-RateLimit-Reset": new Date(
      limiter.getResetTime(identifier)
    ).toISOString(),
  });

  next();
};

export const createCustomLimiter = (windowMs: number, maxRequests: number) => {
  const limiter = new SimpleRateLimiter(windowMs, maxRequests);

  return (req: Request, res: Response, next: NextFunction): void => {
    const identifier = req.ip || req.socket.remoteAddress || "unknown";

    if (!limiter.isAllowed(identifier)) {
      const resetTime = limiter.getResetTime(identifier);
      const resetDate = new Date(resetTime);

      res.status(429).json({
        error: "Too many requests",
        message: "Rate limit exceeded. Please try again later.",
        retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
        resetTime: resetDate.toISOString(),
      });
      return;
    }

    res.set({
      "X-RateLimit-Limit": maxRequests.toString(),
      "X-RateLimit-Remaining": limiter
        .getRemainingRequests(identifier)
        .toString(),
      "X-RateLimit-Reset": new Date(
        limiter.getResetTime(identifier)
      ).toISOString(),
    });

    next();
  };
};
