// Content script for X Profile Name Tag Generator

// Check if current page is an X profile page
function isXProfilePage(): boolean {
  const url = window.location.href;
  const profileUrlPattern = /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/[^/]+\/?$/;
  return profileUrlPattern.test(url);
}

// Extract profile information from the page
function extractProfileInfo() {
  const profileInfo = {
    username: '',
    displayName: '',
    bio: '',
    avatarUrl: '',
    verified: false,
    followerCount: '',
    followingCount: ''
  };

  try {
    // Extract username from URL
    const urlParts = window.location.pathname.split('/');
    profileInfo.username = urlParts[1] || '';

    // Extract display name
    const displayNameElement = document.querySelector('[data-testid="UserName"] span');
    if (displayNameElement) {
      profileInfo.displayName = displayNameElement.textContent || '';
    }

    // Extract bio
    const bioElement = document.querySelector('[data-testid="UserDescription"]');
    if (bioElement) {
      profileInfo.bio = bioElement.textContent || '';
    }

    // Extract avatar URL
    const avatarElement = document.querySelector('[data-testid="UserAvatar-Container-unknown"] img') as HTMLImageElement;
    if (avatarElement) {
      profileInfo.avatarUrl = avatarElement.src || '';
    }

    // Check verification status
    const verifiedBadge = document.querySelector('[aria-label="Verified account"]');
    profileInfo.verified = !!verifiedBadge;

    // Extract follower count
    const followerLink = document.querySelector('a[href$="/followers"] span');
    if (followerLink) {
      profileInfo.followerCount = followerLink.textContent || '';
    }

    // Extract following count
    const followingLink = document.querySelector('a[href$="/following"] span');
    if (followingLink) {
      profileInfo.followingCount = followingLink.textContent || '';
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
      const profileInfo = extractProfileInfo();
      sendResponse({ success: true, data: profileInfo });
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