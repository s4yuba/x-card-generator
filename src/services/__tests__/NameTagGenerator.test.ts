import { NameTagGenerator } from '../NameTagGenerator';
import { ProfileScraper } from '../ProfileScraper';
import { ImageProcessor } from '../ImageProcessor';
import { QRCodeGenerator } from '../QRCodeGenerator';
import { PDFGenerator } from '../PDFGenerator';
import { ProfileData } from '../../types';

// Mock all dependencies
jest.mock('../ProfileScraper');
jest.mock('../ImageProcessor');
jest.mock('../QRCodeGenerator');
jest.mock('../PDFGenerator');

describe('NameTagGenerator', () => {
  let nameTagGenerator: NameTagGenerator;
  let mockProfileScraper: jest.Mocked<ProfileScraper>;
  let mockImageProcessor: jest.Mocked<ImageProcessor>;
  let mockQRCodeGenerator: jest.Mocked<QRCodeGenerator>;
  let mockPDFGenerator: jest.Mocked<PDFGenerator>;

  const mockProfileData: ProfileData = {
    username: 'testuser',
    displayName: 'Test User',
    profileImageUrl: 'https://example.com/image.jpg',
    profileUrl: 'https://x.com/testuser',
    extractedAt: new Date('2024-01-01')
  };

  const mockProfileImageBuffer = Buffer.from('fake-profile-image');
  const mockQRCodeBuffer = Buffer.from('fake-qr-code');
  const mockPDFBuffer = Buffer.from('fake-pdf');

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockProfileScraper = {
      extractProfile: jest.fn().mockResolvedValue(mockProfileData),
      close: jest.fn().mockResolvedValue(undefined),
      isProfileAccessible: jest.fn().mockResolvedValue(true)
    } as any;

    mockImageProcessor = {
      createCircularImage: jest.fn().mockResolvedValue(mockProfileImageBuffer),
      processProfileImage: jest.fn().mockResolvedValue(mockProfileImageBuffer)
    } as any;

    mockQRCodeGenerator = {
      generateQRCode: jest.fn().mockResolvedValue(mockQRCodeBuffer)
    } as any;

    mockPDFGenerator = {
      generateNameTag: jest.fn().mockResolvedValue(mockPDFBuffer),
      generateSimpleNameTag: jest.fn().mockResolvedValue(mockPDFBuffer),
      generateMultipleNameTags: jest.fn().mockResolvedValue(mockPDFBuffer)
    } as any;

    // Mock constructors
    (ProfileScraper as jest.MockedClass<typeof ProfileScraper>).mockImplementation(() => mockProfileScraper);
    (ImageProcessor as jest.MockedClass<typeof ImageProcessor>).mockImplementation(() => mockImageProcessor);
    (QRCodeGenerator as jest.MockedClass<typeof QRCodeGenerator>).mockImplementation(() => mockQRCodeGenerator);
    (PDFGenerator as jest.MockedClass<typeof PDFGenerator>).mockImplementation(() => mockPDFGenerator);

    nameTagGenerator = new NameTagGenerator();
  });

  describe('generateNameTag', () => {
    it('should generate a complete name tag successfully', async () => {
      const result = await nameTagGenerator.generateNameTag('https://x.com/testuser');

      // Verify the workflow
      expect(mockProfileScraper.extractProfile).toHaveBeenCalledWith('https://x.com/testuser');
      expect(mockImageProcessor.createCircularImage).toHaveBeenCalledWith(mockProfileData.profileImageUrl);
      expect(mockQRCodeGenerator.generateQRCode).toHaveBeenCalledWith(mockProfileData.profileUrl);
      expect(mockPDFGenerator.generateNameTag).toHaveBeenCalledWith({
        profileData: mockProfileData,
        profileImageBuffer: mockProfileImageBuffer,
        qrCodeBuffer: mockQRCodeBuffer
      });
      expect(mockProfileScraper.close).toHaveBeenCalled();

      expect(result).toBe(mockPDFBuffer);
    });

    it('should handle profile scraping errors', async () => {
      mockProfileScraper.extractProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(nameTagGenerator.generateNameTag('https://x.com/invalid'))
        .rejects.toThrow('Failed to generate name tag: Profile not found');

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });

    it('should use fallback image when image processing fails', async () => {
      mockImageProcessor.createCircularImage.mockRejectedValue(new Error('Image processing failed'));

      const result = await nameTagGenerator.generateNameTag('https://x.com/testuser');

      expect(mockImageProcessor.processProfileImage).toHaveBeenCalledWith('');
      expect(result).toBe(mockPDFBuffer);
    });

    it('should handle QR code generation errors', async () => {
      mockQRCodeGenerator.generateQRCode.mockRejectedValue(new Error('QR generation failed'));

      await expect(nameTagGenerator.generateNameTag('https://x.com/testuser'))
        .rejects.toThrow('Failed to generate name tag: QR generation failed');

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });

    it('should handle PDF generation errors', async () => {
      mockPDFGenerator.generateNameTag.mockRejectedValue(new Error('PDF generation failed'));

      await expect(nameTagGenerator.generateNameTag('https://x.com/testuser'))
        .rejects.toThrow('Failed to generate name tag: PDF generation failed');

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });

    it('should always close browser even on error', async () => {
      mockProfileScraper.extractProfile.mockRejectedValue(new Error('Some error'));

      try {
        await nameTagGenerator.generateNameTag('https://x.com/testuser');
      } catch (error) {
        // Expected error
      }

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });
  });

  describe('generateMultipleNameTags', () => {
    const urls = ['https://x.com/user1', 'https://x.com/user2', 'https://x.com/user3'];

    it('should generate multiple name tags successfully', async () => {
      const result = await nameTagGenerator.generateMultipleNameTags(urls);

      expect(mockProfileScraper.extractProfile).toHaveBeenCalledTimes(3);
      expect(mockImageProcessor.createCircularImage).toHaveBeenCalledTimes(3);
      expect(mockQRCodeGenerator.generateQRCode).toHaveBeenCalledTimes(3);
      expect(mockPDFGenerator.generateMultipleNameTags).toHaveBeenCalledWith(
        expect.arrayContaining([
          {
            profileData: mockProfileData,
            profileImageBuffer: mockProfileImageBuffer,
            qrCodeBuffer: mockQRCodeBuffer
          }
        ]),
        {}
      );
      expect(result).toBe(mockPDFBuffer);
    });

    it('should skip failed profiles and continue', async () => {
      // Make second profile fail
      mockProfileScraper.extractProfile
        .mockResolvedValueOnce(mockProfileData)
        .mockRejectedValueOnce(new Error('Profile not found'))
        .mockResolvedValueOnce(mockProfileData);

      const result = await nameTagGenerator.generateMultipleNameTags(urls);

      expect(mockPDFGenerator.generateMultipleNameTags).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ profileData: mockProfileData })
        ]),
        {}
      );
      // Should have 2 successful profiles
      const callArgs = mockPDFGenerator.generateMultipleNameTags.mock.calls[0];
      expect(callArgs[0]).toHaveLength(2);
      expect(result).toBe(mockPDFBuffer);
    });

    it('should throw error if no profiles could be processed', async () => {
      mockProfileScraper.extractProfile.mockRejectedValue(new Error('Profile not found'));

      await expect(nameTagGenerator.generateMultipleNameTags(urls))
        .rejects.toThrow('No valid profiles could be processed');

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });

    it('should pass custom options to PDF generator', async () => {
      const options = {
        paperSize: 'A4' as const,
        columns: 3,
        rows: 5,
        spacing: 15
      };

      await nameTagGenerator.generateMultipleNameTags(urls, options);

      expect(mockPDFGenerator.generateMultipleNameTags).toHaveBeenCalledWith(
        expect.any(Array),
        options
      );
    });

    it('should use fallback images for failed image processing', async () => {
      mockImageProcessor.createCircularImage
        .mockResolvedValueOnce(mockProfileImageBuffer)
        .mockRejectedValueOnce(new Error('Image failed'))
        .mockResolvedValueOnce(mockProfileImageBuffer);

      await nameTagGenerator.generateMultipleNameTags(urls);

      expect(mockImageProcessor.processProfileImage).toHaveBeenCalledWith('');
    });
  });

  describe('generateSimpleNameTag', () => {
    it('should generate a simple name tag without QR code', async () => {
      const result = await nameTagGenerator.generateSimpleNameTag('https://x.com/testuser');

      expect(mockProfileScraper.extractProfile).toHaveBeenCalledWith('https://x.com/testuser');
      expect(mockImageProcessor.createCircularImage).toHaveBeenCalledWith(mockProfileData.profileImageUrl);
      expect(mockQRCodeGenerator.generateQRCode).not.toHaveBeenCalled();
      expect(mockPDFGenerator.generateSimpleNameTag).toHaveBeenCalledWith({
        profileData: mockProfileData,
        profileImageBuffer: mockProfileImageBuffer
      });
      expect(result).toBe(mockPDFBuffer);
    });

    it('should handle errors appropriately', async () => {
      mockProfileScraper.extractProfile.mockRejectedValue(new Error('Profile error'));

      await expect(nameTagGenerator.generateSimpleNameTag('https://x.com/invalid'))
        .rejects.toThrow('Failed to generate simple name tag: Profile error');

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });
  });

  describe('validateProfile', () => {
    it('should validate accessible profiles', async () => {
      mockProfileScraper.isProfileAccessible.mockResolvedValue(true);

      const result = await nameTagGenerator.validateProfile('https://x.com/testuser');

      expect(mockProfileScraper.isProfileAccessible).toHaveBeenCalledWith('https://x.com/testuser');
      expect(result).toBe(true);
      expect(mockProfileScraper.close).toHaveBeenCalled();
    });

    it('should return false for inaccessible profiles', async () => {
      mockProfileScraper.isProfileAccessible.mockResolvedValue(false);

      const result = await nameTagGenerator.validateProfile('https://x.com/private');

      expect(result).toBe(false);
      expect(mockProfileScraper.close).toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should close browser instance', async () => {
      await nameTagGenerator.cleanup();

      expect(mockProfileScraper.close).toHaveBeenCalled();
    });
  });

  describe('with custom options', () => {
    it('should pass options to all services', () => {
      const options = {
        profileScraperOptions: { timeout: 60000 },
        imageProcessorOptions: { size: 300 },
        qrCodeOptions: { size: 500 },
        pdfOptions: { width: 300 }
      };

      new NameTagGenerator(options);

      expect(ProfileScraper).toHaveBeenCalledWith(options.profileScraperOptions);
      expect(ImageProcessor).toHaveBeenCalledWith(options.imageProcessorOptions);
      expect(QRCodeGenerator).toHaveBeenCalledWith(options.qrCodeOptions);
      expect(PDFGenerator).toHaveBeenCalledWith(options.pdfOptions);
    });
  });
});