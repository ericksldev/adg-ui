import { Component, OnDestroy, OnInit } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { I18nService } from 'src/app/core/services/i18n.service';
import { normalizeUserRoles } from 'src/app/shared/constants/domain.constants';
import { CompanyOption, RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { PaddockListItem } from '../../models/paddock.model';
import { PaddockManagementService } from '../../services/paddock-management.service';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { PADDOCK_LIST_ALL_RANCHES } from '../../constants/paddock-list.constants';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';

@Component({
  selector: 'app-paddock-list',
  templateUrl: './paddock-list.component.html',
  styleUrls: ['./paddock-list.component.scss']
})
export class PaddockListComponent implements OnInit, OnDestroy {
  readonly allRanchesValue = PADDOCK_LIST_ALL_RANCHES;

  companies: CompanyOption[] = [];
  ranches: RanchOption[] = [];
  paddocks: PaddockListItem[] = [];
  selectedCompany = '';
  selectedRanch = '';
  search = '';
  page = 1;
  readonly pageSize = 10;
  listPagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'ASC',
    pageSize: 10,
  };
  isLoading = false;
  errorMessage = '';
  private pendingRanchFromQuery = '';
  private readonly searchChanges$ = new Subject<string>();
  private searchSub?: Subscription;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userManagementService: UserManagementService,
    private readonly paddockManagementService: PaddockManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    this.searchSub = this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadPaddocks());
    const companyFromQuery = this.route.snapshot.queryParamMap.get('company') ?? '';
    this.pendingRanchFromQuery = this.route.snapshot.queryParamMap.get('ranch') ?? '';
    if (this.isSaasOwner) {
      this.loadCompanies(companyFromQuery);
      return;
    }
    this.loadRanchesForTenant();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  get showAllPaddocks(): boolean {
    return this.selectedRanch === this.allRanchesValue;
  }

  get totalPages(): number {
    return this.listPagination.totalPages;
  }

  get pageNumbersList(): number[] {
    return pageNumbers(this.totalPages);
  }

  onCompanyChange(uuid: string): void {
    this.selectedCompany = uuid;
    this.selectedRanch = '';
    this.pendingRanchFromQuery = '';
    this.paddocks = [];
    this.page = 1;
    this.syncListQueryParams();
    this.loadRanchesForSelection();
  }

  onRanchChange(uuid: string): void {
    this.selectedRanch = uuid;
    this.paddocks = [];
    this.page = 1;
    this.syncListQueryParams();
    if (uuid?.trim()) {
      this.loadPaddocks();
    }
  }

  private syncListQueryParams(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.createQueryParams(),
      replaceUrl: true
    });
  }

  updateSearch(value: string): void {
    this.search = value;
    this.page = 1;
    this.searchChanges$.next(value);
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.page = nextPage;
    this.loadPaddocks();
  }

  createQueryParams(): Record<string, string> {
    const params: Record<string, string> = {};
    if (this.selectedRanch === this.allRanchesValue) {
      params['ranch'] = this.allRanchesValue;
    } else if (this.selectedRanch) {
      params['ranch'] = this.selectedRanch;
    }
    if (this.isSaasOwner && this.selectedCompany) {
      params['company'] = this.selectedCompany;
    }
    return params;
  }

  private loadCompanies(companyFromQuery: string): void {
    this.isLoading = true;
    this.errorMessage = '';
    this.userManagementService.getCompanies().subscribe({
      next: (list) => {
        this.companies = list;
        this.selectedCompany =
          companyFromQuery || (list.length === 1 ? list[0].uuid_company : '');
        if (this.selectedCompany) {
          this.loadRanchesForSelection();
        } else {
          this.ranches = [];
          this.selectedRanch = '';
          this.paddocks = [];
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
    this.isLoading = true;
    this.errorMessage = '';
    const companyId = this.sessionService.getUuidCompany() ?? undefined;
    this.userManagementService.getRanches(companyId).subscribe({
      next: (rows) => {
        this.ranches = rows;
        this.applyRanchSelection(rows);
        if (this.selectedRanch) {
          this.syncListQueryParams();
          this.loadPaddocks();
        } else {
          this.isLoading = false;
        }
      },
      error: () => {
        this.ranches = [];
        this.errorMessage = this.i18nService.translate('errors.loadRanches');
        this.isLoading = false;
      }
    });
  }

  private loadRanchesForSelection(): void {
    if (!this.isSaasOwner) {
      return;
    }
    if (!this.selectedCompany?.trim()) {
      this.ranches = [];
      this.selectedRanch = '';
      this.paddocks = [];
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.userManagementService.getRanches(this.selectedCompany).subscribe({
      next: (rows) => {
        this.ranches = rows;
        this.applyRanchSelection(rows);
        if (this.selectedRanch) {
          this.syncListQueryParams();
          this.loadPaddocks();
        } else {
          this.paddocks = [];
          this.isLoading = false;
        }
      },
      error: () => {
        this.ranches = [];
        this.paddocks = [];
        this.errorMessage = this.i18nService.translate('errors.loadRanches');
        this.isLoading = false;
      }
    });
  }

  private applyRanchSelection(rows: RanchOption[]): void {
    if (!rows.length) {
      this.selectedRanch = '';
      return;
    }
    const preferred = this.pendingRanchFromQuery?.trim();
    if (preferred === this.allRanchesValue) {
      this.selectedRanch = this.allRanchesValue;
      return;
    }
    if (preferred && rows.some((ranch) => ranch.uuid_ranch === preferred)) {
      this.selectedRanch = preferred;
      return;
    }
    this.selectedRanch = this.allRanchesValue;
  }

  private loadPaddocks(): void {
    if (!this.selectedRanch?.trim()) {
      this.paddocks = [];
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const query = {
      page: this.page,
      size: this.pageSize,
      search: this.search,
      sortBy: this.showAllPaddocks ? 'ranch_name' : 'name',
      order: 'ASC' as const,
    };

    if (this.showAllPaddocks) {
      const companyUuid = this.isSaasOwner
        ? this.selectedCompany.trim()
        : (this.sessionService.getUuidCompany() ?? '');
      this.paddockManagementService
        .listPaddocks({
          ...query,
          uuid_company: companyUuid || undefined,
          uuid_ranch_in: !companyUuid ? this.ranches.map((r) => r.uuid_ranch) : undefined,
        })
        .subscribe({
          next: (result) => this.applyPaddockResult(result),
          error: () => this.onPaddockLoadError(),
        });
      return;
    }

    this.paddockManagementService
      .listPaddocks({
        ...query,
        ranch_uuid: this.selectedRanch,
      })
      .subscribe({
        next: (result) => this.applyPaddockResult(result),
        error: () => this.onPaddockLoadError(),
      });
  }

  private applyPaddockResult(result: {
    items: PaddockListItem[];
    pagination: ApiPagination;
  }): void {
    this.paddocks = result.items;
    this.listPagination = result.pagination;
    this.page = result.pagination.currentPage;
    this.isLoading = false;
  }

  private onPaddockLoadError(): void {
    this.paddocks = [];
    this.errorMessage = this.i18nService.translate('errors.loadPaddocks');
    this.isLoading = false;
  }
}
