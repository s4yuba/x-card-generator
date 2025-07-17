// Content script for X Profile Name Tag Generator

// Check if current page is an X profile page
function isXProfilePage(): boolean {
  const url = window.location.href;
  const profileUrlPattern = /^https:\/\/(www\.)?(x\.com|twitter\.com)\/[^/]+\/?$/;
  return profileUrlPattern.test(url);
}

// Wait for element with retry
async function waitForElement(selector: string, timeout: number = 5000): Promise<Element | null> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return null;
}

// Extract profile information from the page
async function extractProfileInfo() {
  const profileInfo = {
    username: '',
    displayName: '',
    bio: '',
    avatarUrl: '',
    profileUrl: window.location.href,
    verified: false,
    followerCount: '',
    followingCount: '',
    extractedAt: new Date().toISOString()
  };

  try {
    // Extract username from URL
    const urlParts = window.location.pathname.split('/');
    profileInfo.username = urlParts[1] || '';

    // Wait for profile to load
    await waitForElement('[data-testid="UserName"]');

    // Extract display name - try multiple selectors
    const displayNameSelectors = [
      '[data-testid="UserName"] > div > div > div > span',
      '[data-testid="UserName"] span:first-child',
      'div[dir="ltr"] > span[style*="font-weight"]'
    ];
    
    for (const selector of displayNameSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        profileInfo.displayName = element.textContent.trim();
        break;
      }
    }

    // Extract bio - try multiple selectors
    const bioSelectors = [
      '[data-testid="UserDescription"]',
      'div[dir="auto"][data-testid="UserDescription"]',
      'div[data-testid="UserProfileHeader_Items"] + div[dir="auto"]'
    ];
    
    for (const selector of bioSelectors) {
      const element = document.querySelector(selector);
      if (element?.textContent) {
        profileInfo.bio = element.textContent.trim();
        break;
      }
    }

    // Extract avatar URL - try multiple selectors
    const avatarSelectors = [
      'img[alt*="avatar"]',
      'img[alt*="profile"]',
      'a[href$="/photo"] img',
      'div[data-testid="UserAvatar-Container-unknown"] img',
      'div[style*="background-image"][role="presentation"]'
    ];
    
    for (const selector of avatarSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        if (element instanceof HTMLImageElement && element.src) {
          // Get higher resolution version
          profileInfo.avatarUrl = element.src.replace(/_normal\.|_200x200\.|_400x400\./, '.');
          break;
        } else if (element instanceof HTMLDivElement) {
          const bgImage = window.getComputedStyle(element).backgroundImage;
          const match = bgImage.match(/url\("(.+?)"\)/);
          if (match?.[1]) {
            profileInfo.avatarUrl = match[1].replace(/_normal\.|_200x200\.|_400x400\./, '.');
            break;
          }
        }
      }
    }

    // Check verification status - try multiple selectors
    const verifiedSelectors = [
      '[aria-label="Verified account"]',
      'svg[aria-label*="Verified"]',
      '[data-testid="icon-verified"]',
      'svg[class*="verified"]'
    ];
    
    profileInfo.verified = verifiedSelectors.some(selector => !!document.querySelector(selector));

    // Extract follower/following counts
    const statsLinks = document.querySelectorAll('a[href$="/verified_followers"], a[href$="/followers"], a[href$="/following"]');
    
    statsLinks.forEach(link => {
      const href = link.getAttribute('href') || '';
      const text = link.textContent || '';
      
      if (href.includes('/followers')) {
        // Extract number from text like "1.2K Followers"
        const match = text.match(/([0-9,.]+[KMB]?)/);
        if (match) {
          profileInfo.followerCount = match[1];
        }
      } else if (href.includes('/following')) {
        const match = text.match(/([0-9,.]+[KMB]?)/);
        if (match) {
          profileInfo.followingCount = match[1];
        }
      }
    });

    // If display name is still empty, use username
    if (!profileInfo.displayName && profileInfo.username) {
      profileInfo.displayName = profileInfo.username;
    }
  } catch (error) {
    console.error('Error extracting profile info:', error);
  }

  return profileInfo;
}

// Listen for messages from the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'checkProfilePage') {
    sendResponse({ isProfilePage: isXProfilePage() });
  } else if (request.action === 'extractProfileInfo') {
    if (isXProfilePage()) {
      extractProfileInfo().then(profileInfo => {
        sendResponse({ success: true, data: profileInfo });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    } else {
      sendResponse({ success: false, error: 'Not on a profile page' });
    }
  }
  return true;
});

// Notify background script when on a profile page
if (isXProfilePage()) {
  chrome.runtime.sendMessage({ action: 'onProfilePage', url: window.location.href });
}