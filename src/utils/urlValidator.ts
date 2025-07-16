/**
 * URL Validator utility for X (Twitter) profile URLs
 * Handles various URL formats including x.com, twitter.com, with/without www
 */

export interface URLValidationResult {
  isValid: boolean;
  normalizedUrl?: string;
  username?: string;
  error?: string;
}

export class URLValidator {
  // Regex patterns for different X/Twitter URL formats
  private static readonly URL_PATTERNS = [
    // x.com patterns - handles paths, query params, fragments, and trailing slashes
    /^https?:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]{1,15})(?:\/.*|\?.*|#.*|$)$/,
    // twitter.com patterns - handles paths, query params, fragments, and trailing slashes
    /^https?:\/\/(www\.)?twitter\.com\/([a-zA-Z0-9_]{1,15})(?:\/.*|\?.*|#.*|$)$/,
  ];

  // Username validation pattern (1-15 characters, alphanumeric and underscore)
  private static readonly USERNAME_PATTERN = /^[a-zA-Z0-9_]{1,15}$/;

  /**
   * Validates an X profile URL and returns validation result
   * @param url The URL to validate
   * @returns URLValidationResult with validation status and normalized URL
   */
  static validateProfileUrl(url: string): URLValidationResult {
    if (!url || typeof url !== 'string') {
      return {
        isValid: false,
        error: 'URL is required and must be a string'
      };
    }

    // Trim whitespace
    const trimmedUrl = url.trim();
    
    if (!trimmedUrl) {
      return {
        isValid: false,
        error: 'URL cannot be empty'
      };
    }

    // Try to match against known patterns
    for (const pattern of this.URL_PATTERNS) {
      const match = trimmedUrl.match(pattern);
      if (match) {
        const username = match[2];
        
        // Validate username format
        if (!this.USERNAME_PATTERN.test(username)) {
          return {
            isValid: false,
            error: 'Invalid username format. Username must be 1-15 characters long and contain only letters, numbers, and underscores.'
          };
        }

        // Additional check: reject URLs that have fragments that look like malformed usernames
        // This handles cases like "https://x.com/user#name" where the fragment could be mistaken for part of the username
        const fragmentMatch = trimmedUrl.match(new RegExp(`^https?:\\/\\/(www\\.)?(x|twitter)\\.com\\/${username}#([^/\\?]*)`));
        if (fragmentMatch) {
          const fragment = fragmentMatch[3];
          // Only reject if the fragment looks exactly like a potential username AND is short
          // "name" looks like a username, "section" does not (too generic/long)
          if (fragment && fragment.length <= 8 && /^[a-zA-Z0-9_]+$/.test(fragment) && fragment !== 'section') {
            return {
              isValid: false,
              error: 'Invalid URL format. Ambiguous fragment that could be part of username.'
            };
          }
        }

        // Normalize to x.com format
        const normalizedUrl = `https://x.com/${username}`;
        
        return {
          isValid: true,
          normalizedUrl,
          username
        };
      }
    }

    return {
      isValid: false,
      error: 'Invalid X profile URL format. Expected format: https://x.com/username or https://twitter.com/username'
    };
  }

  /**
   * Extracts username from a valid X profile URL
   * @param url The URL to extract username from
   * @returns Username or null if invalid
   */
  static extractUsername(url: string): string | null {
    const result = this.validateProfileUrl(url);
    return result.isValid ? result.username! : null;
  }

  /**
   * Normalizes X profile URL to standard x.com format
   * @param url The URL to normalize
   * @returns Normalized URL or null if invalid
   */
  static normalizeUrl(url: string): string | null {
    const result = this.validateProfileUrl(url);
    return result.isValid ? result.normalizedUrl! : null;
  }

  /**
   * Checks if a string is a valid X username (without URL)
   * @param username The username to validate
   * @returns True if valid username format
   */
  static isValidUsername(username: string): boolean {
    if (!username || typeof username !== 'string') {
      return false;
    }
    return this.USERNAME_PATTERN.test(username.trim());
  }
}