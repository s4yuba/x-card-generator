import { XProfile, NameTagTemplate } from '../types';
import * as qrcode from 'qrcode';
import sharp from 'sharp';

export class NameTagService {
  /**
   * Generate a name tag image buffer from profile data and template
   */
  async generateNameTag(profile: XProfile, template: NameTagTemplate): Promise<Buffer> {
    // Validate inputs
    this.validateProfileData(profile);
    
    if (!this.validateTemplate(template)) {
      throw new Error('Invalid template: template validation failed');
    }

    try {
      // Generate QR code
      const qrCodeBuffer = await this.generateQRCode(profile.profileUrl, template);

      // Process avatar image if available
      const avatarBuffer = await this.processAvatarImage(profile.avatarUrl, template);

      // Create base canvas
      const canvas = this.createBaseCanvas(template);

      // Generate SVG for text content
      const textSvg = this.generateTextSvg(profile, template);
      
      // Prepare composite layers
      const compositeLayers = [
        {
          input: Buffer.from(textSvg),
          top: 0,
          left: 0
        },
        {
          input: qrCodeBuffer,
          top: template.layout.qrCodePosition.y,
          left: template.layout.qrCodePosition.x
        }
      ];

      // Add avatar if available
      if (avatarBuffer) {
        compositeLayers.push({
          input: avatarBuffer,
          top: template.layout.avatarPosition.y,
          left: template.layout.avatarPosition.x
        });
      }

      // Composite the final image
      const composite = await canvas
        .composite(compositeLayers)
        .png()
        .toBuffer();

      return composite;
    } catch (error) {
      throw new Error(`Failed to generate name tag: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate name tag with custom style overrides
   */
  async generateWithCustomizations(
    profile: XProfile,
    template: NameTagTemplate,
    customizations: Partial<NameTagTemplate['styles']>
  ): Promise<Buffer> {
    const customTemplate = {
      ...template,
      styles: {
        ...template.styles,
        ...customizations
      }
    };

    return this.generateNameTag(profile, customTemplate);
  }

  /**
   * Validate template structure and required fields
   */
  validateTemplate(template: NameTagTemplate): boolean {
    if (!template || !template.id || !template.name) {
      return false;
    }

    if (!template.dimensions || template.dimensions.width <= 0 || template.dimensions.height <= 0) {
      return false;
    }

    if (!template.layout || !template.layout.avatarPosition || !template.layout.namePosition || 
        !template.layout.usernamePosition || !template.layout.qrCodePosition) {
      return false;
    }

    if (!template.styles || !template.styles.backgroundColor || !template.styles.textColor) {
      return false;
    }

    return true;
  }

  /**
   * Get default template configuration
   */
  getDefaultTemplate(): NameTagTemplate {
    return {
      id: 'default',
      name: 'Default Template',
      dimensions: {
        width: 300,
        height: 200
      },
      layout: {
        avatarPosition: { x: 20, y: 20 },
        avatarSize: 60,
        namePosition: { x: 100, y: 40, align: 'left' },
        usernamePosition: { x: 100, y: 70, align: 'left' },
        qrCodePosition: { x: 210, y: 20 },
        qrCodeSize: 80
      },
      styles: {
        backgroundColor: '#ffffff',
        textColor: '#000000',
        accentColor: '#1da1f2',
        fontFamily: 'Arial, sans-serif',
        nameFontSize: 16,
        usernameFontSize: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#e1e8ed'
      }
    };
  }

  /**
   * Validate profile data
   */
  private validateProfileData(profile: XProfile): void {
    if (!profile.username || !profile.displayName) {
      throw new Error('Invalid profile data: username and displayName are required');
    }
    
    if (!profile.profileUrl) {
      throw new Error('Invalid profile data: profileUrl is required');
    }
  }

  /**
   * Generate QR code for profile URL
   */
  private async generateQRCode(profileUrl: string, template: NameTagTemplate): Promise<Buffer> {
    return qrcode.toBuffer(profileUrl, {
      width: template.layout.qrCodeSize,
      margin: 1,
      color: {
        dark: template.styles.textColor,
        light: template.styles.backgroundColor
      }
    });
  }

  /**
   * Process avatar image from URL
   */
  private async processAvatarImage(avatarUrl: string, template: NameTagTemplate): Promise<Buffer | null> {
    if (!avatarUrl) {
      return null;
    }

    try {
      // Validate URL
      const url = new URL(avatarUrl);
      
      // Security check: Only allow HTTPS URLs from trusted domains
      if (url.protocol !== 'https:') {
        throw new Error('Only HTTPS URLs are allowed for avatar images');
      }
      
      // Whitelist of allowed image domains (Twitter/X CDNs)
      const allowedDomains = ['pbs.twimg.com', 'abs.twimg.com'];
      if (!allowedDomains.includes(url.hostname)) {
        throw new Error(`Avatar domain not allowed: ${url.hostname}`);
      }

      // Fetch the image with timeout
      const response = await fetch(avatarUrl, {
        signal: AbortSignal.timeout(5000), // 5 second timeout
        headers: {
          'User-Agent': 'X-Card-Generator/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch avatar: ${response.status}`);
      }

      // Validate content type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.startsWith('image/')) {
        throw new Error('Invalid content type for avatar image');
      }

