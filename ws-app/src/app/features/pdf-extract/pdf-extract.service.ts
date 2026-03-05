import { Injectable } from '@angular/core';
import * as pdfjsLib from 'pdfjs-dist';

export interface FormSection {
  keyword: string;
  width?: number;
  height?: number;
}

interface KeywordCoordinate {
  page: number;
  keyword: string;
  x: number;
  y: number;
}

interface KeywordRegion extends KeywordCoordinate {
  image: string;
}

@Injectable({ providedIn: 'root' })
export class PdfExtractService {
  private readonly WORKER_SRC = '/assets/pdf-js/pdf.worker.min.mjs';
  private readonly RENDER_SCALE = 2;
  private readonly DEFAULT_WIDTH = 300;
  private readonly DEFAULT_HEIGHT = 100;

  /**
   * Reads a PDF, searches for keywords, and returns their x,y coordinates on each page.
   * @param file PDF file to process
   * @param keywords Array of keywords to search for
   * @returns Array of matches with page, keyword, and coordinates
   */
  async findKeywordsCoordinates(file: File, keywords: string[]): Promise<KeywordCoordinate[]> {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_SRC;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const results: KeywordCoordinate[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      for (const item of textContent.items as any[]) {
        if (typeof item.str === 'string') {
          for (const keyword of keywords) {
            if (item.str.includes(keyword)) {
              const [, , , , x, y] = item.transform;
              results.push({ page: pageNum, keyword, x, y });
            }
          }
        }
      }
    }

    return results;
  }

  /**
   * Extracts image regions from a PDF page based on keyword coordinates.
   * @param file PDF file to process
   * @param keywords Array of keywords to search for
   * @param width Width of the region to extract in pixels
   * @param height Height of the region to extract in pixels
   * @returns Array of objects with page, keyword, coordinates, and extracted image
   */
  async extractKeywordRegions(
    file: File,
    keywords: string[],
    width: number = this.DEFAULT_WIDTH,
    height: number = this.DEFAULT_HEIGHT
  ): Promise<KeywordRegion[]> {
    const coords = await this.findKeywordsCoordinates(file, keywords);
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_SRC;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const results: KeywordRegion[] = [];

    for (const coord of coords) {
      const page = await pdf.getPage(coord.page);
      const viewport = page.getViewport({ scale: this.RENDER_SCALE });
      const canvas = await this.createCanvasFromPage(page, viewport);
      const image = this.extractRegionFromCanvas(canvas, coord, width, height, viewport.height);
      results.push({ ...coord, image });
    }

    return results;
  }

  /**
   * Extracts image regions for multiple form sections by loading the PDF only once.
   * @param file PDF file to process
   * @param sections Array of form sections with keywords and optional width/height
   * @returns Array of arrays, one for each section, containing the extracted regions
   */
  async extractKeywordRegionsBatch(
    file: File,
    sections: FormSection[]
  ): Promise<KeywordRegion[][]> {
    // Load PDF once
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_SRC;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    // Find coordinates for all keywords
    const allKeywords = sections.map(s => s.keyword);
    const coords = await this.findKeywordsCoordinatesInPdf(pdf, allKeywords);

    // Group coordinates by section
    const results: KeywordRegion[][] = [];
    
    for (const section of sections) {
      const sectionCoords = coords.filter(c => c.keyword === section.keyword);
      const width = section.width || this.DEFAULT_WIDTH;
      const height = section.height || this.DEFAULT_HEIGHT;
      const sectionRegions: KeywordRegion[] = [];

      for (const coord of sectionCoords) {
        const page = await pdf.getPage(coord.page);
        const viewport = page.getViewport({ scale: this.RENDER_SCALE });
        const canvas = await this.createCanvasFromPage(page, viewport);
        const image = this.extractRegionFromCanvas(canvas, coord, width, height, viewport.height);
        sectionRegions.push({ ...coord, image });
      }

      results.push(sectionRegions);
    }

    return results;
  }

  /**
   * Finds keyword coordinates in an already-loaded PDF document.
   * @param pdf Loaded PDF document
   * @param keywords Array of keywords to search for
   * @returns Array of matches with page, keyword, and coordinates
   */
  private async findKeywordsCoordinatesInPdf(pdf: any, keywords: string[]): Promise<KeywordCoordinate[]> {
    const results: KeywordCoordinate[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      for (const item of textContent.items as any[]) {
        if (typeof item.str === 'string') {
          for (const keyword of keywords) {
            if (item.str.includes(keyword)) {
              const [, , , , x, y] = item.transform;
              results.push({ page: pageNum, keyword, x, y });
            }
          }
        }
      }
    }

    return results;
  }

