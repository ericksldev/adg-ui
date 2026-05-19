import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { CompanyOption, RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { PaddockFormValue } from '../../components/paddock-form/paddock-form.component';
import { PaddockManagementService } from '../../services/paddock-management.service';
import { formValueToPaddockPayload } from '../../utils/paddock-form.util';
import { normalizeUserRoles } from 'src/app/shared/constants/domain.constants';
import { PADDOCK_LIST_ALL_RANCHES } from '../../constants/paddock-list.constants';

@Component({
  selector: 'app-paddock-create',
  templateUrl: './paddock-create.component.html'
})
export class PaddockCreateComponent implements OnInit {
  companies: CompanyOption[] = [];
  ranches: RanchOption[] = [];
  selectedCompany = '';
  selectedRanch = '';
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
  private pendingCompanyFromQuery = '';
  private pendingRanchFromQuery = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userManagementService: UserManagementService,
    private readonly paddockManagementService: PaddockManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  ngOnInit(): void {
    this.pendingRanchFromQuery = this.route.snapshot.queryParamMap.get('ranch') ?? '';
    this.pendingCompanyFromQuery = this.route.snapshot.queryParamMap.get('company') ?? '';
    if (this.isSaasOwner) {
      this.loadCompanies();
      return;
    }
    this.loadRanchesForTenant();
  }

  onCompanyChange(uuid: string): void {
    this.selectedCompany = uuid;
    this.selectedRanch = '';
    this.pendingRanchFromQuery = '';
    this.loadRanchesForCompany();
  }

  onRanchChange(uuid: string): void {
    this.selectedRanch = uuid;
  }

  listQueryParams(): Record<string, string> {
    return this.buildListQueryParams();
  }

  cancel(): void {
    void this.router.navigate(['/configuration/paddocks'], {
      queryParams: this.buildListQueryParams()
    });
  }

  save(value: PaddockFormValue): void {
    if (!this.selectedRanch?.trim()) {
      this.errorMessage = this.i18nService.translate('paddocks.selectRanchHint');
      return;
    }
    this.isSaving = true;
    this.errorMessage = '';
    this.paddockManagementService
      .createPaddock(formValueToPaddockPayload(value, this.selectedRanch))
      .subscribe({
        next: () => {
          this.isSaving = false;
          void this.router.navigate(['/configuration/paddocks'], {
            queryParams: this.buildListQueryParams()
          });
        },
        error: (err) => {
          this.isSaving = false;
          this.errorMessage = this.resolveSaveError(err);
        }
      });
  }

  private loadCompanies(): void {
    this.userManagementService.getCompanies().subscribe({
      next: (list) => {
        this.companies = list;
        this.selectedCompany =
          this.pendingCompanyFromQuery || (list.length === 1 ? list[0].uuid_company : '');
        if (this.selectedCompany) {
          this.loadRanchesForCompany();
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.loadCompanies');
        this.isLoading = false;
      }
    });
  }

  private loadRanchesForTenant(): void {
    const companyId = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(companyId).subscribe({
      next: (rows) => {
        this.ranches = rows;
        this.selectedRanch = this.resolvePreselectedRanch(rows);
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.loadRanches');
        this.isLoading = false;
      }
    });
  }

  private loadRanchesForCompany(): void {
    if (!this.selectedCompany?.trim()) {
      this.ranches = [];
      this.selectedRanch = '';
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.userManagementService.getRanches(this.selectedCompany).subscribe({
      next: (rows) => {
        this.ranches = rows;
        this.selectedRanch = this.resolvePreselectedRanch(rows);
        this.isLoading = false;
      },
      error: () => {
        this.ranches = [];
        this.errorMessage = this.i18nService.translate('errors.loadRanches');
        this.isLoading = false;
      }
    });
  }

  private resolvePreselectedRanch(rows: RanchOption[]): string {
    const preferred = this.pendingRanchFromQuery?.trim();
    if (preferred === PADDOCK_LIST_ALL_RANCHES) {
      return '';
    }
    if (preferred && rows.some((ranch) => ranch.uuid_ranch === preferred)) {
      return preferred;
    }
    return rows[0]?.uuid_ranch ?? '';
  }

  private buildListQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.selectedRanch) {
      params['ranch'] = this.selectedRanch;
    } else if (this.pendingRanchFromQuery === PADDOCK_LIST_ALL_RANCHES) {
      params['ranch'] = PADDOCK_LIST_ALL_RANCHES;
    }
    if (this.isSaasOwner && this.selectedCompany) {
      params['company'] = this.selectedCompany;
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
