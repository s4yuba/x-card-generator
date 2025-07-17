import { XProfile } from '../types/index';

class ContentScript {
  private currentUrl: string;
  private observer: MutationObserver | null = null;

  constructor() {
    this.currentUrl = window.location.href;
    this.initialize();
  }

  private initialize(): void {
    // Check if we're on a profile page
    if (this.isProfilePage()) {
      this.notifyBackgroundScript();
      this.setupMessageListener();
      this.observeUrlChanges();
    }

    // Listen for URL changes (X is a SPA)
    this.setupNavigationListener();
  }

  private isProfilePage(): boolean {
    const pathname = window.location.pathname;
    const hostname = window.location.hostname;

    // Check if it's X.com or Twitter.com
    if (hostname === 'x.com' || hostname === 'twitter.com' || 
        hostname === 'www.x.com' || hostname === 'www.twitter.com') {
      // Check if it's a profile page (not /home, /explore, etc.)
      const profilePattern = /^\/[^\/]+\/?$/;
      const reservedPaths = ['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'i'];
      const pathSegment = pathname.slice(1).split('/')[0];
      
      return profilePattern.test(pathname) && !reservedPaths.includes(pathSegment);
    }
    return false;
  }

  private notifyBackgroundScript(): void {
    chrome.runtime.sendMessage({ 
      action: 'onProfilePage',
      url: window.location.href 
    });
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('[Content] Received message:', request);
      if (request.action === 'extractProfileInfo') {
        console.log('[Content] Extracting profile info...');
        this.extractProfileInfo().then(profile => {
          console.log('[Content] Profile extracted:', profile);
          sendResponse({ success: true, data: profile });
        }).catch(error => {
          console.error('[Content] Error extracting profile:', error);
          sendResponse({ success: false, error: error.message });
        });
        return true; // Keep message channel open for async response
      } else if (request.action === 'extractProfile') {
        // From context menu
        this.extractProfileInfo().then(profile => {
          // Send to popup to generate name tag
          chrome.runtime.sendMessage({
            action: 'profileExtracted',
            profile: profile
          });
        }).catch(error => {
          console.error('Failed to extract profile:', error);
        });
      } else if (request.action === 'checkProfilePage') {
        sendResponse({ isProfilePage: this.isProfilePage() });
      }
    });
  }

  private async extractProfileInfo(): Promise<XProfile> {
    // Wait for profile data to load
    await this.waitForProfileElements();

    const username = this.extractUsername();
    const displayName = this.extractDisplayName();
    const bio = this.extractBio();
    const avatarUrl = this.extractAvatarUrl();
    const followersCount = this.extractFollowersCount();
    const followingCount = this.extractFollowingCount();
    const verified = this.isVerified();

    if (!username) {
      throw new Error('Could not extract username from profile page');
    }

    return {
      username,
      displayName: displayName || username,
      bio: bio || '',
      avatarUrl: avatarUrl || '',
      followerCount: followersCount.toString(),
      followingCount: followingCount.toString(),
      verified,
      profileUrl: window.location.href,
      extractedAt: new Date()
    };
  }

  private async waitForProfileElements(timeout: number = 5000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      // Check if profile elements are loaded
      const hasUsername = this.extractUsername() !== null;
      const hasDisplayName = this.extractDisplayName() !== null;
      
      if (hasUsername || hasDisplayName) {
        // Give a little more time for all elements to load
        await new Promise(resolve => setTimeout(resolve, 500));
        return;
      }
      
      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    throw new Error('Timeout waiting for profile elements to load');
  }

  private extractUsername(): string | null {
    // Try multiple selectors for username
    const selectors = [
      '[data-testid="UserName"] div[dir="ltr"] span',
      'div[data-testid="UserName"] span:not([class*="css-"])',
      'a[role="link"][href^="/"][tabindex="-1"] span'
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      for (const element of elements) {
        if (element?.textContent?.startsWith('@')) {
          return element.textContent.slice(1); // Remove @ prefix
        }
      }
    }

    // Fallback: extract from URL
    const match = window.location.pathname.match(/^\/([^\/]+)\/?$/);
    return match ? match[1] : null;
  }

  private extractDisplayName(): string | null {
    const selectors = [
      '[data-testid="UserName"] > div:first-child span',
      'div[data-testid="UserName"] > div > div > div > span',
      '[data-testid="UserName"] span:first-child',
      'div[dir="ltr"] > span[style*="font-weight"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent && !element.textContent.startsWith('@')) {
        return element.textContent;
      }
    }

    return null;
  }

  private extractBio(): string | null {
    const selectors = [
      '[data-testid="UserDescription"]',
      'div[dir="auto"][data-testid="UserDescription"]',
      'div[data-testid="UserProfileHeader_Items"] + div[dir="auto"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  private extractAvatarUrl(): string | null {
    const selectors = [
      'img[alt*="avatar"]',
      'img[alt*="Avatar"]',
      'img[alt*="profile"]',
      'a[href$="/photo"] img',
      'div[data-testid="UserAvatar-Container-unknown"] img',
      '[data-testid="UserAvatar-Container-unknown"] img',
      'img[draggable="true"][src*="profile_images"]'
    ];

    for (const selector of selectors) {
      const img = document.querySelector(selector) as HTMLImageElement;
      if (img?.src && img.src.includes('profile_images')) {
        // Get higher resolution version
        return img.src.replace('_normal', '_400x400')
                     .replace('_bigger', '_400x400')
                     .replace('_200x200', '_400x400');
      }
    }

    // Try background image approach
    const bgElements = document.querySelectorAll('div[style*="background-image"][role="presentation"]');
    for (const element of bgElements) {
      const bgImage = window.getComputedStyle(element).backgroundImage;
      const match = bgImage.match(/url\("(.+?)"\)/);
      if (match?.[1] && match[1].includes('profile_images')) {
        return match[1].replace('_normal', '_400x400')
                       .replace('_bigger', '_400x400')
                       .replace('_200x200', '_400x400');
      }
    }

    return null;
  }

  private extractFollowersCount(): number {
    const followersLink = document.querySelector('a[href$="/verified_followers"], a[href$="/followers"]');
    if (followersLink) {
      const text = followersLink.textContent || '';
      const match = text.match(/^([\d,\.]+[KMB]?)/);
      if (match) {
        return this.parseCount(match[1]);
      }
    }
    return 0;
  }

  private extractFollowingCount(): number {
    const followingLink = document.querySelector('a[href$="/following"]');
    if (followingLink) {
      const text = followingLink.textContent || '';
      const match = text.match(/^([\d,\.]+[KMB]?)/);
      if (match) {
        return this.parseCount(match[1]);
      }
    }
    return 0;
  }

  private parseCount(countStr: string): number {
    const cleanStr = countStr.replace(/,/g, '');
    
    if (cleanStr.endsWith('K')) {
      return parseFloat(cleanStr.slice(0, -1)) * 1000;
    } else if (cleanStr.endsWith('M')) {
      return parseFloat(cleanStr.slice(0, -1)) * 1000000;
    } else if (cleanStr.endsWith('B')) {
      return parseFloat(cleanStr.slice(0, -1)) * 1000000000;
    }
    
    return parseInt(cleanStr, 10) || 0;
  }

  private isVerified(): boolean {
    // Look for verification badge
    const selectors = [
      '[aria-label="Verified account"]',
      'svg[aria-label*="Verified"]',
      '[data-testid="icon-verified"]',
      'svg[class*="verified"]',
      '[data-testid="UserName"] svg[aria-label="認証済みアカウント"]' // Japanese
    ];

    for (const selector of selectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    return false;
  }

  private setupNavigationListener(): void {
    // Listen for URL changes in SPA
    let lastUrl = window.location.href;
    
    const checkUrlChange = () => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        this.handleUrlChange();
      }
    };

    // Use MutationObserver to detect URL changes
    this.observer = new MutationObserver(checkUrlChange);
    this.observer.observe(document.body, { childList: true, subtree: true });

    // Also listen for popstate events
    window.addEventListener('popstate', checkUrlChange);
  }

  private observeUrlChanges(): void {
    // Additional observer for navigation within the app
    const pushState = history.pushState;
    const replaceState = history.replaceState;

    history.pushState = function(...args) {
      pushState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
    };

    history.replaceState = function(...args) {
      replaceState.apply(history, args);
      window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('locationchange', () => {
      this.handleUrlChange();
    });
  }

  private handleUrlChange(): void {
    if (this.isProfilePage()) {
      this.notifyBackgroundScript();
    }
  }
}

// Initialize content script
new ContentScript();