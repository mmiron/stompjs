/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { LocaleService } from '../../core/services/locale.service';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let mockLocaleService: jasmine.SpyObj<LocaleService>;

  beforeEach(() => {
    mockLocaleService = jasmine.createSpyObj('LocaleService', ['translate']);

    TestBed.configureTestingModule({
      providers: [
        TranslatePipe,
        { provide: LocaleService, useValue: mockLocaleService },
      ],
    });

    pipe = TestBed.inject(TranslatePipe);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('should call locale service translate method', () => {
      mockLocaleService.translate.and.returnValue('Translated Text');

      const result = pipe.transform('testKey');

      expect(mockLocaleService.translate).toHaveBeenCalledWith('testKey');
      expect(result).toBe('Translated Text');
    });

    it('should return translated value for home key', () => {
      mockLocaleService.translate.and.returnValue('Home');

      const result = pipe.transform('home');

      expect(result).toBe('Home');
      expect(mockLocaleService.translate).toHaveBeenCalledWith('home');
    });

    it('should return translated value for dataRecords key', () => {
      mockLocaleService.translate.and.returnValue('Data Records');

      const result = pipe.transform('dataRecords');

      expect(result).toBe('Data Records');
      expect(mockLocaleService.translate).toHaveBeenCalledWith('dataRecords');
    });

    it('should handle multiple consecutive calls', () => {
      mockLocaleService.translate.and.returnValues('Home', 'Filter', 'Expand All');

      expect(pipe.transform('home')).toBe('Home');
      expect(pipe.transform('filter')).toBe('Filter');
      expect(pipe.transform('expandAll')).toBe('Expand All');

      expect(mockLocaleService.translate).toHaveBeenCalledTimes(3);
    });

    it('should pass through the key when no translation exists', () => {
      mockLocaleService.translate.and.returnValue('unknownKey');

      const result = pipe.transform('unknownKey');

      expect(result).toBe('unknownKey');
    });

    it('should handle empty string key', () => {
      mockLocaleService.translate.and.returnValue('');

      const result = pipe.transform('');

      expect(mockLocaleService.translate).toHaveBeenCalledWith('');
      expect(result).toBe('');
    });
  });
});
