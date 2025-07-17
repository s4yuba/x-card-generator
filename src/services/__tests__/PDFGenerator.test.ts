import { PDFGenerator, NameTagContent } from '../PDFGenerator';
import { ProfileData } from '../../types';
import PDFDocument from 'pdfkit';

// Mock PDFKit
jest.mock('pdfkit');

describe('PDFGenerator', () => {
  let pdfGenerator: PDFGenerator;
  let mockDoc: any;
  let mockProfileData: ProfileData;
  let mockContent: NameTagContent;
  const mockProfileImageBuffer = Buffer.from('fake-profile-image');
  const mockQRCodeBuffer = Buffer.from('fake-qr-code');

  beforeEach(() => {
    // Setup mock PDFDocument
    mockDoc = {
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      circle: jest.fn().mockReturnThis(),
      clip: jest.fn().mockReturnThis(),
      image: jest.fn().mockReturnThis(),
      save: jest.fn().mockReturnThis(),
      restore: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      addPage: jest.fn().mockReturnThis(),
      lineWidth: jest.fn().mockReturnThis(),
      strokeColor: jest.fn().mockReturnThis(),
      roundedRect: jest.fn().mockReturnThis(),
      stroke: jest.fn().mockReturnThis(),
      translate: jest.fn().mockReturnThis(),
      end: jest.fn(),
      on: jest.fn()
    };

    // Mock PDFDocument constructor
    (PDFDocument as unknown as jest.Mock).mockImplementation(() => mockDoc);

    // Setup test data
    mockProfileData = {
      username: 'testuser',
      displayName: 'Test User',
      profileImageUrl: 'https://example.com/image.jpg',
      profileUrl: 'https://x.com/testuser',
      extractedAt: new Date('2024-01-01')
    };

    mockContent = {
      profileData: mockProfileData,
      profileImageBuffer: mockProfileImageBuffer,
      qrCodeBuffer: mockQRCodeBuffer
    };

    pdfGenerator = new PDFGenerator();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateNameTag', () => {
    it('should generate a complete name tag PDF', async () => {
      const mockPdfBuffer = Buffer.from('fake-pdf-content');
      const chunks: Buffer[] = [mockPdfBuffer];
      
      // Setup event handlers
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          // Simulate data event
          setTimeout(() => handler(chunks[0]), 0);
        } else if (event === 'end') {
          // Simulate end event after doc.end() is called
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      const result = await pdfGenerator.generateNameTag(mockContent);

      // Verify PDF document was created with correct options
      expect(PDFDocument).toHaveBeenCalledWith({
        size: [252, 162], // 3.5" x 2.25"
        margins: { top: 10, bottom: 10, left: 10, right: 10 },
        info: {
          Title: 'Name Tag - Test User',
          Author: 'X Profile Name Tag Generator',
          Subject: 'Professional Name Tag',
          Keywords: 'name tag, X, Twitter, profile'
        }
      });

      // Verify front side was generated
      expect(mockDoc.rect).toHaveBeenCalledWith(0, 0, 252, 162);
      expect(mockDoc.fill).toHaveBeenCalledWith('#FFFFFF');
      expect(mockDoc.image).toHaveBeenCalledWith(
        mockProfileImageBuffer,
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
      expect(mockDoc.text).toHaveBeenCalledWith(
        'Test User',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );
      expect(mockDoc.text).toHaveBeenCalledWith(
        '@testuser',
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );

      // Verify back side was generated
      expect(mockDoc.addPage).toHaveBeenCalled();
      expect(mockDoc.image).toHaveBeenCalledWith(
        mockQRCodeBuffer,
        expect.any(Number),
        expect.any(Number),
        expect.any(Object)
      );

      expect(mockDoc.end).toHaveBeenCalled();
      expect(result).toEqual(mockPdfBuffer);
    });

    it('should handle image drawing errors gracefully', async () => {
      // Make image method throw error
      mockDoc.image.mockImplementation(() => {
        throw new Error('Image error');
      });

      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('pdf')), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      const result = await pdfGenerator.generateNameTag(mockContent);

      // Should draw placeholder circles instead
      expect(mockDoc.circle).toHaveBeenCalled();
      expect(mockDoc.fill).toHaveBeenCalledWith('#E1E8ED');
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle PDF generation errors', async () => {
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'error') {
          setTimeout(() => handler(new Error('PDF generation failed')), 0);
        }
        return mockDoc;
      });

      await expect(pdfGenerator.generateNameTag(mockContent))
        .rejects.toThrow('PDF generation failed');
    });
  });

  describe('generateSimpleNameTag', () => {
    it('should generate front-only name tag', async () => {
      const mockPdfBuffer = Buffer.from('fake-pdf-content');
      
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(mockPdfBuffer), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      const simpleContent = {
        profileData: mockProfileData,
        profileImageBuffer: mockProfileImageBuffer
      };

      const result = await pdfGenerator.generateSimpleNameTag(simpleContent);

      // Should not add a second page
      expect(mockDoc.addPage).not.toHaveBeenCalled();
      expect(result).toEqual(mockPdfBuffer);
    });
  });

  describe('generateMultipleNameTags', () => {
    it('should generate multiple name tags on a single page', async () => {
      const mockPdfBuffer = Buffer.from('fake-pdf-content');
      const contents = [mockContent, mockContent, mockContent, mockContent];
      
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(mockPdfBuffer), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      const result = await pdfGenerator.generateMultipleNameTags(contents, {
        paperSize: 'LETTER',
        columns: 2,
        rows: 2
      });

      // Verify paper size
      expect(PDFDocument).toHaveBeenCalledWith({
        size: [612, 792], // Letter size
        margins: { top: 36, bottom: 36, left: 36, right: 36 }
      });

      // Verify positioning for each tag
      expect(mockDoc.translate).toHaveBeenCalledTimes(4);
      expect(mockDoc.save).toHaveBeenCalledTimes(4);
      expect(mockDoc.restore).toHaveBeenCalledTimes(4);
      
      expect(result).toEqual(mockPdfBuffer);
    });

    it('should handle multiple pages when needed', async () => {
      const mockPdfBuffer = Buffer.from('fake-pdf-content');
      // Create more contents than fit on one page (2x4 = 8 per page)
      const contents = Array(10).fill(mockContent);
      
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(mockPdfBuffer), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      await pdfGenerator.generateMultipleNameTags(contents, {
        columns: 2,
        rows: 4
      });

      // Should add a page for the remaining 2 tags
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    it('should support A4 paper size', async () => {
      const mockPdfBuffer = Buffer.from('fake-pdf-content');
      
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(mockPdfBuffer), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      await pdfGenerator.generateMultipleNameTags([mockContent], {
        paperSize: 'A4'
      });

      expect(PDFDocument).toHaveBeenCalledWith({
        size: [595, 842], // A4 size
        margins: expect.any(Object)
      });
    });
  });

  describe('with custom options', () => {
    it('should use custom dimensions and margins', async () => {
      const customGenerator = new PDFGenerator({
        width: 300,
        height: 200,
        margins: { top: 20, bottom: 20, left: 20, right: 20 }
      });

      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('pdf')), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      await customGenerator.generateNameTag(mockContent);

      expect(PDFDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          size: [300, 200],
          margins: { top: 20, bottom: 20, left: 20, right: 20 }
        })
      );
    });

    it('should use custom fonts and colors', async () => {
      const customGenerator = new PDFGenerator({
        fonts: {
          displayName: { size: 30, family: 'Times-Bold' },
          username: { size: 20, family: 'Times-Roman' }
        },
        colors: {
          background: '#F0F0F0',
          text: '#333333',
          accent: '#FF0000'
        }
      });

      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('pdf')), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      await customGenerator.generateNameTag(mockContent);

      expect(mockDoc.fill).toHaveBeenCalledWith('#F0F0F0');
      expect(mockDoc.fillColor).toHaveBeenCalledWith('#333333');
      expect(mockDoc.fillColor).toHaveBeenCalledWith('#FF0000');
      expect(mockDoc.font).toHaveBeenCalledWith('Times-Bold');
      expect(mockDoc.font).toHaveBeenCalledWith('Times-Roman');
      expect(mockDoc.fontSize).toHaveBeenCalledWith(30);
      expect(mockDoc.fontSize).toHaveBeenCalledWith(20);
    });
  });

  describe('decorative elements', () => {
    it('should add decorative border', async () => {
      mockDoc.on.mockImplementation((event: string, handler: Function) => {
        if (event === 'data') {
          setTimeout(() => handler(Buffer.from('pdf')), 0);
        } else if (event === 'end') {
          const originalEnd = mockDoc.end;
          mockDoc.end = jest.fn(() => {
            originalEnd();
            setTimeout(() => handler(), 0);
          });
        }
        return mockDoc;
      });

      await pdfGenerator.generateNameTag(mockContent);

      expect(mockDoc.lineWidth).toHaveBeenCalledWith(2);
      expect(mockDoc.strokeColor).toHaveBeenCalledWith('#1DA1F2');
      expect(mockDoc.roundedRect).toHaveBeenCalled();
      expect(mockDoc.stroke).toHaveBeenCalled();
    });
  });
});