import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { OwnerFormValue } from '../../components/owner-form/owner-form.component';
import { Owner } from '../../models/owner.model';
import { OwnerManagementService } from '../../services/owner-management.service';
import { formValueToOwnerUpdatePayload, ownerToFormValue } from '../../utils/owner-form.util';

@Component({
  selector: 'app-owner-edit',
  templateUrl: './owner-edit.component.html'
})
export class OwnerEditComponent implements OnInit, OnDestroy {
  owner: Owner | null = null;
  formValue: OwnerFormValue = {
    fullName: '',
    documentNumber: '',
    phoneNumber: '',
    email: '',
    address: '',
    description: ''
  };
  isLoading = true;
  isSaving = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly ownerManagementService: OwnerManagementService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('uuidOwner');
      if (!id) {
        void this.router.navigate(['/configuration/owners']);
        return;
      }
      this.load(id);
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  cancel(): void {
    if (this.owner) {
      void this.router.navigate(['/configuration/owners', this.owner.owner_uuid]);
      return;
    }
    void this.router.navigate(['/configuration/owners']);
  }

  save(value: OwnerFormValue): void {
    if (!this.owner) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.ownerManagementService
      .updateOwner(this.owner.owner_uuid, formValueToOwnerUpdatePayload(value))
      .subscribe({
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

  private load(ownerUuid: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.ownerManagementService.getOwnerById(ownerUuid).subscribe({
      next: (row) => {
        this.owner = row;
        this.formValue = ownerToFormValue(row);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('owners.detailNotFound');
        this.isLoading = false;
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
