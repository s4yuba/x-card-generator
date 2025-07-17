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
  if (request.action === 'fetchProfile') {
    // TODO: Implement profile fetching logic
    sendResponse({ success: true, data: {} });
  } else if (request.action === 'generateNameTag') {
    // TODO: Implement name tag generation logic
    sendResponse({ success: true, data: {} });
  }
  return true; // Will respond asynchronously
});

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