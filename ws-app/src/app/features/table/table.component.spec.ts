/// <reference types="jasmine" />
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { RouterTestingModule } from '@angular/router/testing';
import { TableComponent } from './table.component';
import { SocketService } from '../../core/services/socket.service';
import { LocaleService } from '../../core/services/locale.service';
import { of, Subject } from 'rxjs';

describe('TableComponent', () => {
  let component: TableComponent;
  let fixture: ComponentFixture<TableComponent>;
  let mockSocketService: jasmine.SpyObj<SocketService>;
  let mockLocaleService: jasmine.SpyObj<LocaleService>;
  let dataUpdateSubject: Subject<any>;

  beforeEach(async () => {
    dataUpdateSubject = new Subject<any>();
    
    mockSocketService = jasmine.createSpyObj('SocketService', ['connect', 'requestData'], {
      dataUpdate$: dataUpdateSubject.asObservable(),
      recordChanged$: new Subject<any>().asObservable(),
      error$: new Subject<any>().asObservable(),
      connected$: of(true),
    });

    mockLocaleService = jasmine.createSpyObj('LocaleService', ['load', 'translate']);
    mockLocaleService.load.and.returnValue(Promise.resolve());
    mockLocaleService.translate.and.returnValue('Translated');

    await TestBed.configureTestingModule({
      imports: [TableComponent, ReactiveFormsModule, RouterTestingModule],
      providers: [
        { provide: SocketService, useValue: mockSocketService },
        { provide: LocaleService, useValue: mockLocaleService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TableComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('initialization', () => {
    it('should initialize with empty data array', () => {
      expect(component.data()).toEqual([]);
    });

    it('should initialize with loading false', () => {
      expect(component.isLoading()).toBe(false);
    });

    it('should initialize with filter panel hidden', () => {
      expect(component.showFilterPanel()).toBe(false);
    });

    it('should create filter form with all fields', () => {
      expect(component.filterForm).toBeTruthy();
      expect(component.filterForm.get('id')).toBeTruthy();
      expect(component.filterForm.get('name')).toBeTruthy();
      expect(component.filterForm.get('description')).toBeTruthy();
      expect(component.filterForm.get('createdAt')).toBeTruthy();
      expect(component.filterForm.get('updatedAt')).toBeTruthy();
      expect(component.filterForm.get('tags')).toBeTruthy();
    });

    it('should load locale on init', async () => {
      spyOn<any>(component, 'loadData');
      await component.ngOnInit();
      expect(mockLocaleService.load).toHaveBeenCalledWith('en');
      expect((component as any).loadData).toHaveBeenCalled();
    });
  });

  describe('toggleFilterPanel', () => {
    it('should toggle filter panel visibility', async () => {
      expect(component.showFilterPanel()).toBe(false);
      
      await component.toggleFilterPanel();
      expect(component.showFilterPanel()).toBe(true);
      
      await component.toggleFilterPanel();
      expect(component.showFilterPanel()).toBe(false);
    });

    it('should load filter component when showing for first time', async () => {
      expect(component.filterComponent).toBeNull();
      
      await component.toggleFilterPanel();
      
      expect(component.filterComponent).toBeTruthy();
    });
  });

  describe('clearFilters', () => {
    it('should reset filter form', () => {
      component.filterForm.patchValue({
        id: '123',
        name: 'Test',
        description: 'Desc',
      });

      component.clearFilters();

      expect(component.filterForm.value.id).toBeNull();
      expect(component.filterForm.value.name).toBeNull();
      expect(component.filterForm.value.description).toBeNull();
    });
  });

  describe('filteredData', () => {
    beforeEach(() => {
      const mockData = [
        { id: 1, name: 'Record 1', description: 'Desc 1', createdAt: '2024-01-01', updatedAt: '2024-01-02', tags: 'tag1' },
        { id: 2, name: 'Record 2', description: 'Desc 2', createdAt: '2024-01-03', updatedAt: '2024-01-04', tags: 'tag2' },
        { id: 3, name: 'Test Record', description: 'Test Desc', createdAt: '2024-01-05', updatedAt: '2024-01-06', tags: 'test' },
      ] as any;
      component.data.set(mockData);
    });

    it('should return all data when no filters applied', () => {
      const result = component.filteredData;
      expect(result.length).toBe(3);
    });

    it('should filter by name', () => {
      component.filterForm.patchValue({ name: 'Test' });
      const result = component.filteredData;
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Test Record');
    });

    it('should filter by id', () => {
      component.filterForm.patchValue({ id: '1' });
      const result = component.filteredData;
      expect(result.length).toBe(1);
      expect(result[0].id).toBe(1);
    });

    it('should filter case-insensitively', () => {
      component.filterForm.patchValue({ name: 'record' });
      const result = component.filteredData;
      expect(result.length).toBe(3);
    });

    it('should apply multiple filters', () => {
      component.filterForm.patchValue({ 
        name: 'Record',
        description: 'Test'
      });
      const result = component.filteredData;
      expect(result.length).toBe(1);
      expect(result[0].name).toBe('Test Record');
    });

    it('should return empty array when no matches', () => {
      component.filterForm.patchValue({ name: 'NonExistent' });
      const result = component.filteredData;
      expect(result.length).toBe(0);
    });
  });

  describe('ngOnDestroy', () => {
    it('should unsubscribe from all subscriptions', () => {
      const mockSubscription = jasmine.createSpyObj('Subscription', ['unsubscribe']);
      (component as any).subscriptions = [mockSubscription];

      component.ngOnDestroy();

      expect(mockSubscription.unsubscribe).toHaveBeenCalled();
    });
  });

  describe('socket integration', () => {
    it('should have dataUpdate$ observable', () => {
      expect(mockSocketService.dataUpdate$).toBeDefined();
    });
  });
});
