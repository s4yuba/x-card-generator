import { PDFService, PDFOptions } from '../PDFService';
import { XProfile, NameTagTemplate } from '../../types';
import { NameTagService } from '../NameTagService';

// Mock dependencies
jest.mock('../NameTagService');
jest.mock('pdfkit');

const mockNameTagService = NameTagService as jest.MockedClass<typeof NameTagService>;
const mockPDFDocument = require('pdfkit');

describe('PDFService', () => {
  let service: PDFService;
  let mockProfile: XProfile;
  let mockTemplate: NameTagTemplate;
  let mockPDFOptions: PDFOptions;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock NameTagService
    mockNameTagService.prototype.generateNameTag = jest.fn().mockResolvedValue(Buffer.from('mock-name-tag'));
    
    // Mock PDFDocument
    const mockDoc = {
      on: jest.fn(),
      end: jest.fn(),
      addPage: jest.fn(),
      image: jest.fn(),
      page: {
        width: 595,
        height: 842
      }
    };

    // Setup event simulation
    mockDoc.on.mockImplementation((event, callback) => {
      if (event === 'data') {
        // Simulate data event
        setTimeout(() => callback(Buffer.from('mock-pdf-data')), 10);
      } else if (event === 'end') {
        // Simulate end event
        setTimeout(() => callback(), 20);
      }
    });

    mockPDFDocument.mockReturnValue(mockDoc);
    
    service = new PDFService();
    
    mockProfile = {
      username: 'testuser',
      displayName: 'Test User',
      bio: 'Test bio',
      avatarUrl: 'https://example.com/avatar.jpg',
      profileUrl: 'https://x.com/testuser',
      verified: false,
      followerCount: '100',
      followingCount: '50',
      extractedAt: new Date('2023-01-01')
    };

    mockTemplate = {
      id: 'default',
      name: 'Default Template',
      dimensions: { width: 300, height: 200 },
      layout: {
        avatarPosition: { x: 20, y: 20 },
        avatarSize: 60,
        namePosition: { x: 100, y: 30 },
        usernamePosition: { x: 100, y: 60 },
        qrCodePosition: { x: 220, y: 20 },
        qrCodeSize: 80
      },
      styles: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        accentColor: '#1da1f2',
        fontFamily: 'Arial',
        nameFontSize: 16,
        usernameFontSize: 12
      }
    };

    mockPDFOptions = {
      quality: 'medium',
      pageSize: 'A4',
      orientation: 'portrait',
      margin: 50,
      nameTagsPerPage: 6
    };
  });

  describe('generateSingleNameTagPDF', () => {
    it('should generate PDF with single name tag', async () => {
      const result = await service.generateSingleNameTagPDF(mockProfile, mockTemplate);
      
      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeDefined();
      expect(result.nameTagCount).toBe(1);
      expect(result.pageCount).toBe(1);
      expect(result.memoryUsage).toBeGreaterThan(0);
      expect(Buffer.isBuffer(result.pdfBuffer)).toBe(true);
    });

    it('should call NameTagService to generate name tag', async () => {
      await service.generateSingleNameTagPDF(mockProfile, mockTemplate);
      
      expect(mockNameTagService.prototype.generateNameTag).toHaveBeenCalledWith(mockProfile, mockTemplate);
    });

    it('should create PDF document with correct options', async () => {
      await service.generateSingleNameTagPDF(mockProfile, mockTemplate, mockPDFOptions);
      
      expect(mockPDFDocument).toHaveBeenCalledWith({
        size: 'A4',
        margin: 50,
        info: {
          Title: 'Name Tag - Test User',
          Author: 'X Profile Name Tag Generator',
          Subject: 'Generated Name Tag',
          Keywords: 'name tag, profile, x, twitter'
        }
      });
    });

    it('should handle errors gracefully', async () => {
      mockNameTagService.prototype.generateNameTag.mockRejectedValue(new Error('Generation failed'));
      
      await expect(service.generateSingleNameTagPDF(mockProfile, mockTemplate)).rejects.toThrow();
    });
  });

  describe('generateMultipleNameTagsPDF', () => {
    it('should generate PDF with multiple name tags', async () => {
      const profiles = [mockProfile, { ...mockProfile, username: 'user2' }];
      
      const result = await service.generateMultipleNameTagsPDF(profiles, mockTemplate);
      
      expect(result).toBeDefined();
      expect(result.pdfBuffer).toBeDefined();
      expect(result.nameTagCount).toBe(2);
      expect(result.pageCount).toBe(1);
      expect(result.memoryUsage).toBeGreaterThan(0);
    });

    it('should call NameTagService for each profile', async () => {
      const profiles = [mockProfile, { ...mockProfile, username: 'user2' }];
      
      await service.generateMultipleNameTagsPDF(profiles, mockTemplate);
      
      expect(mockNameTagService.prototype.generateNameTag).toHaveBeenCalledTimes(2);
    });

    it('should calculate correct page count', async () => {
      const profiles = Array.from({ length: 10 }, (_, i) => ({
        ...mockProfile,
        username: `user${i}`
      }));
      
      const result = await service.generateMultipleNameTagsPDF(profiles, mockTemplate);
      
      expect(result.pageCount).toBe(2); // 10 name tags with 6 per page = 2 pages
    });

    it('should throw error for empty profiles array', async () => {
      await expect(service.generateMultipleNameTagsPDF([], mockTemplate)).rejects.toThrow(
        'No profiles provided for PDF generation'
      );
    });

    it('should throw error if memory usage exceeds limit', async () => {
      // Create a large number of profiles to exceed memory limit
      const profiles = Array.from({ length: 1050 }, (_, i) => ({
        ...mockProfile,
        username: `user${i}`
      }));
      
      await expect(service.generateMultipleNameTagsPDF(profiles, mockTemplate)).rejects.toThrow(
        'Memory usage exceeds limit:'
      );
    });
  });

  describe('validatePDFOptions', () => {
    it('should validate correct PDF options', () => {
      const validOptions: PDFOptions = {
        quality: 'medium',
        pageSize: 'A4',
        orientation: 'portrait',
        margin: 50,
        nameTagsPerPage: 6
      };
      
      expect(service.validatePDFOptions(validOptions)).toBe(true);
    });

    it('should reject invalid quality', () => {
      const invalidOptions = { ...mockPDFOptions, quality: 'invalid' as any };
      expect(service.validatePDFOptions(invalidOptions)).toBe(false);
    });

    it('should reject invalid page size', () => {
      const invalidOptions = { ...mockPDFOptions, pageSize: 'invalid' as any };
      expect(service.validatePDFOptions(invalidOptions)).toBe(false);
    });

    it('should reject invalid orientation', () => {
      const invalidOptions = { ...mockPDFOptions, orientation: 'invalid' as any };
      expect(service.validatePDFOptions(invalidOptions)).toBe(false);
    });

    it('should reject invalid margin values', () => {
      const negativeMargin = { ...mockPDFOptions, margin: -10 };
      const excessiveMargin = { ...mockPDFOptions, margin: 150 };
      
      expect(service.validatePDFOptions(negativeMargin)).toBe(false);
      expect(service.validatePDFOptions(excessiveMargin)).toBe(false);
    });

    it('should reject invalid nameTagsPerPage values', () => {
      const tooFew = { ...mockPDFOptions, nameTagsPerPage: 0 };
      const tooMany = { ...mockPDFOptions, nameTagsPerPage: 25 };
      
      expect(service.validatePDFOptions(tooFew)).toBe(false);
      expect(service.validatePDFOptions(tooMany)).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle PDF generation errors', async () => {
      const mockDoc = {
        on: jest.fn(),
        end: jest.fn(),
        addPage: jest.fn(),
        image: jest.fn(),
        page: { width: 595, height: 842 }
      };

      mockDoc.on.mockImplementation((event, callback) => {
        if (event === 'error') {
          setTimeout(() => callback(new Error('PDF generation failed')), 10);
        }
      });

      mockPDFDocument.mockReturnValue(mockDoc);
      
      await expect(service.generateSingleNameTagPDF(mockProfile, mockTemplate)).rejects.toThrow();
    });

    it('should handle name tag generation errors', async () => {
      mockNameTagService.prototype.generateNameTag.mockRejectedValue(new Error('Name tag generation failed'));
      
      await expect(service.generateSingleNameTagPDF(mockProfile, mockTemplate)).rejects.toThrow(
        'Failed to generate single name tag PDF'
      );
    });
  });
});