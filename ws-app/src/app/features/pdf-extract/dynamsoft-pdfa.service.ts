import { Injectable } from '@angular/core';
import Dynamsoft from 'dwt';
import { environment } from '../../../environments/environment';

/**
 * Wrapper service for Dynamsoft PDF/A-2 creation in Angular.
 * Replace placeholder calls with actual Dynamsoft SDK API methods.
 */
@Injectable({ providedIn: 'root' })
export class DynamsoftPdfAService {
  // --- Fields ---
  private sdk: typeof Dynamsoft | null = null;
  private webTwain: any = null;
  private pdfDoc: any = null;

  // --- Initialization ---
  async initialize(): Promise<void> {
    this.sdk = Dynamsoft;
    if (!this.sdk) {
      throw new Error('Dynamsoft PDF SDK not loaded');
    }
    if (!this.webTwain) {
      await new Promise<void>((resolve, reject) => {
        if (!this.sdk || !this.sdk.DWT) {
          reject('Dynamsoft DWT not available');
          return;
        }
        this.sdk.DWT.RegisterEvent('OnWebTwainReady', () => {
          this.webTwain = this.sdk && this.sdk.DWT
            ? this.sdk.DWT.GetWebTwain('dwtcontrolContainer')
            : null;
          if (this.webTwain) {
            resolve();
          } else {
            reject('WebTwain instance not found');
          }
        });
        this.sdk.DWT.ProductKey = environment.dynamsoftProductKey;
        this.sdk.DWT.Containers = [
          { ContainerId: 'dwtcontrolContainer', Width: 0, Height: 0 },
        ];
        this.sdk.DWT.Load();
      });
    }
  }

  // --- Document Management ---
  async createPdfA2(): Promise<void> {
    if (!this.webTwain) await this.initialize();
    if (typeof this.webTwain.RemoveAllImages === 'function') {
      try {
        this.webTwain.RemoveAllImages();
      } catch {}
    }
    this.pdfDoc = this.webTwain;
  }

  // --- Image Addition ---
  /**
  * Add one or more PNG images (base64 strings) to the PDF/A-2 document.
  * @param images Array of base64 PNG strings (no data URL prefix)
  */
  async addImages(images: string[]): Promise<void> {
    if (!this.pdfDoc) await this.createPdfA2();
    if (!this.webTwain) throw new Error('WebTwain not initialized');
    for (const base64String of images) {
      if (typeof this.webTwain.LoadImageFromBase64Binary === 'function') {
        await new Promise<void>((resolve, reject) => {
          this.webTwain.LoadImageFromBase64Binary(
            base64String,
            Dynamsoft.DWT.EnumDWT_ImageType,
            () => resolve(),
            (errorCode: number, errorString: string) => reject(new Error('Failed to add image: ' + errorString + ' (code ' + errorCode + ')'))
          );
        });
      } else {
        throw new Error('WebTwain.LoadImageFromBase64Binary method not available');
      }
    }
  }

  /**
   * Loads a PDF file, extracts all pages as PNG images, reverses order, and adds to PDF/A-2.
   */
  async addPdfPagesAsImagesReverse(pdfFile: File): Promise<void> {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/assets/pdf.worker.min.mjs';
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const pageImages: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      pageImages.push(canvas.toDataURL('image/png'));
    }
    await this.createPdfA2();
    for (const dataUrl of pageImages.reverse()) {
      const base64Match = dataUrl.match(/^data:image\/png;base64,(.+)$/);
      if (!base64Match) throw new Error('Could not extract image data from PDF page.');
      const base64String = base64Match[1];
      await new Promise<void>((resolve, reject) => {
        this.webTwain.LoadImageFromBase64Binary(
          base64String,
          Dynamsoft.DWT.EnumDWT_ImageType,
          () => resolve(),
          (errorCode: number, errorString: string) => reject(new Error('Failed to add PDF page as image: ' + errorString + ' (code ' + errorCode + ')'))
        );
      });
    }
  }

  /**
   * Export the PDF/A-2 document as base64.
   */
  async exportBase64(): Promise<string> {
    if (!this.pdfDoc) throw new Error('PDF document not created');
    // Export PDF/A-2 as base64
    // Example: use SaveAsPDF with PDF/A option and callback
    // See https://www.dynamsoft.com/web-twain/docs/indepth/save-as-pdf.html
    return new Promise((resolve, reject) => {
      // Dynamsoft PDF/A-2b setup per docs
      if (
        this.webTwain.Addon &&
        this.webTwain.Addon.PDF &&
        typeof this.webTwain.Addon.PDF.Write.Setup === 'function'
      ) {
        this.webTwain.Addon.PDF.Write.Setup({
          version: '1.5',
          pdfaVersion: 'pdf/a-2b',
          Title: 'PDF/A-2 Export',
          Author: 'Dynamsoft Angular Demo',
        });
      }
      this.webTwain.SaveAsPDF(
        '', // file name (empty for in-memory)
        0, // start index
        this.webTwain.HowManyImagesInBuffer - 1, // end index
        (result: any, base64: string) => {
          if (result) {
            resolve(base64);
          } else {
            reject('Failed to export PDF/A-2');
          }
        },
      );
    });
  }

  /**
   * Reset the service state.
   */
  reset(): void {
    this.pdfDoc = null;
  }
}
