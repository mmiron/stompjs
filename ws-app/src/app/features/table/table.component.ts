import { Component, OnInit, OnDestroy, ViewChild, ElementRef, signal } from '@angular/core';
import { LocaleService } from '../../core/services/locale.service';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { FILTER_FORM_TOKEN, CLEAR_FILTERS_TOKEN } from './table-filter.component';
import { Injector, inject, signal as ngSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StompService } from '../../core/services/stomp.service';
import { DataRecordViewModel } from '../../shared/models/data-record.view-model';
import { DataRecordPayload } from '../../shared/models/data.model';
import { RowDetailsComponent } from './row-details.component';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-table',
  imports: [ReactiveFormsModule, CommonModule, RouterModule, RowDetailsComponent, TranslatePipe],
  templateUrl: './table.component.html',
  styleUrl: './table.component.css',
  standalone : true
})
export class TableComponent implements OnInit, OnDestroy {
  @ViewChild('tableWrapper') tableWrapper!: ElementRef;

  data = signal<DataRecordViewModel[]>([]);
  isLoading = signal(false);

  showFilterPanel = signal(false);
  filterComponent: any = null;
  filterInjector: Injector;
  filterForm = new FormGroup({
    id: new FormControl(''),
    name: new FormControl(''),
    description: new FormControl(''),
    createdAt: new FormControl(''),
    updatedAt: new FormControl(''),
    tags: new FormControl(''),
  });
  filterValues: Record<string, any> = {};

  private subscriptions: Subscription[] = [];

  constructor(private stompService: StompService, private router: Router, public locale: LocaleService) {
    const parentInjector = inject(Injector);
    this.filterInjector = Injector.create({
      providers: [
        { provide: FILTER_FORM_TOKEN, useValue: this.filterForm },
        { provide: CLEAR_FILTERS_TOKEN, useValue: () => this.clearFilters() },
      ],
      parent: parentInjector,
    });
  }

  private async loadFilterComponent() {
    if (!this.filterComponent) {
      const mod = await import('./table-filter.component');
      this.filterComponent = mod.TableFilterComponent;
    }
  }

  async ngOnInit(): Promise<void> {
    await this.locale.load('en');
    this.loadData();
    this.subscribeToSocketEvents();
  }

  get filteredData(): DataRecordViewModel[] {
    const filters = this.filterForm.value;
    return this.data().filter(item => {
      return Object.entries(filters).every(([key, value]) => {
        if (!value) return true;
        const v = (value as string).toLowerCase();
        if (['id', 'createdAt', 'updatedAt', 'name', 'description', 'tags'].includes(key)) {
          return item[key as keyof DataRecordViewModel].toString().toLowerCase().includes(v);
        } else {
          return true;
        }
      });
    });
  }

  async toggleFilterPanel(): Promise<void> {
    if (!this.showFilterPanel()) {
      await this.loadFilterComponent();
    }
    this.showFilterPanel.update(v => !v);
  }

  clearFilters(): void {
    this.filterForm.reset();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private subscribeToSocketEvents(): void {
    this.stompService.connectToEvents([
      { event: 'dataUpdate', topicParam: 42 },
      { event: 'recordChanged', topicParam: 0 },
    ]);

    // Subscribe to real-time data updates from STOMP (single record at a time)
    const dataUpdateSub = this.stompService.dataUpdate$.subscribe((record: DataRecordPayload) => {
      console.log('Record received via STOMP:', record);
      const currentData = this.data();
      const existingIndex = currentData.findIndex(item => item.id === record.id);
      if (existingIndex !== -1) {
        // Update existing record
        // currentData[existingIndex] = new DataRecordViewModel(record);
        // this.data.set([...currentData]);
      } else {
        // Add new record to the beginning
        const newViewModel = new DataRecordViewModel(record);
        this.data.set([newViewModel, ...currentData]);
      }
    });

    // Subscribe to record changes from other clients
    const recordChangedSub = this.stompService.recordChanged$.subscribe((updatedRecord: DataRecordPayload) => {
      console.log('Record changed via STOMP:', updatedRecord);
      const currentData = this.data();
      const index = currentData.findIndex(item => item.id === updatedRecord.id);
      if (index !== -1) {
        // Replace the record with the updated one
        currentData[index] = new DataRecordViewModel(updatedRecord);
        this.data.set([...currentData]);
      } else {
        // If not found, add it to the beginning
        const newViewModel = new DataRecordViewModel(updatedRecord);
        this.data.set([newViewModel, ...currentData]);
      }
    });


    // Subscribe to STOMP errors
    const errorSub = this.stompService.error$.subscribe((error) => {
      console.error('STOMP error:', error);
    });

    this.subscriptions.push(dataUpdateSub, recordChangedSub, errorSub);
  }

  private loadData(): void {
    // Request initial data batch via STOMP
    this.stompService.requestData(0, 8);
  }

  toggleRow(item: DataRecordViewModel): void {
    item.toggleExpanded();
  }

  getTagsDisplay(item: DataRecordViewModel): string {
    return item.getTagsAsString();
  }

  saveChanges(item: DataRecordViewModel): void {
    item.updateFromControls();
    const updatedRecord = item.toDataRecord();
    // Emit the update via STOMP to notify other clients
    this.stompService.updateRecord(updatedRecord);
    item.clearChanged();
  }

  expandAll(): void {
    this.data().forEach(item => {
      if (!item.isExpanded()) {
        item.toggleExpanded();
      }
    });
  }

  collapseAll(): void {
    this.data().forEach(item => {
      if (item.isExpanded()) {
        item.toggleExpanded();
      }
    });
  }

  onTableScroll(event: any): void {
    // Scroll handler no longer needed - data is pushed from server every 5 seconds
  }

    goHome(): void {
    this.router.navigate(['/']);
  }
}
