import { ChangeDetectorRef, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { firstValueFrom, forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, finalize, takeUntil } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmDialogComponent } from 'src/app/shared/components/modals/confirm-dialog/confirm-dialog.component';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { translateAnimalWriteError } from 'src/app/core/utils/animal-write-error.util';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX,
  ANIMAL_BATCH_DEFAULT_OPTIONAL_COLUMN_VISIBILITY,
  ANIMAL_BATCH_DEFAULT_ROW_SLOTS,
  ANIMAL_BATCH_MAX_ROW_SLOTS,
  ANIMAL_BATCH_MIN_ROW_SLOTS,
  ANIMAL_BATCH_OPTIONAL_COLUMNS,
  ANIMAL_BATCH_PERSIST_DEBOUNCE_MS,
  AnimalBatchOptionalColumnKey
} from '../../constants/animal-batch.constants';
import { CATTLE_BREED_CODES } from '../../constants/cattle-breeds';
import {
  ANIMAL_BATCH_DRAFT_VERSION,
  AnimalBatchDraftRow,
  AnimalBatchDraftSnapshot
} from '../../models/animal-batch-draft.model';
import { AnimalBatchCreateRequestBody } from '../../models/animal-batch-create.model';
import { AnimalCreatePayload } from '../../models/animal-create-payload.model';
import { AnimalApiService, OwnerOptionDto, PaddockOptionDto } from '../../services/animal-api.service';
import { AnimalBatchDraftStorageService } from '../../services/animal-batch-draft-storage.service';
import { AnimalBatchExcelImportService } from '../../services/animal-batch-excel-import.service';
import { batchDraftRowHasData, emptyBatchDraftRow, optionalColumnVisibilityForImport } from '../../utils/animal-batch-draft.utils';

@Component({
  selector: 'app-animal-batch-register',
  templateUrl: './animal-batch-register.component.html',
  styleUrls: ['./animal-batch-register.component.scss']
})
export class AnimalBatchRegisterComponent implements OnInit, OnDestroy {
  readonly minSlots = ANIMAL_BATCH_MIN_ROW_SLOTS;
  readonly maxSlots = ANIMAL_BATCH_MAX_ROW_SLOTS;
  readonly breedCodes = [...CATTLE_BREED_CODES];
  readonly optionalColumns = ANIMAL_BATCH_OPTIONAL_COLUMNS;

  visibleOptionalColumns: Record<AnimalBatchOptionalColumnKey, boolean> = {
    ...ANIMAL_BATCH_DEFAULT_OPTIONAL_COLUMN_VISIBILITY
  };

  @ViewChild('excelFileInput') excelFileInput?: ElementRef<HTMLInputElement>;

  form: FormGroup;
  requestedSlotCount = ANIMAL_BATCH_DEFAULT_ROW_SLOTS;
  feedback: { type: 'success' | 'error'; message: string } | null = null;
  savingBatch = false;
  batchTableAlive = true;

  ranchRows: RanchOption[] = [];
  ownerRows: OwnerOptionDto[] = [];

  /** 1-based row number shown in the grid (# column). */
  modelRowNumber = 1;
  copyOnlyEmptyTargets = true;

