import { QRCodeGenerator } from '../QRCodeGenerator';
import QRCode from 'qrcode';
import sharp from 'sharp';

// Mock dependencies
jest.mock('qrcode');
jest.mock('sharp');

const mockedQRCode = QRCode as any;

describe('QRCodeGenerator', () => {
  let qrGenerator: QRCodeGenerator;
  const mockUrl = 'https://x.com/testuser';
  const mockQRBuffer = Buffer.from('fake-qr-data');
  const mockQRDataUrl = 'data:image/png;base64,ZmFrZS1xci1kYXRh';
  const mockQRSvg = '<svg>fake-qr-svg</svg>';

  beforeEach(() => {
    qrGenerator = new QRCodeGenerator();
    jest.clearAllMocks();
  });

  describe('generateQRCode', () => {
    it('should generate QR code as buffer by default', async () => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);

      const result = await qrGenerator.generateQRCode(mockUrl);

      expect(mockedQRCode.toBuffer).toHaveBeenCalledWith(mockUrl, {
        errorCorrectionLevel: 'M',
        type: 'png',
        width: 400,
        margin: 4,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      expect(result).toBe(mockQRBuffer);
    });

    it('should generate QR code as SVG when type is svg', async () => {
      const svgGenerator = new QRCodeGenerator({ type: 'svg' });
      mockedQRCode.toString.mockResolvedValue(mockQRSvg);

      const result = await svgGenerator.generateQRCode(mockUrl);

      expect(mockedQRCode.toString).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
        type: 'svg'
      }));
      expect(result).toBe(mockQRSvg);
    });

    it('should generate QR code as data URL when type is png', async () => {
      const pngGenerator = new QRCodeGenerator({ type: 'png' });
      mockedQRCode.toDataURL.mockResolvedValue(mockQRDataUrl);

      const result = await pngGenerator.generateQRCode(mockUrl);

      expect(mockedQRCode.toDataURL).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
        type: 'png'
      }));
      expect(result).toBe(mockQRDataUrl);
    });

    it('should use custom options', async () => {
      const customGenerator = new QRCodeGenerator({
        size: 600,
        margin: 2,
        errorCorrectionLevel: 'H',
        color: {
          dark: '#123456',
          light: '#FEDCBA'
        }
      });
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);

      await customGenerator.generateQRCode(mockUrl);

      expect(mockedQRCode.toBuffer).toHaveBeenCalledWith(mockUrl, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 600,
        margin: 2,
        color: {
          dark: '#123456',
          light: '#FEDCBA'
        }
      });
    });

    it('should handle QR code generation errors', async () => {
      mockedQRCode.toBuffer.mockRejectedValue(new Error('QR generation failed'));

      await expect(qrGenerator.generateQRCode(mockUrl))
        .rejects.toThrow('Failed to generate QR code: QR generation failed');
    });
  });

  describe('generateStyledQRCode', () => {
    beforeEach(() => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);
    });

    it('should generate basic QR code without logo', async () => {
      const result = await qrGenerator.generateStyledQRCode(mockUrl);

      expect(mockedQRCode.toBuffer).toHaveBeenCalled();
      expect(result).toBe(mockQRBuffer);
    });

    it('should generate QR code with custom colors', async () => {
      await qrGenerator.generateStyledQRCode(mockUrl, {
        backgroundColor: '#FF0000',
        foregroundColor: '#0000FF'
      });

      expect(mockedQRCode.toBuffer).toHaveBeenCalledWith(mockUrl, expect.objectContaining({
        color: {
          dark: '#0000FF',
          light: '#FF0000'
        }
      }));
    });

    it('should add logo to QR code', async () => {
      const mockLogoBuffer = Buffer.from('fake-logo-data');
      const mockProcessedLogo = Buffer.from('processed-logo');
      const mockCompositeQR = Buffer.from('composite-qr');

      // Mock sharp for logo processing
      const logoSharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockProcessedLogo)
      };
      
      // Mock sharp for QR compositing
      const qrSharpInstance = {
        composite: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockCompositeQR)
      };

      (sharp as any)
        .mockReturnValueOnce(logoSharpInstance as any)
        .mockReturnValueOnce(qrSharpInstance as any);

      const result = await qrGenerator.generateStyledQRCode(mockUrl, {
        logoBuffer: mockLogoBuffer,
        logoSize: 100
      });

      expect(logoSharpInstance.resize).toHaveBeenCalledWith(100, 100, { fit: 'contain' });
      expect(qrSharpInstance.composite).toHaveBeenCalledWith([{
        input: mockProcessedLogo,
        top: 150, // (400 - 100) / 2
        left: 150
      }]);
      expect(result).toBe(mockCompositeQR);
    });
  });

  describe('generateRoundedQRCode', () => {
    it('should generate QR code with rounded corners', async () => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);
      const mockRoundedQR = Buffer.from('rounded-qr');

      const sharpInstance = {
        composite: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockRoundedQR)
      };
      (sharp as any).mockReturnValue(sharpInstance as any);

      const result = await qrGenerator.generateRoundedQRCode(mockUrl, 30);

      expect(sharpInstance.composite).toHaveBeenCalledWith([{
        input: expect.any(Buffer),
        blend: 'dest-in'
      }]);
      expect(sharpInstance.toFormat).toHaveBeenCalledWith('png');
      expect(result).toBe(mockRoundedQR);
    });

    it('should use default border radius', async () => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);
      const mockRoundedQR = Buffer.from('rounded-qr');

      const sharpInstance = {
        composite: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockRoundedQR)
      };
      (sharp as any).mockReturnValue(sharpInstance as any);

      await qrGenerator.generateRoundedQRCode(mockUrl);

      // Check that SVG contains default radius of 20
      const compositeCall = sharpInstance.composite.mock.calls[0][0];
      const svgBuffer = compositeCall[0].input;
      const svgString = svgBuffer.toString();
      expect(svgString).toContain('rx="20"');
      expect(svgString).toContain('ry="20"');
    });
  });

  describe('validateUrl', () => {
    it('should validate correct URLs', () => {
      expect(qrGenerator.validateUrl('https://x.com/user')).toBe(true);
      expect(qrGenerator.validateUrl('http://example.com')).toBe(true);
      expect(qrGenerator.validateUrl('https://example.com/path?query=1')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(qrGenerator.validateUrl('not-a-url')).toBe(false);
      expect(qrGenerator.validateUrl('')).toBe(false);
      expect(qrGenerator.validateUrl('javascript:alert(1)')).toBe(false);
    });

    it('should reject URLs that are too long', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      expect(qrGenerator.validateUrl(longUrl)).toBe(false);
    });
  });

  describe('getRecommendedSize', () => {
    it('should recommend appropriate sizes based on URL length', () => {
      expect(qrGenerator.getRecommendedSize('https://x.com/u')).toBe(200);
      expect(qrGenerator.getRecommendedSize('https://x.com/' + 'a'.repeat(60))).toBe(300);
      expect(qrGenerator.getRecommendedSize('https://x.com/' + 'a'.repeat(150))).toBe(400);
      expect(qrGenerator.getRecommendedSize('https://x.com/' + 'a'.repeat(250))).toBe(500);
    });
  });

  describe('generateAndSaveQRCode', () => {
    it('should save buffer QR code to file', async () => {
      const fs = { writeFile: jest.fn().mockResolvedValue(undefined) };
      const path = { dirname: jest.fn().mockReturnValue('/tmp') };
      
      jest.doMock('fs/promises', () => fs);
      jest.doMock('path', () => path);
      
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);
      
      const outputPath = '/tmp/qr.png';
      const result = await qrGenerator.generateAndSaveQRCode(mockUrl, outputPath);
      
      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, mockQRBuffer);
      expect(result).toBe(outputPath);
    });

    it('should save data URL QR code to file', async () => {
      const fs = { writeFile: jest.fn().mockResolvedValue(undefined) };
      const path = { dirname: jest.fn().mockReturnValue('/tmp') };
      
      jest.doMock('fs/promises', () => fs);
      jest.doMock('path', () => path);
      
      const pngGenerator = new QRCodeGenerator({ type: 'png' });
      mockedQRCode.toDataURL.mockResolvedValue(mockQRDataUrl);
      
      const outputPath = '/tmp/qr.png';
      await pngGenerator.generateAndSaveQRCode(mockUrl, outputPath);
      
      // Should convert base64 to buffer
      const expectedBuffer = Buffer.from('fake-qr-data', 'base64');
      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, expectedBuffer);
    });

    it('should save SVG QR code to file', async () => {
      const fs = { writeFile: jest.fn().mockResolvedValue(undefined) };
      const path = { dirname: jest.fn().mockReturnValue('/tmp') };
      
      jest.doMock('fs/promises', () => fs);
      jest.doMock('path', () => path);
      
      const svgGenerator = new QRCodeGenerator({ type: 'svg' });
      mockedQRCode.toString.mockResolvedValue(mockQRSvg);
      
      const outputPath = '/tmp/qr.svg';
      await svgGenerator.generateAndSaveQRCode(mockUrl, outputPath);
      
      expect(fs.writeFile).toHaveBeenCalledWith(outputPath, mockQRSvg);
    });
  });

  describe('generatePatternQRCode', () => {
    it('should return standard QR for square pattern', async () => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);

      const result = await qrGenerator.generatePatternQRCode(mockUrl, 'square');

      expect(result).toBe(mockQRBuffer);
    });

    it('should generate rounded pattern', async () => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);
      const mockRoundedQR = Buffer.from('rounded-qr');

      const sharpInstance = {
        composite: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockRoundedQR)
      };
      (sharp as any).mockReturnValue(sharpInstance as any);

      const result = await qrGenerator.generatePatternQRCode(mockUrl, 'rounded');

      expect(result).toBe(mockRoundedQR);
    });

    it('should handle dots pattern (fallback to standard)', async () => {
      mockedQRCode.toBuffer.mockResolvedValue(mockQRBuffer);

      const result = await qrGenerator.generatePatternQRCode(mockUrl, 'dots');

      // Since dots pattern is not fully implemented, it should return standard
      expect(result).toBe(mockQRBuffer);
    });
  });
});