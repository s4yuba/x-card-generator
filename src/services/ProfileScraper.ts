/**
 * Profile Scraper service for extracting X (Twitter) profile information
 * Uses Puppeteer to scrape profile data from X profile pages
 */

import puppeteer, { Browser, Page } from 'puppeteer';
import { ProfileData } from '../types';
import { URLValidator } from '../utils/urlValidator';

export interface ProfileScraperOptions {
  timeout?: number;
  headless?: boolean;
  userAgent?: string;
}

export class ProfileScraper {
  private browser: Browser | null = null;
  private options: Required<ProfileScraperOptions>;

  constructor(options: ProfileScraperOptions = {}) {
    this.options = {
      timeout: options.timeout || 30000,
      headless: options.headless !== false, // default to true
      userAgent: options.userAgent || 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };
  }

  /**
   * Initialize the browser instance
   */
  private async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: this.options.headless,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
    }
  }

  /**
   * Enhance profile image URL to get higher quality version
   * @param imageUrl The original profile image URL
   * @returns Enhanced image URL
   */
  private enhanceProfileImageUrl(imageUrl: string): string {
    if (!imageUrl) return imageUrl;
    
    // Remove _normal suffix to get higher quality image
    return imageUrl.replace(/_normal\.(jpg|jpeg|png|webp)$/i, '.$1');
  }

  /**
   * Extract profile data from X profile URL
   * @param url The X profile URL to scrape
   * @returns Promise<ProfileData> The extracted profile information
   */
  async extractProfile(url: string): Promise<ProfileData> {
    // Validate URL first
    const validation = URLValidator.validateProfileUrl(url);
    if (!validation.isValid) {
      throw new Error(`Invalid URL: ${validation.error}`);
    }

    const normalizedUrl = validation.normalizedUrl!;
    const username = validation.username!;

    await this.initBrowser();
    const page = await this.browser!.newPage();

    try {
      // Set user agent to avoid bot detection
      await page.setUserAgent(this.options.userAgent);

      // Set viewport
      await page.setViewport({ width: 1280, height: 720 });

      // Navigate to profile page
      await page.goto(normalizedUrl, { 
        waitUntil: 'networkidle2',
        timeout: this.options.timeout 
      });

      // Wait for profile content to load
      await page.waitForSelector('[data-testid="UserName"]', { 
        timeout: this.options.timeout 
      });

      // Extract profile data
      const profileData = await page.evaluate(() => {
        // Extract display name
        const displayNameElement = document.querySelector('[data-testid="UserName"] span');
        const displayName = displayNameElement?.textContent?.trim() || '';

        // Extract profile image URL - try multiple selectors
        let profileImageUrl = '';
        const selectors = [
          '[data-testid="UserAvatar-Container-unknown"] img',
          '[data-testid="UserAvatar-Container-"] img',
          'img[alt*="profile"]',
          'img[src*="profile_images"]'
        ];
        
        for (const selector of selectors) {
          const element = document.querySelector(selector) as HTMLImageElement;
          if (element?.src) {
            profileImageUrl = element.src;
            break;
          }
        }
        
        return {
          displayName,
          profileImageUrl
        };
      });

      // Validate extracted data
      if (!profileData.displayName) {
        throw new Error('Could not extract display name. Profile may be private or page structure has changed.');
      }

      // Enhance profile image URL and fallback to photo endpoint if not found
      let finalProfileImageUrl = profileData.profileImageUrl;
      if (finalProfileImageUrl) {
        finalProfileImageUrl = this.enhanceProfileImageUrl(finalProfileImageUrl);
      } else {
        finalProfileImageUrl = `https://x.com/${username}/photo`;
      }

      const result: ProfileData = {
        username,
        displayName: profileData.displayName,
        profileImageUrl: finalProfileImageUrl,
        profileUrl: normalizedUrl,
        extractedAt: new Date()
      };

      return result;

    } catch (error) {
      // Handle specific error cases
      if (error instanceof Error) {
        if (error.message.includes('net::ERR_NAME_NOT_RESOLVED')) {
          throw new Error('Network error: Could not resolve X.com. Please check your internet connection.');
        }
        if (error.message.includes('Navigation timeout')) {
          throw new Error('Timeout: Profile page took too long to load. The profile may be private or temporarily unavailable.');
        }
        if (error.message.includes('Could not extract display name')) {
          throw error; // Re-throw the original error to preserve the message
        }
      }
      
      throw new Error(`Failed to extract profile data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      await page.close();
    }
  }

  /**
   * Close the browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if a profile is accessible (public)
   * @param url The X profile URL to check
   * @returns Promise<boolean> True if profile is accessible
   */
  async isProfileAccessible(url: string): Promise<boolean> {
    try {
      await this.extractProfile(url);
      return true;
    } catch (error) {
      return false;
    }
  }
}