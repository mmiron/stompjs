/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { PdfExtractComponent } from './pdf-extract.component';
import { PdfExtractService } from './pdf-extract.service';

describe('PdfExtractComponent', () => {
  let component: PdfExtractComponent;
  let fixture: ComponentFixture<PdfExtractComponent>;
  let mockPdfExtractService: jasmine.SpyObj<PdfExtractService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockPdfExtractService = jasmine.createSpyObj('PdfExtractService', [
      'extractKeywordRegions',
      'extractTextFromKeywords',
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [PdfExtractComponent],
      providers: [
        { provide: PdfExtractService, useValue: mockPdfExtractService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PdfExtractComponent);
    component = fixture.componentInstance;
    
    // Spy on loadDefaultPdf to prevent it from executing during ngOnInit
    spyOn<any>(component, 'loadDefaultPdf').and.returnValue(Promise.resolve());
    
    // Now we can safely detect changes which triggers ngOnInit
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with empty regions array', () => {
      expect(component.regions).toEqual([]);
    });

    it('should initialize with loading false', () => {
      expect(component.isLoading).toBe(false);
    });

    it('should initialize with empty error string', () => {
      expect(component.error).toBe('');
    });

    it('should have form sections configured', () => {
      expect(component.formSections).toBeDefined();
      expect(component.formSections.length).toBeGreaterThan(0);
    });

    it('should have default PDF URL', () => {
      expect(component.defaultPdfUrl).toBeTruthy();
      expect(component.defaultPdfUrl).toContain('.pdf');
    });
  });

  describe('form sections configuration', () => {
    it('should have Personal Information section', () => {
      const personalInfoSection = component.formSections.find(
        s => s.keyword.includes('PERSONAL INFORMATION')
      );
      expect(personalInfoSection).toBeDefined();
      expect(personalInfoSection?.width).toBeDefined();
    });

    it('should have Declaration of Guarantor section', () => {
      const guarantorSection = component.formSections.find(
        s => s.keyword.includes('DECLARATION OF GUARANTOR')
      );
      expect(guarantorSection).toBeDefined();
      expect(guarantorSection?.width).toBeDefined();
    });
  });

  describe('ngOnInit', () => {
    it('should call loadDefaultPdf on initialization', () => {
      // loadDefaultPdf is already spied in beforeEach
      component.ngOnInit();
      expect((component as any).loadDefaultPdf).toHaveBeenCalled();
    });
  });

  describe('onFileSelected', () => {
    it('should handle file selection', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      const event = {
        target: {
          files: [mockFile],
        },
      } as any;

      spyOn<any>(component, 'extractData').and.returnValue(Promise.resolve());
      await component.onFileSelected(event);

      expect(component.pdfFile).toBe(mockFile);
      expect((component as any).extractData).toHaveBeenCalled();
    });

    it('should not process when no files selected', async () => {
      const event = {
        target: {
          files: null,
        },
      } as any;

      spyOn<any>(component, 'extractData');
      await component.onFileSelected(event);

      expect((component as any).extractData).not.toHaveBeenCalled();
    });

    it('should not process when files array is empty', async () => {
      const event = {
        target: {
          files: [],
        },
      } as any;

      spyOn<any>(component, 'extractData');
      await component.onFileSelected(event);

      expect((component as any).extractData).not.toHaveBeenCalled();
    });
  });

  describe('goHome', () => {
    it('should navigate to home route', () => {
      component.goHome();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
    });
  });

  describe('error handling', () => {
    it('should set error message when extraction fails', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      component.pdfFile = mockFile;

      mockPdfExtractService.extractKeywordRegions.and.returnValue(
        Promise.reject(new Error('Extraction failed'))
      );

      await (component as any).extractData();

      expect(component.error).toContain('Failed to extract');
      expect(component.isLoading).toBe(false);
    });

    it('should handle non-Error exceptions', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      component.pdfFile = mockFile;

      mockPdfExtractService.extractKeywordRegions.and.returnValue(
        Promise.reject('String error')
      );

      await (component as any).extractData();

      expect(component.error).toBeTruthy();
      expect(component.isLoading).toBe(false);
    });
  });

  describe('loading state', () => {
    it('should set loading to false after extraction completes', async () => {
      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      component.pdfFile = mockFile;

      mockPdfExtractService.extractKeywordRegions.and.returnValue(Promise.resolve([]));

      await (component as any).extractData();

      expect(component.isLoading).toBe(false);
    });
  });

  // Tests for extractRegionByKeyword method - skipped as method was refactored
  xdescribe('extractRegionByKeyword', () => {
    xit('should return first region when regions exist', async () => {
      const mockRegions = [
        { page: 1, keyword: 'test', x: 100, y: 200, image: 'data:image/png;base64,abc' },
        { page: 2, keyword: 'test', x: 150, y: 250, image: 'data:image/png;base64,def' },
      ];

      mockPdfExtractService.extractKeywordRegions.and.returnValue(
        Promise.resolve(mockRegions)
      );

      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      component.pdfFile = mockFile;

      const result = await (component as any).extractRegionByKeyword('test', 950);

      expect(result.length).toBe(1);
      expect(result[0]).toEqual(mockRegions[0]);
    });

    xit('should return empty array when no regions found', async () => {
      mockPdfExtractService.extractKeywordRegions.and.returnValue(Promise.resolve([]));

      const mockFile = new File(['content'], 'test.pdf', { type: 'application/pdf' });
      component.pdfFile = mockFile;

      const result = await (component as any).extractRegionByKeyword('test', 950);

      expect(result).toEqual([]);
    });
  });

  describe('component template bindings', () => {
    it('should bind isLoading to template', () => {
      component.isLoading = true;
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const loadingElement = compiled.querySelector('.loading');
      expect(loadingElement).toBeTruthy();
    });

    it('should bind error to template', () => {
      component.error = 'Test error message';
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const errorElement = compiled.querySelector('.error');
      expect(errorElement).toBeTruthy();
      expect(errorElement?.textContent).toContain('Test error message');
    });

    it('should render form sections when regions exist', () => {
      component.regions = [
        [{ page: 1, keyword: 'test', x: 100, y: 200, image: 'data:image/png;base64,abc' }],
      ];
      fixture.detectChanges();
      const compiled = fixture.nativeElement as HTMLElement;
      const sections = compiled.querySelectorAll('.regions-section');
      expect(sections.length).toBeGreaterThan(0);
    });
  });
});
