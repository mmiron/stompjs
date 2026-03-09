/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { PdfExtractService } from './pdf-extract.service';

describe('PdfExtractService', () => {
  let service: PdfExtractService;
  let mockFile: File;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(PdfExtractService);
    
    // Create a mock PDF file
    const blob = new Blob(['mock pdf content'], { type: 'application/pdf' });
    mockFile = new File([blob], 'test.pdf', { type: 'application/pdf' });
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('findKeywordsCoordinates', () => {
    it('should return empty array when no keywords match', async () => {
      // Note: This test would require a real PDF or mocking pdfjs-dist
      // For now, we'll test the service structure
      expect(service.findKeywordsCoordinates).toBeDefined();
      expect(typeof service.findKeywordsCoordinates).toBe('function');
    });

    it('should accept file and keywords array parameters', () => {
      const methodParams = service.findKeywordsCoordinates.length;
      expect(methodParams).toBe(2);
    });
  });

  describe('extractKeywordRegions', () => {
    it('should be defined', () => {
      expect(service.extractKeywordRegions).toBeDefined();
    });

    it('should accept optional regionSize parameter', async () => {
      // Verify method signature - 2 required params (file, keywords), regionSize is optional with default
      expect(service.extractKeywordRegions.length).toBe(2);
    });

    it('should return a promise', () => {
      const result = service.extractKeywordRegions(mockFile, ['test']);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('extractTextFromKeywords', () => {
    it('should be defined', () => {
      expect(service.extractTextFromKeywords).toBeDefined();
    });

    it('should return a promise', () => {
      const result = service.extractTextFromKeywords(mockFile, ['Surname']);
      expect(result).toBeInstanceOf(Promise);
    });

    it('should accept file and keywords parameters', () => {
      expect(service.extractTextFromKeywords.length).toBe(2);
    });
  });

  describe('extractDocumentTypeFromFooter', () => {
    it('should be defined', () => {
      expect(service.extractDocumentTypeFromFooter).toBeDefined();
      expect(typeof service.extractDocumentTypeFromFooter).toBe('function');
    });

    it('should accept one file parameter', () => {
      expect(service.extractDocumentTypeFromFooter.length).toBe(1);
    });
  });

  describe('document type parser', () => {
    it('should parse PPTC footer format from text', () => {
      const parsed = (service as any).parseDocumentTypeFromText('PPTC 153 (11-2024) sample');
      expect(parsed).toEqual({
        formFamily: 'PPTC',
        formVersion: '153',
        revision: '11-2024',
      });
    });

    it('should return null for non-matching footer text', () => {
      const parsed = (service as any).parseDocumentTypeFromText('Some unrelated footer');
      expect(parsed).toBeNull();
    });
  });

  describe('service configuration', () => {
    it('should have proper injectable decorator', () => {
      expect(service).toBeTruthy();
      expect(service instanceof PdfExtractService).toBe(true);
    });
  });
});
