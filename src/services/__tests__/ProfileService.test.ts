import { ProfileService } from '../ProfileService';
import { ErrorCode } from '../../types';
import { isValidXProfileUrl } from '../../utils/validation';

// Mock chrome API
global.chrome = {
  runtime: {
    sendMessage: jest.fn(),
    lastError: null,
    onMessage: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    }
  },
  tabs: {
    query: jest.fn(),
    create: jest.fn(),
    sendMessage: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onActivated: {
      addListener: jest.fn()
    },
    get: jest.fn()
  },
  action: {
    setIcon: jest.fn()
  },
  storage: {
    sync: {
      set: jest.fn(),
      get: jest.fn()
    }
  }
} as any;

describe('ProfileService', () => {
  let profileService: ProfileService;
  
  beforeEach(() => {
    profileService = ProfileService.getInstance();
    profileService.clearCache();
    jest.clearAllMocks();
  });

  describe('URL Validation', () => {
    it('should validate correct X.com URLs', () => {
      expect(isValidXProfileUrl('https://x.com/elonmusk')).toBe(true);
      expect(isValidXProfileUrl('https://x.com/OpenAI')).toBe(true);
      expect(isValidXProfileUrl('https://www.x.com/user123')).toBe(true);
    });

    it('should validate correct Twitter.com URLs', () => {
      expect(isValidXProfileUrl('https://twitter.com/elonmusk')).toBe(true);
      expect(isValidXProfileUrl('https://www.twitter.com/OpenAI')).toBe(true);
    });

    it('should reject invalid URLs', () => {
      expect(isValidXProfileUrl('https://x.com/home')).toBe(false);
      expect(isValidXProfileUrl('https://x.com/explore')).toBe(false);
      expect(isValidXProfileUrl('https://google.com/user')).toBe(false);
      expect(isValidXProfileUrl('not-a-url')).toBe(false);
    });
  });

  describe('fetchProfile', () => {
    const mockProfile = {
      username: 'testuser',
      displayName: 'Test User',
      bio: 'Test bio',
      avatarUrl: 'https://example.com/avatar.jpg',
      profileUrl: 'https://x.com/testuser',
      verified: true,
      followerCount: '1.2K',
      followingCount: '500',
      extractedAt: new Date()
    };

    it('should fetch profile successfully', async () => {
      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: mockProfile });
      });

      const result = await profileService.fetchProfile('https://x.com/testuser');
      
      expect(result.success).toBe(true);
      expect(result.data?.profile.username).toBe('testuser');
      expect(result.data?.fromCache).toBe(false);
    });

    it('should return cached profile on second request', async () => {
      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: mockProfile });
      });

      // First request
      await profileService.fetchProfile('https://x.com/testuser');
      
      // Second request should use cache
      const result = await profileService.fetchProfile('https://x.com/testuser');
      
      expect(result.success).toBe(true);
      expect(result.data?.fromCache).toBe(true);
      expect(mockSendMessage).toHaveBeenCalledTimes(1); // Only called once
    });

    it('should handle invalid URL', async () => {
      const result = await profileService.fetchProfile('invalid-url');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_URL);
    });

    it('should handle profile not found', async () => {
      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: false, error: 'Profile not found' });
      });

      const result = await profileService.fetchProfile('https://x.com/nonexistentuser');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.PROFILE_NOT_FOUND);
    });

    it('should handle network errors', async () => {
      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      mockSendMessage.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await profileService.fetchProfile('https://x.com/testuser');
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.UNKNOWN_ERROR);
    });
  });

  describe('fetchBatchProfiles', () => {
    it('should fetch multiple profiles', async () => {
      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      let callCount = 0;
      
      mockSendMessage.mockImplementation((message, callback) => {
        callCount++;
        if (callCount === 1) {
          callback({ 
            success: true, 
            data: {
              username: 'user1',
              displayName: 'User 1',
              avatarUrl: 'https://example.com/avatar1.jpg',
              profileUrl: 'https://x.com/user1',
              verified: false,
              followerCount: '100',
              followingCount: '50',
              extractedAt: new Date()
            }
          });
        } else {
          callback({ success: false, error: 'Profile not found' });
        }
      });

      const urls = ['https://x.com/user1', 'https://x.com/nonexistent'];
      const result = await profileService.fetchBatchProfiles(urls);
      
      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.successful[0].profile.username).toBe('user1');
      expect(result.failed[0].url).toBe('https://x.com/nonexistent');
    });
  });

  describe('extractFromCurrentTab', () => {
    it('should extract profile from current tab', async () => {
      const mockQuery = chrome.tabs.query as jest.Mock;
      mockQuery.mockResolvedValue([{
        id: 1,
        url: 'https://x.com/testuser'
      }]);

      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ 
          success: true, 
          data: {
            username: 'testuser',
            displayName: 'Test User',
            avatarUrl: 'https://example.com/avatar.jpg',
            profileUrl: 'https://x.com/testuser',
            verified: true,
            followerCount: '1K',
            followingCount: '100',
            extractedAt: new Date()
          }
        });
      });

      const result = await profileService.extractFromCurrentTab();
      
      expect(result.success).toBe(true);
      expect(result.data?.profile.username).toBe('testuser');
    });

    it('should handle no active tab', async () => {
      const mockQuery = chrome.tabs.query as jest.Mock;
      mockQuery.mockResolvedValue([]);

      const result = await profileService.extractFromCurrentTab();
      
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe(ErrorCode.INVALID_URL);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting between requests', async () => {
      const mockSendMessage = chrome.runtime.sendMessage as jest.Mock;
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: true, data: { username: 'test' } });
      });

      const start = Date.now();
      
      // Make two requests in quick succession
      await profileService.fetchProfile('https://x.com/user1');
      await profileService.fetchProfile('https://x.com/user2');
      
      const elapsed = Date.now() - start;
      
      // Should take at least 1 second due to rate limiting
      expect(elapsed).toBeGreaterThanOrEqual(1000);
    });
  });
});