/**
 * QR Code Generator service for creating QR codes that link to X profiles
 * Uses qrcode library to generate high-quality QR codes
 */

import QRCode from 'qrcode';
import sharp from 'sharp';

export interface QRCodeOptions {
  size?: number;
  margin?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  color?: {
    dark?: string;
    light?: string;
  };
  type?: 'svg' | 'png' | 'buffer';
}

export class QRCodeGenerator {
  private options: Required<QRCodeOptions>;

  constructor(options: QRCodeOptions = {}) {
    this.options = {
      size: options.size || 400, // Default size for print quality
      margin: options.margin || 4, // Default margin (quiet zone)
      errorCorrectionLevel: options.errorCorrectionLevel || 'M', // Medium error correction
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF'
      },
      type: options.type || 'buffer'
    };
  }

  /**
   * Generate QR code for a URL
   * @param url The URL to encode in the QR code
   * @returns Promise<Buffer | string> The QR code data
   */
  async generateQRCode(url: string): Promise<Buffer | string> {
    try {
      if (this.options.type === 'svg') {
        return await QRCode.toString(url, {
          errorCorrectionLevel: this.options.errorCorrectionLevel,
          type: 'svg',
          width: this.options.size,
          margin: this.options.margin,
          color: this.options.color
        });
      } else if (this.options.type === 'png') {
        const dataUrl = await QRCode.toDataURL(url, {
          errorCorrectionLevel: this.options.errorCorrectionLevel,
          type: 'image/png',
          width: this.options.size,
          margin: this.options.margin,
          color: this.options.color
        });
        return dataUrl;
      } else {
        // Return as buffer for PDF embedding
        return await QRCode.toBuffer(url, {
          errorCorrectionLevel: this.options.errorCorrectionLevel,
          type: 'png',
          width: this.options.size,
          margin: this.options.margin,
          color: this.options.color
        });
      }
    } catch (error) {
      throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate QR code with custom styling
   * @param url The URL to encode
   * @param customOptions Custom styling options
   * @returns Promise<Buffer> The styled QR code buffer
   */
  async generateStyledQRCode(url: string, customOptions?: {
    backgroundColor?: string;
    foregroundColor?: string;
    logoBuffer?: Buffer;
    logoSize?: number;
  }): Promise<Buffer> {
    // Generate base QR code
    const qrBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: this.options.errorCorrectionLevel,
      type: 'png',
      width: this.options.size,
      margin: this.options.margin,
      color: {
        dark: customOptions?.foregroundColor || this.options.color.dark,
        light: customOptions?.backgroundColor || this.options.color.light
      }
    });

    // If no logo, return the QR code as is
    if (!customOptions?.logoBuffer) {
      return qrBuffer;
    }

    // Add logo to center of QR code
    const logoSize = customOptions.logoSize || Math.floor(this.options.size * 0.2); // 20% of QR code size
    const logoPosition = Math.floor((this.options.size - logoSize) / 2);

    // Process logo to ensure it's the right size
    const processedLogo = await sharp(customOptions.logoBuffer)
      .resize(logoSize, logoSize, { fit: 'contain' })
      .toBuffer();

    // Composite logo onto QR code
    const compositeQR = await sharp(qrBuffer)
      .composite([{
        input: processedLogo,
        top: logoPosition,
        left: logoPosition
      }])
      .toBuffer();

    return compositeQR;
  }

  /**
   * Generate QR code and save to file
   * @param url The URL to encode
   * @param outputPath The path to save the QR code
   * @returns Promise<string> The path to the saved file
   */
  async generateAndSaveQRCode(url: string, outputPath: string): Promise<string> {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const qrBuffer = await this.generateQRCode(url);
    
    if (typeof qrBuffer === 'string') {
      // If SVG or data URL, extract the actual data
      if (qrBuffer.startsWith('data:image/png;base64,')) {
        const base64Data = qrBuffer.replace(/^data:image\/png;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        await fs.writeFile(outputPath, buffer);
      } else {
        // SVG string
        await fs.writeFile(outputPath, qrBuffer);
      }
    } else {
      // Buffer
      await fs.writeFile(outputPath, qrBuffer);
    }
    
    return outputPath;
  }

  /**
   * Generate QR code with rounded corners
   * @param url The URL to encode
   * @param borderRadius The radius for rounded corners
   * @returns Promise<Buffer> The QR code with rounded corners
   */
  async generateRoundedQRCode(url: string, borderRadius: number = 20): Promise<Buffer> {
    const qrBuffer = await this.generateQRCode(url) as Buffer;
    
    // Create rounded corners mask
    const maskSvg = `
      <svg width="${this.options.size}" height="${this.options.size}">
        <rect 
          x="0" 
          y="0" 
          width="${this.options.size}" 
          height="${this.options.size}" 
          rx="${borderRadius}" 
          ry="${borderRadius}" 
          fill="white"
        />
      </svg>
    `;
    
    const roundedQR = await sharp(qrBuffer)
      .composite([{
        input: Buffer.from(maskSvg),
        blend: 'dest-in'
      }])
      .toFormat('png')
      .toBuffer();
    
    return roundedQR;
  }

  /**
   * Validate if a URL is suitable for QR code generation
   * @param url The URL to validate
   * @returns boolean True if URL is valid
   */
  validateUrl(url: string): boolean {
    try {
      new URL(url);
      // Check if URL is not too long for QR code (practical limit)
      return url.length <= 2000;
    } catch {
      return false;
    }
  }

  /**
   * Get recommended QR code size based on content length
   * @param url The URL to encode
   * @returns number Recommended size in pixels
   */
  getRecommendedSize(url: string): number {
    const length = url.length;
    if (length < 50) return 200;
    if (length < 100) return 300;
    if (length < 200) return 400;
    return 500;
  }

  /**
   * Generate QR code with custom data modules pattern
   * @param url The URL to encode
   * @param pattern Pattern type for data modules
   * @returns Promise<Buffer> The styled QR code
   */
  async generatePatternQRCode(url: string, pattern: 'dots' | 'rounded' | 'square' = 'square'): Promise<Buffer> {
    // First generate standard QR code
    const qrBuffer = await this.generateQRCode(url) as Buffer;
    
    if (pattern === 'square') {
      return qrBuffer; // Default is already square
    }
    
    // For other patterns, we'd need more complex processing
    // This is a simplified implementation
    if (pattern === 'rounded') {
      return this.generateRoundedQRCode(url, 10);
    }
    
    // For dots pattern, this would require pixel-by-pixel processing
    // which is beyond the scope of this basic implementation
    return qrBuffer;
  }
}