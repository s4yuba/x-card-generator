import PDFDocument from 'pdfkit';

// Type definition for PDFKit document
type PDFDocumentInstance = InstanceType<typeof PDFDocument>;
import { Readable } from 'stream';
import { XProfile, NameTagTemplate } from '../types';
import { NameTagService } from './NameTagService';

export interface PDFOptions {
  quality: 'low' | 'medium' | 'high';
  pageSize: 'A4' | 'Letter' | 'Legal';
  orientation: 'portrait' | 'landscape';
  margin: number;
  nameTagsPerPage: number;
}

export interface PDFGenerationResult {
  pdfBuffer: Buffer;
  nameTagCount: number;
  pageCount: number;
  memoryUsage: number;
}

export class PDFService {
  private nameTagService: NameTagService;
  private readonly maxMemoryUsage = 100 * 1024 * 1024; // 100MB limit

  constructor() {
    this.nameTagService = new NameTagService();
  }

  /**
   * Generate PDF with a single name tag
   */
  async generateSingleNameTagPDF(
    profile: XProfile,
    template: NameTagTemplate,
    options: Partial<PDFOptions> = {}
  ): Promise<PDFGenerationResult> {
    const pdfOptions = this.getDefaultPDFOptions(options);
    
    try {
      // Generate name tag image
      const nameTagBuffer = await this.nameTagService.generateNameTag(profile, template);
      
      // Create PDF document
      const doc = new PDFDocument({
        size: pdfOptions.pageSize,
        margin: pdfOptions.margin,
        info: {
          Title: `Name Tag - ${profile.displayName}`,
          Author: 'X Profile Name Tag Generator',
          Subject: 'Generated Name Tag',
          Keywords: 'name tag, profile, x, twitter'
        }
      });

      // Convert PDF to buffer
      const pdfBuffer = await this.convertPDFToBuffer(doc, async (doc) => {
        await this.addNameTagToPage(doc, nameTagBuffer, template, pdfOptions);
      });

      const memoryUsage = this.estimateMemoryUsage(pdfBuffer.length, 1);
      
      return {
        pdfBuffer,
        nameTagCount: 1,
        pageCount: 1,
        memoryUsage
      };
    } catch (error) {
      throw new Error(`Failed to generate single name tag PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate PDF with multiple name tags
   */
  async generateMultipleNameTagsPDF(
    profiles: XProfile[],
    template: NameTagTemplate,
    options: Partial<PDFOptions> = {}
  ): Promise<PDFGenerationResult> {
    const pdfOptions = this.getDefaultPDFOptions(options);
    
    if (profiles.length === 0) {
      throw new Error('No profiles provided for PDF generation');
    }

    try {
      // Generate all name tag images
      const nameTagBuffers = await Promise.all(
        profiles.map(profile => this.nameTagService.generateNameTag(profile, template))
      );

      // Create PDF document
      const doc = new PDFDocument({
        size: pdfOptions.pageSize,
        margin: pdfOptions.margin,
        info: {
          Title: `Name Tags - ${profiles.length} profiles`,
          Author: 'X Profile Name Tag Generator',
          Subject: 'Generated Name Tags',
          Keywords: 'name tag, profile, x, twitter'
        }
      });

      // Convert PDF to buffer
      const pdfBuffer = await this.convertPDFToBuffer(doc, async (doc) => {
        await this.addMultipleNameTagsToPages(doc, nameTagBuffers, template, pdfOptions);
      });

      const pageCount = Math.ceil(profiles.length / pdfOptions.nameTagsPerPage);
      const memoryUsage = this.estimateMemoryUsage(pdfBuffer.length, profiles.length);
      
      // Check memory usage
      if (memoryUsage > this.maxMemoryUsage) {
        throw new Error(`Memory usage exceeds limit: ${memoryUsage} bytes`);
      }

      return {
        pdfBuffer,
        nameTagCount: profiles.length,
        pageCount,
        memoryUsage
      };
    } catch (error) {
      throw new Error(`Failed to generate multiple name tags PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default PDF options with overrides
   */
  private getDefaultPDFOptions(options: Partial<PDFOptions>): PDFOptions {
    return {
      quality: 'medium',
      pageSize: 'A4',
      orientation: 'portrait',
      margin: 50,
      nameTagsPerPage: 6,
      ...options
    };
  }

  /**
   * Convert PDF document to buffer
   */
  private async convertPDFToBuffer(
    doc: PDFDocumentInstance,
    contentCallback: (doc: PDFDocumentInstance) => Promise<void>
  ): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const buffers: Buffer[] = [];
      
      doc.on('data', (chunk: any) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      try {
        await contentCallback(doc);
        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Add single name tag to PDF page
   */
  private async addNameTagToPage(
    doc: any,
    nameTagBuffer: Buffer,
    template: NameTagTemplate,
    options: PDFOptions
  ): Promise<void> {
    // Calculate position to center the name tag
    const pageWidth = doc.page.width;
    const pageHeight = doc.page.height;
    const nameTagWidth = template.dimensions.width;
    const nameTagHeight = template.dimensions.height;
    
    const x = (pageWidth - nameTagWidth) / 2;
    const y = (pageHeight - nameTagHeight) / 2;

    // Add name tag image to PDF
    doc.image(nameTagBuffer, x, y, {
      width: nameTagWidth,
      height: nameTagHeight
    });
  }

  /**
   * Add multiple name tags to PDF pages
   */
  private async addMultipleNameTagsToPages(
    doc: any,
    nameTagBuffers: Buffer[],
    template: NameTagTemplate,
    options: PDFOptions
  ): Promise<void> {
    const { nameTagsPerPage } = options;
    const nameTagWidth = template.dimensions.width;
    const nameTagHeight = template.dimensions.height;
    
    // Calculate layout
    const cols = Math.min(2, Math.floor(doc.page.width / (nameTagWidth + 20)));
    const rows = Math.ceil(nameTagsPerPage / cols);
    
    const startX = (doc.page.width - (cols * nameTagWidth + (cols - 1) * 20)) / 2;
    const startY = (doc.page.height - (rows * nameTagHeight + (rows - 1) * 20)) / 2;

    let currentPage = 0;
    
    for (let i = 0; i < nameTagBuffers.length; i++) {
      const positionOnPage = i % nameTagsPerPage;
      
      // Add new page if needed
      if (i > 0 && positionOnPage === 0) {
        doc.addPage();
        currentPage++;
      }
      
      // Calculate position on current page
      const col = positionOnPage % cols;
      const row = Math.floor(positionOnPage / cols);
      
      const x = startX + col * (nameTagWidth + 20);
      const y = startY + row * (nameTagHeight + 20);
      
      // Add name tag image
      doc.image(nameTagBuffers[i], x, y, {
        width: nameTagWidth,
        height: nameTagHeight
      });
    }
  }

  /**
   * Estimate memory usage for PDF generation
   */
  private estimateMemoryUsage(pdfSize: number, nameTagCount: number): number {
    // More accurate estimation based on typical resource usage:
    // - Each name tag image: ~50-200KB depending on complexity
    // - PDF structure overhead: ~10KB per page
    // - Image compression in PDF: reduces size by ~30%
    // - Processing buffers: ~2x the raw image size during generation
    
    const avgNameTagSize = 150 * 1024; // 150KB average per name tag
    const pdfOverheadPerPage = 10 * 1024; // 10KB per page
    const compressionRatio = 0.7; // 30% compression
    const processingMultiplier = 2; // 2x memory during processing
    
    const totalImageSize = nameTagCount * avgNameTagSize;
    const pdfStructureSize = Math.ceil(nameTagCount / 6) * pdfOverheadPerPage; // 6 tags per page
    const compressedSize = totalImageSize * compressionRatio;
    const processingOverhead = compressedSize * processingMultiplier;
    
    return Math.ceil(pdfSize + compressedSize + pdfStructureSize + processingOverhead);
  }

  /**
   * Validate PDF generation parameters
   */
  validatePDFOptions(options: PDFOptions): boolean {
    if (!['low', 'medium', 'high'].includes(options.quality)) {
      return false;
    }
    
    if (!['A4', 'Letter', 'Legal'].includes(options.pageSize)) {
      return false;
    }
    
    if (!['portrait', 'landscape'].includes(options.orientation)) {
      return false;
    }
    
    if (options.margin < 0 || options.margin > 100) {
      return false;
    }
    
    if (options.nameTagsPerPage < 1 || options.nameTagsPerPage > 20) {
      return false;
    }
    
    return true;
  }
}