/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrExtractComponent } from './qr-extract.component';
import { PdfExtractService } from '../pdf-extract/pdf-extract.service';
import { Router } from '@angular/router';

describe('QrExtractComponent', () => {
  let component: QrExtractComponent;
  let fixture: ComponentFixture<QrExtractComponent>;
  let mockPdfExtractService: jasmine.SpyObj<PdfExtractService>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockPdfExtractService = jasmine.createSpyObj('PdfExtractService', ['extractQRCodes']);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [QrExtractComponent],
      providers: [
        { provide: PdfExtractService, useValue: mockPdfExtractService },
        { provide: Router, useValue: mockRouter },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(QrExtractComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have a default PDF URL', () => {
    expect(component.defaultPdfUrl).toContain('QRCodeFieldExamples.pdf');
  });

  it('should navigate home when goHome is called', () => {
    component.goHome();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });
});
