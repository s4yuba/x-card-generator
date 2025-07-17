import { ProfileService } from '../services/ProfileService';
import { BrowserNameTagService } from '../services/BrowserNameTagService';
import { BrowserPDFService } from '../services/BrowserPDFService';
import { isValidXProfileUrl } from '../utils/validation';
import { getErrorMessage, formatErrorForDisplay } from '../utils/errors';
import { XProfile, APIError, ErrorCode } from '../types';

document.addEventListener('DOMContentLoaded', () => {
  const profileUrlInput = document.getElementById('profile-url') as HTMLInputElement;
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const previewDiv = document.getElementById('preview') as HTMLDivElement;
  const progressSection = document.getElementById('progress-section') as HTMLDivElement;
  const progressBarFill = document.getElementById('progress-bar-fill') as HTMLDivElement;
  const progressText = document.getElementById('progress-text') as HTMLDivElement;
  const actionsSection = document.getElementById('actions-section') as HTMLDivElement;
  const downloadBtn = document.getElementById('download-btn') as HTMLButtonElement;
  const settingsBtn = document.getElementById('settings-btn') as HTMLButtonElement;
  
  // Error notification elements
  const errorNotification = document.getElementById('error-notification') as HTMLDivElement;
  const errorTitle = document.getElementById('error-title') as HTMLSpanElement;
  const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;
  const errorActions = document.getElementById('error-actions') as HTMLDivElement;
  const errorCloseBtn = document.getElementById('error-close') as HTMLButtonElement;
  
  const profileService = ProfileService.getInstance();
  const nameTagService = BrowserNameTagService.getInstance();
  const pdfService = BrowserPDFService.getInstance();
  
  let generatedPdfBlob: Blob | null = null;
  let currentProfileUrl: string = '';

  // Check if we're on an X profile page and auto-fill the URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab?.url && (currentTab.url.includes('x.com') || currentTab.url.includes('twitter.com'))) {
      profileUrlInput.value = currentTab.url;
    }
  });

  generateBtn.addEventListener('click', async () => {
    const profileUrl = profileUrlInput.value.trim();
    currentProfileUrl = profileUrl;
    
    if (!profileUrl) {
      showError({
        code: ErrorCode.INVALID_URL,
        message: 'Please enter a profile URL',
        timestamp: new Date(),
        recoverable: true
      });
      return;
    }

    if (!isValidXProfileUrl(profileUrl)) {
      showError({
        code: ErrorCode.INVALID_URL,
        message: 'Please enter a valid X profile URL (e.g., https://x.com/username)',
        timestamp: new Date(),
        recoverable: true
      });
      return;
    }

    hideError();
    showStatus('Fetching profile information...', 'loading');
    generateBtn.disabled = true;

    try {
      // Fetch profile data
      console.log('[Popup] Fetching profile for URL:', profileUrl);
      const result = await profileService.fetchProfile(profileUrl);
      console.log('[Popup] Profile fetch result:', result);
      
      if (result.success && result.data) {
        const profile = result.data.profile;
        showStatus(`Profile found: ${profile.displayName} (@${profile.username})`, 'success');
        
        // Display profile preview
        displayProfilePreview(profile);
        
        // Generate name tag
        await generateNameTag(profile);
      } else if (result.error) {
        console.error('[Popup] Profile fetch error:', result.error);
        showError(result.error);
      }
    } catch (error) {
      showError({
        code: ErrorCode.UNKNOWN_ERROR,
        message: 'Failed to fetch profile',
        timestamp: new Date(),
        recoverable: true,
        details: error
      });
      console.error('[Popup] Error fetching profile:', error);
    } finally {
      generateBtn.disabled = false;
    }
  });

  function showStatus(message: string, type: 'success' | 'error' | 'loading') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }
  
  function displayProfilePreview(profile: XProfile) {
    // Clear previous content
    previewDiv.innerHTML = '';
    
    const container = document.createElement('div');
    container.style.cssText = 'text-align: center; margin-top: 20px;';
    
    const img = document.createElement('img');
    img.src = profile.avatarUrl;
    img.alt = profile.displayName;
    img.style.cssText = 'width: 80px; height: 80px; border-radius: 50%;';
    
    const nameHeader = document.createElement('h3');
    nameHeader.textContent = profile.displayName;
    
    const usernameP = document.createElement('p');
    usernameP.textContent = `@${profile.username}`;
    
    container.appendChild(img);
    container.appendChild(nameHeader);
    container.appendChild(usernameP);
    
    if (profile.verified) {
      const verifiedSpan = document.createElement('span');
      verifiedSpan.style.color = '#1da1f2';
      verifiedSpan.textContent = '✓ Verified';
      container.appendChild(verifiedSpan);
    }
    
    previewDiv.appendChild(container);
  }
  
  async function generateNameTag(profile: XProfile) {
    try {
      // Show progress
      showProgress(true, 'Generating name tag...');
      updateProgress(20);
      
      // Generate name tag canvas
      const canvas = await nameTagService.generateNameTag(profile);
      updateProgress(50);
      
      // Display canvas preview
      previewDiv.innerHTML = '';
      const canvasContainer = document.createElement('div');
      canvasContainer.style.cssText = 'margin-top: 20px;';
      canvasContainer.appendChild(canvas);
      previewDiv.appendChild(canvasContainer);
      
      updateProgress(70);
      
      // Generate PDF
      showProgress(true, 'Creating PDF...');
      generatedPdfBlob = await pdfService.generatePDF([canvas]);
      updateProgress(100);
      
      // Show actions
      showProgress(false);
      actionsSection.style.display = 'block';
      showStatus('Name tag generated successfully!', 'success');
    } catch (error) {
      showProgress(false);
      showError({
        code: ErrorCode.GENERATION_ERROR,
        message: 'Failed to generate name tag. Please try again.',
        timestamp: new Date(),
        recoverable: true,
        details: error
      });
      console.error('Error generating name tag:', error);
    }
  }
  
  function showProgress(show: boolean, message: string = 'Loading...') {
    progressSection.style.display = show ? 'block' : 'none';
    if (show) {
      progressText.textContent = message;
      progressBarFill.style.width = '0%';
    }
  }
  
  function updateProgress(percent: number) {
    progressBarFill.style.width = `${percent}%`;
  }
  
  // Handle settings button
  settingsBtn.addEventListener('click', () => {
    window.location.href = 'settings.html';
  });
  
  // Enhanced error display functions
  function showError(error: APIError) {
    const formatted = formatErrorForDisplay(error);
    
    errorTitle.textContent = formatted.title;
    errorMessage.textContent = formatted.message;
    
    // Clear previous actions
    errorActions.innerHTML = '';
    
    // Add action buttons if available
    if (formatted.actions) {
      formatted.actions.forEach((action, index) => {
        const button = document.createElement('button');
        button.textContent = action.label;
        button.className = index === 0 ? 'error-action-primary' : 'error-action-secondary';
        
        button.addEventListener('click', () => {
          handleErrorAction(action.action, error);
        });
        
        errorActions.appendChild(button);
      });
    }
    
    // Show error notification
    errorNotification.style.display = 'block';
    statusDiv.style.display = 'none';
  }
  
  function hideError() {
    errorNotification.style.display = 'none';
  }
  
  function handleErrorAction(action: string, error: APIError) {
    switch (action) {
      case 'retry':
        hideError();
        generateBtn.click();
        break;
        
      case 'show-example-url':
        profileUrlInput.value = 'https://x.com/username';
        profileUrlInput.focus();
        hideError();
        break;
        
      case 'open-permissions':
        chrome.tabs.create({ url: 'chrome://extensions/?id=' + chrome.runtime.id });
        break;
        
      case 'dismiss':
      default:
        hideError();
        break;
    }
  }
  
  // Show success toast notification
  function showSuccessToast(message: string) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out';
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 300);
    }, 3000);
  }
  
  // Error notification close button
  errorCloseBtn.addEventListener('click', () => {
    hideError();
  });
  
  // Update download success feedback
  const originalDownloadClick = downloadBtn.onclick;
  downloadBtn.onclick = null;
  downloadBtn.addEventListener('click', () => {
    if (generatedPdfBlob) {
      const url = URL.createObjectURL(generatedPdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'x-profile-name-tag.pdf';
      a.click();
      URL.revokeObjectURL(url);
      showSuccessToast('PDF downloaded successfully!');
    }
  });
});