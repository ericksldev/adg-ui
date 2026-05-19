import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

export interface PaddockFormValue {
  name: string;
  sizeInHectares: string | number | null;
  grassType: string;
  waterSource: string;
  maximumCapacity: string | number | null;
  description: string;
}

@Component({
  selector: 'app-paddock-form',
  templateUrl: './paddock-form.component.html',
  styleUrls: ['./paddock-form.component.scss']
})
export class PaddockFormComponent implements OnChanges {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() loading = false;
  @Input() submitLabelKey = 'common.save';
  @Input() cancelLabelKey = 'common.cancel';
  @Input() value: PaddockFormValue = this.buildEmptyValue();

  @Output() readonly submitForm = new EventEmitter<PaddockFormValue>();
  @Output() readonly cancelForm = new EventEmitter<void>();

  nameTouched = false;
  sizeTouched = false;
  capacityTouched = false;
  submitAttempted = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      this.resetTouched();
    }
    if (changes['mode'] && !changes['mode'].firstChange) {
      this.resetTouched();
    }
  }

  get nameInvalid(): boolean {
    return !this.fieldText(this.value.name);
  }

  get sizeInvalid(): boolean {
    const raw = this.fieldText(this.value.sizeInHectares);
    if (!raw) {
      return false;
    }
    const n = Number(raw);
    return Number.isNaN(n) || n < 0;
  }

  get capacityInvalid(): boolean {
    const raw = this.fieldText(this.value.maximumCapacity);
    if (!raw) {
      return false;
    }
    const n = Number(raw);
    return !Number.isInteger(n) || n < 0;
  }

  get showNameError(): boolean {
    return (this.submitAttempted || this.nameTouched) && this.nameInvalid;
  }

  get showSizeError(): boolean {
    return (this.submitAttempted || this.sizeTouched) && this.sizeInvalid;
  }

  get showCapacityError(): boolean {
    return (this.submitAttempted || this.capacityTouched) && this.capacityInvalid;
  }

  get isValid(): boolean {
    return !this.nameInvalid && !this.sizeInvalid && !this.capacityInvalid;
  }

  markTouched(field: 'name' | 'size' | 'capacity'): void {
    if (field === 'name') {
      this.nameTouched = true;
    }
    if (field === 'size') {
      this.sizeTouched = true;
    }
    if (field === 'capacity') {
      this.capacityTouched = true;
    }
  }

  onSubmit(): void {
    this.submitAttempted = true;
    this.nameTouched = true;
    if (this.sizeInvalid || this.fieldText(this.value.sizeInHectares)) {
      this.sizeTouched = true;
    }
    if (this.capacityInvalid || this.fieldText(this.value.maximumCapacity)) {
      this.capacityTouched = true;
    }
    if (!this.isValid) {
      return;
    }
    this.submitForm.emit({
      name: this.fieldText(this.value.name),
      sizeInHectares: this.fieldText(this.value.sizeInHectares),
      grassType: this.fieldText(this.value.grassType),
      waterSource: this.fieldText(this.value.waterSource),
      maximumCapacity: this.fieldText(this.value.maximumCapacity),
      description: this.fieldText(this.value.description)
    });
  }

  onCancel(): void {
    this.resetTouched();
    this.cancelForm.emit();
  }

  private resetTouched(): void {
    this.nameTouched = false;
    this.sizeTouched = false;
    this.capacityTouched = false;
    this.submitAttempted = false;
  }

  private fieldText(value: string | number | null | undefined): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  private buildEmptyValue(): PaddockFormValue {
    return {
      name: '',
      sizeInHectares: '',
      grassType: '',
      waterSource: '',
      maximumCapacity: '',
      description: ''
    };
  }
}
