import { XProfile, ProfileFetchResult, BatchProfileResult, APIError, ErrorCode, APIResponse } from '../types';
import { isValidXProfileUrl, extractUsernameFromUrl, validateXProfile, createAPIError } from '../utils/validation';
import { logError } from '../utils/errors';

export class ProfileService {
  private static instance: ProfileService;
  private cache: Map<string, { profile: XProfile; timestamp: number }> = new Map();
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  private readonly REQUEST_TIMEOUT = 10000; // 10 seconds
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

  private constructor() {}

  public static getInstance(): ProfileService {
    if (!ProfileService.instance) {
      ProfileService.instance = new ProfileService();
    }
    return ProfileService.instance;
  }

  /**
   * Fetch a single X profile
   */
  public async fetchProfile(url: string): Promise<APIResponse<ProfileFetchResult>> {
    try {
      // Validate URL
      if (!isValidXProfileUrl(url)) {
        return {
          success: false,
          error: createAPIError(
            ErrorCode.INVALID_URL,
            `Invalid X profile URL: ${url}`
          )
        };
      }

      // Check cache
      const cached = this.getCachedProfile(url);
      if (cached) {
        return {
          success: true,
          data: {
            profile: cached,
            fromCache: true
          }
        };
      }

      // Rate limiting
      await this.enforceRateLimit();

      // Fetch profile from content script
      const profile = await this.fetchProfileFromContentScript(url);
      
      if (!profile) {
        return {
          success: false,
          error: createAPIError(
            ErrorCode.PROFILE_NOT_FOUND,
            `Profile not found: ${url}`
          )
        };
      }

      // Cache the profile
      this.cacheProfile(url, profile);

      return {
        success: true,
        data: {
          profile,
          fromCache: false
        }
      };
    } catch (error) {
      logError('ProfileService.fetchProfile', error);
      
      return {
        success: false,
        error: createAPIError(
          ErrorCode.UNKNOWN_ERROR,
          'Failed to fetch profile',
          error
        )
      };
    }
  }

  /**
   * Fetch multiple profiles in batch
   */
  public async fetchBatchProfiles(urls: string[]): Promise<BatchProfileResult> {
    const result: BatchProfileResult = {
      successful: [],
      failed: []
    };

    for (const url of urls) {
      const response = await this.fetchProfile(url);
      
      if (response.success && response.data) {
        result.successful.push(response.data);
      } else if (response.error) {
        result.failed.push({
          url,
          error: response.error
        });
      }
    }

    return result;
  }

  /**
   * Clear profile cache
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get profile from cache if available and not expired
   */
  private getCachedProfile(url: string): XProfile | null {
    const cached = this.cache.get(url);
    
    if (!cached) {
      return null;
    }

    const now = Date.now();
    if (now - cached.timestamp > this.CACHE_DURATION) {
      this.cache.delete(url);
      return null;
    }

    return cached.profile;
  }

  /**
   * Cache a profile
   */
  private cacheProfile(url: string, profile: XProfile): void {
    this.cache.set(url, {
      profile,
      timestamp: Date.now()
    });

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }
  }

  /**
   * Enforce rate limiting
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
      const waitTime = this.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Fetch profile data using content script
   */
  private async fetchProfileFromContentScript(url: string): Promise<XProfile | null> {
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        logError('ProfileService.fetchProfileFromContentScript', 'Request timeout');
        resolve(null);
      }, this.REQUEST_TIMEOUT);

      // Send message to background script to coordinate with content script
      console.log('[ProfileService] Sending fetchProfileData message for:', url);
      chrome.runtime.sendMessage(
        {
          action: 'fetchProfileData',
          url
        },
        (response) => {
          clearTimeout(timeoutId);
          
          if (chrome.runtime.lastError) {
            console.error('[ProfileService] Chrome runtime error:', chrome.runtime.lastError);
            logError('ProfileService.fetchProfileFromContentScript', chrome.runtime.lastError);
            resolve(null);
            return;
          }

          console.log('[ProfileService] Received response:', response);
          if (response?.success && response.data) {
            const validated = validateXProfile(response.data);
            console.log('[ProfileService] Validated profile:', validated);
            resolve(validated);
          } else {
            console.error('[ProfileService] Failed response or no data:', response);
            resolve(null);
          }
        }
      );
    });
  }

  /**
   * Extract profile from current tab (if on X profile page)
   */
  public async extractFromCurrentTab(): Promise<APIResponse<ProfileFetchResult>> {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab?.url) {
        return {
          success: false,
          error: createAPIError(
            ErrorCode.INVALID_URL,
            'No active tab found'
          )
        };
      }

      return this.fetchProfile(tab.url);
    } catch (error) {
      logError('ProfileService.extractFromCurrentTab', error);
      
      return {
        success: false,
        error: createAPIError(
          ErrorCode.UNKNOWN_ERROR,
          'Failed to extract profile from current tab',
          error
        )
      };
    }
  }
}