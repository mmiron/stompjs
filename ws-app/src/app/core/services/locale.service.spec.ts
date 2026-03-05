/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { LocaleService } from './locale.service';

describe('LocaleService', () => {
  let service: LocaleService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(LocaleService);
    
    // Reset fetch mock
    spyOn(globalThis, 'fetch').and.stub();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('load', () => {
    it('should fetch locale file', async () => {
      const mockMessages = { home: 'Home', dataRecords: 'Data Records' };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      await service.load('en');

      expect(globalThis.fetch).toHaveBeenCalledWith('assets/locale.en.json');
    });

    it('should not reload if same locale already loaded', async () => {
      const mockMessages = { home: 'Home' };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      await service.load('en');
      const firstCallCount = (globalThis.fetch as jasmine.Spy).calls.count();

      await service.load('en');
      const secondCallCount = (globalThis.fetch as jasmine.Spy).calls.count();

      expect(secondCallCount).toBe(firstCallCount);
    });

    it('should load different locale when requested', async () => {
      const mockMessagesEn = { home: 'Home' };
      const mockMessagesFr = { home: 'Accueil' };

      (globalThis.fetch as jasmine.Spy).and.returnValues(
        Promise.resolve({
          json: () => Promise.resolve(mockMessagesEn),
        } as Response),
        Promise.resolve({
          json: () => Promise.resolve(mockMessagesFr),
        } as Response)
      );

      await service.load('en');
      await service.load('fr');

      expect(globalThis.fetch).toHaveBeenCalledWith('assets/locale.en.json');
      expect(globalThis.fetch).toHaveBeenCalledWith('assets/locale.fr.json');
      expect((globalThis.fetch as jasmine.Spy).calls.count()).toBe(2);
    });

    it('should handle concurrent load requests', async () => {
      const mockMessages = { home: 'Home' };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      const promise1 = service.load('en');
      const promise2 = service.load('en');

      await Promise.all([promise1, promise2]);

      expect((globalThis.fetch as jasmine.Spy).calls.count()).toBe(1);
    });

    it('should default to "en" locale if not specified', async () => {
      const mockMessages = { home: 'Home' };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      await service.load();

      expect(globalThis.fetch).toHaveBeenCalledWith('assets/locale.en.json');
    });
  });

  describe('translate', () => {
    it('should return translated message for existing key', async () => {
      const mockMessages = { home: 'Home', dataRecords: 'Data Records' };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      await service.load('en');
      const result = service.translate('home');

      expect(result).toBe('Home');
    });

    it('should return key itself if translation not found', async () => {
      const mockMessages = { home: 'Home' };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      await service.load('en');
      const result = service.translate('nonExistentKey');

      expect(result).toBe('nonExistentKey');
    });

    it('should return key if called before loading', () => {
      const result = service.translate('someKey');
      expect(result).toBe('someKey');
    });

    it('should handle multiple translations', async () => {
      const mockMessages = {
        home: 'Home',
        dataRecords: 'Data Records',
        filter: 'Filter',
      };
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.resolve(mockMessages),
        } as Response)
      );

      await service.load('en');

      expect(service.translate('home')).toBe('Home');
      expect(service.translate('dataRecords')).toBe('Data Records');
      expect(service.translate('filter')).toBe('Filter');
    });
  });

  describe('error handling', () => {
    it('should handle fetch errors gracefully', async () => {
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.reject(new Error('Network error'))
      );

      try {
        await service.load('en');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });

    it('should handle JSON parsing errors', async () => {
      (globalThis.fetch as jasmine.Spy).and.returnValue(
        Promise.resolve({
          json: () => Promise.reject(new Error('Invalid JSON')),
        } as Response)
      );

      try {
        await service.load('en');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeTruthy();
      }
    });
  });
});
