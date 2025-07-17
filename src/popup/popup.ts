import { ProfileService } from '../services/ProfileService';
import { isValidXProfileUrl } from '../utils/validation';
import { getErrorMessage } from '../utils/errors';
import { XProfile } from '../types';

document.addEventListener('DOMContentLoaded', () => {
  const profileUrlInput = document.getElementById('profile-url') as HTMLInputElement;
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const previewDiv = document.getElementById('preview') as HTMLDivElement;
  
  const profileService = ProfileService.getInstance();

  // Check if we're on an X profile page and auto-fill the URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab?.url && (currentTab.url.includes('x.com') || currentTab.url.includes('twitter.com'))) {
      profileUrlInput.value = currentTab.url;
    }
  });

  generateBtn.addEventListener('click', async () => {
    const profileUrl = profileUrlInput.value.trim();
    
    if (!profileUrl) {
      showStatus('Please enter a profile URL', 'error');
      return;
    }

    if (!isValidXProfileUrl(profileUrl)) {
      showStatus('Please enter a valid X profile URL', 'error');
      return;
    }

    showStatus('Fetching profile information...', 'loading');
    generateBtn.disabled = true;

    try {
      // Fetch profile data
      const result = await profileService.fetchProfile(profileUrl);
      
      if (result.success && result.data) {
        const profile = result.data.profile;
        showStatus(`Profile found: ${profile.displayName} (@${profile.username})`, 'success');
        
        // Display profile preview
        displayProfilePreview(profile);
        
        // TODO: Implement name tag generation
      } else {
        showStatus(getErrorMessage(result.error), 'error');
      }
    } catch (error) {
      showStatus('Failed to fetch profile', 'error');
      console.error('Error fetching profile:', error);
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
});