import { ProfileService } from '../services/ProfileService';
import { BrowserNameTagService } from '../services/BrowserNameTagService';
import { BrowserPDFService } from '../services/BrowserPDFService';
import { isValidXProfileUrl } from '../utils/validation';
import { getErrorMessage } from '../utils/errors';
import { XProfile } from '../types';

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
  
  const profileService = ProfileService.getInstance();
  const nameTagService = BrowserNameTagService.getInstance();
  const pdfService = BrowserPDFService.getInstance();
  
  let generatedPdfBlob: Blob | null = null;

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
        
        // Generate name tag
        await generateNameTag(profile);
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
      showStatus('Failed to generate name tag', 'error');
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
  
  // Handle download button
  downloadBtn.addEventListener('click', () => {
    if (generatedPdfBlob) {
      const url = URL.createObjectURL(generatedPdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'x-profile-name-tag.pdf';
      a.click();
      URL.revokeObjectURL(url);
      showStatus('PDF downloaded!', 'success');
    }
  });
  
  // Handle settings button
  settingsBtn.addEventListener('click', () => {
    // This will be implemented in task 7.2
    showStatus('Settings panel coming soon!', 'loading');
  });
});