import { Component, OnInit } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { CompanyManagement } from '../../models/company-management.model';
import { SaasManagementService } from '../../services/saas-management.service';
import { CompanyFieldAvailabilityService } from 'src/app/core/services/company-field-availability.service';
import { I18nService } from 'src/app/core/services/i18n.service';
import { translateCompanyWriteError } from 'src/app/core/utils/company-write-error.util';
import { ConfirmDialogComponent } from 'src/app/shared/components/modals/confirm-dialog/confirm-dialog.component';
import { BillingCycle, CompanyPlanType, MembershipStatus } from 'src/app/shared/constants/domain.constants';
import {
  normalizeBillingCycle,
  normalizeCompanyPlanType,
  PLAN_HEAD_LIMIT
} from 'src/app/shared/constants/subscription.constants';
import {
  companyCanArchive,
  companyCanEndSubscription,
  companyCanReactivate,
  companyIsArchived,
  companySubscriptionLooksInactive
} from '../../utils/company-subscription-display';

@Component({
  selector: 'app-saas-management',
  templateUrl: './saas-management.component.html',
  styleUrls: ['./saas-management.component.scss']
})
export class SaasManagementComponent implements OnInit {
  companies: CompanyManagement[] = [];
  isLoading = false;
  errorMessage = '';
  companySearch = '';
  companyArchiveFilter: 'all' | 'active' | 'archived' = 'all';
  companyPage = 1;
  readonly companyPageSize = 8;

  companyForm: Partial<CompanyManagement> = this.buildEmptyCompanyForm();
  showCompanyForm = false;
  companyFormSubmitAttempted = false;
  companyFormTouched: Record<string, boolean> = {};
  private companyRemoteUniqueness: Partial<Record<'name' | 'tax_id', string>> = {};

  constructor(
    private readonly modalService: NgbModal,
    private readonly saasManagementService: SaasManagementService,
    private readonly companyFieldAvailability: CompanyFieldAvailabilityService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.loadCompanies();
  }