  private suppressDraftPersist = false;
  private readonly destroy$ = new Subject<void>();
  private draftPersistSub?: Subscription;
  private readonly paddockCache = new Map<string, PaddockOptionDto[]>();
  private readonly paddockLoading = new Set<string>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly draftStorage: AnimalBatchDraftStorageService,
    private readonly excelImport: AnimalBatchExcelImportService,
    private readonly i18n: I18nService,
    private readonly sessionService: SessionService,
    private readonly userManagementService: UserManagementService,
    private readonly animalApi: AnimalApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly modalService: NgbModal
  ) {
    this.form = this.fb.group({
      rows: this.fb.array([])
    });
  }

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  breedLabel(code: string): string {
    return this.i18n.translate(`animal.breed.${code}`);
  }

  get anyOptionalColumnVisible(): boolean {
    return this.optionalColumns.some((col) => this.isOptionalColumnVisible(col.key));
  }

  isOptionalColumnVisible(key: AnimalBatchOptionalColumnKey): boolean {
    return this.visibleOptionalColumns[key] ?? false;
  }

  isFirstVisibleOptionalColumn(key: AnimalBatchOptionalColumnKey): boolean {
    const first = this.optionalColumns.find((col) => this.isOptionalColumnVisible(col.key));
    return first?.key === key;
  }

  onOptionalColumnToggle(key: AnimalBatchOptionalColumnKey, checked: boolean): void {
    this.visibleOptionalColumns = { ...this.visibleOptionalColumns, [key]: checked };
    this.persistColumnVisibility();
  }

  setAllOptionalColumns(visible: boolean): void {
    const next = { ...this.visibleOptionalColumns };
    for (const col of this.optionalColumns) {
      next[col.key] = visible;
    }
    this.visibleOptionalColumns = next;
    this.persistColumnVisibility();
  }

  private applyOptionalColumnsFromExcelImport(columnsInFile: AnimalBatchOptionalColumnKey[]): void {
    this.visibleOptionalColumns = optionalColumnVisibilityForImport(columnsInFile);
    this.persistColumnVisibility();
    this.cdr.markForCheck();
  }

  paddockOptionsForRow(index: number): PaddockOptionDto[] {
    const g = this.rows.at(index) as FormGroup | null;
    const ranch = g?.get('ranchUuid')?.value;
    if (!ranch) {
      return [];
    }
    return this.paddockCache.get(String(ranch)) ?? [];
  }

  onRanchChange(index: number): void {
    const g = this.rows.at(index) as FormGroup;
    g.patchValue({ currentPaddockUuid: '' }, { emitEvent: false });
    const ranch = g.get('ranchUuid')?.value;
    if (ranch) {
      this.ensurePaddocksLoaded(String(ranch));
    }
  }

  applyModelRowToOthers(): void {
    const n = this.rows.length;
    if (n < 2) {
      return;
    }
    const src = Math.min(Math.max(1, Math.floor(this.modelRowNumber)), n) - 1;
    const sourceGroup = this.rows.at(src) as FormGroup;
    const full = sourceGroup.getRawValue() as AnimalBatchDraftRow;
    const { registrationNumber: _reg, chipNumber: _chip, ...template } = full;

    if (!this.copyOnlyEmptyTargets) {
      const wouldOverwrite = [...Array(n).keys()].some(
        (idx) =>
          idx !== src && batchDraftRowHasData((this.rows.at(idx) as FormGroup).getRawValue() as AnimalBatchDraftRow)
      );
      if (wouldOverwrite) {
        const ok = globalThis.confirm(this.i18n.translate('animal.batchCopyModelConfirm'));
        if (!ok) {
          return;
        }
      }
    }

    for (let i = 0; i < n; i++) {
      if (i === src) {
        continue;
      }
      const row = this.rows.at(i) as FormGroup;
      if (this.copyOnlyEmptyTargets && batchDraftRowHasData(row.getRawValue() as AnimalBatchDraftRow)) {
        continue;
      }
      row.patchValue(template);
      const ranch = row.get('ranchUuid')?.value;
      if (ranch) {
        this.ensurePaddocksLoaded(String(ranch));
      }
    }
    this.feedback = { type: 'success', message: this.i18n.translate('animal.batchCopyModelDone') };
    this.cdr.markForCheck();
  }

  private ensurePaddocksLoaded(ranchUuid: string): void {
    const r = ranchUuid.trim();
    if (!r || this.paddockCache.has(r) || this.paddockLoading.has(r)) {
      return;
    }
    this.paddockLoading.add(r);
    this.animalApi
      .getPaddocksForRanch(r)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.paddockLoading.delete(r))
      )
      .subscribe((list) => {
        this.paddockCache.set(r, list);
        this.cdr.markForCheck();
      });
  }

  private preloadPaddocksForAllRanches(): void {
    const seen = new Set<string>();
    for (let i = 0; i < this.rows.length; i++) {
      const ranch = (this.rows.at(i) as FormGroup).get('ranchUuid')?.value;
      const key = String(ranch ?? '').trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        this.ensurePaddocksLoaded(key);
      }
    }
  }

  ngOnInit(): void {
    this.loadColumnVisibility();

    const company = this.sessionService.getUuidCompany();
    forkJoin({
      ranches: this.userManagementService.getRanches(company ?? undefined).pipe(catchError(() => of([]))),
      owners: this.animalApi.getOwners().pipe(catchError(() => of([])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ ranches, owners }) => {
        this.ranchRows = ranches;
        this.ownerRows = owners;
      });

    const draft = this.draftStorage.load();
    if (draft) {
      const count = this.clampSlotCount(draft.rowSlotCount);
      this.requestedSlotCount = count;
      this.replaceFormRows(count, draft.rows);
    } else {
      this.requestedSlotCount = ANIMAL_BATCH_DEFAULT_ROW_SLOTS;
      this.replaceFormRows(ANIMAL_BATCH_DEFAULT_ROW_SLOTS, []);
    }

    this.bindDraftAutoSave();
  }

  ngOnDestroy(): void {
    this.persistDraftNow();
    this.draftPersistSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private bindDraftAutoSave(): void {
    this.draftPersistSub?.unsubscribe();
    this.draftPersistSub = this.form.valueChanges
      .pipe(debounceTime(ANIMAL_BATCH_PERSIST_DEBOUNCE_MS), takeUntil(this.destroy$))
      .subscribe(() => this.persistDraftNow());
  }

  /** Saves draft immediately (import/rebuild does not emit valueChanges). */
  private persistDraftNow(): void {
    if (this.suppressDraftPersist) {
      return;
    }
    const values = this.rows.getRawValue() as AnimalBatchDraftRow[];
    if (!values.some((row) => batchDraftRowHasData(row))) {
      return;
    }
    this.draftStorage.save(this.toSnapshot());
  }

  openExcelPicker(): void {
    this.excelFileInput?.nativeElement.click();
  }

  onExcelFileChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    this.feedback = null;
    if (!file) {
      return;
    }

    file
      .arrayBuffer()
      .then((buffer) => {
        const parseResult = this.excelImport.parseFirstSheet(buffer);
        const imported = parseResult.rows;
        if (imported.length === 0) {
          this.feedback = { type: 'error', message: this.i18n.translate('animal.batchImportEmpty') };
          return;
        }
        const slotCount = this.clampSlotCount(Math.max(this.minSlots, imported.length));
        this.requestedSlotCount = slotCount;
        const merged = this.excelImport.mergeIntoSlotCount(imported, slotCount);
        this.applyOptionalColumnsFromExcelImport(parseResult.optionalColumnsInFile);
        this.rebuildRows(slotCount, merged);
        this.feedback = {
          type: 'success',
          message: this.i18n.translate('animal.batchImportSuccess', { count: String(imported.length) })
        };
      })
      .catch(() => {
        this.feedback = { type: 'error', message: this.i18n.translate('animal.batchImportError') };
      })
      .finally(() => {
        input.value = '';
      });
  }

  applyRequestedSlotCount(): void {
    const next = this.clampSlotCount(this.requestedSlotCount);
    this.requestedSlotCount = next;
    const currentValues = this.rows.getRawValue() as AnimalBatchDraftRow[];
    if (next === currentValues.length) {
      return;
    }
    if (next < currentValues.length) {
      const dropped = currentValues.slice(next);
      if (dropped.some((r) => batchDraftRowHasData(r))) {
        const ok = globalThis.confirm(this.i18n.translate('animal.batchShrinkConfirm'));
        if (!ok) {
          this.requestedSlotCount = currentValues.length;
          return;
        }
      }
    }
    this.rebuildRows(next, currentValues);
  }

  rowHasData(index: number): boolean {
    const row = this.rows.at(index) as FormGroup | null;
    if (!row) {
      return false;
    }
    return batchDraftRowHasData(row.getRawValue() as AnimalBatchDraftRow);
  }

  clearBatchRow(index: number): void {
    if (!this.rowHasData(index)) {
      return;
    }

    const rowNumber = String(index + 1);
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = 'animal.batchClearRowConfirmTitle';
    dialog.messageKey = 'animal.batchClearRowConfirm';
    dialog.messageParams = { row: rowNumber };
    dialog.confirmKey = 'common.confirm';
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = 'btn-danger';

    modalRef.result.then(
      () => this.executeClearBatchRow(index),
      () => undefined
    );
  }

  private executeClearBatchRow(index: number): void {
    const row = this.rows.at(index) as FormGroup | null;
    if (!row) {
      return;
    }
    row.reset(this.emptyRowControlValues());
    this.cdr.detectChanges();
  }

  clearBatchTable(): void {
    const values = this.rows.getRawValue() as AnimalBatchDraftRow[];
    const hasData = values.some((row) => batchDraftRowHasData(row));
    const rowCount = values.length;

    if (!hasData) {
      this.executeClearBatchTable(rowCount);
      return;
    }

    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = 'animal.batchClearConfirmTitle';
    dialog.messageKey = 'animal.batchClearConfirm';
    dialog.confirmKey = 'common.confirm';
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = 'btn-danger';

    modalRef.result.then(
      () => this.executeClearBatchTable(rowCount),
      () => undefined
    );
  }

  private executeClearBatchTable(rowCount: number): void {
    this.ngZone.run(() => {
      this.feedback = null;
      this.draftStorage.clear();
      this.suppressDraftPersist = true;
      this.remountBatchTableWithRows(rowCount, []);
      globalThis.setTimeout(() => {
        this.suppressDraftPersist = false;
      }, ANIMAL_BATCH_PERSIST_DEBOUNCE_MS + 100);
      this.feedback = { type: 'success', message: this.i18n.translate('animal.batchClearDone') };
    });
  }

  async saveBatch(): Promise<void> {
    this.feedback = null;
    const values = this.rows.getRawValue() as AnimalBatchDraftRow[];
    const filledRows = values
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => batchDraftRowHasData(row));
    const filled = filledRows.map(({ row }) => row);
    if (filled.length === 0) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.batchNoRows') };
      return;
    }
    const missingCore = filled.some(
      (r) =>
        !String(r.registrationNumber ?? '').trim() ||
        !String(r.ranchUuid ?? '').trim() ||
        !String(r.breedCode ?? '').trim() ||
        !String(r.sex ?? '').trim() ||
        !String(r.birthDate ?? '').trim()
    );
    if (missingCore) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.batchMissingRequiredFields') };
      return;
    }

    const requestBody: AnimalBatchCreateRequestBody = {
      rows: filledRows.map(({ row, index }) => ({
        index,
        animal: this.toCreatePayload(row)
      }))
    };

    this.savingBatch = true;
    let batchResult;
    try {
      batchResult = await firstValueFrom(this.animalApi.createAnimalsBatch(requestBody));
    } catch (error: unknown) {
      this.savingBatch = false;
      this.feedback = { type: 'error', message: this.extractApiError(error) };
      return;
    }
    this.savingBatch = false;

    if (!batchResult) {
      this.feedback = { type: 'error', message: this.i18n.translate('animal.individualSaveError') };
      return;
    }

    const successes = batchResult.results.filter((r) => r.success);
    const failures = batchResult.results.filter((r) => !r.success);

    if (failures.length === 0) {
      this.draftStorage.clear();
      this.suppressDraftPersist = true;
      this.remountBatchTableWithRows(values.length, []);
      globalThis.setTimeout(() => {
        this.suppressDraftPersist = false;
      }, ANIMAL_BATCH_PERSIST_DEBOUNCE_MS + 100);
      this.feedback = {
        type: 'success',
        message: this.i18n.translate('animal.batchSaveApiDone', { count: String(successes.length) })
      };
      return;
    }

    for (const success of successes) {
      const g = this.rows.at(success.index) as FormGroup | null;
      g?.patchValue(emptyBatchDraftRow());
    }
    this.persistDraftNow();

    const failedRows = failures.map((f) => String(f.index + 1)).join(', ');
    const firstReason = failures[0].error ?? this.i18n.translate('animal.individualSaveError');
    this.feedback = {
      type: 'error',
      message: this.i18n.translate('animal.batchSaveApiPartial', {
        success: String(successes.length),
        failed: String(failures.length),
        rows: failedRows,
        reason: firstReason
      })
    };
  }

  trackByRow(index: number): number {
    return this.rowRenderGeneration * 100000 + index;
  }

  private rowRenderGeneration = 0;

  private toSnapshot(): AnimalBatchDraftSnapshot {
    return {
      version: ANIMAL_BATCH_DRAFT_VERSION,
      rowSlotCount: this.rows.length,
      rows: this.rows.getRawValue() as AnimalBatchDraftRow[]
    };
  }

  private clampSlotCount(raw: number): number {
    const n = Math.floor(Number(raw));
    if (Number.isNaN(n)) {
      return ANIMAL_BATCH_MIN_ROW_SLOTS;
    }
    return Math.min(ANIMAL_BATCH_MAX_ROW_SLOTS, Math.max(ANIMAL_BATCH_MIN_ROW_SLOTS, n));
  }

  private rebuildRows(count: number, previous: AnimalBatchDraftRow[]): void {
    this.remountBatchTableWithRows(count, previous);
    this.preloadPaddocksForAllRanches();
    this.persistDraftNow();
  }

  /** Replaces the reactive form so table controls re-bind after clear/import. */
  private replaceFormRows(count: number, previous: AnimalBatchDraftRow[]): void {
    const safeCount = this.clampSlotCount(count);
    const rowGroups: FormGroup[] = [];
    for (let i = 0; i < safeCount; i++) {
      const seed = previous[i] ?? emptyBatchDraftRow();
      rowGroups.push(this.createRowGroup(seed));
    }
    this.form = this.fb.group({
      rows: this.fb.array(rowGroups)
    });
    this.bindDraftAutoSave();
  }

  private remountBatchTableWithRows(count: number, previous: AnimalBatchDraftRow[]): void {
    this.batchTableAlive = false;
    this.cdr.detectChanges();
    this.replaceFormRows(count, previous);
    this.rowRenderGeneration++;
    this.batchTableAlive = true;
    this.cdr.detectChanges();
  }

  private columnsStorageKey(): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX}_${company}_${username}`;
  }

  private loadColumnVisibility(): void {
    const key = this.columnsStorageKey();
    if (!key) {
      return;
    }
    const raw = localStorage.getItem(key);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw) as Partial<Record<AnimalBatchOptionalColumnKey, boolean>>;
      this.visibleOptionalColumns = {
        ...ANIMAL_BATCH_DEFAULT_OPTIONAL_COLUMN_VISIBILITY,
        ...parsed
      };
    } catch {
      // ignore invalid saved preferences
    }
  }

  private persistColumnVisibility(): void {
    const key = this.columnsStorageKey();
    if (!key) {
      return;
    }
    localStorage.setItem(key, JSON.stringify(this.visibleOptionalColumns));
  }

  private toCreatePayload(row: AnimalBatchDraftRow): AnimalCreatePayload {
    const payload: AnimalCreatePayload = {
      ranch_uuid: String(row.ranchUuid ?? '').trim(),
      breed_code: String(row.breedCode ?? '').trim(),
      registration_number: String(row.registrationNumber ?? '').trim(),
      sex: row.sex as 'MALE' | 'FEMALE',
      birth_date: String(row.birthDate ?? '').trim(),
      origin_type: (String(row.originType ?? '').trim() || 'UNKNOWN') as AnimalCreatePayload['origin_type']
    };

    const chip = String(row.chipNumber ?? '').trim();
    const mother = String(row.motherRegistrationNumber ?? '').trim();
    const father = String(row.fatherRegistrationNumber ?? '').trim();
    const owner = String(row.currentOwnerUuid ?? '').trim();
    const paddock = String(row.currentPaddockUuid ?? '').trim();
    const color = String(row.color ?? '').trim();
    const description = String(row.description ?? '').trim();

    if (chip) {
      payload.chip_number = chip;
    }
    if (mother) {
      payload.mother_registration_number = mother;
    }
    if (father) {
      payload.father_registration_number = father;
    }
    if (owner) {
      payload.current_owner_uuid = owner;
    }
    if (paddock) {
      payload.current_paddock_uuid = paddock;
    }
    if (color) {
      payload.color = color;
    }
    if (description) {
      payload.description = description;
    }
    return payload;
  }

  private extractApiError(error: unknown): string {
    return translateAnimalWriteError(this.i18n, error, 'animal.individualSaveError');
  }

  private createRowGroup(seed: AnimalBatchDraftRow): FormGroup {
    return this.fb.group({
      registrationNumber: [seed.registrationNumber],
      chipNumber: [seed.chipNumber],
      ranchUuid: [seed.ranchUuid],
      breedCode: [seed.breedCode || 'UNKNOWN'],
      motherRegistrationNumber: [seed.motherRegistrationNumber],
      fatherRegistrationNumber: [seed.fatherRegistrationNumber],
      currentOwnerUuid: [seed.currentOwnerUuid],
      currentPaddockUuid: [seed.currentPaddockUuid],
      sex: [seed.sex || 'MALE'],
      color: [seed.color],
      birthDate: [seed.birthDate],
      originType: [seed.originType || 'UNKNOWN'],
      description: [seed.description]
    });
  }

  private emptyRowControlValues(): AnimalBatchDraftRow {
    const empty = emptyBatchDraftRow();
    return {
      ...empty,
      breedCode: 'UNKNOWN',
      sex: 'MALE',
      originType: 'UNKNOWN'
    };
  }
}
