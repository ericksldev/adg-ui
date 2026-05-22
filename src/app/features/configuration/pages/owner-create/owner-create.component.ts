import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { I18nService } from 'src/app/core/services/i18n.service';
import { OwnerFormValue } from '../../components/owner-form/owner-form.component';
import { OwnerManagementService } from '../../services/owner-management.service';
import { formValueToOwnerPayload } from '../../utils/owner-form.util';

@Component({
  selector: 'app-owner-create',
  templateUrl: './owner-create.component.html'
})
export class OwnerCreateComponent {
  formValue: OwnerFormValue = {
    fullName: '',
    documentNumber: '',
    phoneNumber: '',
    email: '',
    address: '',
    description: ''
  };
  isSaving = false;
  errorMessage = '';

  constructor(
    private readonly router: Router,
    private readonly ownerManagementService: OwnerManagementService,
    private readonly i18nService: I18nService
  ) {}

  cancel(): void {
    void this.router.navigate(['/configuration/owners']);
  }

  save(value: OwnerFormValue): void {
    this.isSaving = true;
    this.errorMessage = '';
    this.ownerManagementService.createOwner(formValueToOwnerPayload(value)).subscribe({
      next: () => {
        this.isSaving = false;
        void this.router.navigate(['/configuration/owners']);
      },
      error: (err) => {
        this.isSaving = false;
        this.errorMessage = this.resolveSaveError(err);
      }
    });
  }

  private resolveSaveError(err: { status?: number }): string {
    if (err?.status === 409) {
      return this.i18nService.translate('owners.validation.nameInUse');
    }
    return this.i18nService.translate('errors.saveOwner');
  }
}
