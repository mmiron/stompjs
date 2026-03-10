import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DynamsoftPdfAService } from './dynamsoft-pdfa.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-dynamsoft-pdfa',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './dynamsoft-pdfa.component.html',
  styleUrls: ['./dynamsoft-pdfa.component.css'],
})
export class DynamsoftPdfAComponent {
  pdfaBase64: string | null = null;
  pdfaError: string = '';
  imageFile: File | null = null;
  pdfFile: File | null = null;

  constructor(private dynamsoftPdfA: DynamsoftPdfAService) {}

  async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    this.imageFile = files[0];
    this.pdfaError = '';
    try {
      await this.dynamsoftPdfA.createPdfA2();
        // Convert selected image(s) to base64 and call addImages
        const base64Images: string[] = await Promise.all(Array.from(files).map(file => {
          return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const result = reader.result as string;
              // Remove data URL prefix if present
              const base64 = result.startsWith('data:') ? result.split(',')[1] : result;
              resolve(base64);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          });
        }));
        await this.dynamsoftPdfA.addImages(base64Images);
    } catch (err) {
      this.pdfaError = 'Failed to add image to PDF/A-2: ' + (err instanceof Error ? err.message : String(err));
    }
  }

  async onPdfSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }
    this.pdfFile = files[0];
    this.pdfaError = '';
  }

  async addPdfPagesReverse(): Promise<void> {
    if (!this.pdfFile) return;
    this.pdfaError = '';
    try {
      await this.dynamsoftPdfA.addPdfPagesAsImagesReverse(this.pdfFile);
    } catch (err) {
      this.pdfaError = 'Failed to add PDF pages: ' + (err instanceof Error ? err.message : String(err));
    }
  }

  async exportPdfA2(): Promise<void> {
    this.pdfaError = '';
    try {
      this.pdfaBase64 = await this.dynamsoftPdfA.exportBase64();
    } catch (err) {
      this.pdfaError = 'Failed to export PDF/A-2: ' + (err instanceof Error ? err.message : String(err));
    }
  }
}
