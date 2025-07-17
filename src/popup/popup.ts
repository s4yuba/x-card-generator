document.addEventListener('DOMContentLoaded', () => {
  const profileUrlInput = document.getElementById('profile-url') as HTMLInputElement;
  const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
  const statusDiv = document.getElementById('status') as HTMLDivElement;
  const previewDiv = document.getElementById('preview') as HTMLDivElement;

  // Check if we're on an X profile page and auto-fill the URL
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    if (currentTab?.url && currentTab.url.includes('x.com')) {
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

    showStatus('Generating name tag...', 'loading');
    generateBtn.disabled = true;

    try {
      // TODO: Implement profile fetching and name tag generation
      showStatus('Name tag generated successfully!', 'success');
    } catch (error) {
      showStatus('Failed to generate name tag', 'error');
      console.error('Error generating name tag:', error);
    } finally {
      generateBtn.disabled = false;
    }
  });

  function isValidXProfileUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname === 'x.com' || urlObj.hostname === 'twitter.com';
    } catch {
      return false;
    }
  }

  function showStatus(message: string, type: 'success' | 'error' | 'loading') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
  }
});