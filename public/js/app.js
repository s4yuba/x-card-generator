/**
 * Frontend JavaScript for X Profile Name Tag Generator
 */

// API base URL
const API_BASE = '/api/name-tag';

// Utility functions
const showError = (elementId, message) => {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    setTimeout(() => {
        errorEl.style.display = 'none';
    }, 5000);
};

const showSuccess = (elementId, message) => {
    const successEl = document.getElementById(elementId);
    successEl.textContent = message;
    successEl.style.display = 'block';
    setTimeout(() => {
        successEl.style.display = 'none';
    }, 5000);
};

const downloadPDF = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
};

// Single name tag form handler
document.getElementById('singleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    const profileUrl = document.getElementById('profileUrl').value.trim();
    const includeQR = document.getElementById('includeQR').checked;
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    btnLoading.innerHTML = '<span class="spinner"></span> Generating...';
    
    try {
        // Choose endpoint based on QR option
        const endpoint = includeQR ? '/generate' : '/generate-simple';
        
        const response = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ profileUrl }),
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const username = profileUrl.split('/').pop() || 'user';
            downloadPDF(blob, `nametag-${username}.pdf`);
            showSuccess('singleSuccess', 'Name tag generated successfully!');
            form.reset();
        } else {
            const error = await response.json();
            throw new Error(error.error.message || 'Failed to generate name tag');
        }
    } catch (error) {
        showError('singleError', error.message);
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
});

// Multiple name tags form handler
document.getElementById('multipleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    const profileUrlsText = document.getElementById('profileUrls').value.trim();
    const profileUrls = profileUrlsText.split('\n').filter(url => url.trim());
    
    if (profileUrls.length === 0) {
        showError('multipleError', 'Please enter at least one profile URL');
        return;
    }
    
    if (profileUrls.length > 20) {
        showError('multipleError', 'Maximum 20 profiles can be processed at once');
        return;
    }
    
    const options = {
        paperSize: document.getElementById('paperSize').value,
        columns: parseInt(document.getElementById('columns').value),
        rows: parseInt(document.getElementById('rows').value),
    };
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    btnLoading.style.display = 'inline-flex';
    btnLoading.innerHTML = '<span class="spinner"></span> Generating multiple name tags...';
    
    try {
        const response = await fetch(`${API_BASE}/generate-multiple`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ profileUrls, options }),
        });
        
        if (response.ok) {
            const blob = await response.blob();
            
            // Check for warnings about invalid URLs
            const invalidUrls = response.headers.get('X-Invalid-URLs');
            if (invalidUrls) {
                const invalid = JSON.parse(invalidUrls);
                showSuccess('multipleSuccess', 
                    `Generated name tags successfully! (${invalid.length} invalid URLs were skipped)`
                );
            } else {
                showSuccess('multipleSuccess', 'All name tags generated successfully!');
            }
            
            downloadPDF(blob, 'nametags-multiple.pdf');
            form.reset();
        } else {
            const error = await response.json();
            throw new Error(error.error.message || 'Failed to generate name tags');
        }
    } catch (error) {
        showError('multipleError', error.message);
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.style.display = 'inline';
        btnLoading.style.display = 'none';
    }
});

// URL validation helper
const validateProfileUrl = (url) => {
    const patterns = [
        /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]{1,15}$/,
        /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]{1,15}\/status\/\d+$/
    ];
    
    return patterns.some(pattern => pattern.test(url));
};

// Add real-time URL validation
document.getElementById('profileUrl').addEventListener('input', (e) => {
    const url = e.target.value.trim();
    if (url && !validateProfileUrl(url)) {
        e.target.setCustomValidity('Please enter a valid X profile URL (e.g., https://x.com/username)');
    } else {
        e.target.setCustomValidity('');
    }
});

// Add real-time validation for multiple URLs
document.getElementById('profileUrls').addEventListener('input', (e) => {
    const urls = e.target.value.split('\n').filter(url => url.trim());
    const invalidUrls = urls.filter(url => url && !validateProfileUrl(url));
    
    if (invalidUrls.length > 0) {
        e.target.setCustomValidity(`${invalidUrls.length} invalid URL(s) detected`);
    } else {
        e.target.setCustomValidity('');
    }
});

// Auto-adjust textarea height
const textarea = document.getElementById('profileUrls');
textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
});

// Load API options on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch(`${API_BASE}/options`);
        if (response.ok) {
            const options = await response.json();
            console.log('API Options loaded:', options);
        }
    } catch (error) {
        console.error('Failed to load API options:', error);
    }
});