import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin, of, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs/operators';
import { I18nService } from 'src/app/core/services/i18n.service';
import { notAvailableLabel } from 'src/app/core/utils/i18n-display.util';
import { SessionService } from 'src/app/core/services/session.service';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  ANIMAL_BATCH_DEACTIVATE_DISPLAY_COLUMNS,
  AnimalBatchDeactivateDisplayColumnKey,
  AnimalBatchDeactivateDisplayColumnDef
} from '../../constants/animal-batch-deactivate.constants';
import {
  ANIMAL_EXIT_TYPE_OPTIONS,
  AnimalExitType
} from '../../constants/animal-exit.constants';
import {
  AnimalDeactivateBatchPayload,
  AnimalDeactivateDraftRow
} from '../../models/animal-deactivate-draft.model';
import { AnimalListItem } from '../../models/animal.model';
import { AnimalApiService, OwnerOptionDto, PaddockOptionDto } from '../../services/animal-api.service';
import { AnimalBatchDeactivatePreferencesService } from '../../services/animal-batch-deactivate-preferences.service';
import { AnimalService } from '../../services/animal.service';
import {
  animalBreedLabelKey,
  animalOriginLabelKey,
  animalStatusLabelKey
} from '../../utils/animal-display.util';

@Component({
  selector: 'app-animal-batch-deactivate',
  templateUrl: './animal-batch-deactivate.component.html',
  styleUrls: ['./animal-batch-deactivate.component.scss']
})
export class AnimalBatchDeactivateComponent implements OnInit, OnDestroy {
  readonly exitTypeOptions = ANIMAL_EXIT_TYPE_OPTIONS;
  readonly displayColumns: readonly AnimalBatchDeactivateDisplayColumnDef[] =
    ANIMAL_BATCH_DEACTIVATE_DISPLAY_COLUMNS;
  readonly maxExitDate = new Date().toISOString().slice(0, 10);

  /** Defaults applied when an animal is added to the draft table. */
  templateExitType: AnimalExitType = 'SALE';
  templateExitDate = '';
  templateReason = '';
  templateDescription = '';

  animals: AnimalListItem[] = [];
  draftRows: AnimalDeactivateDraftRow[] = [];
  searchTerm = '';
  isLoading = false;
  saving = false;
  feedback: { type: 'success' | 'error'; message: string } | null = null;

  visibleDisplayColumns: Record<AnimalBatchDeactivateDisplayColumnKey, boolean> =
    this.columnPreferences.loadColumnVisibility();

  private ranchNameByUuid = new Map<string, string>();
  private ownerNameByUuid = new Map<string, string>();
  private paddockNameByUuid = new Map<string, string>();
  private parentRegistrationByUuid = new Map<string, string>();

