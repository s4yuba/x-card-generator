import { NameTagService } from '../NameTagService';
import { XProfile, NameTagTemplate, NameTagData } from '../../types';

// Mock dependencies
jest.mock('qrcode');
jest.mock('sharp');

const mockQRCode = require('qrcode');
const mockSharp = require('sharp');

// Mock sharp with chainable methods
const mockComposite = jest.fn().mockReturnValue({
  png: jest.fn().mockReturnValue({
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('mock-image-data'))
  })
});

mockSharp.mockReturnValue({
  composite: mockComposite
});

// Mock qrcode.toBuffer to return a buffer
mockQRCode.toBuffer = jest.fn().mockResolvedValue(Buffer.from('mock-qr-code'));

describe('NameTagService', () => {
  let service: NameTagService;
  let mockProfile: XProfile;
  let mockTemplate: NameTagTemplate;

  beforeEach(() => {
    service = new NameTagService();
    // Reset mocks
    jest.clearAllMocks();
    
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
  });

  describe('generateNameTag', () => {
    it('should generate a name tag with basic profile information', async () => {
      // This test will fail initially (RED phase)
      const result = await service.generateNameTag(mockProfile, mockTemplate);
      
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should generate name tag with QR code containing profile URL', async () => {
      const result = await service.generateNameTag(mockProfile, mockTemplate);
      
      expect(result).toBeDefined();
      // QR code should be generated with profile URL
      expect(mockQRCode.toBuffer).toHaveBeenCalledWith(mockProfile.profileUrl, expect.any(Object));
    });

    it('should handle profile with long display name', async () => {
      const longNameProfile = {
        ...mockProfile,
        displayName: 'This is a very long display name that should be handled properly'
      };
      
      const result = await service.generateNameTag(longNameProfile, mockTemplate);
      expect(result).toBeDefined();
    });

    it('should handle missing avatar image gracefully', async () => {
      const profileWithoutAvatar = {
        ...mockProfile,
        avatarUrl: ''
      };
      
      const result = await service.generateNameTag(profileWithoutAvatar, mockTemplate);
      expect(result).toBeDefined();
    });
  });

  describe('generateWithCustomizations', () => {
    it('should apply custom font size', async () => {
      const customizations = {
        nameFontSize: 20,
        usernameFontSize: 14
      };
      
      const result = await service.generateWithCustomizations(mockProfile, mockTemplate, customizations);
      expect(result).toBeDefined();
    });

    it('should apply custom colors', async () => {
      const customizations = {
        backgroundColor: '#f0f0f0',
        textColor: '#333333',
        accentColor: '#ff6600'
      };
      
      const result = await service.generateWithCustomizations(mockProfile, mockTemplate, customizations);
      expect(result).toBeDefined();
    });

    it('should apply custom template selection', async () => {
      const customTemplate = {
        ...mockTemplate,
        id: 'custom',
        name: 'Custom Template',
        dimensions: { width: 400, height: 250 }
      };
      
      const result = await service.generateWithCustomizations(mockProfile, customTemplate, {});
      expect(result).toBeDefined();
    });
  });

  describe('validateTemplate', () => {
    it('should validate a valid template', () => {
      const isValid = service.validateTemplate(mockTemplate);
      expect(isValid).toBe(true);
    });

    it('should reject template with invalid dimensions', () => {
      const invalidTemplate = {
        ...mockTemplate,
        dimensions: { width: 0, height: 200 }
      };
      
      const isValid = service.validateTemplate(invalidTemplate);
      expect(isValid).toBe(false);
    });

    it('should reject template with missing required fields', () => {
      const invalidTemplate = {
        ...mockTemplate,
        layout: {
          ...mockTemplate.layout,
          avatarPosition: undefined as any
        }
      };
      
      const isValid = service.validateTemplate(invalidTemplate);
      expect(isValid).toBe(false);
    });
  });

  describe('getDefaultTemplate', () => {
    it('should return a valid default template', () => {
      const defaultTemplate = service.getDefaultTemplate();
      
      expect(defaultTemplate).toBeDefined();
      expect(defaultTemplate.id).toBe('default');
      expect(service.validateTemplate(defaultTemplate)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error for invalid profile data', async () => {
      const invalidProfile = {
        ...mockProfile,
        username: ''
      };
      
      await expect(service.generateNameTag(invalidProfile, mockTemplate)).rejects.toThrow();
    });

    it('should throw error for invalid template', async () => {
      const invalidTemplate = {
        ...mockTemplate,
        dimensions: { width: 0, height: 0 }
      };
      
      await expect(service.generateNameTag(mockProfile, invalidTemplate)).rejects.toThrow();
    });
  });
});