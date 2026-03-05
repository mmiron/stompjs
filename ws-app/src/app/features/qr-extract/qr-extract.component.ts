import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { PdfExtractService } from '../pdf-extract/pdf-extract.service';

interface QRCodeImage {
  page: number;
  image: string;
  index: number;
}

@Component({
  selector: 'app-qr-extract',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './qr-extract.component.html',
  styleUrls: ['./qr-extract.component.css'],
})
export class QrExtractComponent implements OnInit {
  pdfFile: File | null = null;
  qrCodes: QRCodeImage[] = [];
  isLoading = false;
  error: string = '';
  readonly defaultPdfUrl = 'assets/pdf/QRCodeFieldExamples.pdf';

  constructor(private pdfExtract: PdfExtractService, private router: Router) {}

  ngOnInit(): void {
    this.loadDefaultPdf();
  }

  private async loadDefaultPdf(): Promise<void> {
    try {
      this.isLoading = true;
      this.error = '';
      const response = await fetch(this.defaultPdfUrl);
      if (!response.ok) {
        throw new Error('Failed to load PDF');
      }
      const blob = await response.blob();
      const file = new File([blob], 'qr-codes.pdf', { type: 'application/pdf' });
      this.pdfFile = file;
      await this.extractQRCodes();
    } catch (err) {
      this.error = this.getErrorMessage(err);
    } finally {
      this.isLoading = false;
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files || files.length === 0) {
      return;
    }

    this.pdfFile = files[0];
    await this.extractQRCodes();
  }

  private async extractQRCodes(): Promise<void> {
    if (!this.pdfFile) {
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.qrCodes = [];

    try {
      // Extract QR code regions from the PDF
      const qrImages = await this.pdfExtract.extractQRCodes(this.pdfFile);
      this.qrCodes = qrImages;
      
      if (qrImages.length === 0) {
        console.warn('No QR codes found - check browser console for annotation details');
      }
    } catch (err) {
      this.error = this.getErrorMessage(err);
      console.error('Error extracting QR codes:', err);
    } finally {
      this.isLoading = false;
    }
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return `Failed to extract QR codes: ${err.message}`;
    }
    return `Failed to extract QR codes: ${String(err)}`;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
