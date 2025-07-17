import jsPDF from 'jspdf';

export class BrowserPDFService {
  private static instance: BrowserPDFService;

  public static getInstance(): BrowserPDFService {
    if (!BrowserPDFService.instance) {
      BrowserPDFService.instance = new BrowserPDFService();
    }
    return BrowserPDFService.instance;
  }

  private constructor() {}

  /**
   * Generate PDF from canvases using jsPDF for browser environment
   */
  async generatePDF(canvases: HTMLCanvasElement[]): Promise<Blob> {
    // Create new PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });
    
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 20;
    
    // Calculate layout
    const nameTagWidth = 85; // mm (standard name tag width)
    const nameTagHeight = 54; // mm (standard name tag height)
    const spacing = 10; // mm
    
    const itemsPerRow = Math.floor((pageWidth - 2 * margin) / (nameTagWidth + spacing));
    const itemsPerColumn = Math.floor((pageHeight - 2 * margin) / (nameTagHeight + spacing));
    const itemsPerPage = itemsPerRow * itemsPerColumn;
    
    let currentPage = 0;
    let currentPosition = 0;
    
    for (let i = 0; i < canvases.length; i++) {
      const canvas = canvases[i];
      
      // Calculate position on page
      const pageIndex = Math.floor(currentPosition / itemsPerPage);
      const positionOnPage = currentPosition % itemsPerPage;
      const row = Math.floor(positionOnPage / itemsPerRow);
      const col = positionOnPage % itemsPerRow;
      
      const x = margin + col * (nameTagWidth + spacing);
      const y = margin + row * (nameTagHeight + spacing);
      
      // Add new page if needed
      if (pageIndex > currentPage) {
        pdf.addPage();
        currentPage = pageIndex;
      }
      
      // Convert canvas to data URL
      const imgData = canvas.toDataURL('image/png');
      
      // Add image to PDF
      pdf.addImage(imgData, 'PNG', x, y, nameTagWidth, nameTagHeight);
      
      currentPosition++;
    }
    
    // Return as blob
    return pdf.output('blob');
  }
}