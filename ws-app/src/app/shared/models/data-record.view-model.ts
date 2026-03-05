import { Signal, signal } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DataRecord, DataRecordPayload, Tag } from './data.model';

const TAG_SEPARATOR = ', ';

export class DataRecordViewModel {
  // Immutable model properties
  readonly id: number;
  name: string;
  description: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly tags: Tag[];

  // Form controls for editing
  readonly nameControl: FormControl<string>;
  readonly descriptionControl: FormControl<string>;

  // State signals
  readonly isExpanded: Signal<boolean>;
  readonly isChanged: Signal<boolean>;

  private isChangedSignal = signal<boolean>(false);
  private isExpandedSignal = signal<boolean>(false);
  private originalName: string;
  private originalDescription: string;

  constructor(data: DataRecord) {
    // Initialize immutable model properties
    this.id = data.id;
    this.name = data.name;
    this.description = data.description;
    this.createdAt = data.createdAt;
    this.updatedAt = data.updatedAt ?? data.createdAt;
    this.tags = data.tags;

    // Store original values for comparison
    this.originalName = data.name;
    this.originalDescription = data.description;

    // Initialize form controls for editing
    this.nameControl = new FormControl(data.name, { nonNullable: true });
    this.descriptionControl = new FormControl(data.description, { nonNullable: true });

    // Initialize signals
    this.isExpanded = this.isExpandedSignal;
    this.isChanged = this.isChangedSignal;

    // Subscribe to real-time form control changes
    this.subscribeToFormChanges();
  }

  private subscribeToFormChanges(): void {
    this.nameControl.valueChanges.subscribe(() => this.checkIfChanged());
    this.descriptionControl.valueChanges.subscribe(() => this.checkIfChanged());
  }

  private checkIfChanged(): void {
    const hasNameChanged = this.nameControl.value !== this.originalName;
    const hasDescriptionChanged = this.descriptionControl.value !== this.originalDescription;
    this.isChangedSignal.set(hasNameChanged || hasDescriptionChanged);
  }

  toggleExpanded(): void {
    this.isExpandedSignal.set(!this.isExpandedSignal());
  }

  markChanged(): void {
    this.isChangedSignal.set(true);
  }

  clearChanged(): void {
    this.originalName = this.nameControl.value;
    this.originalDescription = this.descriptionControl.value;
    this.isChangedSignal.set(false);
  }

  getTagsAsString(): string {
    return this.tags.map(tag => tag.name).join(TAG_SEPARATOR);
  }

  updateFromControls(): void {
    this.name = this.nameControl.value;
    this.description = this.descriptionControl.value;
  }

  toDataRecord(): DataRecordPayload {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      tags: this.tags
    };
  }
}
