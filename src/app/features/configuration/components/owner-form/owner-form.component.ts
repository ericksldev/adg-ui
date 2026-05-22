import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

export interface OwnerFormValue {
  fullName: string;
  documentNumber: string;
  phoneNumber: string;
  email: string;
  address: string;
  description: string;
}

@Component({
  selector: 'app-owner-form',
  templateUrl: './owner-form.component.html',
  styleUrls: ['./owner-form.component.scss']
})
export class OwnerFormComponent implements OnChanges {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() loading = false;
  @Input() submitLabelKey = 'common.save';
  @Input() cancelLabelKey = 'common.cancel';
  @Input() value: OwnerFormValue = this.buildEmptyValue();

  @Output() readonly submitForm = new EventEmitter<OwnerFormValue>();
  @Output() readonly cancelForm = new EventEmitter<void>();

  fullNameTouched = false;
  emailTouched = false;
  submitAttempted = false;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['value'] && !changes['value'].firstChange) {
      this.resetTouched();
    }
    if (changes['mode'] && !changes['mode'].firstChange) {
      this.resetTouched();
    }
  }

  get fullNameInvalid(): boolean {
    return !this.fieldText(this.value.fullName);
  }

  get emailInvalid(): boolean {
    const raw = this.fieldText(this.value.email);
    if (!raw) {
      return false;
    }
    return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw);
  }

  get showFullNameError(): boolean {
    return (this.submitAttempted || this.fullNameTouched) && this.fullNameInvalid;
  }

  get showEmailError(): boolean {
    return (this.submitAttempted || this.emailTouched) && this.emailInvalid;
  }

  get isValid(): boolean {
    return !this.fullNameInvalid && !this.emailInvalid;
  }

  markTouched(field: 'fullName' | 'email'): void {
    if (field === 'fullName') {
      this.fullNameTouched = true;
    }
    if (field === 'email') {
      this.emailTouched = true;
    }
  }

  onSubmit(): void {
    this.submitAttempted = true;
    this.fullNameTouched = true;
    if (this.fieldText(this.value.email)) {
      this.emailTouched = true;
    }
    if (!this.isValid) {
      return;
    }
    this.submitForm.emit({
      fullName: this.fieldText(this.value.fullName),
      documentNumber: this.fieldText(this.value.documentNumber),
      phoneNumber: this.fieldText(this.value.phoneNumber),
      email: this.fieldText(this.value.email),
      address: this.fieldText(this.value.address),
      description: this.fieldText(this.value.description)
    });
  }

  onCancel(): void {
    this.resetTouched();
    this.cancelForm.emit();
  }

  private resetTouched(): void {
    this.fullNameTouched = false;
    this.emailTouched = false;
    this.submitAttempted = false;
  }

  private fieldText(value: string | undefined): string {
    return (value ?? '').trim();
  }

  private buildEmptyValue(): OwnerFormValue {
    return {
      fullName: '',
      documentNumber: '',
      phoneNumber: '',
      email: '',
      address: '',
      description: ''
    };
  }
}
