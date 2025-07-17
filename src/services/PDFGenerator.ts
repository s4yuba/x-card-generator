/**
 * PDF Generator service for creating printable name tag PDFs
 * Uses PDFKit to generate high-quality, print-ready documents
 */

import PDFDocument from 'pdfkit';
import { ProfileData } from '../types';

export interface PDFGeneratorOptions {
  width?: number;
  height?: number;
  margins?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  fonts?: {
    displayName: {
      size: number;
      family: string;
    };
    username: {
      size: number;
      family: string;
    };
  };
  colors?: {
    background: string;
    text: string;
    accent: string;
  };
}

export interface NameTagContent {
  profileData: ProfileData;
  profileImageBuffer: Buffer;
  qrCodeBuffer: Buffer;
}

type RequiredPDFGeneratorOptions = {
  width: number;
  height: number;
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  fonts: {
    displayName: {
      size: number;
      family: string;
    };
    username: {
      size: number;
      family: string;
    };
  };
  colors: {
    background: string;
    text: string;
    accent: string;
  };
};

export class PDFGenerator {
  private options: RequiredPDFGeneratorOptions;

  constructor(options: PDFGeneratorOptions = {}) {
    // Standard name tag size: 3.5" x 2.25" (converted to points: 72 points = 1 inch)
    this.options = {
      width: options.width || 252, // 3.5 inches
      height: options.height || 162, // 2.25 inches
      margins: options.margins || {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10
      },
      fonts: options.fonts || {
        displayName: {
          size: 24,
          family: 'Helvetica-Bold'
        },
        username: {
          size: 16,
          family: 'Helvetica'
        }
      },
      colors: options.colors || {
        background: '#FFFFFF',
        text: '#000000',
        accent: '#1DA1F2' // X (Twitter) blue
      }
    };
  }

  /**
   * Generate a complete name tag PDF with front and back sides
   * @param content The content for the name tag
   * @returns Promise<Buffer> The PDF buffer
   */
  async generateNameTag(content: NameTagContent): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [this.options.width, this.options.height],
          margins: this.options.margins,
          info: {
            Title: `Name Tag - ${content.profileData.displayName}`,
            Author: 'X Profile Name Tag Generator',
            Subject: 'Professional Name Tag',
            Keywords: 'name tag, X, Twitter, profile'
          }
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Generate front side
        this.generateFrontSide(doc, content);

        // Add new page for back side
        doc.addPage();

        // Generate back side
        this.generateBackSide(doc, content);

        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate the front side of the name tag
   * @param doc The PDF document
   * @param content The content for the name tag
   */
  private generateFrontSide(doc: PDFKit.PDFDocument, content: NameTagContent): void {
    const { profileData, profileImageBuffer } = content;
    const { width, height, margins, colors, fonts } = this.options;

    // Fill background
    doc.rect(0, 0, width, height)
       .fill(colors.background);

    // Calculate content area
    const contentWidth = width - margins.left - margins.right;
    const contentHeight = height - margins.top - margins.bottom;

    // Profile image size and position
    const imageSize = Math.min(contentWidth * 0.35, 80); // Max 80 points
    const imageCenterX = margins.left + contentWidth / 2;
    const imageY = margins.top + 10;

    // Draw profile image (circular)
    try {
      doc.save();
      doc.circle(imageCenterX, imageY + imageSize / 2, imageSize / 2);
      doc.clip();
      doc.image(profileImageBuffer, imageCenterX - imageSize / 2, imageY, {
        width: imageSize,
        height: imageSize
      });
      doc.restore();
    } catch (error) {
      console.error('Error drawing profile image:', error);
      // Draw placeholder circle if image fails
      doc.circle(imageCenterX, imageY + imageSize / 2, imageSize / 2)
         .fill('#E1E8ED');
    }

    // Display name
    const nameY = imageY + imageSize + 15;
    doc.fillColor(colors.text)
       .font(fonts.displayName.family)
       .fontSize(fonts.displayName.size)
       .text(profileData.displayName, margins.left, nameY, {
         width: contentWidth,
         align: 'center'
       });

    // Username
    const usernameY = nameY + fonts.displayName.size + 5;
    doc.fillColor(colors.accent)
       .font(fonts.username.family)
       .fontSize(fonts.username.size)
       .text(`@${profileData.username}`, margins.left, usernameY, {
         width: contentWidth,
         align: 'center'
       });

    // Optional: Add decorative element or border
    this.addDecorativeBorder(doc);
  }

