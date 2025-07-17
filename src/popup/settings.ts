import { SettingsService } from '../services/SettingsService';
import { BrowserNameTagService } from '../services/BrowserNameTagService';
import { AppSettings, NameTagTemplate, XProfile } from '../types';

document.addEventListener('DOMContentLoaded', async () => {
  const settingsService = new SettingsService();
  const nameTagService = BrowserNameTagService.getInstance();
  
  // DOM Elements
  const backBtn = document.getElementById('back-btn') as HTMLButtonElement;
  const saveBtn = document.getElementById('save-btn') as HTMLButtonElement;
  const resetBtn = document.getElementById('reset-btn') as HTMLButtonElement;
  
  // Template elements
  const templateOptions = document.querySelectorAll('.template-option');
  
  // Font elements
  const fontFamilySelect = document.getElementById('font-family') as HTMLSelectElement;
  const nameFontSizeInput = document.getElementById('name-font-size') as HTMLInputElement;
  const nameFontSizeValue = document.getElementById('name-font-size-value') as HTMLSpanElement;
  const usernameFontSizeInput = document.getElementById('username-font-size') as HTMLInputElement;
  const usernameFontSizeValue = document.getElementById('username-font-size-value') as HTMLSpanElement;
  
  // Color elements
  const bgColorInput = document.getElementById('bg-color') as HTMLInputElement;
  const bgColorText = document.getElementById('bg-color-text') as HTMLInputElement;
  const textColorInput = document.getElementById('text-color') as HTMLInputElement;
  const textColorText = document.getElementById('text-color-text') as HTMLInputElement;
  const accentColorInput = document.getElementById('accent-color') as HTMLInputElement;
  const accentColorText = document.getElementById('accent-color-text') as HTMLInputElement;
  
  // General settings elements
  const autoDownloadCheckbox = document.getElementById('auto-download') as HTMLInputElement;
  const pdfQualitySelect = document.getElementById('pdf-quality') as HTMLSelectElement;
  
  // Preview canvas
  const previewCanvas = document.getElementById('preview-canvas') as HTMLCanvasElement;
  
  // Current settings
  let currentSettings: AppSettings;
  let currentTemplate: Partial<NameTagTemplate> = {
    id: 'custom',
    name: 'Custom',
    styles: {
      backgroundColor: '#ffffff',
      textColor: '#000000',
      accentColor: '#1da1f2',
      fontFamily: 'Arial',
      nameFontSize: 24,
      usernameFontSize: 18
    }
  };
  
  // Sample profile for preview
  const sampleProfile: XProfile = {
    username: 'sampleuser',
    displayName: 'Sample User',
    bio: 'This is a sample profile for preview purposes.',
    avatarUrl: '/icons/icon-128.png', // Use extension icon as placeholder
    profileUrl: 'https://x.com/sampleuser',
    verified: true,
    followerCount: '1,234',
    followingCount: '567',
    extractedAt: new Date()
  };
  
  // Load current settings
  async function loadSettings() {
    currentSettings = await settingsService.loadSettings();
    
    // Apply settings to UI
    autoDownloadCheckbox.checked = currentSettings.autoDownload;
    pdfQualitySelect.value = currentSettings.pdfQuality;
    
    // Set default template selection
    const defaultTemplate = currentSettings.defaultTemplate || 'default';
    selectTemplate(defaultTemplate);
    
    // Update preview
    updatePreview();
  }
  
  // Template selection
  function selectTemplate(templateId: string) {
    templateOptions.forEach(option => {
      option.classList.remove('selected');
      if (option.getAttribute('data-template') === templateId) {
        option.classList.add('selected');
      }
    });
    
    // Update template-specific settings based on selection
    switch (templateId) {
      case 'minimal':
        bgColorInput.value = '#ffffff';
        bgColorText.value = '#ffffff';
        textColorInput.value = '#333333';
        textColorText.value = '#333333';
        accentColorInput.value = '#666666';
        accentColorText.value = '#666666';
        break;
      case 'colorful':
        bgColorInput.value = '#667eea';
        bgColorText.value = '#667eea';
        textColorInput.value = '#ffffff';
        textColorText.value = '#ffffff';
        accentColorInput.value = '#ffd700';
        accentColorText.value = '#ffd700';
        break;
      default: // default template
        bgColorInput.value = '#ffffff';
        bgColorText.value = '#ffffff';
        textColorInput.value = '#000000';
        textColorText.value = '#000000';
        accentColorInput.value = '#1da1f2';
        accentColorText.value = '#1da1f2';
        break;
    }
    
    currentSettings.defaultTemplate = templateId;
    updateCurrentTemplate();
    updatePreview();
  }
  
  // Update current template with form values
  function updateCurrentTemplate() {
    currentTemplate.styles = {
      backgroundColor: bgColorInput.value,
      textColor: textColorInput.value,
      accentColor: accentColorInput.value,
      fontFamily: fontFamilySelect.value,
      nameFontSize: parseInt(nameFontSizeInput.value),
      usernameFontSize: parseInt(usernameFontSizeInput.value)
    };
  }
  
  // Update preview canvas
  async function updatePreview() {
    try {
      const canvas = await nameTagService.generateNameTag(sampleProfile, currentTemplate as NameTagTemplate);
      const ctx = previewCanvas.getContext('2d')!;
      
      // Set preview canvas size
      previewCanvas.width = canvas.width;
      previewCanvas.height = canvas.height;
      
      // Copy generated canvas to preview
      ctx.drawImage(canvas, 0, 0);
    } catch (error) {
      console.error('Error updating preview:', error);
    }
  }
  
  // Event listeners for template selection
  templateOptions.forEach(option => {
    option.addEventListener('click', () => {
      const templateId = option.getAttribute('data-template') || 'default';
      selectTemplate(templateId);
    });
  });
  
  // Event listeners for font size inputs
  nameFontSizeInput.addEventListener('input', () => {
    nameFontSizeValue.textContent = `${nameFontSizeInput.value}px`;
    updateCurrentTemplate();
    updatePreview();
  });
  
  usernameFontSizeInput.addEventListener('input', () => {
    usernameFontSizeValue.textContent = `${usernameFontSizeInput.value}px`;
    updateCurrentTemplate();
    updatePreview();
  });
  
  // Event listeners for font family
  fontFamilySelect.addEventListener('change', () => {
    updateCurrentTemplate();
    updatePreview();
  });
  
  // Event listeners for color inputs
  function syncColorInputs(colorInput: HTMLInputElement, textInput: HTMLInputElement) {
    colorInput.addEventListener('input', () => {
      textInput.value = colorInput.value;
      updateCurrentTemplate();
      updatePreview();
    });
    
    textInput.addEventListener('input', () => {
      if (/^#[0-9A-F]{6}$/i.test(textInput.value)) {
        colorInput.value = textInput.value;
        updateCurrentTemplate();
        updatePreview();
      }
    });
  }
  
  syncColorInputs(bgColorInput, bgColorText);
  syncColorInputs(textColorInput, textColorText);
  syncColorInputs(accentColorInput, accentColorText);
  
  // Save settings
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
    
    try {
      // Update settings with current values
      currentSettings.autoDownload = autoDownloadCheckbox.checked;
      currentSettings.pdfQuality = pdfQualitySelect.value as 'low' | 'medium' | 'high';
      
      // Save to storage
      await settingsService.saveSettings(currentSettings);
      
      // Show success message
      saveBtn.textContent = 'Saved!';
      setTimeout(() => {
        saveBtn.textContent = 'Save Settings';
        saveBtn.disabled = false;
      }, 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      saveBtn.textContent = 'Error!';
      setTimeout(() => {
        saveBtn.textContent = 'Save Settings';
        saveBtn.disabled = false;
      }, 2000);
    }
  });
  
  // Reset to default settings
  resetBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      await settingsService.resetSettings();
      await loadSettings();
    }
  });
  
  // Back button
  backBtn.addEventListener('click', () => {
    window.location.href = 'popup.html';
  });
  
  // Initialize
  await loadSettings();
});