      // Get image buffer
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Process and resize the image
      const processedAvatar = await sharp(buffer)
        .resize(template.dimensions.avatarSize, template.dimensions.avatarSize, {
          fit: 'cover',
          position: 'centre'
        })
        .png()
        .toBuffer();

      return processedAvatar;
    } catch (error) {
      // If avatar processing fails, we continue without the avatar
      console.warn('Failed to process avatar image:', error);
      return null;
    }
  }

  /**
   * Create base canvas for the name tag
   */
  private createBaseCanvas(template: NameTagTemplate) {
    return sharp({
      create: {
        width: template.dimensions.width,
        height: template.dimensions.height,
        channels: 3,
        background: template.styles.backgroundColor
      }
    });
  }

  /**
   * Generate SVG text content for the name tag
   */
  private generateTextSvg(profile: XProfile, template: NameTagTemplate): string {
    const { styles, layout } = template;
    
    // Improved text handling with word wrapping
    const displayName = this.truncateText(profile.displayName, 20);
    const username = `@${profile.username}`;

    return `
      <svg width="${template.dimensions.width}" height="${template.dimensions.height}" xmlns="http://www.w3.org/2000/svg">
        <text x="${layout.namePosition.x}" y="${layout.namePosition.y}" 
              font-family="${styles.fontFamily}" 
              font-size="${styles.nameFontSize}" 
              font-weight="bold"
              fill="${styles.textColor}"
              text-anchor="${layout.namePosition.align || 'start'}">${displayName}</text>
        <text x="${layout.usernamePosition.x}" y="${layout.usernamePosition.y}" 
              font-family="${styles.fontFamily}" 
              font-size="${styles.usernameFontSize}" 
              fill="${styles.accentColor}"
              text-anchor="${layout.usernamePosition.align || 'start'}">${username}</text>
      </svg>
    `;
  }

  /**
   * Truncate text with ellipsis if it's too long
   * Considers full-width characters for accurate text width calculation
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    // Calculate the visual width of text (full-width chars count as 2)
    const getVisualLength = (str: string): number => {
      let length = 0;
      for (const char of str) {
        // Check if character is full-width (CJK, etc.)
        const code = char.charCodeAt(0);
        if ((code >= 0x1100 && code <= 0x115F) || // Hangul Jamo
            (code >= 0x2E80 && code <= 0x9FFF) || // CJK
            (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
            (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility
            (code >= 0xFE30 && code <= 0xFE4F) || // CJK Compatibility Forms
            (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
            (code >= 0xFFE0 && code <= 0xFFE6)) { // Fullwidth Forms
          length += 2;
        } else {
          length += 1;
        }
      }
      return length;
    };
    
    // Find the cutoff point considering visual width
    let visualLength = 0;
    let cutoffIndex = 0;
    const ellipsisLength = 3; // "..." takes 3 visual units
    
    for (let i = 0; i < text.length; i++) {
      const charVisualLength = getVisualLength(text[i]);
      if (visualLength + charVisualLength + ellipsisLength > maxLength) {
        break;
      }
      visualLength += charVisualLength;
      cutoffIndex = i + 1;
    }
    
    return text.substring(0, cutoffIndex) + '...';
  }
}