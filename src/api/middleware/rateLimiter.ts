/**
 * Rate limiting middleware
 */

import rateLimit, { RateLimitRequestHandler } from 'express-rate-limit';
import { Request, Response } from 'express';

// Create different rate limiters for different endpoints
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  handler: (req, res) => {
    res.status(429).json({
      error: {
        message: 'Too many requests, please try again later.',
        statusCode: 429,
        retryAfter: (req as any).rateLimit?.resetTime,
      },
    });
  },
});

// Stricter rate limiter for generation endpoints
export const generationRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // Limit each IP to 20 generation requests per windowMs
  skipSuccessfulRequests: false,
  message: 'Too many generation requests from this IP, please try again later.',
});

// Even stricter rate limiter for multiple generation
export const multipleGenerationRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 multiple generation requests per windowMs
  skipSuccessfulRequests: false,
  message: 'Too many batch generation requests from this IP, please try again later.',
});