import {
  isValidXProfileUrl,
  extractUsernameFromUrl,
  validateXProfile,
  validateNameTagTemplate,
  validateAppSettings,
  createAPIError
} from '../validation';
import { ErrorCode } from '../../types';

describe('Validation Utils', () => {
  describe('isValidXProfileUrl', () => {
    it('should validate correct X.com URLs', () => {
      expect(isValidXProfileUrl('https://x.com/username')).toBe(true);
      expect(isValidXProfileUrl('https://x.com/user_name')).toBe(true);
      expect(isValidXProfileUrl('https://x.com/user123')).toBe(true);
      expect(isValidXProfileUrl('https://www.x.com/username')).toBe(true);
      expect(isValidXProfileUrl('http://x.com/username')).toBe(true);
    });

    it('should validate correct Twitter.com URLs', () => {
      expect(isValidXProfileUrl('https://twitter.com/username')).toBe(true);
      expect(isValidXProfileUrl('https://www.twitter.com/username')).toBe(true);
    });

    it('should reject non-profile URLs', () => {
      expect(isValidXProfileUrl('https://x.com/home')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/explore')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/notifications')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/messages')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/settings')).toBe(false);
    });

    it('should reject invalid URLs', () => {
      expect(isValidXProfileUrl('https://google.com/username')).toBe(false);
      expect(isValidXProfileUrl('https://facebook.com/username')).toBe(false);
      expect(isValidXProfileUrl('not-a-url')).toBe(false);
      expect(isValidXProfileUrl('')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/user/status/123')).toBe(false);
    });
  });

  describe('extractUsernameFromUrl', () => {
    it('should extract username from valid URLs', () => {
      expect(extractUsernameFromUrl('https://x.com/username')).toBe('username');
      expect(extractUsernameFromUrl('https://twitter.com/user_123')).toBe('user_123');
      expect(extractUsernameFromUrl('https://www.x.com/TestUser')).toBe('TestUser');
    });

    it('should return null for invalid URLs', () => {
      expect(extractUsernameFromUrl('not-a-url')).toBe(null);
      expect(extractUsernameFromUrl('')).toBe(null);
      expect(extractUsernameFromUrl('https://x.com/')).toBe(null);
    });
  });

  describe('validateXProfile', () => {
    const validProfile = {
      username: 'testuser',
      displayName: 'Test User',
      bio: 'Test bio',
      avatarUrl: 'https://example.com/avatar.jpg',
      profileUrl: 'https://x.com/testuser',
      verified: true,
      followerCount: '1000',
      followingCount: '500',
      extractedAt: new Date().toISOString()
    };

    it('should validate correct profile data', () => {
      const result = validateXProfile(validProfile);
      expect(result).not.toBe(null);
      expect(result?.username).toBe('testuser');
      expect(result?.verified).toBe(true);
    });

    it('should handle missing optional fields', () => {
      const minimalProfile = {
        username: 'testuser',
        displayName: 'Test User',
        avatarUrl: 'https://example.com/avatar.jpg',
        profileUrl: 'https://x.com/testuser'
      };
      
      const result = validateXProfile(minimalProfile);
      expect(result).not.toBe(null);
      expect(result?.bio).toBeUndefined();
      expect(result?.verified).toBe(false);
      expect(result?.followerCount).toBe('0');
    });

    it('should reject invalid profile data', () => {
      expect(validateXProfile(null)).toBe(null);
      expect(validateXProfile({})).toBe(null);
      expect(validateXProfile({ username: 'test' })).toBe(null);
      expect(validateXProfile({ ...validProfile, username: '' })).toBe(null);
    });

    it('should trim string fields', () => {
      const profileWithSpaces = {
        ...validProfile,
        username: '  testuser  ',
        displayName: '  Test User  ',
        bio: '  Test bio  '
      };
      
      const result = validateXProfile(profileWithSpaces);
      expect(result?.username).toBe('testuser');
      expect(result?.displayName).toBe('Test User');
      expect(result?.bio).toBe('Test bio');
    });
  });

  describe('validateAppSettings', () => {
    it('should return defaults for invalid input', () => {
      expect(validateAppSettings(null)).toEqual({
        autoDownload: true,
        downloadFormat: 'pdf',
        pdfQuality: 'high',
        defaultTemplate: 'standard',
        recentProfiles: [],
        maxRecentProfiles: 10
      });
    });

    it('should validate correct settings', () => {
      const settings = {
        autoDownload: false,
        downloadFormat: 'png',
        pdfQuality: 'medium',
        defaultTemplate: 'custom',
        recentProfiles: ['user1', 'user2'],
        maxRecentProfiles: 20
      };
      
      const result = validateAppSettings(settings);
      expect(result.autoDownload).toBe(false);
      expect(result.downloadFormat).toBe('png');
      expect(result.pdfQuality).toBe('medium');
      expect(result.maxRecentProfiles).toBe(20);
    });

    it('should handle invalid enum values', () => {
      const settings = {
        downloadFormat: 'invalid',
        pdfQuality: 'invalid'
      };
      
      const result = validateAppSettings(settings);
      expect(result.downloadFormat).toBe('pdf');
      expect(result.pdfQuality).toBe('high');
    });

    it('should limit recent profiles array', () => {
      const settings = {
        recentProfiles: new Array(100).fill('user'),
        maxRecentProfiles: 100
      };
      
      const result = validateAppSettings(settings);
      expect(result.recentProfiles.length).toBe(50);
      expect(result.maxRecentProfiles).toBe(50);
    });
  });

  describe('createAPIError', () => {
    it('should create API error with required fields', () => {
      const error = createAPIError(
        ErrorCode.INVALID_URL,
        'Invalid URL provided'
      );
      
      expect(error.code).toBe(ErrorCode.INVALID_URL);
      expect(error.message).toBe('Invalid URL provided');
      expect(error.recoverable).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it('should include optional details', () => {
      const details = { url: 'https://invalid.com' };
      const error = createAPIError(
        ErrorCode.NETWORK_ERROR,
        'Network failed',
        details,
        false
      );
      
      expect(error.details).toEqual(details);
      expect(error.recoverable).toBe(false);
    });
  });
});