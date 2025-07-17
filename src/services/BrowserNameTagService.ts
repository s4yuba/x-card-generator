import { XProfile, NameTagTemplate } from '../types';

export class BrowserNameTagService {
  private static instance: BrowserNameTagService;

  public static getInstance(): BrowserNameTagService {
    if (!BrowserNameTagService.instance) {
      BrowserNameTagService.instance = new BrowserNameTagService();
    }
    return BrowserNameTagService.instance;
  }

  private constructor() {}

  /**
   * Generate a name tag using Canvas API for browser environment
   */
  async generateNameTag(profile: XProfile, template?: NameTagTemplate): Promise<HTMLCanvasElement> {
    // Create canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size (standard name tag size in pixels)
    canvas.width = 400;
    canvas.height = 250;
    
    // Fill background
    ctx.fillStyle = template?.styles?.backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw border
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    
    // Load and draw avatar
    try {
      const avatarImg = new Image();
      avatarImg.crossOrigin = 'anonymous';
      
      await new Promise((resolve, reject) => {
        avatarImg.onload = resolve;
        avatarImg.onerror = reject;
        avatarImg.src = profile.avatarUrl;
      });
      
      // Draw circular avatar
      const avatarSize = 80;
      const avatarX = canvas.width / 2;
      const avatarY = 60;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(avatarImg, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
      ctx.restore();
    } catch (error) {
      console.error('Failed to load avatar:', error);
      // Draw placeholder circle
      ctx.fillStyle = '#e0e0e0';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 60, 40, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Draw display name
    ctx.fillStyle = template?.styles?.textColor || '#000000';
    ctx.font = `bold ${template?.styles?.nameFontSize || 24}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText(profile.displayName, canvas.width / 2, 130);
    
    // Draw username
    ctx.fillStyle = '#666666';
    ctx.font = '18px Arial';
    ctx.fillText(`@${profile.username}`, canvas.width / 2, 155);
    
    // Draw verified badge if applicable
    if (profile.verified) {
      ctx.fillStyle = '#1da1f2';
      ctx.font = '16px Arial';
      ctx.fillText('✓ Verified', canvas.width / 2, 180);
    }
    
    // Draw follower count
    if (profile.followerCount) {
      ctx.fillStyle = '#666666';
      ctx.font = '14px Arial';
      const followersText = `${profile.followerCount} followers`;
      ctx.fillText(followersText, canvas.width / 2, 210);
    }
    
    return canvas;
  }
}