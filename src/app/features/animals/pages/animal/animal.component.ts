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
import { CATTLE_BREED_CODES } from '../../constants/cattle-breeds';
import { ANIMAL_EXIT_TYPE_OPTIONS } from '../../constants/animal-exit.constants';
import {
  ANIMAL_LIST_OPTIONAL_COLUMNS,
  ANIMAL_LIST_PAGE_SIZE_OPTIONS,
  ANIMAL_LIST_TABLE_COLUMNS,
  AnimalBirthDisplayMode,
  AnimalListColumnKey,
  AnimalListOptionalColumnKey
} from '../../constants/animal-list.constants';
import { AnimalListItem } from '../../models/animal.model';
import { AnimalApiService, OwnerOptionDto, PaddockOptionDto } from '../../services/animal-api.service';
import { AnimalListPreferencesService } from '../../services/animal-list-preferences.service';
import { AnimalService } from '../../services/animal.service';
import {
  animalAgeParts,
  animalBreedLabelKey,
  animalExitTypeLabelKey,
  animalOriginLabelKey,
  animalStatusLabelKey
} from '../../utils/animal-display.util';

type AnimalListFilterKey =
  | 'sex'
  | 'ranch'
  | 'paddock'
  | 'breed'
  | 'owner'
  | 'origin'
  | 'birthFrom'
  | 'birthTo'
  | 'exitType';

interface AnimalListFilterChip {
  key: AnimalListFilterKey;
  label: string;
}