  private readonly searchChanges$ = new Subject<string>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly animalService: AnimalService,
    private readonly animalApi: AnimalApiService,
    private readonly userManagementService: UserManagementService,
    private readonly columnPreferences: AnimalBatchDeactivatePreferencesService,
    private readonly sessionService: SessionService,
    private readonly i18n: I18nService,
    private readonly router: Router
  ) {}

  ngOnInit(): void {
    this.templateExitDate = this.maxExitDate;
    this.loadRanchAndOwnerLookups();
    this.loadAnimals();
    this.searchChanges$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(() => this.loadAnimals());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get draftCount(): number {
    return this.draftRows.length;
  }

  get allVisibleSelected(): boolean {
    return (
      this.animals.length > 0 &&
      this.animals.every((a) => this.draftRows.some((d) => d.animal_uuid === a.animal_uuid))
    );
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

  sexLabel(sex?: string | null): string {
    return sex === 'MALE'
      ? this.i18n.translate('animal.male')
      : sex === 'FEMALE'
        ? this.i18n.translate('animal.female')
        : notAvailableLabel(this.i18n);
  }

  isDisplayColumnVisible(key: AnimalBatchDeactivateDisplayColumnKey): boolean {
    return this.visibleDisplayColumns[key] ?? false;
  }

  onDisplayColumnToggle(key: AnimalBatchDeactivateDisplayColumnKey, checked: boolean): void {
    this.visibleDisplayColumns = { ...this.visibleDisplayColumns, [key]: checked };
    this.columnPreferences.saveColumnVisibility(this.visibleDisplayColumns);
  }

  setAllDisplayColumns(visible: boolean): void {
    const next = { ...this.visibleDisplayColumns };
    for (const col of this.displayColumns) {
      next[col.key] = visible;
    }
    this.visibleDisplayColumns = next;
    this.columnPreferences.saveColumnVisibility(this.visibleDisplayColumns);
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
    this.searchChanges$.next(term);
  }

  isInDraft(animalUuid: string): boolean {
    return this.draftRows.some((r) => r.animal_uuid === animalUuid);
  }

  toggleAll(checked: boolean): void {
    if (checked) {
      for (const item of this.animals) {
        this.addToDraft(item);
      }
    } else {
      for (const item of this.animals) {
        this.removeFromDraft(item.animal_uuid);
      }
    }
  }

  toggleOne(item: AnimalListItem, checked: boolean): void {
    if (checked) {
      this.addToDraft(item);
    } else {
      this.removeFromDraft(item.animal_uuid);
    }
  }

  removeDraftRow(animalUuid: string): void {
    this.removeFromDraft(animalUuid);
  }

  applyTemplateToAll(): void {
    this.draftRows = this.draftRows.map((row) => ({
      ...row,
      exit_type: this.templateExitType,
      exit_date: this.templateExitDate,
      reason: this.templateReason,
      description: this.templateDescription
    }));
  }

  updateDraftField(
    animalUuid: string,
    field: keyof Pick<AnimalDeactivateDraftRow, 'exit_type' | 'exit_date' | 'reason' | 'description'>,
    value: string
  ): void {
    const row = this.draftRows.find((r) => r.animal_uuid === animalUuid);
    if (!row) {
      return;
    }
    if (field === 'exit_type') {
      row.exit_type = value as AnimalExitType;
    } else {
      row[field] = value;
    }
  }

  submit(): void {
    this.feedback = null;
    if (this.draftRows.length === 0) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.batchDeactivateNoSelection') };
      return;
    }

    const invalid = this.draftRows.find((r) => !r.exit_type || !String(r.exit_date ?? '').trim());
    if (invalid) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.exitInvalid') };
      return;
    }

    const payload: AnimalDeactivateBatchPayload = {
      rows: this.draftRows.map((row) => ({
        animal_uuid: row.animal_uuid,
        exit_type: row.exit_type,
        exit_date: String(row.exit_date).trim(),
        reason: String(row.reason ?? '').trim() || null,
        description: String(row.description ?? '').trim() || null
      }))
    };

    this.saving = true;
    this.animalService.deactivateAnimalsBatch(payload).subscribe({
      next: (result) => {
        this.saving = false;
        if (result.failed === 0) {
          this.feedback = {
            type: 'success',
            message: this.i18n.translate('animal.batchDeactivateSuccess', { count: result.success })
          };
          void this.router.navigate(['/animal/inactive']);
          return;
        }
        this.feedback = {
          type: 'error',
          message: this.i18n.translate('animal.batchDeactivatePartial', {
            success: result.success,
            failed: result.failed
          })
        };
        this.syncDraftAfterPartialFailure(result.rows);
        this.loadAnimals();
      },
      error: () => {
        this.saving = false;
        this.feedback = { type: 'error', message: this.i18n.translate('errors.deactivateAnimal') };
      }
    });
  }

  private addToDraft(item: AnimalListItem): void {
    if (!item.animal_uuid || this.isInDraft(item.animal_uuid)) {
      return;
    }
    this.draftRows = [
      ...this.draftRows,
      {
        animal_uuid: item.animal_uuid,
        registration_number: item.registration_number,
        breed_code: item.breed_code ?? null,
        sex: item.sex,
        exit_type: this.templateExitType,
        exit_date: this.templateExitDate,
        reason: this.templateReason,
        description: this.templateDescription
      }
    ];
  }

  private removeFromDraft(animalUuid: string): void {
    this.draftRows = this.draftRows.filter((r) => r.animal_uuid !== animalUuid);
  }

  private syncDraftAfterPartialFailure(
    results: { animal_uuid: string; success: boolean }[]
  ): void {
    const succeeded = new Set(results.filter((r) => r.success).map((r) => r.animal_uuid));
    this.draftRows = this.draftRows.filter((r) => !succeeded.has(r.animal_uuid));
  }

  private loadRanchAndOwnerLookups(): void {
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

  private loadAnimals(): void {
    this.isLoading = true;
    this.animalService
      .getAnimals({
        page: 1,
        size: 200,
        search: this.searchTerm,
        sex: 'ALL',
        status: 'active',
        sortBy: 'createdAt',
        order: 'DESC'
      })
      .subscribe({
        next: (result) => {
          this.animals = result.items.filter((item) => Boolean(item.animal_uuid));
          this.isLoading = false;
          this.loadLookupMapsForPage(this.animals);
        },
        error: () => {
          this.animals = [];
          this.isLoading = false;
        }
      });
  }
}
