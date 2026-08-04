import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { AnimalDeactivateDialogComponent } from '../../components/animal-deactivate-dialog/animal-deactivate-dialog.component';
import { forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import { hasPermission, Permission } from 'src/app/shared/constants/permissions';
import { ApiPagination } from 'src/app/shared/models/paginated-list.model';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import {
  ANIMAL_LIST_OPTIONAL_COLUMNS,
  ANIMAL_LIST_PAGE_SIZE_OPTIONS,
  ANIMAL_LIST_TABLE_COLUMNS,
  AnimalListColumnKey,
  AnimalListOptionalColumnKey
} from '../../constants/animal-list.constants';
import { AnimalListItem } from '../../models/animal.model';
import { AnimalApiService, OwnerOptionDto, PaddockOptionDto } from '../../services/animal-api.service';
import { AnimalListPreferencesService } from '../../services/animal-list-preferences.service';
import { AnimalService } from '../../services/animal.service';
import {
  animalBreedLabelKey,
  animalExitTypeLabelKey,
  animalOriginLabelKey,
  animalStatusLabelKey
} from '../../utils/animal-display.util';

@Component({
  selector: 'app-animal',
  templateUrl: './animal.component.html',
  styleUrls: ['./animal.component.scss']
})
export class AnimalComponent implements OnInit, OnDestroy {
  animals: AnimalListItem[] = [];
  listStatus: 'active' | 'inactive' = 'active';
  searchTerm = '';
  selectedSex = 'ALL';
  page = 1;
  pageSize = 10;
  readonly pageSizeOptions = ANIMAL_LIST_PAGE_SIZE_OPTIONS;
  readonly optionalColumns = ANIMAL_LIST_OPTIONAL_COLUMNS;
  isLoading = false;
  listPagination: ApiPagination = {
    totalItems: 0,
    totalPages: 1,
    currentPage: 1,
    order: 'DESC',
    pageSize: 10
  };

  visibleOptionalColumns: Record<AnimalListOptionalColumnKey, boolean> =
    this.listPreferences.loadOptionalColumnVisibility();

  private ranchNameByUuid = new Map<string, string>();
  private ownerNameByUuid = new Map<string, string>();
  private paddockNameByUuid = new Map<string, string>();
  private parentRegistrationByUuid = new Map<string, string>();

  private readonly searchChanges$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private searchSub?: Subscription;

  constructor(
    private readonly animalService: AnimalService,
    private readonly animalApi: AnimalApiService,
    private readonly userManagementService: UserManagementService,
    private readonly listPreferences: AnimalListPreferencesService,
    private readonly sessionService: SessionService,
    private readonly route: ActivatedRoute,
    private readonly i18n: I18nService,
    private readonly modalService: NgbModal
  ) {}

  get isInactiveList(): boolean {
    return this.listStatus === 'inactive';
  }

  get pageTitleKey(): string {
    return this.isInactiveList ? 'animal.inactiveListTitle' : 'animal.activeListTitle';
  }

  get emptyMessageKey(): string {
    return this.isInactiveList ? 'animal.emptyInactive' : 'animal.empty';
  }

  get canAnimalWrite(): boolean {
    return hasPermission(this.sessionService.getRoles(), Permission.ANIMAL_WRITE);
  }

  ngOnInit(): void {
    this.pageSize = this.listPreferences.loadPageSize();

    const company = this.sessionService.getUuidCompany();
    forkJoin({
      ranches: this.userManagementService.getRanches(company ?? undefined).pipe(catchError(() => of([]))),
      owners: this.animalApi.getOwners().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ ranches, owners }) => {
        this.ranchNameByUuid = new Map(ranches.map((r: RanchOption) => [r.uuid_ranch, r.name]));
        this.ownerNameByUuid = new Map(owners.map((o: OwnerOptionDto) => [o.owner_uuid, o.full_name]));
      });

    this.route.data.pipe(takeUntil(this.destroy$)).subscribe((data) => {
      const nextStatus: 'active' | 'inactive' = data['listStatus'] === 'inactive' ? 'inactive' : 'active';
      const statusChanged = nextStatus !== this.listStatus;
      this.listStatus = nextStatus;
      if (statusChanged) {
        this.page = 1;
        this.searchTerm = '';
        this.selectedSex = 'ALL';
      }
      this.loadAnimals();
    });

    this.searchSub = this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(() => this.loadAnimals());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.searchSub?.unsubscribe();
  }

  get totalPages(): number {
    return this.listPagination.totalPages;
  }

  get pageNumbersList(): number[] {
    return pageNumbers(this.totalPages);
  }

  isColumnVisible(key: AnimalListColumnKey): boolean {
    const def = ANIMAL_LIST_TABLE_COLUMNS.find((col) => col.key === key);
    if (!def?.optional) {
      return true;
    }
    return this.visibleOptionalColumns[key as AnimalListOptionalColumnKey] ?? false;
  }

  isOptionalColumnVisible(key: AnimalListOptionalColumnKey): boolean {
    return this.visibleOptionalColumns[key] ?? false;
  }

  onOptionalColumnToggle(key: AnimalListOptionalColumnKey, checked: boolean): void {
    this.visibleOptionalColumns = { ...this.visibleOptionalColumns, [key]: checked };
    this.listPreferences.saveOptionalColumnVisibility(this.visibleOptionalColumns);
  }

  setAllOptionalColumns(visible: boolean): void {
    const next = { ...this.visibleOptionalColumns };
    for (const col of this.optionalColumns) {
      next[col.key as AnimalListOptionalColumnKey] = visible;
    }
    this.visibleOptionalColumns = next;
    this.listPreferences.saveOptionalColumnVisibility(this.visibleOptionalColumns);
  }

  onPageSizeChange(raw: string): void {
    const next = Number.parseInt(raw, 10);
    if (!ANIMAL_LIST_PAGE_SIZE_OPTIONS.includes(next) || next === this.pageSize) {
      return;
    }
    this.pageSize = next;
    this.page = 1;
    this.listPreferences.savePageSize(next);
    this.loadAnimals();
  }

  breedLabel(code?: string | null): string {
    return this.i18n.translate(animalBreedLabelKey(code));
  }

  statusLabel(status?: string | null): string {
    return this.i18n.translate(animalStatusLabelKey(status));
  }

  originLabel(origin?: string | null): string {
    return this.i18n.translate(animalOriginLabelKey(origin));
  }

  exitTypeLabel(exitType?: string | null): string {
    return this.i18n.translate(animalExitTypeLabelKey(exitType));
  }

  openDeactivateDialog(item: AnimalListItem): void {
    if (!item.animal_uuid || !this.canAnimalWrite) {
      return;
    }
    const modalRef = this.modalService.open(AnimalDeactivateDialogComponent, {
      centered: true,
      backdrop: 'static',
      size: 'lg'
    });
    const dialog = modalRef.componentInstance as AnimalDeactivateDialogComponent;
    dialog.animalUuid = item.animal_uuid;
    dialog.animalLabel = item.registration_number;
    modalRef.closed.pipe(takeUntil(this.destroy$)).subscribe((result) => {
      if (result === 'success') {
        this.loadAnimals();
      }
    });
  }

  ranchLabel(ranchUuid?: string | null): string {
    if (!ranchUuid) {
      return notAvailableLabel(this.i18n);
    }
    return this.ranchNameByUuid.get(ranchUuid) ?? notAvailableLabel(this.i18n);
  }

  ownerLabel(ownerUuid?: string | null): string {
    if (!ownerUuid) {
      return notAvailableLabel(this.i18n);
    }
    return this.ownerNameByUuid.get(ownerUuid) ?? notAvailableLabel(this.i18n);
  }

  paddockLabel(paddockUuid?: string | null): string {
    if (!paddockUuid) {
      return notAvailableLabel(this.i18n);
    }
    return this.paddockNameByUuid.get(paddockUuid) ?? notAvailableLabel(this.i18n);
  }

  parentRegistrationLabel(animalUuid?: string | null): string {
    if (!animalUuid) {
      return notAvailableLabel(this.i18n);
    }
    return this.parentRegistrationByUuid.get(animalUuid) ?? notAvailableLabel(this.i18n);
  }

  updateSearch(term: string): void {
    this.searchTerm = term;
    this.page = 1;
    this.searchChanges$.next(term);
  }

  updateSexFilter(value: string): void {
    this.selectedSex = value;
    this.page = 1;
    this.loadAnimals();
  }

  goToPage(nextPage: number): void {
    if (nextPage < 1 || nextPage > this.totalPages) {
      return;
    }
    this.page = nextPage;
    this.loadAnimals();
  }

  private loadAnimals(): void {
    this.isLoading = true;
    this.animalService
      .getAnimals({
        page: this.page,
        size: this.pageSize,
        search: this.searchTerm,
        sex: this.selectedSex,
        status: this.listStatus,
        sortBy: 'createdAt',
        order: 'DESC'
      })
      .subscribe({
        next: (result) => {
          this.animals = result.items;
          this.listPagination = result.pagination;
          this.page = result.pagination.currentPage;
          this.isLoading = false;
          this.loadLookupMapsForPage(this.animals);
        },
        error: () => {
          this.animals = [];
          this.isLoading = false;
        }
      });
  }

  private loadLookupMapsForPage(items: AnimalListItem[]): void {
    const ranchIds = [...new Set(items.map((item) => item.ranch_uuid).filter((id): id is string => Boolean(id)))];
    if (ranchIds.length === 0) {
      this.paddockNameByUuid = new Map();
      this.parentRegistrationByUuid = new Map();
      return;
    }

    const paddockRequests = ranchIds.map((ranchUuid) =>
      this.animalApi.getPaddocksForRanch(ranchUuid).pipe(catchError(() => of([] as PaddockOptionDto[])))
    );
    const parentRequests = ranchIds.flatMap((ranchUuid) => [
      this.animalApi.getParentOptions(ranchUuid, 'FEMALE').pipe(catchError(() => of([]))),
      this.animalApi.getParentOptions(ranchUuid, 'MALE').pipe(catchError(() => of([])))
    ]);

    forkJoin({
      paddocksPerRanch: forkJoin(paddockRequests),
      parents: forkJoin(parentRequests)
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ paddocksPerRanch, parents }) => {
        const paddockMap = new Map<string, string>();
        for (const list of paddocksPerRanch) {
          for (const p of list) {
            paddockMap.set(p.paddock_uuid, p.name);
          }
        }
        this.paddockNameByUuid = paddockMap;

        const parentMap = new Map<string, string>();
        for (const list of parents) {
          for (const p of list) {
            parentMap.set(p.animal_uuid, p.registration_number);
          }
        }
        this.parentRegistrationByUuid = parentMap;
      });
  }
}
