import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock Chrome API
const mockChrome = {
  runtime: {
    sendMessage: vi.fn(),
    onMessage: {
      addListener: vi.fn()
    }
  }
};

(global as any).chrome = mockChrome;

describe('ContentScript', () => {
  let mockDocument: any;
  let mockWindow: any;
  let originalDocument: Document;
  let originalWindow: Window & typeof globalThis;

  beforeEach(() => {
    // Save original globals
    originalDocument = global.document;
    originalWindow = global.window;

    // Create mock document
    mockDocument = {
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      body: {}
    };

    // Create mock window
    mockWindow = {
      location: {
        href: 'https://x.com/testuser',
        hostname: 'x.com',
        pathname: '/testuser'
      },
      addEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      getComputedStyle: vi.fn(() => ({ backgroundImage: 'none' })),
      history: {
        pushState: vi.fn(),
        replaceState: vi.fn()
      }
    };

    // Replace globals
    (global as any).document = mockDocument;
    (global as any).window = mockWindow;
    (global as any).MutationObserver = vi.fn(() => ({
      observe: vi.fn(),
      disconnect: vi.fn()
    }));

    // Clear mocks
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore original globals
    (global as any).document = originalDocument;
    (global as any).window = originalWindow;
  });

  describe('Profile Page Detection', () => {
    it('should detect X.com profile pages', async () => {
      const locations = [
        { href: 'https://x.com/elonmusk', hostname: 'x.com', pathname: '/elonmusk', expected: true },
        { href: 'https://x.com/home', hostname: 'x.com', pathname: '/home', expected: false },
        { href: 'https://x.com/explore', hostname: 'x.com', pathname: '/explore', expected: false },
        { href: 'https://twitter.com/jack', hostname: 'twitter.com', pathname: '/jack', expected: true },
        { href: 'https://x.com/messages', hostname: 'x.com', pathname: '/messages', expected: false },
        { href: 'https://x.com/i/flow/login', hostname: 'x.com', pathname: '/i/flow/login', expected: false }
      ];

      for (const location of locations) {
        mockWindow.location = location;
        
        // Import fresh module to trigger constructor
        vi.resetModules();
        await import('../../src/content/content');

        if (location.expected) {
          expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
            action: 'onProfilePage',
            url: location.href
          });
        } else {
          expect(mockChrome.runtime.sendMessage).not.toHaveBeenCalled();
        }
        
        vi.clearAllMocks();
      }
    });
  });

  describe('Profile Data Extraction', () => {
    it('should extract profile information when requested', async () => {
      // Setup mock elements
      const mockUsernameElement = { textContent: '@testuser' };
      const mockDisplayNameElement = { textContent: 'Test User' };
      const mockBioElement = { textContent: 'This is a test bio' };
      const mockAvatarElement = { 
        src: 'https://pbs.twimg.com/profile_images/123/test_normal.jpg' 
      };
      const mockFollowersElement = { 
        textContent: '1.2K Followers',
        getAttribute: () => '/testuser/followers'
      };
      const mockFollowingElement = { 
        textContent: '500 Following',
        getAttribute: () => '/testuser/following'
      };

      // Setup querySelector responses
      mockDocument.querySelector.mockImplementation((selector: string) => {
        if (selector.includes('UserName') && selector.includes('span')) {
          return mockUsernameElement;
        }
        if (selector.includes('UserName') && selector.includes('first-child')) {
          return mockDisplayNameElement;
        }
        if (selector.includes('UserDescription')) {
          return mockBioElement;
        }
        if (selector.includes('img')) {
          return mockAvatarElement;
        }
        if (selector.includes('followers')) {
          return mockFollowersElement;
        }
        if (selector.includes('following')) {
          return mockFollowingElement;
        }
        return null;
      });

      mockDocument.querySelectorAll.mockImplementation((selector: string) => {
        if (selector.includes('followers') || selector.includes('following')) {
          return [mockFollowersElement, mockFollowingElement];
        }
        if (selector.includes('span')) {
          return [mockUsernameElement];
        }
        return [];
      });

      // Import module and setup message listener
      vi.resetModules();
      await import('../../src/content/content');

      // Get the message listener
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Test extractProfileInfo message
      const sendResponse = vi.fn();
      messageListener(
        { action: 'extractProfileInfo' },
        {},
        sendResponse
      );

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(sendResponse).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          username: 'testuser',
          displayName: 'Test User',
          bio: 'This is a test bio',
          avatarUrl: 'https://pbs.twimg.com/profile_images/123/test_400x400.jpg',
          followersCount: 1200,
          followingCount: 500,
          verified: false,
          profileUrl: 'https://x.com/testuser'
        })
      });
    });

    it('should handle profile extraction errors', async () => {
      // Setup no elements found
      mockDocument.querySelector.mockReturnValue(null);
      mockDocument.querySelectorAll.mockReturnValue([]);

      // Import module
      vi.resetModules();
      await import('../../src/content/content');

      // Get the message listener
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Test extractProfileInfo message
      const sendResponse = vi.fn();
      messageListener(
        { action: 'extractProfileInfo' },
        {},
        sendResponse
      );

      // Wait for async operation
      await new Promise(resolve => setTimeout(resolve, 6000));

      expect(sendResponse).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Timeout')
      });
    });
  });

  describe('Message Handling', () => {
    it('should respond to checkProfilePage message', async () => {
      mockWindow.location = {
        href: 'https://x.com/testuser',
        hostname: 'x.com',
        pathname: '/testuser'
      };

      // Import module
      vi.resetModules();
      await import('../../src/content/content');

      // Get the message listener
      const messageListener = mockChrome.runtime.onMessage.addListener.mock.calls[0][0];

      // Test checkProfilePage message
      const sendResponse = vi.fn();
      messageListener(
        { action: 'checkProfilePage' },
        {},
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith({
        isProfilePage: true
      });
    });
  });

  describe('URL Change Detection', () => {
    it('should setup navigation listeners', async () => {
      // Import module
      vi.resetModules();
      await import('../../src/content/content');

      // Check that event listeners were added
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('popstate', expect.any(Function));
      expect(mockWindow.addEventListener).toHaveBeenCalledWith('locationchange', expect.any(Function));
      
      // Check that MutationObserver was created
      expect(MutationObserver).toHaveBeenCalled();
    });
  });
});