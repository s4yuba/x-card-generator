import { ImageProcessor } from '../ImageProcessor';
import fetch from 'node-fetch';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('node-fetch');
jest.mock('fs/promises');

const mockedFetch = fetch as jest.MockedFunction<typeof fetch>;
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('ImageProcessor', () => {
  let imageProcessor: ImageProcessor;
  const mockImageBuffer = Buffer.from('fake-image-data');
  const mockImageUrl = 'https://pbs.twimg.com/profile_images/123456789/test.jpg';

  beforeEach(() => {
    imageProcessor = new ImageProcessor();
    jest.clearAllMocks();
  });

  describe('processProfileImage', () => {
    it('should successfully download and process an image', async () => {
      // Mock successful fetch
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        buffer: jest.fn().mockResolvedValue(mockImageBuffer)
      } as any);

      // Mock sharp processing
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer),
        metadata: jest.fn().mockResolvedValue({ width: 200, height: 200 })
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.processProfileImage(mockImageUrl);

      expect(mockedFetch).toHaveBeenCalledWith(mockImageUrl, expect.objectContaining({
        headers: expect.objectContaining({
          'User-Agent': expect.any(String)
        }),
        timeout: 10000
      }));
      expect(result).toBe(mockImageBuffer);
      expect(sharpInstance.resize).toHaveBeenCalledWith(200, 200, {
        fit: 'cover',
        position: 'center'
      });
    });

    it('should use fallback image when download fails', async () => {
      // Mock failed fetch
      mockedFetch.mockRejectedValue(new Error('Network error'));

      // Mock sharp for fallback image processing
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.processProfileImage(mockImageUrl);

      expect(result).toBe(mockImageBuffer);
      expect(sharpInstance.resize).toHaveBeenCalled();
    });

    it('should retry download on failure', async () => {
      // Mock fetch to fail twice then succeed
      mockedFetch
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({
          ok: true,
          buffer: jest.fn().mockResolvedValue(mockImageBuffer)
        } as any);

      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.processProfileImage(mockImageUrl);

      expect(mockedFetch).toHaveBeenCalledTimes(3);
      expect(result).toBe(mockImageBuffer);
    });

    it('should handle HTTP error responses', async () => {
      // Mock HTTP 404 response
      mockedFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      } as any);

      // Mock sharp for fallback image
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.processProfileImage(mockImageUrl);

      expect(result).toBe(mockImageBuffer); // Should return fallback
    });

    it('should handle empty image responses', async () => {
      // Mock empty buffer response
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        buffer: jest.fn().mockResolvedValue(Buffer.alloc(0))
      } as any);

      // Mock sharp for fallback image
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.processProfileImage(mockImageUrl);

      expect(result).toBe(mockImageBuffer); // Should return fallback
    });
  });

  describe('processAndSaveImage', () => {
    it('should process and save image to file', async () => {
      const outputPath = '/tmp/processed-image.jpg';
      
      // Mock successful fetch
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        buffer: jest.fn().mockResolvedValue(mockImageBuffer)
      } as any);

      // Mock sharp processing
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      // Mock file system operations
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue();

      const result = await imageProcessor.processAndSaveImage(mockImageUrl, outputPath);

      expect(mockedFs.mkdir).toHaveBeenCalledWith(path.dirname(outputPath), { recursive: true });
      expect(mockedFs.writeFile).toHaveBeenCalledWith(outputPath, mockImageBuffer);
      expect(result).toBe(outputPath);
    });
  });

  describe('createCircularImage', () => {
    it('should create a circular version of the image', async () => {
      // Mock successful fetch
      mockedFetch.mockResolvedValueOnce({
        ok: true,
        buffer: jest.fn().mockResolvedValue(mockImageBuffer)
      } as any);

      // Mock sharp processing with composite
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        composite: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.createCircularImage(mockImageUrl);

      expect(sharpInstance.composite).toHaveBeenCalledWith([{
        input: expect.any(Buffer),
        blend: 'dest-in'
      }]);
      expect(sharpInstance.toFormat).toHaveBeenCalledWith('png');
      expect(result).toBe(mockImageBuffer);
    });
  });

  describe('with custom options', () => {
    it('should use custom size and quality options', async () => {
      const customProcessor = new ImageProcessor({
        size: 300,
        quality: 80,
        format: 'webp'
      });

      mockedFetch.mockResolvedValueOnce({
        ok: true,
        buffer: jest.fn().mockResolvedValue(mockImageBuffer)
      } as any);

      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        sharpen: jest.fn().mockReturnThis(),
        normalize: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      await customProcessor.processProfileImage(mockImageUrl);

      expect(sharpInstance.resize).toHaveBeenCalledWith(300, 300, {
        fit: 'cover',
        position: 'center'
      });
      expect(sharpInstance.toFormat).toHaveBeenCalledWith('webp', {
        quality: 80
      });
    });

    it('should use custom fallback image when provided', async () => {
      const customFallbackPath = '/path/to/fallback.png';
      const customProcessor = new ImageProcessor({
        fallbackImagePath: customFallbackPath
      });

      // Mock failed download
      mockedFetch.mockRejectedValue(new Error('Network error'));

      // Mock fallback image exists
      mockedFs.access.mockResolvedValue();
      mockedFs.readFile.mockResolvedValue(mockImageBuffer);

      // Mock sharp for fallback processing
      const sharpInstance = {
        resize: jest.fn().mockReturnThis(),
        toFormat: jest.fn().mockReturnThis(),
        toBuffer: jest.fn().mockResolvedValue(mockImageBuffer)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      await customProcessor.processProfileImage(mockImageUrl);

      expect(mockedFs.access).toHaveBeenCalledWith(customFallbackPath);
      expect(mockedFs.readFile).toHaveBeenCalledWith(customFallbackPath);
    });
  });

  describe('getImageMetadata', () => {
    it('should return image metadata', async () => {
      const mockMetadata = {
        width: 400,
        height: 400,
        format: 'jpeg'
      };

      const sharpInstance = {
        metadata: jest.fn().mockResolvedValue(mockMetadata)
      };
      (sharp as any).mockReturnValue(sharpInstance);

      const result = await imageProcessor.getImageMetadata(mockImageBuffer);

      expect(result).toEqual(mockMetadata);
      expect(sharpInstance.metadata).toHaveBeenCalled();
    });
  });
});