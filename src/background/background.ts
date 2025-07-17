import { AppSettings } from '../types/index';
import { SettingsService } from '../services/SettingsService';

class BackgroundScript {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = new SettingsService();
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // Extension install/update handler
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstallOrUpdate(details);
    });

    // Message listener for popup and content scripts
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // Keep message channel open for async response
    });

    // Context menu setup
    this.setupContextMenu();

    // Initialize default settings
    await this.initializeSettings();
  }

  private async handleInstallOrUpdate(details: chrome.runtime.InstalledDetails): Promise<void> {
    console.log('Extension event:', details.reason);

    if (details.reason === 'install') {
      // First time installation
      await this.initializeSettings();
      
      // Open welcome page (optional, comment out if not needed)
      // chrome.tabs.create({
      //   url: chrome.runtime.getURL('welcome.html')
      // });
    } else if (details.reason === 'update') {
      // Extension updated
      const previousVersion = details.previousVersion;
      console.log(`Updated from version ${previousVersion} to ${chrome.runtime.getManifest().version}`);
      
      // Migrate settings if needed
      await this.migrateSettings(previousVersion);
    }

    // Update extension icon
    this.updateIcon();
  }

  private async initializeSettings(): Promise<void> {
    try {
      const settings = await this.settingsService.getSettings();
      if (!settings) {
        // Initialize with default settings
        await this.settingsService.saveSettings({
          defaultTemplate: 'modern',
          fontSize: 16,
          primaryColor: '#1DA1F2',
          backgroundColor: '#FFFFFF',
          autoDownload: true
        });
      }
    } catch (error) {
      console.error('Failed to initialize settings:', error);
    }
  }

  private async migrateSettings(previousVersion?: string): Promise<void> {
    // Add migration logic here if needed in future versions
    console.log('Checking for settings migration...', previousVersion);
  }

  private setupContextMenu(): void {
    chrome.contextMenus.create({
      id: 'generate-name-tag',
      title: 'Generate name tag for this profile',
      contexts: ['page'],
      documentUrlPatterns: ['*://x.com/*', '*://twitter.com/*']
    });

    chrome.contextMenus.onClicked.addListener((info, tab) => {
      if (info.menuItemId === 'generate-name-tag' && tab?.id) {
        // Send message to content script to extract profile
        chrome.tabs.sendMessage(tab.id, { 
          action: 'extractProfile' 
        });
      }
    });
  }

  private updateIcon(): void {
    chrome.action.setIcon({
      path: {
        '16': 'icons/icon16.png',
        '32': 'icons/icon32.png',
        '48': 'icons/icon48.png',
        '128': 'icons/icon128.png'
      }
    });
  }

  private async handleMessage(
    request: any,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: any) => void
  ): Promise<void> {
    try {
      switch (request.action) {
        case 'getActiveTabInfo':
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const activeTab = tabs[0];
          sendResponse({
            success: true,
            data: {
              url: activeTab?.url,
              title: activeTab?.title,
              isXProfile: this.isXProfileUrl(activeTab?.url || '')
            }
          });
          break;

        case 'openTab':
          const newTab = await chrome.tabs.create({ url: request.url });
          sendResponse({ success: true, data: newTab });
          break;

        case 'getSettings':
          const settings = await this.settingsService.getSettings();
          sendResponse({ success: true, data: settings });
          break;

        case 'updateSettings':
          await this.settingsService.saveSettings(request.settings);
          sendResponse({ success: true });
          break;

        case 'fetchProfileData':
          await this.handleProfileFetch(request.url, sendResponse);
          break;

        case 'onProfilePage':
          if (sender.tab?.id) {
            this.updateIconForTab(sender.tab.id, true);
          }
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: `Unknown action: ${request.action}` });
      }
    } catch (error) {
      console.error('Error handling message:', error);
      sendResponse({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    }
  }

  private async handleProfileFetch(url: string, sendResponse: (response: any) => void): Promise<void> {
    try {
      // Check if we already have a tab with this URL
      const tabs = await chrome.tabs.query({ url: url });
      let tab = tabs[0];
      
      if (!tab) {
        // Open new tab if not found
        tab = await chrome.tabs.create({ url: url, active: false });
        
        // Wait for tab to load
        await new Promise<void>((resolve) => {
          const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
            if (tabId === tab!.id && changeInfo.status === 'complete') {
              chrome.tabs.onUpdated.removeListener(listener);
              resolve();
            }
          };
          chrome.tabs.onUpdated.addListener(listener);
        });
      }
      
      if (!tab.id) {
        sendResponse({ success: false, error: 'Tab ID not available' });
        return;
      }
      
      // Send message to content script to extract profile data
      chrome.tabs.sendMessage(tab.id, { action: 'extractProfileInfo' }, (response) => {
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

  private updateIconForTab(tabId: number, isProfilePage: boolean): void {
    const iconPath = isProfilePage ? {
      '16': 'icons/icon16-active.png',
      '32': 'icons/icon32-active.png',
      '48': 'icons/icon48-active.png',
      '128': 'icons/icon128-active.png'
    } : {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    };
    
    chrome.action.setIcon({ tabId, path: iconPath });
  }

  private isXProfileUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname;
      const pathname = urlObj.pathname;

      // Check if it's X.com or Twitter.com
      if (hostname === 'x.com' || hostname === 'twitter.com' || 
          hostname === 'www.x.com' || hostname === 'www.twitter.com') {
        // Check if it's a profile page (not /home, /explore, etc.)
        const profilePattern = /^\/[^\/]+\/?$/;
        return profilePattern.test(pathname) && 
               !['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists'].includes(pathname.slice(1));
      }
      return false;
    } catch {
      return false;
    }
  }
}

// Initialize background script
new BackgroundScript();

// Tab activated listener
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  const isXSite = tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'));
  
  chrome.action.setIcon({
    path: isXSite ? {
      '16': 'icons/icon16-active.png',
      '32': 'icons/icon32-active.png',
      '48': 'icons/icon48-active.png',
      '128': 'icons/icon128-active.png'
    } : {
      '16': 'icons/icon16.png',
      '32': 'icons/icon32.png',
      '48': 'icons/icon48.png',
      '128': 'icons/icon128.png'
    }
  });
});