const ANIMAL_ORIGIN_OPTIONS = ['BIRTH', 'PURCHASE', 'TRANSFER', 'UNKNOWN'] as const;

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
  selectedRanch = '';
  selectedPaddock = '';
  selectedBreed = '';
  selectedOwner = '';
  selectedOrigin = '';
  birthDateFrom = '';
  birthDateTo = '';
  selectedExitType = '';
  ranchOptions: RanchOption[] = [];
  ownerOptions: OwnerOptionDto[] = [];
  paddockOptions: PaddockOptionDto[] = [];
  page = 1;
  pageSize = 10;
  readonly pageSizeOptions = ANIMAL_LIST_PAGE_SIZE_OPTIONS;
  readonly optionalColumns = ANIMAL_LIST_OPTIONAL_COLUMNS;
  birthDisplayMode: AnimalBirthDisplayMode = 'date';
  readonly breedCodes = CATTLE_BREED_CODES;
  readonly originOptions = ANIMAL_ORIGIN_OPTIONS;
  readonly exitTypeOptions = ANIMAL_EXIT_TYPE_OPTIONS;
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

  get columnOptions() {
    return this.optionalColumns.filter((col) => !col.inactiveOnly || this.isInactiveList);
  }

  ngOnInit(): void {
    this.pageSize = this.listPreferences.loadPageSize();
    this.birthDisplayMode = this.listPreferences.loadBirthDisplayMode();

    const company = this.sessionService.getUuidCompany();
    forkJoin({
      ranches: this.userManagementService.getRanches(company ?? undefined).pipe(catchError(() => of([]))),
      owners: this.animalApi.getOwners().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ ranches, owners }) => {
        this.ranchOptions = [...ranches].sort((a, b) => a.name.localeCompare(b.name));
        this.ownerOptions = [...owners].sort((a, b) => a.full_name.localeCompare(b.full_name));
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
        this.resetStructuredFilters();
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
    if (def.inactiveOnly && !this.isInactiveList) {
      return false;
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
    for (const col of this.columnOptions) {
      next[col.key] = visible;
    }
    this.visibleOptionalColumns = next;
    this.listPreferences.saveOptionalColumnVisibility(this.visibleOptionalColumns);
  }

  setBirthDisplayMode(mode: AnimalBirthDisplayMode): void {
    if (mode === this.birthDisplayMode) {
      return;
    }
    this.birthDisplayMode = mode;
    this.listPreferences.saveBirthDisplayMode(mode);
  }

  ageLabel(birthDate?: string | null): string {
    const age = animalAgeParts(birthDate);
    if (!age) {
      return '—';
    }
    if (age.years >= 1) {
      const key = age.years === 1 ? 'animal.ageYear' : 'animal.ageYears';
      return this.i18n.translate(key, { count: age.years });
    }
    if (age.months >= 1) {
      const key = age.months === 1 ? 'animal.ageMonth' : 'animal.ageMonths';
      return this.i18n.translate(key, { count: age.months });
    }
    return this.i18n.translate('animal.ageLessThanMonth');
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

  updateRanchFilter(value: string): void {
    this.selectedRanch = value;
    this.selectedPaddock = '';
    this.page = 1;
    this.loadPaddockOptions();
    this.loadAnimals();
  }

  updatePaddockFilter(value: string): void {
    this.selectedPaddock = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateBreedFilter(value: string): void {
    this.selectedBreed = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateOwnerFilter(value: string): void {
    this.selectedOwner = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateOriginFilter(value: string): void {
    this.selectedOrigin = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateBirthDateFrom(value: string): void {
    this.birthDateFrom = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateBirthDateTo(value: string): void {
    this.birthDateTo = value;
    this.page = 1;
    this.loadAnimals();
  }

  updateExitTypeFilter(value: string): void {
    this.selectedExitType = value;
    this.page = 1;
    this.loadAnimals();
  }

  get panelFilterCount(): number {
    return [
      this.selectedRanch,
      this.selectedPaddock,
      this.selectedBreed,
      this.selectedOwner,
      this.selectedOrigin,
      this.birthDateFrom,
      this.birthDateTo,
      this.isInactiveList ? this.selectedExitType : ''
    ].filter((value) => Boolean(value)).length;
  }

  get filterChips(): AnimalListFilterChip[] {
    const chips: AnimalListFilterChip[] = [];
    if (this.selectedSex === 'MALE' || this.selectedSex === 'FEMALE') {
      chips.push({
        key: 'sex',
        label: `${this.i18n.translate('animal.sex')}: ${this.i18n.translate(this.selectedSex === 'MALE' ? 'animal.male' : 'animal.female')}`
      });
    }
    if (this.selectedRanch) {
      chips.push({
        key: 'ranch',
        label: `${this.i18n.translate('animal.fieldRanch')}: ${this.ranchLabel(this.selectedRanch)}`
      });
    }
    if (this.selectedPaddock) {
      chips.push({
        key: 'paddock',
        label: `${this.i18n.translate('animal.fieldPaddock')}: ${this.paddockOptionLabel(this.selectedPaddock)}`
      });
    }
    if (this.selectedBreed) {
      chips.push({
        key: 'breed',
        label: `${this.i18n.translate('animal.fieldBreed')}: ${this.breedLabel(this.selectedBreed)}`
      });
    }
    if (this.selectedOwner) {
      chips.push({
        key: 'owner',
        label: `${this.i18n.translate('animal.fieldOwner')}: ${this.ownerLabel(this.selectedOwner)}`
      });
    }
    if (this.selectedOrigin) {
      chips.push({
        key: 'origin',
        label: `${this.i18n.translate('animal.fieldOriginType')}: ${this.originLabel(this.selectedOrigin)}`
      });
    }
    if (this.birthDateFrom) {
      chips.push({
        key: 'birthFrom',
        label: `${this.i18n.translate('animal.listFilterBirthFrom')}: ${this.birthDateFrom}`
      });
    }
    if (this.birthDateTo) {
      chips.push({
        key: 'birthTo',
        label: `${this.i18n.translate('animal.listFilterBirthTo')}: ${this.birthDateTo}`
      });
    }
    if (this.isInactiveList && this.selectedExitType) {
      chips.push({
        key: 'exitType',
        label: `${this.i18n.translate('animal.exitType')}: ${this.exitTypeLabel(this.selectedExitType)}`
      });
    }
    return chips;
  }

  clearFilter(key: AnimalListFilterKey): void {
    switch (key) {
      case 'sex':
        this.selectedSex = 'ALL';
        break;
      case 'ranch':
        this.selectedRanch = '';
        this.selectedPaddock = '';
        this.paddockOptions = [];
        break;
      case 'paddock':
        this.selectedPaddock = '';
        break;
      case 'breed':
        this.selectedBreed = '';
        break;
      case 'owner':
        this.selectedOwner = '';
        break;
      case 'origin':
        this.selectedOrigin = '';
        break;
      case 'birthFrom':
        this.birthDateFrom = '';
        break;
      case 'birthTo':
        this.birthDateTo = '';
        break;
      case 'exitType':
        this.selectedExitType = '';
        break;
    }
    this.page = 1;
    this.loadAnimals();
  }

  clearStructuredFilters(): void {
    this.resetStructuredFilters();
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
        ranch_uuid: this.selectedRanch || undefined,
        breed_code: this.selectedBreed || undefined,
        origin_type: this.selectedOrigin || undefined,
        current_owner_uuid: this.selectedOwner || undefined,
        current_paddock_uuid: this.selectedPaddock || undefined,
        birth_date_from: this.birthDateFrom || undefined,
        birth_date_to: this.birthDateTo || undefined,
        exit_type: this.isInactiveList ? this.selectedExitType || undefined : undefined,
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

  private resetStructuredFilters(): void {
    this.selectedSex = 'ALL';
    this.selectedRanch = '';
    this.selectedPaddock = '';
    this.selectedBreed = '';
    this.selectedOwner = '';
    this.selectedOrigin = '';
    this.birthDateFrom = '';
    this.birthDateTo = '';
    this.selectedExitType = '';
    this.paddockOptions = [];
  }

  private paddockOptionLabel(paddockUuid: string): string {
    return this.paddockOptions.find((paddock) => paddock.paddock_uuid === paddockUuid)?.name
      ?? this.paddockNameByUuid.get(paddockUuid)
      ?? notAvailableLabel(this.i18n);
  }

  private loadPaddockOptions(): void {
    const ranchUuid = this.selectedRanch;
    if (!ranchUuid) {
      this.paddockOptions = [];
      return;
    }
    this.animalApi
      .getPaddocksForRanch(ranchUuid)
      .pipe(catchError(() => of([] as PaddockOptionDto[])), takeUntil(this.destroy$))
      .subscribe((paddocks) => {
        if (this.selectedRanch !== ranchUuid) {
          return;
        }
        this.paddockOptions = [...paddocks].sort((a, b) => a.name.localeCompare(b.name));
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
