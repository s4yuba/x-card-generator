/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  error: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal server error';
  let details: any = undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
  } else if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = error.message;
  } else if (error.message.includes('Profile not found')) {
    statusCode = 404;
    message = 'Profile not found';
  } else if (error.message.includes('private')) {
    statusCode = 403;
    message = 'Profile is private or protected';
  } else if (error.message.includes('timeout')) {
    statusCode = 504;
    message = 'Request timeout - profile page took too long to load';
  } else if (error.message.includes('network')) {
    statusCode = 502;
    message = 'Network error - could not connect to X';
  }

  // Log error for debugging
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', error);
  }

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      statusCode,
      ...(details && { details }),
      ...(process.env.NODE_ENV !== 'production' && { stack: error.stack }),
    },
    timestamp: new Date().toISOString(),
  });
}