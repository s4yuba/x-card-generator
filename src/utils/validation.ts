import { XProfile, NameTagTemplate, AppSettings, APIError, ErrorCode } from '../types';

// URL Validation
export function isValidXProfileUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    const pathname = urlObj.pathname;
    
    // Only allow HTTPS for security
    if (urlObj.protocol !== 'https:') {
      return false;
    }
    
    // Check if it's X.com or Twitter.com
    if (hostname !== 'x.com' && hostname !== 'twitter.com' && hostname !== 'www.x.com' && hostname !== 'www.twitter.com') {
      return false;
    }
    
    // Check if it's a profile URL (has username in path)
    const pathParts = pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length === 0 || pathParts.length > 2) {
      return false;
    }
    
    // Username should not be a reserved path
    const reservedPaths = ['home', 'explore', 'notifications', 'messages', 'bookmarks', 'lists', 'settings', 'help'];
    if (reservedPaths.includes(pathParts[0].toLowerCase())) {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}

export function extractUsernameFromUrl(url: string): string | null {
  if (!isValidXProfileUrl(url)) {
    return null;
  }

  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(part => part.length > 0);
    return pathParts[0] || null;
  } catch {
    return null;
  }
}

// Profile Validation
export function validateXProfile(data: any): XProfile | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  
  const required = ['username', 'displayName', 'avatarUrl', 'profileUrl'];
  for (const field of required) {
    if (!data[field] || typeof data[field] !== 'string') {
      return null;
    }
  }
  
  return {
    username: data.username.trim(),
    displayName: data.displayName.trim(),
    bio: data.bio?.trim() || undefined,
    avatarUrl: data.avatarUrl,
    profileUrl: data.profileUrl,
    verified: Boolean(data.verified),
    followerCount: data.followerCount?.toString() || '0',
    followingCount: data.followingCount?.toString() || '0',
    extractedAt: data.extractedAt ? new Date(data.extractedAt) : new Date()
  };
}

// Template Validation
export function validateNameTagTemplate(data: any): NameTagTemplate | null {
  if (!data || typeof data !== 'object') {
    return null;
  }
  
  const required = ['id', 'name', 'dimensions', 'layout', 'styles'];
  for (const field of required) {
    if (!data[field]) {
      return null;
    }
  }
  
  // Validate dimensions
  if (!data.dimensions.width || !data.dimensions.height ||
      data.dimensions.width <= 0 || data.dimensions.height <= 0) {
    return null;
  }
  
  return data as NameTagTemplate;
}

// Settings Validation
export function validateAppSettings(data: any): AppSettings {
  const defaults: AppSettings = {
    autoDownload: true,
    downloadFormat: 'pdf',
    pdfQuality: 'high',
    defaultTemplate: 'standard',
    recentProfiles: [],
    maxRecentProfiles: 10
  };
  
  if (!data || typeof data !== 'object') {
    return defaults;
  }
  
  return {
    autoDownload: typeof data.autoDownload === 'boolean' ? data.autoDownload : defaults.autoDownload,
    downloadFormat: ['pdf', 'png'].includes(data.downloadFormat) ? data.downloadFormat : defaults.downloadFormat,
    pdfQuality: ['low', 'medium', 'high'].includes(data.pdfQuality) ? data.pdfQuality : defaults.pdfQuality,
    defaultTemplate: data.defaultTemplate || defaults.defaultTemplate,
    recentProfiles: Array.isArray(data.recentProfiles) ? data.recentProfiles.slice(0, 50) : defaults.recentProfiles,
    maxRecentProfiles: typeof data.maxRecentProfiles === 'number' ? Math.min(50, Math.max(0, data.maxRecentProfiles)) : defaults.maxRecentProfiles
  };
}

// Error Validation
export function createAPIError(
  code: ErrorCode,
  message: string,
  details?: any,
  recoverable: boolean = true
): APIError {
  return {
    code,
    message,
    details,
    timestamp: new Date(),
    recoverable
  };
}