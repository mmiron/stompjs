import { InjectionToken, Component, Inject, Output, EventEmitter } from '@angular/core';
import { ReactiveFormsModule, FormGroup } from '@angular/forms';
import { TranslatePipe } from '../../shared/pipes/translate.pipe';

export const FILTER_FORM_TOKEN = new InjectionToken<FormGroup>('FILTER_FORM_TOKEN');
export const CLEAR_FILTERS_TOKEN = new InjectionToken<() => void>('CLEAR_FILTERS_TOKEN');

@Component({
  selector: 'app-table-filter',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './table-filter.component.html',
  styleUrls: ['./table.component.css']
})
export class TableFilterComponent {
  constructor(
    @Inject(FILTER_FORM_TOKEN) public filterForm: FormGroup,
    @Inject(CLEAR_FILTERS_TOKEN) public clearFilters: () => void
  ) {}
}
