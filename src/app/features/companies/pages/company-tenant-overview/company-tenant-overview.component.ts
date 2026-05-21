import { Component, OnDestroy, OnInit } from '@angular/core';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import {
  normalizeBillingCycle,
  normalizeCompanyPlanType,
  PLAN_HEAD_LIMIT
} from 'src/app/shared/constants/subscription.constants';
import { CompanyManagement, CompanyUser, RanchSummary } from '../../models/company-management.model';
import { SaasManagementService } from '../../services/saas-management.service';

@Component({
  selector: 'app-company-tenant-overview',
  templateUrl: './company-tenant-overview.component.html',
  styleUrls: ['./company-tenant-overview.component.scss']
})
export class CompanyTenantOverviewComponent implements OnInit, OnDestroy {
  company: CompanyManagement | null = null;
  users: CompanyUser[] = [];
  ranches: RanchSummary[] = [];
  isLoading = false;
  errorMessage = '';

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly saasManagementService: SaasManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  get canListCompanyUsers(): boolean {
    return (
      hasPermission(this.sessionService.getRoles(), Permission.USER_READ) ||
      hasPermission(this.sessionService.getRoles(), Permission.COMPANY_TENANT_READ)
    );
  }

  get canListRanches(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.RANCH_READ);
  }

  ngOnInit(): void {
    const uuidCompany = this.sessionService.getUuidCompany();
    if (!uuidCompany) {
      this.errorMessage = this.i18nService.translate('saas.companyNotFound');
      return;
    }
    this.loadOverview(uuidCompany);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  planTypeI18nSuffix(plan: string | undefined): string {
    if (!plan) {
      return 'essential';
    }
    return normalizeCompanyPlanType(plan).toLowerCase();
  }

  billingCycleI18nSuffix(cycle: string | undefined): string {
    if (!cycle) {
      return 'annual';
    }
    return normalizeBillingCycle(cycle).toLowerCase();
  }

  getAnimalHeadLimit(plan: string | undefined): number {
    return PLAN_HEAD_LIMIT[normalizeCompanyPlanType(plan ?? 'ESSENTIAL')];
  }

  private loadOverview(uuidCompany: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.saasManagementService
      .getCompany(uuidCompany)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (company) => {
          this.company = company;
          const users$ = this.canListCompanyUsers
            ? this.saasManagementService.getCompanyUsers(uuidCompany).pipe(catchError(() => of([] as CompanyUser[])))
            : of([] as CompanyUser[]);
          const ranches$ = this.canListRanches
            ? this.saasManagementService.getRanchesByCompany(uuidCompany).pipe(catchError(() => of([] as RanchSummary[])))
            : of([] as RanchSummary[]);

          forkJoin({ users: users$, ranches: ranches$ })
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: ({ users, ranches }) => {
                this.users = users;
                this.ranches = ranches;
                this.isLoading = false;
              },
              error: () => {
                this.users = [];
                this.ranches = [];
                this.errorMessage = this.i18nService.translate('errors.loadRanches');
                this.isLoading = false;
              }
            });
        },
        error: () => {
          this.errorMessage = this.i18nService.translate('saas.companyNotFound');
          this.isLoading = false;
        }
      });
  }

}