  loadCompanies(): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.saasManagementService.getCompanies().subscribe({
      next: (companies) => {
        this.companies = companies;
        this.isLoading = false;
      },
      error: () => {
        this.errorMessage = this.i18nService.translate('errors.loadCompanies');
        this.isLoading = false;
      }
    });
  }

  saveCompany(): void {
    this.companyFormSubmitAttempted = true;
    if (!this.canSaveCompany) {
      return;
    }

    const payload: Partial<CompanyManagement> = {
      name: this.companyForm.name?.trim(),
      legal_name: this.companyForm.legal_name?.trim() || null,
      tax_id: this.companyForm.tax_id?.trim() || null
    };

    const request$ = this.saasManagementService.createCompany(payload);

    request$.subscribe({
      next: () => {
        this.resetCompanyForm();
        this.showCompanyForm = false;
        this.loadCompanies();
      },
      error: (err: unknown) => {
        this.errorMessage = translateCompanyWriteError(this.i18nService, err, 'errors.saveCompany');
      }
    });
  }

  companyRowIsArchived(company: CompanyManagement): boolean {
    return companyIsArchived(company);
  }

  companyRowSubscriptionInactive(company: CompanyManagement): boolean {
    return companySubscriptionLooksInactive(company);
  }

  canEndSubscription(company: CompanyManagement): boolean {
    return companyCanEndSubscription(company);
  }

  canArchiveCompany(company: CompanyManagement): boolean {
    return companyCanArchive(company);
  }

  canReactivateCompany(company: CompanyManagement): boolean {
    return companyCanReactivate(company);
  }

  onCompanyArchiveFilterChange(value: string): void {
    if (value === 'all' || value === 'active' || value === 'archived') {
      this.companyArchiveFilter = value;
      this.companyPage = 1;
    }
  }

  openReactivateCompanyModal(company: CompanyManagement): void {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = 'saas.reactivateCompany';
    dialog.messageKey = 'saas.reactivateCompanyConfirm';
    dialog.confirmKey = 'common.confirm';
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = 'btn-success';

    modalRef.result.then(
      () => {
        this.saasManagementService.reactivateCompany(company.uuid_company).subscribe({
          next: () => {
            this.loadCompanies();
          },
          error: () => {
            this.errorMessage = this.i18nService.translate('errors.reactivateCompany');
          }
        });
      },
      () => undefined
    );
  }

  openArchiveCompanyModal(company: CompanyManagement): void {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = 'saas.archiveCompany';
    dialog.messageKey = 'saas.archiveCompanyConfirm';
    dialog.confirmKey = 'common.confirm';
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = 'btn-dark';

    modalRef.result.then(
      () => {
        this.saasManagementService.deactivateCompany(company.uuid_company).subscribe({
          next: () => {
            this.loadCompanies();
          },
          error: () => {
            this.errorMessage = this.i18nService.translate('errors.deactivateCompany');
          }
        });
      },
      () => undefined
    );
  }

  openEndSubscriptionModal(company: CompanyManagement): void {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = 'saas.endSubscription';
    dialog.messageKey = 'saas.endSubscriptionConfirm';
    dialog.confirmKey = 'common.confirm';
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = 'btn-danger';

    modalRef.result.then(
      () => {
        this.saasManagementService.endCompanySubscription(company.uuid_company).subscribe({
          next: () => {
            this.loadCompanies();
          },
          error: () => {
            this.errorMessage = this.i18nService.translate('errors.endSubscription');
          }
        });
      },
      () => undefined
    );
  }

  get canSaveCompany(): boolean {
    return this.getCompanyFormErrors().length === 0;
  }

  get companyFormErrors(): string[] {
    return this.getCompanyFormErrors();
  }

  markCompanyFieldTouched(field: string): void {
    this.companyFormTouched[field] = true;
  }

  onCompanyAvailabilityBlur(field: 'name' | 'tax_id'): void {
    const intrinsic = this.getCompanyFieldErrorKey(field);
    if (intrinsic !== null) {
      delete this.companyRemoteUniqueness[field];
      return;
    }

    const params: { name?: string; tax_id?: string; exclude_uuid_company?: string } = {};
    if (this.companyForm.uuid_company) {
      params.exclude_uuid_company = this.companyForm.uuid_company;
    }
    if (field === 'name') {
      params.name = (this.companyForm.name ?? '').trim();
    } else {
      params.tax_id = (this.companyForm.tax_id ?? '').trim();
    }

    if (field === 'tax_id' && !params.tax_id) {
      delete this.companyRemoteUniqueness.tax_id;
      return;
    }

    this.companyFieldAvailability.check(params).subscribe({
      next: (result) => {
        const taken = field === 'name' ? !result.nameAvailable : !result.taxIdAvailable;
        if (taken) {
          this.companyRemoteUniqueness[field] =
            field === 'name' ? 'errors.companyNameInUse' : 'errors.taxIdInUse';
        } else {
          delete this.companyRemoteUniqueness[field];
        }
      },
      error: () => {
        delete this.companyRemoteUniqueness[field];
      }
    });
  }

  shouldShowCompanyFieldError(field: string): boolean {
    return this.companyFormSubmitAttempted || !!this.companyFormTouched[field];
  }

  isCompanyFieldInvalid(field: string): boolean {
    return this.shouldShowCompanyFieldError(field) && this.getCompanyFieldError(field) !== null;
  }

  getCompanyFieldError(field: string): string | null {
    const errorKey = this.getCombinedCompanyFieldErrorKey(field);
    if (!errorKey) {
      return null;
    }
    return this.i18nService.translate(errorKey);
  }

  getPlanLabel(plan: CompanyPlanType | string | undefined): string {
    if (!plan) {
      return '-';
    }
    const key = normalizeCompanyPlanType(String(plan)).toLowerCase();
    return this.i18nService.translate(`saas.planType.${key}`);
  }

  getBillingCycleLabel(cycle: BillingCycle | string | undefined): string {
    if (!cycle) {
      return '-';
    }
    const key = normalizeBillingCycle(String(cycle)).toLowerCase();
    return this.i18nService.translate(`saas.billingCycle.${key}`);
  }

  getHeadLimitForCompany(company: CompanyManagement): number {
    return PLAN_HEAD_LIMIT[normalizeCompanyPlanType(company.plan_type)];
  }

  getMembershipStatusLabel(status: MembershipStatus | undefined): string {
    if (!status) {
      return '-';
    }
    return this.i18nService.translate(`saas.membershipStatus.${status.toLowerCase()}`);
  }


  resetCompanyForm(): void {
    this.companyForm = this.buildEmptyCompanyForm();
    this.companyFormSubmitAttempted = false;
    this.companyFormTouched = {};
    this.companyRemoteUniqueness = {};
  }

  openCreateCompanyForm(): void {
    this.resetCompanyForm();
    this.showCompanyForm = true;
  }

  toggleCreateCompanyForm(): void {
    if (this.showCompanyForm) {
      this.cancelCompanyForm();
      return;
    }
    this.openCreateCompanyForm();
  }

  cancelCompanyForm(): void {
    this.resetCompanyForm();
    this.showCompanyForm = false;
  }

  get filteredCompanies(): CompanyManagement[] {
    let list = this.companies;
    if (this.companyArchiveFilter === 'active') {
      list = list.filter((company) => company.is_active);
    } else if (this.companyArchiveFilter === 'archived') {
      list = list.filter((company) => !company.is_active);
    }

    const query = this.companySearch.trim().toLowerCase();
    if (!query) {
      return list;
    }
    return list.filter((company) =>
      company.name?.toLowerCase().includes(query) ||
      company.legal_name?.toLowerCase().includes(query) ||
      company.tax_id?.toLowerCase().includes(query)
    );
  }

  get paginatedCompanies(): CompanyManagement[] {
    const start = (this.companyPage - 1) * this.companyPageSize;
    return this.filteredCompanies.slice(start, start + this.companyPageSize);
  }

  get companyTotalPages(): number {
    const pages = Math.ceil(this.filteredCompanies.length / this.companyPageSize);
    return pages > 0 ? pages : 1;
  }

  get companyPageNumbers(): number[] {
    return Array.from({ length: this.companyTotalPages }, (_, index) => index + 1);
  }

  updateCompanySearch(value: string): void {
    this.companySearch = value;
    this.companyPage = 1;
  }

  goToCompanyPage(page: number): void {
    if (page < 1 || page > this.companyTotalPages) {
      return;
    }
    this.companyPage = page;
  }

  private buildEmptyCompanyForm(): Partial<CompanyManagement> {
    return {
      name: '',
      legal_name: '',
      tax_id: '',
      is_active: true
    };
  }

  private getCompanyFormErrors(): string[] {
    const fields = ['name', 'legal_name', 'tax_id'];

    return fields
      .map((field) => this.getCombinedCompanyFieldErrorKey(field))
      .filter((key): key is string => key !== null)
      .map((key) => this.i18nService.translate(key));
  }

  private getCombinedCompanyFieldErrorKey(field: string): string | null {
    const intrinsic = this.getCompanyFieldErrorKey(field);
    if (intrinsic !== null) {
      return intrinsic;
    }
    if (field === 'name' || field === 'tax_id') {
      return this.companyRemoteUniqueness[field] ?? null;
    }
    return null;
  }

  private getCompanyFieldErrorKey(field: string): string | null {
    const name = (this.companyForm.name ?? '').trim();

    switch (field) {
      case 'name':
        return !name ? 'saas.validation.tradeNameRequired' : null;
      case 'legal_name':
      case 'tax_id':
        return null;
      default:
        return null;
    }
  }

}
