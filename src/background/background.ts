// Background script for X Profile Name Tag Generator

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('X Profile Name Tag Generator installed');
    // Set default settings
    chrome.storage.sync.set({
      settings: {
        autoDownload: true,
        pdfQuality: 'high',
        defaultTemplate: 'standard'
      }
    });
  } else if (details.reason === 'update') {
    console.log('X Profile Name Tag Generator updated');
  }
});

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchProfileData') {
    handleProfileFetch(request.url, sendResponse);
    return true; // Will respond asynchronously
  } else if (request.action === 'generateNameTag') {
    // TODO: Implement name tag generation logic
    sendResponse({ success: true, data: {} });
  } else if (request.action === 'onProfilePage' && sender.tab) {
    // Content script notifying that it's on a profile page
    updateIconForTab(sender.tab.id, true);
  }
  return true;
});

// Handle profile data fetching
async function handleProfileFetch(url: string, sendResponse: Function) {
  try {
    // Create a new tab or find existing tab with the URL
    const tabs = await chrome.tabs.query({ url: url });
    let tab = tabs[0];
    
    if (!tab) {
      // Open new tab if not found
      tab = await chrome.tabs.create({ url: url, active: false });
      
      // Wait for tab to load
      await new Promise<void>((resolve) => {
        const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
          if (tabId === tab.id && changeInfo.status === 'complete') {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });
    }
    
    // Send message to content script to extract profile data
    chrome.tabs.sendMessage(tab.id!, { action: 'extractProfileInfo' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ success: false, error: chrome.runtime.lastError.message });
      } else {
        sendResponse(response);
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    sendResponse({ success: false, error: 'Failed to fetch profile' });
  }
}

// Update icon for a specific tab
function updateIconForTab(tabId: number, isProfilePage: boolean) {
  const iconPath = isProfilePage ? {
    "16": "../icons/icon-16-active.png",
    "48": "../icons/icon-48-active.png",
    "128": "../icons/icon-128-active.png"
  } : {
    "16": "../icons/icon-16.png",
    "48": "../icons/icon-48.png",
    "128": "../icons/icon-128.png"
  };
  
  chrome.action.setIcon({ tabId, path: iconPath });
}

// Set extension icon based on current tab
chrome.tabs.onActivated.addListener((activeInfo) => {
  chrome.tabs.get(activeInfo.tabId, (tab) => {
    if (tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'))) {
      chrome.action.setIcon({ path: {
        "16": "../icons/icon-16-active.png",
        "48": "../icons/icon-48-active.png",
        "128": "../icons/icon-128-active.png"
      }});
    } else {
      chrome.action.setIcon({ path: {
        "16": "../icons/icon-16.png",
        "48": "../icons/icon-48.png",
        "128": "../icons/icon-128.png"
      }});
    }
  });
});