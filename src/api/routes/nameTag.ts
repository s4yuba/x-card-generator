/**
 * Name tag generation API routes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { NameTagGenerator } from '../../services/NameTagGenerator';
import { URLValidator } from '../../utils/urlValidator';
import { AppError } from '../middleware/errorHandler';
import { generationRateLimiter, multipleGenerationRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Initialize name tag generator with default options
const nameTagGenerator = new NameTagGenerator({
  profileScraperOptions: {
    timeout: 30000,
    headless: true,
  },
  imageProcessorOptions: {
    size: 200,
    quality: 90,
    format: 'jpeg',
  },
  qrCodeOptions: {
    size: 400,
    margin: 4,
    errorCorrectionLevel: 'M',
  },
  pdfOptions: {
    width: 252, // 3.5 inches
    height: 162, // 2.25 inches
  },
});

/**
 * Generate a single name tag
 * POST /api/name-tag/generate
 */
router.post('/generate', generationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileUrl } = req.body;

    if (!profileUrl) {
      throw new AppError('Profile URL is required', 400);
    }

    // Validate URL
    const validation = URLValidator.validateProfileUrl(profileUrl);
    if (!validation.isValid) {
      throw new AppError(validation.error || 'Invalid profile URL', 400);
    }

    // Generate name tag
    const pdfBuffer = await nameTagGenerator.generateNameTag(profileUrl);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nametag-${validation.username}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * Generate a simple name tag (no QR code)
 * POST /api/name-tag/generate-simple
 */
router.post('/generate-simple', generationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileUrl } = req.body;

    if (!profileUrl) {
      throw new AppError('Profile URL is required', 400);
    }

    // Validate URL
    const validation = URLValidator.validateProfileUrl(profileUrl);
    if (!validation.isValid) {
      throw new AppError(validation.error || 'Invalid profile URL', 400);
    }

    // Generate simple name tag
    const pdfBuffer = await nameTagGenerator.generateSimpleNameTag(profileUrl);

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="nametag-simple-${validation.username}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * Generate multiple name tags
 * POST /api/name-tag/generate-multiple
 */
router.post('/generate-multiple', multipleGenerationRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileUrls, options = {} } = req.body;

    if (!profileUrls || !Array.isArray(profileUrls)) {
      throw new AppError('Profile URLs array is required', 400);
    }

    if (profileUrls.length === 0) {
      throw new AppError('At least one profile URL is required', 400);
    }

    if (profileUrls.length > 20) {
      throw new AppError('Maximum 20 profiles can be processed at once', 400);
    }

    // Validate all URLs
    const validUrls: string[] = [];
    const invalidUrls: string[] = [];

    for (const url of profileUrls) {
      const validation = URLValidator.validateProfileUrl(url);
      if (validation.isValid) {
        validUrls.push(url);
      } else {
        invalidUrls.push(url);
      }
    }

    if (validUrls.length === 0) {
      throw new AppError('No valid profile URLs provided', 400);
    }

    // Generate multiple name tags
    const pdfBuffer = await nameTagGenerator.generateMultipleNameTags(validUrls, options);

    // Include warning about invalid URLs in response
    if (invalidUrls.length > 0) {
      res.setHeader('X-Invalid-URLs', JSON.stringify(invalidUrls));
      res.setHeader('X-Warning', `${invalidUrls.length} invalid URLs were skipped`);
    }

    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="nametags-multiple.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length.toString());

    // Send PDF
    res.send(pdfBuffer);
  } catch (error) {
    next(error);
  }
});

/**
 * Validate a profile URL
 * POST /api/name-tag/validate
 */
router.post('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { profileUrl } = req.body;

    if (!profileUrl) {
      throw new AppError('Profile URL is required', 400);
    }

    // Validate URL format
    const validation = URLValidator.validateProfileUrl(profileUrl);
    if (!validation.isValid) {
      return res.json({
        valid: false,
        error: validation.error,
        accessible: false,
      });
    }

    // Check if profile is accessible
    const accessible = await nameTagGenerator.validateProfile(profileUrl);

    res.json({
      valid: true,
      accessible,
      username: validation.username,
      normalizedUrl: validation.normalizedUrl,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get supported options and configuration
 * GET /api/name-tag/options
 */
router.get('/options', (req: Request, res: Response) => {
  res.json({
    single: {
      maxTimeout: 30000,
      supportedFormats: ['pdf'],
      nameTagDimensions: {
        width: '3.5 inches',
        height: '2.25 inches',
      },
    },
    multiple: {
      maxProfiles: 20,
      paperSizes: ['LETTER', 'A4'],
      defaultLayout: {
        columns: 2,
        rows: 4,
      },
    },
    imageProcessing: {
      profileImageSize: 200,
      supportedFormats: ['jpeg', 'png', 'webp'],
      quality: 90,
    },
    qrCode: {
      size: 400,
      errorCorrectionLevels: ['L', 'M', 'Q', 'H'],
      defaultLevel: 'M',
    },
  });
});

// Cleanup on server shutdown
process.on('SIGTERM', async () => {
  await nameTagGenerator.cleanup();
});

process.on('SIGINT', async () => {
  await nameTagGenerator.cleanup();
});

export { router as nameTagRouter };