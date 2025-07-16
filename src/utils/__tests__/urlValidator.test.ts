import { URLValidator } from '../urlValidator';

describe('URLValidator', () => {
  describe('validateProfileUrl', () => {
    describe('valid URLs', () => {
      const validUrls = [
        // x.com variations
        'https://x.com/username',
        'http://x.com/username',
        'https://www.x.com/username',
        'http://www.x.com/username',
        'https://x.com/user_name',
        'https://x.com/user123',
        'https://x.com/123user',
        'https://x.com/a',
        'https://x.com/a12345678901234', // 15 characters (max)
        
        // twitter.com variations
        'https://twitter.com/username',
        'http://twitter.com/username',
        'https://www.twitter.com/username',
        'http://www.twitter.com/username',
        'https://twitter.com/user_name',
        'https://twitter.com/user123',
        
        // URLs with additional paths (should still be valid)
        'https://x.com/username/status/123456789',
        'https://x.com/username/followers',
        'https://twitter.com/username/following',
        'https://x.com/username?tab=replies',
        'https://twitter.com/username#section',
      ];

      test.each(validUrls)('should validate %s as valid', (url) => {
        const result = URLValidator.validateProfileUrl(url);
        expect(result.isValid).toBe(true);
        expect(result.normalizedUrl).toBeDefined();
        expect(result.username).toBeDefined();
        expect(result.error).toBeUndefined();
      });

      test('should normalize all valid URLs to x.com format', () => {
        const testCases = [
          { input: 'https://twitter.com/testuser', expected: 'https://x.com/testuser' },
          { input: 'http://www.twitter.com/testuser', expected: 'https://x.com/testuser' },
          { input: 'https://x.com/testuser', expected: 'https://x.com/testuser' },
          { input: 'https://x.com/testuser/status/123', expected: 'https://x.com/testuser' },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = URLValidator.validateProfileUrl(input);
          expect(result.normalizedUrl).toBe(expected);
        });
      });

      test('should extract correct usernames', () => {
        const testCases = [
          { input: 'https://x.com/testuser', expected: 'testuser' },
          { input: 'https://twitter.com/test_user', expected: 'test_user' },
          { input: 'https://x.com/user123', expected: 'user123' },
          { input: 'https://x.com/a12345678901234', expected: 'a12345678901234' },
        ];

        testCases.forEach(({ input, expected }) => {
          const result = URLValidator.validateProfileUrl(input);
          expect(result.username).toBe(expected);
        });
      });
    });

    describe('invalid URLs', () => {
      const invalidUrls = [
        // Empty/null/undefined
        '',
        '   ',
        null as any,
        undefined as any,
        
        // Wrong domains
        'https://facebook.com/username',
        'https://instagram.com/username',
        'https://linkedin.com/username',
        'https://example.com/username',
        
        // Missing protocol
        'x.com/username',
        'twitter.com/username',
        'www.x.com/username',
        
        // Invalid protocols
        'ftp://x.com/username',
        'file://x.com/username',
        
        // Missing username
        'https://x.com/',
        'https://twitter.com/',
        'https://x.com',
        'https://twitter.com',
        
        // Invalid username formats
        'https://x.com/user-name', // hyphen not allowed
        'https://x.com/user.name', // dot not allowed
        'https://x.com/user name', // space not allowed
        'https://x.com/user@name', // @ not allowed
        'https://x.com/user#name', // # not allowed
        'https://x.com/user%20name', // encoded space not allowed
        'https://x.com/a1234567890123456', // 16 characters (too long)
        'https://x.com/', // empty username
        
        // Malformed URLs
        'https://x.com//username',
        'not-a-url',
        'https://',
        'https://x',
        'https://x.',
        'https://.com/username',
      ];

      test.each(invalidUrls)('should validate "%s" as invalid', (url) => {
        const result = URLValidator.validateProfileUrl(url);
        expect(result.isValid).toBe(false);
        expect(result.normalizedUrl).toBeUndefined();
        expect(result.username).toBeUndefined();
        expect(result.error).toBeDefined();
        expect(typeof result.error).toBe('string');
      });
    });

    describe('edge cases', () => {
      test('should handle URLs with whitespace', () => {
        const result = URLValidator.validateProfileUrl('  https://x.com/username  ');
        expect(result.isValid).toBe(true);
        expect(result.username).toBe('username');
      });

      test('should handle mixed case domains', () => {
        const result = URLValidator.validateProfileUrl('https://X.COM/username');
        expect(result.isValid).toBe(false); // Our regex is case-sensitive for domains
      });

      test('should preserve username case', () => {
        const result = URLValidator.validateProfileUrl('https://x.com/TestUser');
        expect(result.isValid).toBe(true);
        expect(result.username).toBe('TestUser');
      });
    });
  });

  describe('extractUsername', () => {
    test('should extract username from valid URLs', () => {
      expect(URLValidator.extractUsername('https://x.com/testuser')).toBe('testuser');
      expect(URLValidator.extractUsername('https://twitter.com/test_user')).toBe('test_user');
    });

    test('should return null for invalid URLs', () => {
      expect(URLValidator.extractUsername('invalid-url')).toBeNull();
      expect(URLValidator.extractUsername('')).toBeNull();
      expect(URLValidator.extractUsername('https://facebook.com/user')).toBeNull();
    });
  });

  describe('normalizeUrl', () => {
    test('should normalize valid URLs to x.com format', () => {
      expect(URLValidator.normalizeUrl('https://twitter.com/testuser')).toBe('https://x.com/testuser');
      expect(URLValidator.normalizeUrl('https://x.com/testuser')).toBe('https://x.com/testuser');
      expect(URLValidator.normalizeUrl('http://www.twitter.com/testuser')).toBe('https://x.com/testuser');
    });

    test('should return null for invalid URLs', () => {
      expect(URLValidator.normalizeUrl('invalid-url')).toBeNull();
      expect(URLValidator.normalizeUrl('')).toBeNull();
      expect(URLValidator.normalizeUrl('https://facebook.com/user')).toBeNull();
    });
  });

  describe('isValidUsername', () => {
    describe('valid usernames', () => {
      const validUsernames = [
        'username',
        'user_name',
        'user123',
        '123user',
        'a',
        'a12345678901234', // 15 characters (max)
        'USER', // uppercase
        'User123',
        '_user',
        'user_',
        '123',
        '_',
      ];

      test.each(validUsernames)('should validate "%s" as valid username', (username) => {
        expect(URLValidator.isValidUsername(username)).toBe(true);
      });
    });

    describe('invalid usernames', () => {
      const invalidUsernames = [
        '', // empty
        '   ', // whitespace only
        'user-name', // hyphen
        'user.name', // dot
        'user name', // space
        'user@name', // @
        'user#name', // #
        'a1234567890123456', // 16 characters (too long)
        null as any,
        undefined as any,
        123 as any, // number
        {} as any, // object
      ];

      test.each(invalidUsernames)('should validate "%s" as invalid username', (username) => {
        expect(URLValidator.isValidUsername(username)).toBe(false);
      });
    });

    test('should handle usernames with whitespace', () => {
      expect(URLValidator.isValidUsername('  username  ')).toBe(true);
    });
  });
});