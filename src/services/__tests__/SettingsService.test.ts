import { SettingsService } from '../SettingsService';
import { AppSettings } from '../../types';

// Mock Chrome storage API
const mockChromeStorage = {
  sync: {
    get: jest.fn(),
    set: jest.fn()
  }
};

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};

Object.defineProperty(global, 'localStorage', {
  value: mockLocalStorage
});

describe('SettingsService', () => {
  let service: SettingsService;
  let mockSettings: AppSettings;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset global chrome object
    (global as any).chrome = undefined;
    
    service = new SettingsService();
    
    mockSettings = {
      autoDownload: true,
      downloadFormat: 'pdf',
      pdfQuality: 'medium',
      defaultTemplate: 'default',
      recentProfiles: ['https://x.com/testuser'],
      maxRecentProfiles: 10
    };
  });

  describe('loadSettings', () => {
    it('should load settings from Chrome storage when available', async () => {
      // Mock Chrome environment
      (global as any).chrome = { storage: mockChromeStorage };
      
      mockChromeStorage.sync.get.mockResolvedValue({
        'x-profile-name-tag-generator-settings': mockSettings
      });

      const result = await service.loadSettings();
      
      expect(result).toEqual(mockSettings);
      expect(mockChromeStorage.sync.get).toHaveBeenCalledWith('x-profile-name-tag-generator-settings');
    });

    it('should fall back to localStorage when Chrome storage is not available', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));

      const result = await service.loadSettings();
      
      expect(result).toEqual(mockSettings);
      expect(mockLocalStorage.getItem).toHaveBeenCalledWith('x-profile-name-tag-generator-settings');
    });

    it('should return default settings when no saved settings exist', async () => {
      mockLocalStorage.getItem.mockReturnValue(null);

      const result = await service.loadSettings();
      
      expect(result).toEqual(service.getDefaultSettings());
    });

    it('should handle Chrome storage errors gracefully', async () => {
      (global as any).chrome = { storage: mockChromeStorage };
      mockChromeStorage.sync.get.mockRejectedValue(new Error('Storage error'));

      const result = await service.loadSettings();
      
      expect(result).toEqual(service.getDefaultSettings());
    });

    it('should handle localStorage errors gracefully', async () => {
      mockLocalStorage.getItem.mockImplementation(() => {
        throw new Error('localStorage error');
      });

      const result = await service.loadSettings();
      
      expect(result).toEqual(service.getDefaultSettings());
    });
  });

  describe('saveSettings', () => {
    it('should save settings to Chrome storage when available', async () => {
      (global as any).chrome = { storage: mockChromeStorage };
      mockChromeStorage.sync.set.mockResolvedValue(undefined);

      await service.saveSettings(mockSettings);
      
      expect(mockChromeStorage.sync.set).toHaveBeenCalledWith({
        'x-profile-name-tag-generator-settings': mockSettings
      });
    });

    it('should fall back to localStorage when Chrome storage is not available', async () => {
      await service.saveSettings(mockSettings);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(mockSettings)
      );
    });

    it('should throw error for invalid settings', async () => {
      const invalidSettings = {
        ...mockSettings,
        autoDownload: 'invalid' as any
      };

      await expect(service.saveSettings(invalidSettings)).rejects.toThrow('Invalid settings');
    });

    it('should handle Chrome storage save errors', async () => {
      (global as any).chrome = { storage: mockChromeStorage };
      mockChromeStorage.sync.set.mockRejectedValue(new Error('Save error'));

      await expect(service.saveSettings(mockSettings)).rejects.toThrow('Failed to save settings');
    });
  });

  describe('updateSetting', () => {
    it('should update specific setting', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));

      await service.updateSetting('autoDownload', false);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify({ ...mockSettings, autoDownload: false })
      );
    });

    it('should update pdf quality setting', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));

      await service.updateSetting('pdfQuality', 'high');
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify({ ...mockSettings, pdfQuality: 'high' })
      );
    });
  });

  describe('resetSettings', () => {
    it('should reset settings to defaults', async () => {
      await service.resetSettings();
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(service.getDefaultSettings())
      );
    });
  });

  describe('recent profiles management', () => {
    beforeEach(() => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));
    });

    it('should add profile to recent profiles', async () => {
      const newProfile = 'https://x.com/newuser';
      
      await service.addRecentProfile(newProfile);
      
      const expectedSettings = {
        ...mockSettings,
        recentProfiles: [newProfile, ...mockSettings.recentProfiles]
      };
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(expectedSettings)
      );
    });

    it('should move existing profile to front of recent profiles', async () => {
      const existingProfile = 'https://x.com/testuser';
      
      await service.addRecentProfile(existingProfile);
      
      const expectedSettings = {
        ...mockSettings,
        recentProfiles: [existingProfile] // Should only appear once, at the front
      };
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(expectedSettings)
      );
    });

    it('should limit recent profiles to maximum count', async () => {
      const settingsWithMaxProfiles = {
        ...mockSettings,
        recentProfiles: Array.from({ length: 10 }, (_, i) => `https://x.com/user${i}`),
        maxRecentProfiles: 5
      };
      
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(settingsWithMaxProfiles));
      
      await service.addRecentProfile('https://x.com/newuser');
      
      // Should only keep 5 profiles (the new one plus 4 existing ones)
      const lastCall = mockLocalStorage.setItem.mock.calls[mockLocalStorage.setItem.mock.calls.length - 1];
      const savedSettings = JSON.parse(lastCall[1]);
      
      expect(savedSettings.recentProfiles).toHaveLength(5);
      expect(savedSettings.recentProfiles[0]).toBe('https://x.com/newuser');
    });

    it('should remove profile from recent profiles', async () => {
      await service.removeRecentProfile('https://x.com/testuser');
      
      const expectedSettings = {
        ...mockSettings,
        recentProfiles: []
      };
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(expectedSettings)
      );
    });

    it('should clear all recent profiles', async () => {
      await service.clearRecentProfiles();
      
      const expectedSettings = {
        ...mockSettings,
        recentProfiles: []
      };
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(expectedSettings)
      );
    });
  });

  describe('validateSettings', () => {
    it('should validate correct settings', () => {
      const result = service.validateSettings(mockSettings);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid autoDownload', () => {
      const invalidSettings = { ...mockSettings, autoDownload: 'invalid' as any };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('autoDownload must be a boolean');
    });

    it('should reject invalid downloadFormat', () => {
      const invalidSettings = { ...mockSettings, downloadFormat: 'invalid' as any };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('downloadFormat must be "pdf" or "png"');
    });

    it('should reject invalid pdfQuality', () => {
      const invalidSettings = { ...mockSettings, pdfQuality: 'invalid' as any };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('pdfQuality must be "low", "medium", or "high"');
    });

    it('should reject invalid defaultTemplate', () => {
      const invalidSettings = { ...mockSettings, defaultTemplate: '' };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('defaultTemplate must be a non-empty string');
    });

    it('should reject invalid recentProfiles', () => {
      const invalidSettings = { ...mockSettings, recentProfiles: 'invalid' as any };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('recentProfiles must be an array');
    });

    it('should reject invalid profile URLs', () => {
      const invalidSettings = { ...mockSettings, recentProfiles: ['invalid-url'] };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid profile URL: invalid-url');
    });

    it('should reject invalid maxRecentProfiles', () => {
      const invalidSettings = { ...mockSettings, maxRecentProfiles: 0 };
      
      const result = service.validateSettings(invalidSettings);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('maxRecentProfiles must be a number between 1 and 50');
    });
  });

  describe('migrateSettings', () => {
    it('should migrate settings from old version', async () => {
      const oldSettings = {
        autoDownload: true,
        downloadFormat: 'pdf',
        someOldField: 'value'
      };

      const migrated = await service.migrateSettings(oldSettings);
      
      expect(migrated.autoDownload).toBe(true);
      expect(migrated.downloadFormat).toBe('pdf');
      expect(migrated.pdfQuality).toBe('medium'); // Should use default
      expect(migrated.defaultTemplate).toBe('default'); // Should use default
      expect(migrated.recentProfiles).toEqual([]); // Should use default
    });

    it('should filter invalid profile URLs during migration', async () => {
      const oldSettings = {
        recentProfiles: ['https://x.com/valid', 'invalid-url', 'https://x.com/another']
      };

      const migrated = await service.migrateSettings(oldSettings);
      
      expect(migrated.recentProfiles).toEqual(['https://x.com/valid', 'https://x.com/another']);
    });

    it('should limit migrated recent profiles to max count', async () => {
      const oldSettings = {
        recentProfiles: Array.from({ length: 15 }, (_, i) => `https://x.com/user${i}`),
        maxRecentProfiles: 5
      };

      const migrated = await service.migrateSettings(oldSettings);
      
      expect(migrated.recentProfiles).toHaveLength(5);
      expect(migrated.maxRecentProfiles).toBe(5);
    });
  });

  describe('export/import settings', () => {
    it('should export settings as JSON', async () => {
      mockLocalStorage.getItem.mockReturnValue(JSON.stringify(mockSettings));

      const exported = await service.exportSettings();
      
      expect(exported).toBe(JSON.stringify(mockSettings, null, 2));
    });

    it('should import settings from JSON', async () => {
      const jsonSettings = JSON.stringify(mockSettings);
      
      await service.importSettings(jsonSettings);
      
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'x-profile-name-tag-generator-settings',
        JSON.stringify(mockSettings)
      );
    });

    it('should handle invalid JSON during import', async () => {
      const invalidJson = 'invalid json';
      
      await expect(service.importSettings(invalidJson)).rejects.toThrow('Failed to import settings');
    });
  });

  describe('getDefaultSettings', () => {
    it('should return default settings', () => {
      const defaults = service.getDefaultSettings();
      
      expect(defaults).toEqual({
        autoDownload: true,
        downloadFormat: 'pdf',
        pdfQuality: 'medium',
        defaultTemplate: 'default',
        recentProfiles: [],
        maxRecentProfiles: 10
      });
    });
  });
});