import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  NgZone,
  AfterViewInit,
  OnDestroy,
  OnInit,
  ViewChild
} from '@angular/core';
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
import {
  ANIMAL_BATCH_TABLE_COLUMNS,
  AnimalBatchColumnKey,
  isAnimalBatchOptionalColumnKey
} from '../../constants/animal-batch-column-keys';
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
import { normalizePastedCellValue } from '../../utils/animal-batch-grid-paste.util';
import {
  gridSelectionBounds,
  GridCellCoord,
  isCoordInGridSelection,
  matrixToClipboardText,
  parseClipboardMatrix
} from '../../utils/animal-batch-grid-selection.util';
import { parseBatchRowTargets } from '../../utils/animal-batch-row-targets.util';

const FEEDBACK_SUCCESS_AUTO_DISMISS_MS = 5000;
const BATCH_HINTS_VISIBLE_MS = 20_000;

@Component({
  selector: 'app-animal-batch-register',
  templateUrl: './animal-batch-register.component.html',
  styleUrls: ['./animal-batch-register.component.scss']
})
export class AnimalBatchRegisterComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly minSlots = ANIMAL_BATCH_MIN_ROW_SLOTS;
  readonly maxSlots = ANIMAL_BATCH_MAX_ROW_SLOTS;
  readonly breedCodes = [...CATTLE_BREED_CODES];
  readonly optionalColumns = ANIMAL_BATCH_OPTIONAL_COLUMNS;
  readonly tableColumns = ANIMAL_BATCH_TABLE_COLUMNS;

  visibleOptionalColumns: Record<AnimalBatchOptionalColumnKey, boolean> = {
    ...ANIMAL_BATCH_DEFAULT_OPTIONAL_COLUMN_VISIBILITY
  };

  @ViewChild('excelFileInput') excelFileInput?: ElementRef<HTMLInputElement>;
  @ViewChild('batchGridScroll') batchGridScroll?: ElementRef<HTMLElement>;
  @ViewChild('batchHintsDetails') batchHintsDetails?: ElementRef<HTMLDetailsElement>;

  form: FormGroup;
  requestedSlotCount = ANIMAL_BATCH_DEFAULT_ROW_SLOTS;
  feedback: { type: 'success' | 'error'; message: string } | null = null;
  savingBatch = false;
  batchTableAlive = true;

  ranchRows: RanchOption[] = [];
  ownerRows: OwnerOptionDto[] = [];

  /** 1-based row number shown in the grid (# column). */
  modelRowNumber = 1;
  targetRowsSpec = '';
  copyOnlyEmptyTargets = true;
  copyFullRow = false;

  gridSelecting = false;

  private gridSelectionAnchor: GridCellCoord | null = null;
  private gridSelectionEnd: GridCellCoord | null = null;
  private gridInternalClipboard: string | null = null;
  private feedbackDismissTimer?: ReturnType<typeof globalThis.setTimeout>;
  private hintsCollapseTimer?: ReturnType<typeof globalThis.setTimeout>;
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

  get visibleDataColumnKeys(): AnimalBatchColumnKey[] {
    return ANIMAL_BATCH_TABLE_COLUMNS.filter((col) => this.isTableColumnVisible(col.key)).map((col) => col.key);
  }

  get hasGridCellSelection(): boolean {
    return this.gridSelectionAnchor !== null && this.gridSelectionEnd !== null;
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

  columnIndex(key: AnimalBatchColumnKey): number {
    return this.visibleDataColumnKeys.indexOf(key);
  }

  isCellSelected(row: number, key: AnimalBatchColumnKey): boolean {
    const col = this.columnIndex(key);
    if (col < 0) {
      return false;
    }
    return isCoordInGridSelection(row, col, this.getGridSelectionBounds());
  }

  isActiveCell(row: number, key: AnimalBatchColumnKey): boolean {
    if (!this.gridSelectionAnchor || !this.gridSelectionEnd) {
      return false;
    }
    const col = this.columnIndex(key);
    return (
      col >= 0 &&
      this.gridSelectionAnchor.row === row &&
      this.gridSelectionAnchor.col === col &&
      this.gridSelectionEnd.row === row &&
      this.gridSelectionEnd.col === col
    );
  }

  onBatchCellMouseDown(event: MouseEvent, row: number, key: AnimalBatchColumnKey): void {
    if (this.savingBatch || event.button !== 0) {
      return;
    }
    const col = this.columnIndex(key);
    if (col < 0) {
      return;
    }

    const target = event.target as HTMLElement;
    const isEditor = !!target.closest('input, select, textarea, button');

    if (event.shiftKey && this.gridSelectionAnchor) {
      this.gridSelectionEnd = { row, col };
      this.cdr.markForCheck();
      return;
    }

    this.gridSelectionAnchor = { row, col };
    this.gridSelectionEnd = { row, col };
    this.gridSelecting = true;

    if (!isEditor) {
      event.preventDefault();
      this.focusBatchGrid();
    }
    this.cdr.markForCheck();
  }

  onBatchCellMouseEnter(row: number, key: AnimalBatchColumnKey): void {
    if (!this.gridSelecting) {
      return;
    }
    const col = this.columnIndex(key);
    if (col < 0) {
      return;
    }
    this.gridSelectionEnd = { row, col };
    this.cdr.markForCheck();
  }

  onBatchGridKeydown(event: KeyboardEvent): void {
    if (this.savingBatch) {
      return;
    }
    const mod = event.ctrlKey || event.metaKey;
    if (mod && event.key === 'c') {
      if (this.shouldUseGridClipboard(event)) {
        event.preventDefault();
        void this.copyGridSelection();
      }
      return;
    }
    if (mod && event.key === 'v') {
      if (this.shouldUseGridPaste(event)) {
        event.preventDefault();
        void this.pasteIntoGrid();
      }
      return;
    }
    if (event.key === 'Escape') {
      this.clearGridSelection();
      return;
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const target = event.target as HTMLElement;
      if (target.closest('input, select, textarea') && !this.hasMultiCellGridSelection()) {
        return;
      }
      if (this.hasGridCellSelection) {
        event.preventDefault();
        this.clearGridSelectionValues();
      }
    }
  }

  @HostListener('document:mouseup')
  onDocumentMouseUp(): void {
    this.gridSelecting = false;
  }

  @HostListener('document:keydown', ['$event'])
  onDocumentKeydown(event: KeyboardEvent): void {
    if (!this.isBatchGridKeyboardEvent(event)) {
      return;
    }
    this.onBatchGridKeydown(event);
  }

  private shouldUseGridClipboard(event: KeyboardEvent): boolean {
    if (!this.hasGridCellSelection) {
      return false;
    }
    if (this.hasMultiCellGridSelection()) {
      return true;
    }
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === this.batchGridScroll?.nativeElement) {
      return true;
    }
    const input = el.closest('.animal-batch-cell input, .animal-batch-cell select') as
      | HTMLInputElement
      | HTMLSelectElement
      | null;
    if (!input) {
      return true;
    }
    if (input instanceof HTMLInputElement && input.selectionStart !== input.selectionEnd) {
      return false;
    }
    return true;
  }

  private shouldUseGridPaste(event: KeyboardEvent): boolean {
    if (this.hasGridCellSelection) {
      return true;
    }
    const el = document.activeElement as HTMLElement | null;
    return !!el && (el === this.batchGridScroll?.nativeElement || !el.closest('.animal-batch-cell input, .animal-batch-cell select'));
  }

  private isBatchGridKeyboardEvent(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) {
      return false;
    }
    if (target.closest('.animal-batch-scroll')) {
      return true;
    }
    return !!this.batchGridScroll?.nativeElement.contains(target);
  }

  private focusBatchGrid(): void {
    this.batchGridScroll?.nativeElement.focus();
  }

  private getGridSelectionBounds() {
    return gridSelectionBounds(this.gridSelectionAnchor, this.gridSelectionEnd);
  }

  private hasMultiCellGridSelection(): boolean {
    const bounds = this.getGridSelectionBounds();
    if (!bounds) {
      return false;
    }
    return bounds.rowMin !== bounds.rowMax || bounds.colMin !== bounds.colMax;
  }

  private clearGridSelection(): void {
    this.gridSelectionAnchor = null;
    this.gridSelectionEnd = null;
    this.cdr.markForCheck();
  }

  private getCellExportValue(row: number, key: AnimalBatchColumnKey): string {
    const g = this.rows.at(row) as FormGroup | null;
    if (!g) {
      return '';
    }
    return String(g.get(key)?.value ?? '').trim();
  }

  private async copyGridSelection(): Promise<void> {
    const bounds = this.getGridSelectionBounds();
    if (!bounds) {
      return;
    }
    const matrix: string[][] = [];
    for (let r = bounds.rowMin; r <= bounds.rowMax; r++) {
      const line: string[] = [];
      for (let c = bounds.colMin; c <= bounds.colMax; c++) {
        const key = this.visibleDataColumnKeys[c];
        line.push(this.getCellExportValue(r, key));
      }
      matrix.push(line);
    }
    const text = matrixToClipboardText(matrix);
    this.gridInternalClipboard = text;
    try {
      await navigator.clipboard.writeText(text);
      this.setFeedback({ type: 'success', message: this.i18n.translate('animal.batchGridCopyDone') });
    } catch {
      this.setFeedback({ type: 'success', message: this.i18n.translate('animal.batchGridCopyDoneInternal') });
    }
  }

  private async pasteIntoGrid(): Promise<void> {
    let text = this.gridInternalClipboard ?? '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      if (!text) {
        this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchGridPasteError') });
        return;
      }
    }

    const matrix = parseClipboardMatrix(text);
    if (matrix.length === 0) {
      return;
    }

    const origin = this.getGridPasteOrigin();
    if (!origin) {
      return;
    }

    const keys = this.visibleDataColumnKeys;
    const ranchesToLoad = new Set<string>();
    let pastedCells = 0;

    for (let dr = 0; dr < matrix.length; dr++) {
      const rowIndex = origin.row + dr;
      if (rowIndex >= this.rows.length) {
        break;
      }
      const line = matrix[dr];
      const rowGroup = this.rows.at(rowIndex) as FormGroup;
      const rowRanch = String(rowGroup.get('ranchUuid')?.value ?? '').trim();

      for (let dc = 0; dc < line.length; dc++) {
        const colIndex = origin.col + dc;
        if (colIndex >= keys.length) {
          break;
        }
        const key = keys[colIndex];
        const normalized = normalizePastedCellValue(key, line[dc], this.buildPasteContext(rowRanch), rowRanch);
        const patch: Partial<AnimalBatchDraftRow> = { [key]: normalized };
        if (key === 'ranchUuid') {
          patch.currentPaddockUuid = '';
          if (normalized) {
            ranchesToLoad.add(normalized);
          }
        }
        rowGroup.patchValue(patch);
        pastedCells++;
      }
    }

    for (const ranch of ranchesToLoad) {
      this.ensurePaddocksLoaded(ranch);
    }

    if (pastedCells > 0) {
      this.setFeedback({
        type: 'success',
        message: this.i18n.translate('animal.batchGridPasteDone', { count: String(pastedCells) })
      });
      this.cdr.markForCheck();
    }
  }

  private getGridPasteOrigin(): GridCellCoord | null {
    const bounds = this.getGridSelectionBounds();
    if (bounds) {
      return { row: bounds.rowMin, col: bounds.colMin };
    }
    return this.gridSelectionAnchor;
  }

  private buildPasteContext(rowRanchUuid: string) {
    return {
      ranchRows: this.ranchRows,
      ownerRows: this.ownerRows,
      getPaddocksForRanch: (ranchUuid: string) => this.paddockCache.get(ranchUuid) ?? [],
      breedCodes: this.breedCodes,
      breedLabel: (code: string) => this.breedLabel(code),
      maleLabel: this.i18n.translate('animal.male'),
      femaleLabel: this.i18n.translate('animal.female'),
      originLabels: {
        UNKNOWN: this.i18n.translate('animal.originUnknown'),
        BIRTH: this.i18n.translate('animal.originBirth'),
        PURCHASE: this.i18n.translate('animal.originPurchase'),
        TRANSFER: this.i18n.translate('animal.originTransfer')
      }
    };
  }

  private clearGridSelectionValues(): void {
    const bounds = this.getGridSelectionBounds();
    if (!bounds) {
      return;
    }
    const empty = this.emptyRowControlValues();
    for (let r = bounds.rowMin; r <= bounds.rowMax; r++) {
      const rowGroup = this.rows.at(r) as FormGroup;
      for (let c = bounds.colMin; c <= bounds.colMax; c++) {
        const key = this.visibleDataColumnKeys[c];
        const patch: Partial<AnimalBatchDraftRow> = { [key]: empty[key] };
        if (key === 'ranchUuid') {
          patch.currentPaddockUuid = empty.currentPaddockUuid;
        }
        rowGroup.patchValue(patch);
      }
    }
    this.cdr.markForCheck();
  }

  applyModelRowToOthers(): void {
    const n = this.rows.length;
    if (n < 2) {
      return;
    }
    const src = Math.min(Math.max(1, Math.floor(this.modelRowNumber)), n) - 1;
    const parsed = parseBatchRowTargets(this.targetRowsSpec, n, { excludeIndex: src });
    if ('error' in parsed) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchCopyInvalidTargets') });
      return;
    }
    if (parsed.indices.length === 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchCopyNoTargets') });
      return;
    }

    const sourceGroup = this.rows.at(src) as FormGroup;
    const full = sourceGroup.getRawValue() as AnimalBatchDraftRow;
    const template = this.copyFullRow
      ? full
      : (() => {
          const { registrationNumber: _reg, chipNumber: _chip, ...rest } = full;
          return rest;
        })();

    const targetIndices = parsed.indices.filter((idx) => {
      if (this.copyOnlyEmptyTargets && batchDraftRowHasData((this.rows.at(idx) as FormGroup).getRawValue() as AnimalBatchDraftRow)) {
        return false;
      }
      return true;
    });

    if (targetIndices.length === 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchCopyNoTargets') });
      return;
    }

    if (!this.copyOnlyEmptyTargets) {
      const wouldOverwrite = targetIndices.some((idx) =>
        batchDraftRowHasData((this.rows.at(idx) as FormGroup).getRawValue() as AnimalBatchDraftRow)
      );
      if (wouldOverwrite) {
        const confirmKey = this.copyFullRow ? 'animal.batchCopyOverwriteConfirmFull' : 'animal.batchCopyModelConfirm';
        const ok = globalThis.confirm(this.i18n.translate(confirmKey));
        if (!ok) {
          return;
        }
      }
    }

    for (const idx of targetIndices) {
      const row = this.rows.at(idx) as FormGroup;
      row.patchValue(template);
      const ranch = row.get('ranchUuid')?.value;
      if (ranch) {
        this.ensurePaddocksLoaded(String(ranch));
      }
    }
    this.setFeedback({
      type: 'success',
      message: this.i18n.translate('animal.batchCopyModelDone', { count: String(targetIndices.length) })
    });
  }

  columnHasData(key: AnimalBatchColumnKey): boolean {
    const emptyDefaults = this.emptyRowControlValues();
    for (let i = 0; i < this.rows.length; i++) {
      const row = (this.rows.at(i) as FormGroup).getRawValue() as AnimalBatchDraftRow;
      if (this.columnValueDiffersFromEmpty(key, row[key], emptyDefaults[key])) {
        return true;
      }
    }
    return false;
  }

  isTableColumnVisible(key: AnimalBatchColumnKey): boolean {
    if (!isAnimalBatchOptionalColumnKey(key)) {
      return true;
    }
    return this.isOptionalColumnVisible(key);
  }

  columnLabelKey(key: AnimalBatchColumnKey): string {
    const col = this.tableColumns.find((c) => c.key === key);
    return col?.labelKey ?? key;
  }

  clearBatchColumn(key: AnimalBatchColumnKey): void {
    if (!this.isTableColumnVisible(key) || !this.columnHasData(key)) {
      return;
    }

    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = 'animal.batchClearColumnConfirmTitle';
    dialog.messageKey = 'animal.batchClearColumnConfirm';
    dialog.messageParams = { column: this.i18n.translate(this.columnLabelKey(key)) };
    dialog.confirmKey = 'common.confirm';
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = 'btn-danger';

    modalRef.result.then(
      () => this.executeClearBatchColumn(key),
      () => undefined
    );
  }

  private executeClearBatchColumn(key: AnimalBatchColumnKey): void {
    const emptyDefaults = this.emptyRowControlValues();
    const clearValue = emptyDefaults[key];
    for (let i = 0; i < this.rows.length; i++) {
      const row = this.rows.at(i) as FormGroup;
      const patch: Partial<AnimalBatchDraftRow> = { [key]: clearValue };
      if (key === 'ranchUuid') {
        patch.currentPaddockUuid = emptyDefaults.currentPaddockUuid;
      }
      row.patchValue(patch);
    }
    this.setFeedback({
      type: 'success',
      message: this.i18n.translate('animal.batchClearColumnDone', {
        column: this.i18n.translate(this.columnLabelKey(key))
      })
    });
    this.cdr.markForCheck();
  }

  private columnValueDiffersFromEmpty(
    key: AnimalBatchColumnKey,
    value: string | AnimalBatchDraftRow['sex'] | AnimalBatchDraftRow['originType'],
    emptyValue: string | AnimalBatchDraftRow['sex'] | AnimalBatchDraftRow['originType']
  ): boolean {
    const s = (v: unknown) => String(v ?? '').trim();
    if (key === 'breedCode') {
      const v = s(value);
      return v !== '' && v !== 'UNKNOWN';
    }
    if (key === 'sex') {
      const v = s(value);
      return v !== '' && v !== 'MALE';
    }
    if (key === 'originType') {
      const v = s(value);
      return v !== '' && v !== 'UNKNOWN';
    }
    return s(value) !== s(emptyValue);
  }

  private setFeedback(
    next: { type: 'success' | 'error'; message: string } | null,
    options?: { autoDismissMs?: number }
  ): void {
    if (this.feedbackDismissTimer) {
      globalThis.clearTimeout(this.feedbackDismissTimer);
      this.feedbackDismissTimer = undefined;
    }
    this.feedback = next;
    if (next?.type === 'success') {
      const ms = options?.autoDismissMs ?? FEEDBACK_SUCCESS_AUTO_DISMISS_MS;
      this.feedbackDismissTimer = globalThis.setTimeout(() => {
        if (this.feedback?.message === next.message) {
          this.feedback = null;
          this.cdr.markForCheck();
        }
        this.feedbackDismissTimer = undefined;
      }, ms);
    }
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

  ngAfterViewInit(): void {
    this.hintsCollapseTimer = globalThis.setTimeout(() => this.collapseBatchHints(), BATCH_HINTS_VISIBLE_MS);
  }

  ngOnDestroy(): void {
    if (this.feedbackDismissTimer) {
      globalThis.clearTimeout(this.feedbackDismissTimer);
    }
    if (this.hintsCollapseTimer) {
      globalThis.clearTimeout(this.hintsCollapseTimer);
    }
    this.persistDraftNow();
    this.draftPersistSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  private collapseBatchHints(): void {
    const el = this.batchHintsDetails?.nativeElement;
    if (el) {
      el.open = false;
    }
    this.hintsCollapseTimer = undefined;
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
    this.setFeedback(null);
    if (!file) {
      return;
    }

    file
      .arrayBuffer()
      .then((buffer) => {
        const parseResult = this.excelImport.parseFirstSheet(buffer);
        const imported = parseResult.rows;
        if (imported.length === 0) {
          this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchImportEmpty') });
          return;
        }
        const slotCount = this.clampSlotCount(Math.max(this.minSlots, imported.length));
        this.requestedSlotCount = slotCount;
        const merged = this.excelImport.mergeIntoSlotCount(imported, slotCount);
        this.applyOptionalColumnsFromExcelImport(parseResult.optionalColumnsInFile);
        this.rebuildRows(slotCount, merged);
        this.setFeedback({
          type: 'success',
          message: this.i18n.translate('animal.batchImportSuccess', { count: String(imported.length) })
        });
      })
      .catch(() => {
        this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchImportError') });
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
      this.setFeedback(null);
      this.draftStorage.clear();
      this.suppressDraftPersist = true;
      this.remountBatchTableWithRows(rowCount, []);
      globalThis.setTimeout(() => {
        this.suppressDraftPersist = false;
      }, ANIMAL_BATCH_PERSIST_DEBOUNCE_MS + 100);
      this.setFeedback({ type: 'success', message: this.i18n.translate('animal.batchClearDone') });
    });
  }

  async saveBatch(): Promise<void> {
    this.setFeedback(null);
    const values = this.rows.getRawValue() as AnimalBatchDraftRow[];
    const filledRows = values
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => batchDraftRowHasData(row));
    const filled = filledRows.map(({ row }) => row);
    if (filled.length === 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchNoRows') });
      return;
    }
    const missingCore = filled.some(
      (r) =>
        !String(r.registrationNumber ?? '').trim() ||
        !String(r.ranchUuid ?? '').trim() ||
        !String(r.sex ?? '').trim() ||
        !String(r.birthDate ?? '').trim()
    );
    if (missingCore) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchMissingRequiredFields') });
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
      this.setFeedback({ type: 'error', message: this.extractApiError(error) });
      return;
    }
    this.savingBatch = false;

    if (!batchResult) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.individualSaveError') });
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
      this.setFeedback({
        type: 'success',
        message: this.i18n.translate('animal.batchSaveApiDone', { count: String(successes.length) })
      });
      return;
    }

    for (const success of successes) {
      const g = this.rows.at(success.index) as FormGroup | null;
      g?.patchValue(emptyBatchDraftRow());
    }
    this.persistDraftNow();

    const failedRows = failures.map((f) => String(f.index + 1)).join(', ');
    const firstReason = failures[0].error ?? this.i18n.translate('animal.individualSaveError');
    this.setFeedback({
      type: 'error',
      message: this.i18n.translate('animal.batchSaveApiPartial', {
        success: String(successes.length),
        failed: String(failures.length),
        rows: failedRows,
        reason: firstReason
      })
    });
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
      registration_number: String(row.registrationNumber ?? '').trim(),
      sex: row.sex as 'MALE' | 'FEMALE',
      birth_date: String(row.birthDate ?? '').trim(),
      origin_type: (String(row.originType ?? '').trim() || 'UNKNOWN') as AnimalCreatePayload['origin_type']
    };

    const breed = String(row.breedCode ?? '').trim();
    if (breed) {
      payload.breed_code = breed;
    }

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
      breedCode: [seed.breedCode || ''],
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
      sex: 'MALE',
      originType: 'UNKNOWN'
    };
  }
}