  private async createCanvasFromPage(
    page: any,
    viewport: any
  ): Promise<HTMLCanvasElement> {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context!, viewport }).promise;
    return canvas;
  }

  private extractRegionFromCanvas(
    canvas: HTMLCanvasElement,
    coord: KeywordCoordinate,
    width: number,
    height: number,
    canvasHeight: number
  ): string {
    const regionCanvas = document.createElement('canvas');
    regionCanvas.width = width;
    regionCanvas.height = height;

    const regionCtx = regionCanvas.getContext('2d')!;
    // Start extraction with reduced left area
    const sx = Math.max(0, coord.x * this.RENDER_SCALE - 60);
    // Reduced top padding - start extraction lower on the page
    const sy = Math.max(0, canvasHeight - coord.y * this.RENDER_SCALE - height / 6 + 25);

    regionCtx.drawImage(canvas, sx, sy, width, height, 0, 0, width, height);
    return regionCanvas.toDataURL('image/png');
  }

  /**
   * Extracts text values that follow keywords in a PDF.
   * @param file PDF file to process
   * @param keywords Keywords to find and extract values after them
   * @returns Object with extracted values keyed by lowercase keyword
   */
  async extractTextFromKeywords(
    file: File,
    keywords: string[]
  ): Promise<{ [key: string]: string | null }> {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_SRC;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const result: { [key: string]: string | null } = {};

    // Initialize result object with null values
    keywords.forEach((kw) => {
      result[this.normalizeKey(kw)] = null;
    });

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const items = textContent.items as any[];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (typeof item.str === 'string') {
          for (const keyword of keywords) {
            if (item.str.includes(keyword) && i + 1 < items.length) {
              // Get the next non-whitespace text item
              let nextValue = '';
              for (let j = i + 1; j < items.length && j < i + 5; j++) {
                const nextItem = items[j];
                if (typeof nextItem.str === 'string' && nextItem.str.trim()) {
                  nextValue = nextItem.str.trim();
                  break;
                }
              }
              if (nextValue) {
                result[this.normalizeKey(keyword)] = nextValue;
              }
            }
          }
        }
      }
    }

    return result;
  }

  /**
   * Extracts QR codes from a PDF by reading raw PDF annotations and barcode data.
   * @param file PDF file to process
   * @returns Array of QR code images with page numbers
   */
  async extractQRCodes(file: File): Promise<Array<{ page: number; image: string; index: number }>> {
    const arrayBuffer = await file.arrayBuffer();
    pdfjsLib.GlobalWorkerOptions.workerSrc = this.WORKER_SRC;
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const results: Array<{ page: number; image: string; index: number }> = [];
    let globalIndex = 1;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: this.RENDER_SCALE });
      const canvas = await this.createCanvasFromPage(page, viewport);
      
      // Get all annotations from the page
      const annotations = await page.getAnnotations();
      
      // Log all annotations to understand structure
      console.log(`Page ${pageNum} annotations:`, annotations);
      
      if (annotations && annotations.length > 0) {
        for (const ann of annotations) {
          // Log each annotation to see what we're working with
          console.log(`Annotation:`, ann);
          
          // Look for barcode-related annotations
          if (this.isBarcodeAnnotation(ann)) {
            const qrImage = await this.extractBarcodeFromAnnotation(ann, canvas, viewport);
            if (qrImage) {
              results.push({
                page: pageNum,
                image: qrImage,
                index: globalIndex++
              });
            }
          }
        }
      }
      
      // Also try pattern detection as fallback
      const detectedQRs = await this.detectQRCodesOnCanvas(canvas, pageNum, globalIndex);
      if (detectedQRs.length > 0) {
        results.push(...detectedQRs);
        globalIndex += detectedQRs.length;
      }
    }

    return results;
  }

  /**
   * Checks if an annotation is a barcode/QR code field
   */
  private isBarcodeAnnotation(annotation: any): boolean {
    const name = annotation.fieldName || annotation.name || '';
    const type = annotation.fieldType || annotation.type || '';
    const subtype = annotation.subtype || '';
    
    // Check for barcode-related keywords
    const isBarcodeKeyword = /barcode|qr|code128|code39|ean|upc|pdf417/i.test(name);
    const isBarcodeType = /barcode|qr|code128|code39|ean|upc|pdf417/i.test(type);
    const isBarcodeSubtype = /barcode|qr|XObject/i.test(subtype);
    
    return isBarcodeKeyword || isBarcodeType || isBarcodeSubtype;
  }

  /**
   * Extracts a barcode image from an annotation
   */
  private async extractBarcodeFromAnnotation(
    annotation: any,
    canvas: HTMLCanvasElement,
    viewport: any
  ): Promise<string | null> {
    try {
      const rect = annotation.rect;
      if (!rect || rect.length < 4) {
        return null;
      }

      const [x1, y1, x2, y2] = rect;
      const x = Math.min(x1, x2) * this.RENDER_SCALE;
      const y = canvas.height - Math.max(y1, y2) * this.RENDER_SCALE;
      const width = Math.abs(x2 - x1) * this.RENDER_SCALE;
      const height = Math.abs(y2 - y1) * this.RENDER_SCALE;

      if (width < 20 || height < 20) {
        return null;
      }

      const qrCanvas = document.createElement('canvas');
      qrCanvas.width = width;
      qrCanvas.height = height;
      const qrCtx = qrCanvas.getContext('2d')!;
      
      qrCtx.drawImage(
        canvas,
        Math.max(0, x),
        Math.max(0, y),
        width,
        height,
        0,
        0,
        width,
        height
      );

      return qrCanvas.toDataURL('image/png');
    } catch (err) {
      console.error('Error extracting barcode from annotation:', err);
      return null;
    }
  }

  /**
   * Detects QR code regions on a canvas by scanning for square regions with dark content.
   */
  private async detectQRCodesOnCanvas(
    canvas: HTMLCanvasElement,
    pageNum: number,
    startIndex: number
  ): Promise<Array<{ page: number; image: string; index: number }>> {
    const ctx = canvas.getContext('2d')!;
    const qrCodes: Array<{ page: number; image: string; index: number }> = [];
    
    // Scan with very aggressive parameters
    const qrSizes = [80, 100, 120, 150, 180, 200, 250, 300, 350, 400, 450, 500, 550, 600];
    const stepSize = 20;  // Very aggressive stepping
    
    const foundRegions: { x: number; y: number; size: number }[] = [];
    
    for (const size of qrSizes) {
      for (let y = 0; y <= canvas.height - size; y += stepSize) {
        for (let x = 0; x <= canvas.width - size; x += stepSize) {
          // Skip if overlapping with already found QR code
          if (foundRegions.some(region => 
            Math.abs(region.x - x) < size && 
            Math.abs(region.y - y) < size)
          ) {
            continue;
          }
          
          try {
            const sampleData = ctx.getImageData(
              Math.max(0, x), 
              Math.max(0, y), 
              Math.min(size, canvas.width - Math.max(0, x)), 
              Math.min(size, canvas.height - Math.max(0, y))
            );
            
            // Look for QR code patterns with relaxed criteria
            if (this.isLikelyQRCode(sampleData)) {
              const qrCanvas = document.createElement('canvas');
              qrCanvas.width = size;
              qrCanvas.height = size;
              const qrCtx = qrCanvas.getContext('2d')!;
              qrCtx.drawImage(canvas, x, y, size, size, 0, 0, size, size);
              
              qrCodes.push({
                page: pageNum,
                image: qrCanvas.toDataURL('image/png'),
                index: startIndex + qrCodes.length
              });
              
              foundRegions.push({ x, y, size });
            }
          } catch (e) {
            // Skip regions that cause errors
            continue;
          }
        }
      }
    }
    
    return qrCodes;
  }

  /**
   * Checks if a region looks like a QR code by analyzing content.
   * Very lenient - just needs some dark pixels and some light pixels.
   */
  private isLikelyQRCode(imageData: ImageData): boolean {
    const { data, width, height } = imageData;
    
    if (width < 20 || height < 20 || data.length === 0) {
      return false;
    }
    
    // Count dark and light pixels
    let darkPixels = 0;
    let lightPixels = 0;
    let totalPixels = 0;
    
    // Sample every pixel for accuracy
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      
      // Skip transparent pixels
      if (a < 100) continue;
      
      const brightness = (r + g + b) / 3;
      totalPixels++;
      
      if (brightness < 130) {
        darkPixels++;
      } else {
        lightPixels++;
      }
    }
    
    if (totalPixels === 0) return false;
    
    const darkRatio = darkPixels / totalPixels;
    
    // QR codes need a mix of dark and light
    // Very lenient: just need between 15-85% dark pixels
    if (darkRatio < 0.15 || darkRatio > 0.85) {
      return false;
    }
    
    // Also check that there's sufficient content (not mostly white/empty)
    const hasContent = (darkPixels + lightPixels) > (totalPixels * 0.7);
    
    return hasContent;
  }

  private normalizeKey(key: string): string {
    return key.toLowerCase().replace(/\s+/g, '');
  }
}
