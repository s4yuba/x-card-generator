import { ProfileData, NameTagData } from '../types';
import { ProfileScraper } from './ProfileScraper';
import { ImageProcessor } from './ImageProcessor';
import { QRCodeGenerator } from './QRCodeGenerator';
import { PDFGenerator } from './PDFGenerator';

export interface NameTagGeneratorOptions {
  profileScraperOptions?: ConstructorParameters<typeof ProfileScraper>[0];
  imageProcessorOptions?: ConstructorParameters<typeof ImageProcessor>[0];
  qrCodeOptions?: ConstructorParameters<typeof QRCodeGenerator>[0];
  pdfOptions?: ConstructorParameters<typeof PDFGenerator>[0];
}

export class NameTagGenerator {
  private profileScraper: ProfileScraper;
  private imageProcessor: ImageProcessor;
  private qrCodeGenerator: QRCodeGenerator;
  private pdfGenerator: PDFGenerator;

  constructor(options: NameTagGeneratorOptions = {}) {
    this.profileScraper = new ProfileScraper(options.profileScraperOptions);
    this.imageProcessor = new ImageProcessor(options.imageProcessorOptions);
    this.qrCodeGenerator = new QRCodeGenerator(options.qrCodeOptions);
    this.pdfGenerator = new PDFGenerator(options.pdfOptions);
  }

  /**
   * Generate a complete name tag from a profile URL
   * @param profileUrl The X profile URL
   * @returns Promise<Buffer> The generated PDF buffer
   */
  async generateNameTag(profileUrl: string): Promise<Buffer> {
    try {
      // Step 1: Extract profile data
      const profileData = await this.profileScraper.extractProfile(profileUrl);

      // Step 2: Process profile image
      let profileImageBuffer: Buffer;
      try {
        profileImageBuffer = await this.imageProcessor.createCircularImage(profileData.profileImageUrl);
      } catch (error) {
        console.warn('Failed to process profile image, using fallback:', error);
        profileImageBuffer = await this.imageProcessor.processProfileImage(''); // Will use fallback
      }

      // Step 3: Generate QR code
      const qrCodeBuffer = await this.qrCodeGenerator.generateQRCode(profileData.profileUrl) as Buffer;

      // Step 4: Generate PDF name tag
      const pdfBuffer = await this.pdfGenerator.generateNameTag({
        profileData,
        profileImageBuffer,
        qrCodeBuffer
      });

      return pdfBuffer;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate name tag: ${error.message}`);
      }
      throw new Error('Failed to generate name tag: Unknown error');
    } finally {
      // Clean up browser instance
      await this.profileScraper.close();
    }
  }

  /**
   * Generate multiple name tags from an array of profile URLs
   * @param profileUrls Array of X profile URLs
   * @param options Options for batch generation
   * @returns Promise<Buffer> The generated PDF with multiple name tags
   */
  async generateMultipleNameTags(
    profileUrls: string[],
    options: {
      paperSize?: 'LETTER' | 'A4';
      columns?: number;
      rows?: number;
      spacing?: number;
    } = {}
  ): Promise<Buffer> {
    const contents = [];

    try {
      for (const url of profileUrls) {
        try {
          // Extract profile data
          const profileData = await this.profileScraper.extractProfile(url);

          // Process profile image
          let profileImageBuffer: Buffer;
          try {
            profileImageBuffer = await this.imageProcessor.createCircularImage(profileData.profileImageUrl);
          } catch (error) {
            console.warn(`Failed to process profile image for ${url}, using fallback:`, error);
            profileImageBuffer = await this.imageProcessor.processProfileImage('');
          }

          // Generate QR code
          const qrCodeBuffer = await this.qrCodeGenerator.generateQRCode(profileData.profileUrl) as Buffer;

          contents.push({
            profileData,
            profileImageBuffer,
            qrCodeBuffer
          });
        } catch (error) {
          console.error(`Failed to process profile ${url}:`, error);
          // Skip failed profiles
        }
      }

      if (contents.length === 0) {
        throw new Error('No valid profiles could be processed');
      }

      // Generate PDF with all name tags
      return await this.pdfGenerator.generateMultipleNameTags(contents, options);
    } finally {
      // Clean up browser instance
      await this.profileScraper.close();
    }
  }

  /**
   * Generate a simple name tag (without QR code on back)
   * @param profileUrl The X profile URL
   * @returns Promise<Buffer> The generated PDF buffer
   */
  async generateSimpleNameTag(profileUrl: string): Promise<Buffer> {
    try {
      // Extract profile data
      const profileData = await this.profileScraper.extractProfile(profileUrl);

      // Process profile image
      let profileImageBuffer: Buffer;
      try {
        profileImageBuffer = await this.imageProcessor.createCircularImage(profileData.profileImageUrl);
      } catch (error) {
        console.warn('Failed to process profile image, using fallback:', error);
        profileImageBuffer = await this.imageProcessor.processProfileImage('');
      }

      // Generate simple PDF name tag (front only)
      const pdfBuffer = await this.pdfGenerator.generateSimpleNameTag({
        profileData,
        profileImageBuffer
      });

      return pdfBuffer;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to generate simple name tag: ${error.message}`);
      }
      throw new Error('Failed to generate simple name tag: Unknown error');
    } finally {
      // Clean up browser instance
      await this.profileScraper.close();
    }
  }

  /**
   * Pre-validate a profile URL before generating
   * @param profileUrl The X profile URL to validate
   * @returns Promise<boolean> True if profile is accessible
   */
  async validateProfile(profileUrl: string): Promise<boolean> {
    try {
      const isAccessible = await this.profileScraper.isProfileAccessible(profileUrl);
      return isAccessible;
    } finally {
      await this.profileScraper.close();
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.profileScraper.close();
  }
}