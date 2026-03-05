import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { DataRecordViewModel } from '../../shared/models/data-record.view-model';

@Component({
  selector: 'app-row-details',
  standalone: true,
  imports: [ReactiveFormsModule, CommonModule],
  templateUrl: './row-details.component.html',
  styleUrl: './row-details.component.css',
})
export class RowDetailsComponent implements OnInit, OnDestroy {
//   @Input() item!: DataRecordViewModel;
  item = input.required<DataRecordViewModel>();
  @Output() saveChanges = new EventEmitter<DataRecordViewModel>();

  ngOnInit(): void {
    console.log('RowDetailsComponent initialized for item:', this.item().id);
  }

  ngOnDestroy(): void {
    console.log('RowDetailsComponent destroyed for item:', this.item().id);
  }

  onSaveChanges(): void {
    this.saveChanges.emit(this.item());
  }
}
