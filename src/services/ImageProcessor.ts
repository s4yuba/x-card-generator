/**
 * Image Processor service for downloading and optimizing profile images
 * Uses Sharp for image processing and optimization
 */

import sharp from 'sharp';
import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs/promises';

export interface ImageProcessorOptions {
  size?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fallbackImagePath?: string;
}

export class ImageProcessor {
  private options: Required<ImageProcessorOptions>;
  private defaultFallbackBase64: string;

  constructor(options: ImageProcessorOptions = {}) {
    this.options = {
      size: options.size || 200, // Default size for name tag profile images
      quality: options.quality || 90,
      format: options.format || 'jpeg',
      fallbackImagePath: options.fallbackImagePath || ''
    };

    // Default fallback image as base64 (simple avatar placeholder)
    // This is a simple SVG converted to base64
    this.defaultFallbackBase64 = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMTAwIiBmaWxsPSIjRTFFOEVEIi8+CjxwYXRoIGQ9Ik0xMDAgNTBDNzcuOTA4NiA1MCA2MCA2Ny45MDg2IDYwIDkwQzYwIDExMi4wOTEgNzcuOTA4NiAxMzAgMTAwIDEzMEMxMjIuMDkxIDEzMCAxNDAgMTEyLjA5MSAxNDAgOTBDMTQwIDY3LjkwODYgMTIyLjA5MSA1MCAxMDAgNTBaIiBmaWxsPSIjOUIxMDI0Ii8+CjxwYXRoIGQ9Ik0xMDAgMTQwQzcwIDE0MCA0MCAxNTAgNDAgMTgwQzQwIDE5MCA1MCAxOTAgNTAgMTkwSDE1MEM2MCAxOTAgMTYwIDE5MCAxNjAgMTgwQzE2MCAxNTAgMTMwIDE0MCAxMDAgMTQwWiIgZmlsbD0iIzlCMTAyNCIvPgo8L3N2Zz4=';
  }

  /**
   * Download image from URL with retry logic
   * @param url The image URL to download
   * @param maxRetries Number of retry attempts
   * @returns Promise<Buffer> The downloaded image data
   */
  private async downloadImage(url: string, maxRetries: number = 3): Promise<Buffer> {
    let lastError: Error | null = null;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
          },
          timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const buffer = await response.buffer();
        
        // Validate that we got actual image data
        if (buffer.length === 0) {
          throw new Error('Downloaded file is empty');
        }

        return buffer;
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
        }
      }
    }

    throw new Error(`Failed to download image after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Get fallback image buffer
   * @returns Promise<Buffer> The fallback image buffer
   */
  private async getFallbackImage(): Promise<Buffer> {
    // First try to use custom fallback image if provided
    if (this.options.fallbackImagePath) {
      try {
        const exists = await fs.access(this.options.fallbackImagePath).then(() => true).catch(() => false);
        if (exists) {
          return await fs.readFile(this.options.fallbackImagePath);
        }
      } catch (error) {
        console.warn('Failed to load custom fallback image:', error);
      }
    }

    // Convert base64 SVG to buffer
    const base64Data = this.defaultFallbackBase64.replace(/^data:image\/svg\+xml;base64,/, '');
    const svgBuffer = Buffer.from(base64Data, 'base64');
    
    // Convert SVG to the desired format
    return await sharp(svgBuffer)
      .resize(this.options.size, this.options.size)
      .toFormat(this.options.format, { quality: this.options.quality })
      .toBuffer();
  }

  /**
   * Process profile image: download, resize, and optimize
   * @param imageUrl The URL of the profile image
   * @returns Promise<Buffer> The processed image buffer
   */
  async processProfileImage(imageUrl: string): Promise<Buffer> {
    let imageBuffer: Buffer;

    try {
      // Download the image
      imageBuffer = await this.downloadImage(imageUrl);
    } catch (error) {
      console.warn(`Failed to download profile image: ${error}. Using fallback image.`);
      return await this.getFallbackImage();
    }

    try {
      // Process the image with Sharp
      const processedImage = await sharp(imageBuffer)
        // Resize to square dimensions
        .resize(this.options.size, this.options.size, {
          fit: 'cover',
          position: 'center'
        })
        // Convert to desired format
        .toFormat(this.options.format, {
          quality: this.options.quality
        })
        // Apply slight sharpening for print quality
        .sharpen()
        // Normalize the image
        .normalize()
        .toBuffer();

      return processedImage;
    } catch (error) {
      console.warn(`Failed to process image: ${error}. Using fallback image.`);
      return await this.getFallbackImage();
    }
  }

  /**
   * Process profile image and save to file
   * @param imageUrl The URL of the profile image
   * @param outputPath The path where to save the processed image
   * @returns Promise<string> The path to the saved image
   */
  async processAndSaveImage(imageUrl: string, outputPath: string): Promise<string> {
    const processedImage = await this.processProfileImage(imageUrl);
    
    // Ensure directory exists
    const dir = path.dirname(outputPath);
    await fs.mkdir(dir, { recursive: true });
    
    // Save the processed image
    await fs.writeFile(outputPath, processedImage);
    
    return outputPath;
  }

  /**
   * Get image metadata
   * @param imageBuffer The image buffer to analyze
   * @returns Promise<sharp.Metadata> Image metadata
   */
  async getImageMetadata(imageBuffer: Buffer): Promise<sharp.Metadata> {
    return await sharp(imageBuffer).metadata();
  }

  /**
   * Create a circular version of the image (for name tags)
   * @param imageUrl The URL of the profile image
   * @returns Promise<Buffer> The circular image buffer
   */
  async createCircularImage(imageUrl: string): Promise<Buffer> {
    const imageBuffer = await this.processProfileImage(imageUrl);
    
    // Create a circular mask
    const roundedCorners = Buffer.from(
      `<svg width="${this.options.size}" height="${this.options.size}">
        <circle cx="${this.options.size / 2}" cy="${this.options.size / 2}" r="${this.options.size / 2}" fill="white"/>
      </svg>`
    );

    return await sharp(imageBuffer)
      .resize(this.options.size, this.options.size)
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .toFormat('png') // PNG for transparency support
      .toBuffer();
  }
}