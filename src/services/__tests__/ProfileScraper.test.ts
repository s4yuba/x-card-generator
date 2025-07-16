import { ProfileScraper } from '../ProfileScraper';
import { ProfileData } from '../../types';

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(),
}));

describe('ProfileScraper', () => {
  let scraper: ProfileScraper;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock page
    mockPage = {
      setUserAgent: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      evaluate: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Create mock browser
    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    // Mock puppeteer.launch
    const puppeteer = require('puppeteer');
    puppeteer.launch.mockResolvedValue(mockBrowser);

    scraper = new ProfileScraper();
  });

  afterEach(async () => {
    await scraper.close();
  });

  describe('extractProfile', () => {
    describe('successful extraction', () => {
      beforeEach(() => {
        mockPage.evaluate.mockResolvedValue({
          displayName: 'Test User',
          profileImageUrl: 'https://pbs.twimg.com/profile_images/123/test_normal.jpg'
        });
      });

      test('should extract profile data from valid X URL', async () => {
        const result = await scraper.extractProfile('https://x.com/testuser');

        expect(result).toEqual({
          username: 'testuser',
          displayName: 'Test User',
          profileImageUrl: 'https://pbs.twimg.com/profile_images/123/test.jpg',
          profileUrl: 'https://x.com/testuser',
          extractedAt: expect.any(Date)
        });

        expect(mockPage.goto).toHaveBeenCalledWith(
          'https://x.com/testuser',
          { waitUntil: 'networkidle2', timeout: 30000 }
        );
        expect(mockPage.waitForSelector).toHaveBeenCalledWith(
          '[data-testid="UserName"]',
          { timeout: 30000 }
        );
      });

      test('should extract profile data from Twitter URL and normalize', async () => {
        const result = await scraper.extractProfile('https://twitter.com/testuser');

        expect(result.profileUrl).toBe('https://x.com/testuser');
        expect(result.username).toBe('testuser');
      });

      test('should handle profile image URL enhancement', async () => {
        mockPage.evaluate.mockResolvedValue({
          displayName: 'Test User',
          profileImageUrl: 'https://pbs.twimg.com/profile_images/123/test_normal.png'
        });

        const result = await scraper.extractProfile('https://x.com/testuser');

        expect(result.profileImageUrl).toBe('https://pbs.twimg.com/profile_images/123/test.png');
      });

      test('should handle missing profile image by using photo endpoint', async () => {
        mockPage.evaluate.mockResolvedValue({
          displayName: 'Test User',
          profileImageUrl: ''
        });

        const result = await scraper.extractProfile('https://x.com/testuser');

        expect(result.profileImageUrl).toBe('https://x.com/testuser/photo');
      });

      test('should set correct user agent and viewport', async () => {
        await scraper.extractProfile('https://x.com/testuser');

        expect(mockPage.setUserAgent).toHaveBeenCalledWith(
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        );
        expect(mockPage.setViewport).toHaveBeenCalledWith({ width: 1280, height: 720 });
      });
    });

    describe('error handling', () => {
      test('should throw error for invalid URL', async () => {
        await expect(scraper.extractProfile('invalid-url'))
          .rejects.toThrow('Invalid URL:');
      });

      test('should throw error when display name cannot be extracted', async () => {
        mockPage.evaluate.mockResolvedValue({
          displayName: '',
          profileImageUrl: ''
        });

        await expect(scraper.extractProfile('https://x.com/testuser'))
          .rejects.toThrow('Could not extract display name. Profile may be private or page structure has changed.');
      });

      test('should handle network errors', async () => {
        mockPage.goto.mockRejectedValue(new Error('net::ERR_NAME_NOT_RESOLVED'));

        await expect(scraper.extractProfile('https://x.com/testuser'))
          .rejects.toThrow('Network error: Could not resolve X.com. Please check your internet connection.');
      });

      test('should handle navigation timeout', async () => {
        mockPage.goto.mockRejectedValue(new Error('Navigation timeout of 30000 ms exceeded'));

        await expect(scraper.extractProfile('https://x.com/testuser'))
          .rejects.toThrow('Timeout: Profile page took too long to load. The profile may be private or temporarily unavailable.');
      });

      test('should handle selector timeout (private profile)', async () => {
        mockPage.waitForSelector.mockRejectedValue(new Error('Timeout waiting for selector'));

        await expect(scraper.extractProfile('https://x.com/testuser'))
          .rejects.toThrow('Failed to extract profile data:');
      });

      test('should close page even when error occurs', async () => {
        mockPage.evaluate.mockRejectedValue(new Error('Test error'));

        await expect(scraper.extractProfile('https://x.com/testuser'))
          .rejects.toThrow();

        expect(mockPage.close).toHaveBeenCalled();
      });
    });

    describe('custom options', () => {
      test('should use custom timeout', async () => {
        const customScraper = new ProfileScraper({ timeout: 60000 });
        mockPage.evaluate.mockResolvedValue({
          displayName: 'Test User',
          profileImageUrl: ''
        });

        await customScraper.extractProfile('https://x.com/testuser');

        expect(mockPage.goto).toHaveBeenCalledWith(
          'https://x.com/testuser',
          { waitUntil: 'networkidle2', timeout: 60000 }
        );
        expect(mockPage.waitForSelector).toHaveBeenCalledWith(
          '[data-testid="UserName"]',
          { timeout: 60000 }
        );

        await customScraper.close();
      });

      test('should use custom user agent', async () => {
        const customUserAgent = 'Custom User Agent';
        const customScraper = new ProfileScraper({ userAgent: customUserAgent });
        mockPage.evaluate.mockResolvedValue({
          displayName: 'Test User',
          profileImageUrl: ''
        });

        await customScraper.extractProfile('https://x.com/testuser');

        expect(mockPage.setUserAgent).toHaveBeenCalledWith(customUserAgent);

        await customScraper.close();
      });
    });
  });

  describe('isProfileAccessible', () => {
    test('should return true for accessible profile', async () => {
      mockPage.evaluate.mockResolvedValue({
        displayName: 'Test User',
        profileImageUrl: ''
      });

      const result = await scraper.isProfileAccessible('https://x.com/testuser');
      expect(result).toBe(true);
    });

    test('should return false for inaccessible profile', async () => {
      mockPage.evaluate.mockRejectedValue(new Error('Profile not found'));

      const result = await scraper.isProfileAccessible('https://x.com/testuser');
      expect(result).toBe(false);
    });
  });

  describe('browser management', () => {
    test('should initialize browser only once', async () => {
      const puppeteer = require('puppeteer');
      
      mockPage.evaluate.mockResolvedValue({
        displayName: 'Test User',
        profileImageUrl: ''
      });

      // Make multiple calls
      await scraper.extractProfile('https://x.com/testuser1');
      await scraper.extractProfile('https://x.com/testuser2');

      // Browser should only be launched once
      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
      expect(mockBrowser.newPage).toHaveBeenCalledTimes(2);
    });

    test('should close browser when close() is called', async () => {
      mockPage.evaluate.mockResolvedValue({
        displayName: 'Test User',
        profileImageUrl: ''
      });

      await scraper.extractProfile('https://x.com/testuser');
      await scraper.close();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should handle close() when browser is not initialized', async () => {
      const newScraper = new ProfileScraper();
      await expect(newScraper.close()).resolves.not.toThrow();
    });
  });
});