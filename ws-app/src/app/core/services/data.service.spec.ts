/// <reference types="jasmine" />
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { DataService } from './data.service';
import { DataRecord } from '../../shared/models/data.model';
import { environment } from '../../../environments/environment';

describe('DataService', () => {
  let service: DataService;
  let httpMock: HttpTestingController;
  const dataApiUrl = `${environment.apiBaseUrl}/api/data`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [DataService]
    });
    service = TestBed.inject(DataService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('fetchData', () => {
    it('should fetch data from API', () => {
      const mockData: DataRecord[] = [
        {
          id: 1,
          name: 'Test Record',
          description: 'Test Description',
          createdAt: '2024-01-01',
          updatedAt: '2024-01-02',
          tags: [{ id: 1, name: 'tag1' }, { id: 2, name: 'tag2' }]
        } as any
      ];

      service.fetchData().subscribe(data => {
        expect(data).toEqual(mockData);
        expect(data.length).toBe(1);
        expect(data[0].name).toBe('Test Record');
      });

      const req = httpMock.expectOne(dataApiUrl);
      expect(req.request.method).toBe('GET');
      req.flush(mockData);
    });

    it('should handle empty response', () => {
      service.fetchData().subscribe(data => {
        expect(data).toEqual([]);
        expect(data.length).toBe(0);
      });

      const req = httpMock.expectOne(dataApiUrl);
      req.flush([]);
    });

    it('should handle HTTP errors', () => {
      const errorMessage = 'Server error';

      service.fetchData().subscribe({
        next: () => fail('should have failed with 500 error'),
        error: (error) => {
          expect(error.status).toBe(500);
          expect(error.statusText).toBe('Server Error');
        }
      });

      const req = httpMock.expectOne(dataApiUrl);
      req.flush(errorMessage, { status: 500, statusText: 'Server Error' });
    });
  });
});
