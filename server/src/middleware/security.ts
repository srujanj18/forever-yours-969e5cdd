import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Rate limiting middleware
export const createRateLimit = (windowMs: number, maxRequests: number) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip + req.path;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean up old entries
    for (const [k, v] of rateLimitStore.entries()) {
      if (v.resetTime < windowStart) {
        rateLimitStore.delete(k);
      }
    }

    const current = rateLimitStore.get(key);
    if (!current || current.resetTime < windowStart) {
      rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (current.count >= maxRequests) {
      return res.status(429).json({
        error: 'Too many requests, please try again later.',
        retryAfter: Math.ceil((current.resetTime - now) / 1000)
      });
    }

    current.count++;
    next();
  };
};

// Input validation middleware
export const validateMessageInput = [
  body('content')
    .optional()
    .isLength({ min: 1, max: 1000 })
    .withMessage('Message content must be between 1 and 1000 characters')
    .trim()
    .escape(),
  body('replyTo')
    .optional()
    .isMongoId()
    .withMessage('Invalid replyTo ID'),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: errors.array()
      });
    }
    next();
  }
];

export const validateAuthInput = [
  body('partnerEmail')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('displayName')
    .optional()
    .isLength({ min: 1, max: 50 })
    .withMessage('Display name must be between 1 and 50 characters')
    .trim()
    .escape(),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: errors.array()
      });
    }
    next();
  }
];

export const validateCustomPartnerNameInput = [
  body('customPartnerName')
    .isLength({ min: 1, max: 50 })
    .withMessage('Custom partner name must be between 1 and 50 characters')
    .trim()
    .escape(),
  (req: Request, res: Response, next: NextFunction) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: errors.array()
      });
    }
    next();
  }
];

// Security headers middleware
export const securityHeaders = (req: Request, res: Response, next: NextFunction) => {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy
  res.setHeader('Content-Security-Policy',
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.gstatic.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; " +
    "img-src 'self' data: https: blob:; " +
    "connect-src 'self' ws: wss: https://firestore.googleapis.com https://identitytoolkit.googleapis.com; " +
    "media-src 'self' blob:; " +
    "object-src 'none'; " +
    "frame-ancestors 'none';"
  );

  // HSTS (HTTP Strict Transport Security) - only in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
};

// Request logging middleware
export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const timestamp = new Date().toISOString();

  // Log request
  console.log(`[${timestamp}] ${req.method} ${req.path} - IP: ${req.ip} - User-Agent: ${req.get('User-Agent') || 'Unknown'}`);

  // Log response
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
  });

  next();
};

// CSRF protection middleware (simplified version)
export const csrfProtection = (req: Request, res: Response, next: NextFunction) => {
  // For API routes, we rely on CORS and authentication
  // In production, implement proper CSRF tokens for forms
  const origin = req.get('origin');
  const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:5173',
    'http://localhost:5174', // Vite dev server
    'http://localhost:3000', // Alternative dev port
    /^http:\/\/localhost:\d+$/, // Expo / local dev servers
    /^http:\/\/127\.0\.0\.1:\d+$/, // Loopback local dev servers
    undefined // Allow requests without origin (proxied requests)
  ];

  const isAllowed = !origin || allowedOrigins.some((allowedOrigin) => {
    if (allowedOrigin === undefined) {
      return false;
    }
    if (typeof allowedOrigin === 'string') {
      return allowedOrigin === origin;
    }
    return allowedOrigin.test(origin);
  });

  if (!isAllowed) {
    console.warn(`CSRF attempt blocked from origin: ${origin}`);
    return res.status(403).json({ error: 'Forbidden' });
  }

  next();
};

// File upload security
export const validateFileUpload = (req: Request, res: Response, next: NextFunction) => {
  if (!req.file) {
    return next();
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      error: 'Invalid file type. Only JPEG, PNG, GIF, and WebP images are allowed.'
    });
  }

  if (req.file.size > maxSize) {
    return res.status(400).json({
      error: 'File too large. Maximum size is 5MB.'
    });
  }

  next();
};
