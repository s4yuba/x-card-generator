import { AppSettings } from '../types';

export interface SettingsValidationResult {
  isValid: boolean;
  errors: string[];
}

export class SettingsService {
  private readonly defaultSettings: AppSettings = {
    autoDownload: true,
    downloadFormat: 'pdf',
    pdfQuality: 'medium',
    defaultTemplate: 'default',
    recentProfiles: [],
    maxRecentProfiles: 10
  };

  private readonly storageKey = 'x-profile-name-tag-generator-settings';

  /**
   * Load settings from Chrome storage
   */
  async getSettings(): Promise<AppSettings> {
    return this.loadSettings();
  }

  /**
   * Load settings from Chrome storage
   */
  async loadSettings(): Promise<AppSettings> {
    try {
      // For Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.storage) {
        const result = await chrome.storage.sync.get(this.storageKey);
        const savedSettings = result[this.storageKey];
        
        if (savedSettings) {
          return this.mergeWithDefaults(savedSettings);
        }
      }

      // Fallback to localStorage for testing or non-Chrome environments
      const savedSettings = this.loadFromLocalStorage();
      return this.mergeWithDefaults(savedSettings);
    } catch (error) {
      console.error('Failed to load settings:', error);
      return this.defaultSettings;
    }
  }

  /**
   * Save settings to Chrome storage
   */
  async saveSettings(settings: AppSettings): Promise<void> {
    const validationResult = this.validateSettings(settings);
    if (!validationResult.isValid) {
      throw new Error(`Invalid settings: ${validationResult.errors.join(', ')}`);
    }

    try {
      // For Chrome extension environment
      if (typeof chrome !== 'undefined' && chrome.storage) {
        await chrome.storage.sync.set({
          [this.storageKey]: settings
        });
      } else {
        // Fallback to localStorage for testing or non-Chrome environments
        this.saveToLocalStorage(settings);
      }
    } catch (error) {
      throw new Error(`Failed to save settings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update specific setting
   */
  async updateSetting<K extends keyof AppSettings>(
    key: K, 
    value: AppSettings[K]
  ): Promise<void> {
    const currentSettings = await this.loadSettings();
    const updatedSettings = { ...currentSettings, [key]: value };
    await this.saveSettings(updatedSettings);
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings(): Promise<void> {
    await this.saveSettings(this.defaultSettings);
  }

  /**
   * Add profile to recent profiles list
   */
  async addRecentProfile(profileUrl: string): Promise<void> {
    const settings = await this.loadSettings();
    
    // Remove if already exists
    const filteredProfiles = settings.recentProfiles.filter(url => url !== profileUrl);
    
    // Add to beginning
    const updatedProfiles = [profileUrl, ...filteredProfiles];
    
    // Limit to max recent profiles
    const trimmedProfiles = updatedProfiles.slice(0, settings.maxRecentProfiles);
    
    await this.updateSetting('recentProfiles', trimmedProfiles);
  }

  /**
   * Remove profile from recent profiles list
   */
  async removeRecentProfile(profileUrl: string): Promise<void> {
    const settings = await this.loadSettings();
    const updatedProfiles = settings.recentProfiles.filter(url => url !== profileUrl);
    await this.updateSetting('recentProfiles', updatedProfiles);
  }

  /**
   * Clear all recent profiles
   */
  async clearRecentProfiles(): Promise<void> {
    await this.updateSetting('recentProfiles', []);
  }

  /**
   * Get default settings
   */
  getDefaultSettings(): AppSettings {
    return { ...this.defaultSettings };
  }

  /**
   * Validate settings structure and values
   */
  validateSettings(settings: AppSettings): SettingsValidationResult {
    const errors: string[] = [];

    // Validate autoDownload
    if (typeof settings.autoDownload !== 'boolean') {
      errors.push('autoDownload must be a boolean');
    }

    // Validate downloadFormat
    if (!['pdf', 'png'].includes(settings.downloadFormat)) {
      errors.push('downloadFormat must be "pdf" or "png"');
    }

    // Validate pdfQuality
    if (!['low', 'medium', 'high'].includes(settings.pdfQuality)) {
      errors.push('pdfQuality must be "low", "medium", or "high"');
    }

    // Validate defaultTemplate
    if (typeof settings.defaultTemplate !== 'string' || settings.defaultTemplate.length === 0) {
      errors.push('defaultTemplate must be a non-empty string');
    }

    // Validate recentProfiles
    if (!Array.isArray(settings.recentProfiles)) {
      errors.push('recentProfiles must be an array');
    } else {
      // Validate each profile URL
      for (const profile of settings.recentProfiles) {
        if (typeof profile !== 'string' || !this.isValidProfileUrl(profile)) {
          errors.push(`Invalid profile URL: ${profile}`);
        }
      }
    }

    // Validate maxRecentProfiles
    if (typeof settings.maxRecentProfiles !== 'number' || 
        settings.maxRecentProfiles < 1 || 
        settings.maxRecentProfiles > 50) {
      errors.push('maxRecentProfiles must be a number between 1 and 50');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Migrate settings from old version to new version
   */
  async migrateSettings(oldSettings: any): Promise<AppSettings> {
    // Handle migration from version 1.0 to current version
    const migrated = { ...this.defaultSettings };

    // Migrate known fields
    if (oldSettings.autoDownload !== undefined) {
      migrated.autoDownload = Boolean(oldSettings.autoDownload);
    }

    if (oldSettings.downloadFormat && ['pdf', 'png'].includes(oldSettings.downloadFormat)) {
      migrated.downloadFormat = oldSettings.downloadFormat;
    }

    if (oldSettings.pdfQuality && ['low', 'medium', 'high'].includes(oldSettings.pdfQuality)) {
      migrated.pdfQuality = oldSettings.pdfQuality;
    }

    if (oldSettings.defaultTemplate && typeof oldSettings.defaultTemplate === 'string') {
      migrated.defaultTemplate = oldSettings.defaultTemplate;
    }

    if (typeof oldSettings.maxRecentProfiles === 'number' && 
        oldSettings.maxRecentProfiles >= 1 && 
        oldSettings.maxRecentProfiles <= 50) {
      migrated.maxRecentProfiles = oldSettings.maxRecentProfiles;
    }

    if (Array.isArray(oldSettings.recentProfiles)) {
      migrated.recentProfiles = oldSettings.recentProfiles
        .filter((url: any) => typeof url === 'string' && this.isValidProfileUrl(url))
        .slice(0, migrated.maxRecentProfiles);
    }

    return migrated;
  }

  /**
   * Export settings as JSON
   */
  async exportSettings(): Promise<string> {
    const settings = await this.loadSettings();
    return JSON.stringify(settings, null, 2);
  }

  /**
   * Import settings from JSON
   */
  async importSettings(jsonString: string): Promise<void> {
    try {
      const parsedSettings = JSON.parse(jsonString);
      const migratedSettings = await this.migrateSettings(parsedSettings);
      await this.saveSettings(migratedSettings);
    } catch (error) {
      throw new Error(`Failed to import settings: ${error instanceof Error ? error.message : 'Invalid JSON'}`);
    }
  }

  /**
   * Merge saved settings with defaults
   */
  private mergeWithDefaults(savedSettings: Partial<AppSettings>): AppSettings {
    return {
      ...this.defaultSettings,
      ...savedSettings
    };
  }

  /**
   * Load settings from localStorage (fallback)
   */
  private loadFromLocalStorage(): any {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return null;
    }
  }

  /**
   * Save settings to localStorage (fallback)
   */
  private saveToLocalStorage(settings: AppSettings): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  /**
   * Validate profile URL format
   */
  private isValidProfileUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === 'x.com' || parsedUrl.hostname === 'twitter.com';
    } catch {
      return false;
    }
  }
}