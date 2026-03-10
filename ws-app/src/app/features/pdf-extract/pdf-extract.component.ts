import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  PdfExtractService,
  FormSection,
  FooterDocumentTypeMatch,
} from './pdf-extract.service';

interface KeywordRegion {
  page: number;
  keyword: string;
  x: number;
  y: number;
  image: string;
}

@Component({
  selector: 'app-pdf-extract',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pdf-extract.component.html',
  styleUrls: ['./pdf-extract.component.css'],
})
export class PdfExtractComponent implements OnInit {
  pdfFile: File | null = null;
  regions: KeywordRegion[][] = [];
  documentTypeMatch: FooterDocumentTypeMatch | null = null;
  isLoading = false;
  error: string = '';
  readonly defaultPdfUrl = 'assets/pdf/pptc153.pdf';
  readonly formSections: FormSection[] = [
    { keyword: 'PERSONAL INFORMATION (SEE INSTRUCTIONS, SECTION I)', width: 950, height: 316 },
    { keyword: 'DECLARATION OF GUARANTOR (SEE INSTRUCTIONS, SECTION J)', width: 1200, height: 400 },
    { keyword: 'EMERGENCY CONTACT INFORMATION (MANDATORY)', width: 1200, height: 266 },
  ];


  constructor(
    private pdfExtract: PdfExtractService,
    private router: Router
  ) {}

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
      const file = new File([blob], 'passport.pdf', { type: 'application/pdf' });
      this.pdfFile = file;
      await this.extractData();
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
    await this.extractData();
  }



  private async extractData(): Promise<void> {
    if (!this.pdfFile) {
      return;
    }

    this.isLoading = true;
    this.error = '';
    this.regions = [];
    this.documentTypeMatch = null;

    try {
      const [regions, documentTypeMatch] = await Promise.all([
        this.pdfExtract.extractKeywordRegionsBatch(this.pdfFile, this.formSections),
        this.pdfExtract.extractDocumentTypeFromFooter(this.pdfFile),
      ]);

      this.regions = regions;
      this.documentTypeMatch = documentTypeMatch;
    } catch (err) {
      this.error = this.getErrorMessage(err);
    } finally {
      this.isLoading = false;
    }
  }

  private getErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return `Failed to extract: ${err.message}`;
    }
    return `Failed to extract: ${String(err)}`;
  }

  goHome(): void {
    this.router.navigate(['/']);
  }
}