  /**
   * Generate the back side of the name tag with QR code
   * @param doc The PDF document
   * @param content The content for the name tag
   */
  private generateBackSide(doc: PDFKit.PDFDocument, content: NameTagContent): void {
    const { qrCodeBuffer, profileData } = content;
    const { width, height, margins, colors } = this.options;

    // Fill background
    doc.rect(0, 0, width, height)
       .fill(colors.background);

    // Calculate QR code size and position
    const maxQRSize = Math.min(width, height) * 0.6;
    const qrSize = Math.min(maxQRSize, 100); // Max 100 points for QR code
    const qrX = (width - qrSize) / 2;
    const qrY = (height - qrSize) / 2 - 10;

    // Draw QR code
    try {
      doc.image(qrCodeBuffer, qrX, qrY, {
        width: qrSize,
        height: qrSize
      });
    } catch (error) {
      console.error('Error drawing QR code:', error);
      // Draw placeholder square if QR code fails
      doc.rect(qrX, qrY, qrSize, qrSize)
         .fill('#E1E8ED');
    }

    // Add text below QR code
    const textY = qrY + qrSize + 10;
    doc.fillColor(colors.text)
       .font('Helvetica')
       .fontSize(10)
       .text('Scan to view profile', margins.left, textY, {
         width: width - margins.left - margins.right,
         align: 'center'
       });

    // Add username at bottom
    doc.fillColor(colors.accent)
       .fontSize(8)
       .text(`x.com/${profileData.username}`, margins.left, height - margins.bottom - 15, {
         width: width - margins.left - margins.right,
         align: 'center'
       });
  }

  /**
   * Add decorative border to the name tag
   * @param doc The PDF document
   */
  private addDecorativeBorder(doc: PDFKit.PDFDocument): void {
    const { width, height, colors } = this.options;
    const borderWidth = 2;
    const cornerRadius = 5;

    doc.save();
    doc.lineWidth(borderWidth);
    doc.strokeColor(colors.accent);
    doc.roundedRect(
      borderWidth / 2,
      borderWidth / 2,
      width - borderWidth,
      height - borderWidth,
      cornerRadius
    );
    doc.stroke();
    doc.restore();
  }

  /**
   * Generate a simple name tag (front only)
   * @param content The content for the name tag
   * @returns Promise<Buffer> The PDF buffer
   */
  async generateSimpleNameTag(content: Omit<NameTagContent, 'qrCodeBuffer'>): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [this.options.width, this.options.height],
          margins: this.options.margins
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        // Generate only front side
        this.generateFrontSide(doc, { ...content, qrCodeBuffer: Buffer.alloc(0) });

        // Finalize the PDF
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate multiple name tags on a single page
   * @param contents Array of name tag contents
   * @param options Layout options
   * @returns Promise<Buffer> The PDF buffer
   */
  async generateMultipleNameTags(
    contents: NameTagContent[],
    options: {
      paperSize?: 'LETTER' | 'A4';
      columns?: number;
      rows?: number;
      spacing?: number;
    } = {}
  ): Promise<Buffer> {
    const paperSizes = {
      LETTER: { width: 612, height: 792 }, // 8.5" x 11"
      A4: { width: 595, height: 842 }
    };

    const paperSize = paperSizes[options.paperSize || 'LETTER'];
    const columns = options.columns || 2;
    const rows = options.rows || 4;
    const spacing = options.spacing || 10;

    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: [paperSize.width, paperSize.height],
          margins: { top: 36, bottom: 36, left: 36, right: 36 } // 0.5" margins
        });

        const chunks: Buffer[] = [];
        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        const tagWidth = this.options.width;
        const tagHeight = this.options.height;
        const pageWidth = paperSize.width - 72; // Account for margins
        const pageHeight = paperSize.height - 72;

        // Calculate actual spacing to fit tags evenly
        const horizontalSpace = (pageWidth - (columns * tagWidth)) / (columns - 1);
        const verticalSpace = (pageHeight - (rows * tagHeight)) / (rows - 1);

        let contentIndex = 0;
        let currentPage = 0;

        while (contentIndex < contents.length) {
          if (currentPage > 0) {
            doc.addPage();
          }

          for (let row = 0; row < rows && contentIndex < contents.length; row++) {
            for (let col = 0; col < columns && contentIndex < contents.length; col++) {
              const x = 36 + col * (tagWidth + horizontalSpace);
              const y = 36 + row * (tagHeight + verticalSpace);

              // Save current state
              doc.save();

              // Translate to tag position
              doc.translate(x, y);

              // Create a clipping region for this tag
              doc.rect(0, 0, tagWidth, tagHeight).clip();

              // Generate the name tag at (0, 0) since we've translated
              this.generateNameTagAt(doc, contents[contentIndex], 0, 0);

              // Restore state
              doc.restore();

              contentIndex++;
            }
          }

          currentPage++;
        }

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Generate a name tag at specific coordinates
   * @param doc The PDF document
   * @param content The content for the name tag
   * @param x X coordinate
   * @param y Y coordinate
   */
  private generateNameTagAt(
    doc: PDFKit.PDFDocument,
    content: NameTagContent,
    x: number,
    y: number
  ): void {
    // Temporarily adjust options to use relative coordinates
    const originalMargins = { ...this.options.margins };
    this.options.margins = {
      top: 10,
      bottom: 10,
      left: 10,
      right: 10
    };

    // Generate front side at the specified position
    this.generateFrontSide(doc, content);

    // Restore original margins
    this.options.margins = originalMargins;
  }
}