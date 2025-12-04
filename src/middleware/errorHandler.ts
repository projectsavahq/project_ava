import { Request, Response, NextFunction } from "express";

export interface APIError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: APIError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Log error details
  console.error("Error occurred:", {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    timestamp: new Date().toISOString(),
  });

  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  // Handle different types of errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
  }

  if (err.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  }

  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid data format";
  }

  // Don't leak error details in production
  if (process.env.NODE_ENV === "production" && statusCode === 500) {
    message = "Something went wrong";
  }

  res.status(statusCode).json({
    error: {
      message,
      status: statusCode,
      timestamp: new Date().toISOString(),
      ...(process.env.NODE_ENV === "development" && {
        stack: err.stack,
        details: err,
      }),
    },
  });
};

export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export const createError = (
  message: string,
  statusCode: number = 500
): APIError => {
  const error = new Error(message) as APIError;
  error.statusCode = statusCode;
  error.isOperational = true;
  return error;
};
