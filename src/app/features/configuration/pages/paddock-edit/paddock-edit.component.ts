import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { PaddockFormValue } from '../../components/paddock-form/paddock-form.component';
import { Paddock } from '../../models/paddock.model';
import { PaddockManagementService } from '../../services/paddock-management.service';
import { formValueToPaddockUpdatePayload, paddockToFormValue } from '../../utils/paddock-form.util';
@Component({
  selector: 'app-paddock-edit',
  templateUrl: './paddock-edit.component.html'
})
export class PaddockEditComponent implements OnInit, OnDestroy {
  paddock: Paddock | null = null;
  formValue: PaddockFormValue = {
    name: '',
    sizeInHectares: '',
    grassType: '',
    waterSource: '',
    maximumCapacity: '',
    description: ''
  };
  isLoading = true;
  isSaving = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly paddockManagementService: PaddockManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe((params) => {
      const id = params.get('uuidPaddock');
      if (!id) {
        void this.router.navigate(['/configuration/paddocks']);
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
    if (this.paddock) {
      void this.router.navigate(['/configuration/paddocks', this.paddock.paddock_uuid]);
      return;
    }
    void this.router.navigate(['/configuration/paddocks']);
  }

  save(value: PaddockFormValue): void {
    if (!this.paddock) {
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.paddockManagementService
      .updatePaddock(this.paddock.paddock_uuid, formValueToPaddockUpdatePayload(value))
      .subscribe({
        next: () => {
          this.isSaving = false;
          void this.router.navigate(['/configuration/paddocks'], {
            queryParams: this.listQueryParams()
          });
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = this.resolveSaveError(err);
        }
      });
  }

  private load(paddockUuid: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.paddockManagementService.getPaddockById(paddockUuid).subscribe({
      next: (row) => {
        this.paddock = row;
        this.formValue = paddockToFormValue(row);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('paddocks.detailNotFound');
        this.isLoading = false;
      }
    });
  }

  private listQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    const ranchFromQuery = this.route.snapshot.queryParamMap.get('ranch') ?? '';
    const companyFromQuery = this.route.snapshot.queryParamMap.get('company') ?? '';
    if (ranchFromQuery) {
      params['ranch'] = ranchFromQuery;
    } else if (this.paddock?.ranch_uuid) {
      params['ranch'] = this.paddock.ranch_uuid;
    }
    if (companyFromQuery) {
      params['company'] = companyFromQuery;
    }
    return params;
  }

  private resolveSaveError(err: { status?: number }): string {
    if (err?.status === 409) {
      return this.i18nService.translate('paddocks.validation.nameInUse');
    }
    return this.i18nService.translate('errors.savePaddock');
  }
}
