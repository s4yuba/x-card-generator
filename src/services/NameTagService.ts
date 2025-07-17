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
      // In a real implementation, you would fetch the image from the URL
      // For now, we'll return null to indicate no avatar processing
      // TODO: Implement actual image fetching and processing
      return null;
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
   */
  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    
    return text.substring(0, maxLength - 3) + '...';
  }
}