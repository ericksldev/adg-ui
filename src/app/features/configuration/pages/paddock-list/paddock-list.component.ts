import { Component, OnInit } from '@angular/core';
import { SessionService } from 'src/app/core/services/session.service';
import { I18nService } from 'src/app/core/services/i18n.service';
import { normalizeUserRoles } from 'src/app/shared/constants/domain.constants';
import { CompanyOption, RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { PaddockListItem } from '../../models/paddock.model';
import { PaddockManagementService } from '../../services/paddock-management.service';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { PADDOCK_LIST_ALL_RANCHES } from '../../constants/paddock-list.constants';

@Component({
  selector: 'app-paddock-list',
  templateUrl: './paddock-list.component.html',
  styleUrls: ['./paddock-list.component.scss']
})
export class PaddockListComponent implements OnInit {
  readonly allRanchesValue = PADDOCK_LIST_ALL_RANCHES;

  companies: CompanyOption[] = [];
  ranches: RanchOption[] = [];
  paddocks: PaddockListItem[] = [];
  selectedCompany = '';
  selectedRanch = '';
  search = '';
  isLoading = false;
  errorMessage = '';
  private pendingRanchFromQuery = '';

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly userManagementService: UserManagementService,
    private readonly paddockManagementService: PaddockManagementService,
    private readonly sessionService: SessionService,
    private readonly i18nService: I18nService
  ) {}

  ngOnInit(): void {
    const companyFromQuery = this.route.snapshot.queryParamMap.get('company') ?? '';
    this.pendingRanchFromQuery = this.route.snapshot.queryParamMap.get('ranch') ?? '';
    if (this.isSaasOwner) {
      this.loadCompanies(companyFromQuery);
      return;
    }
    this.loadRanchesForTenant();
  }

  get isSaasOwner(): boolean {
    return normalizeUserRoles(this.sessionService.getRoles() as string[]).includes('saas_owner');
  }

  get showAllPaddocks(): boolean {
    return this.selectedRanch === this.allRanchesValue;
  }

  get filteredPaddocks(): PaddockListItem[] {
    const term = this.search.trim().toLowerCase();
    if (!term) {
      return this.paddocks;
    }
    return this.paddocks.filter((paddock) => {
      const haystack = [paddock.name, paddock.grass_type, paddock.water_source, paddock.ranch_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }

  onCompanyChange(uuid: string): void {
    this.selectedCompany = uuid;
    this.selectedRanch = '';
    this.pendingRanchFromQuery = '';
    this.paddocks = [];
    this.syncListQueryParams();
    this.loadRanchesForSelection();
  }

  onRanchChange(uuid: string): void {
    this.selectedRanch = uuid;
    this.paddocks = [];
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
    if (this.showAllPaddocks) {
      this.loadAllPaddocks();
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    this.paddockManagementService.getPaddocksForRanch(this.selectedRanch).subscribe({
      next: (rows) => {
        this.paddocks = rows;
        this.isLoading = false;
      },
      error: () => {
        this.paddocks = [];
        this.errorMessage = this.i18nService.translate('errors.loadPaddocks');
        this.isLoading = false;
      }
    });
  }

  private loadAllPaddocks(): void {
    if (!this.ranches.length) {
      this.paddocks = [];
      this.isLoading = false;
      return;
    }
    this.isLoading = true;
    this.errorMessage = '';
    const requests = this.ranches.map((ranch) =>
      this.paddockManagementService.getPaddocksForRanch(ranch.uuid_ranch).pipe(
        map((rows) =>
          rows.map((paddock) => ({
            ...paddock,
            ranch_uuid: ranch.uuid_ranch,
            ranch_name: ranch.name
          }))
        ),
        catchError(() => of([] as PaddockListItem[]))
      )
    );
    forkJoin(requests).subscribe({
      next: (groups) => {
        this.paddocks = groups
          .flat()
          .sort(
            (a, b) =>
              (a.ranch_name ?? '').localeCompare(b.ranch_name ?? '', undefined, { sensitivity: 'base' }) ||
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
          );
        this.isLoading = false;
      },
      error: () => {
        this.paddocks = [];
        this.errorMessage = this.i18nService.translate('errors.loadPaddocks');
        this.isLoading = false;
      }
    });
  }
}
