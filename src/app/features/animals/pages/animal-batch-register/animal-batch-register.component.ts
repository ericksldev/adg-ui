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
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin, of, Subject, Subscription } from 'rxjs';
import { catchError, debounceTime, finalize, map, takeUntil, tap } from 'rxjs/operators';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmDialogComponent } from 'src/app/shared/components/modals/confirm-dialog/confirm-dialog.component';
import { I18nService } from 'src/app/core/services/i18n.service';
import { SessionService } from 'src/app/core/services/session.service';
import { translateAnimalWriteError } from 'src/app/core/utils/animal-write-error.util';
import { readLocalStorageMigrating } from 'src/app/core/utils/legacy-local-storage';
import { RanchOption } from 'src/app/features/users/models/user-management.model';
import { UserManagementService } from 'src/app/features/users/services/user-management.service';
import {
  ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX,
  ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX_LEGACY,
  ANIMAL_BATCH_CATEGORY_ASSIGN_POOL,
  ANIMAL_BATCH_DEFAULT_OPTIONAL_COLUMN_VISIBILITY,
  ANIMAL_BATCH_DEFAULT_PAGE_SIZE,
  ANIMAL_BATCH_OPTIONAL_COLUMNS,
  ANIMAL_BATCH_PAGE_SIZE_OPTIONS,
  ANIMAL_BATCH_PERSIST_DEBOUNCE_MS,
  ANIMAL_BATCH_SAVE_CHUNK_SIZE,
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
import { PendingAnimalBatchNavigationState } from '../../models/animal-batch-pending-handoff.model';
import { AnimalBatchCreateRequestBody, AnimalBatchRowResultDto } from '../../models/animal-batch-create.model';
import { AnimalCreatePayload } from '../../models/animal-create-payload.model';
import { AnimalApiService, OwnerOptionDto, PaddockOptionDto } from '../../services/animal-api.service';
import { AnimalBatchDraftStorageService } from '../../services/animal-batch-draft-storage.service';
import { AnimalBatchExcelImportService } from '../../services/animal-batch-excel-import.service';
import { CategoryMultiSelectOption } from '../../components/category-multi-select/category-multi-select.component';
import { LivestockCategory } from 'src/app/features/configuration/models/livestock-category.model';
import { LivestockCategoryApiService } from 'src/app/features/configuration/services/livestock-category-api.service';
import { batchDraftRowHasData, emptyBatchDraftRow, matchBatchCategoryIds, optionalColumnVisibilityForImport } from '../../utils/animal-batch-draft.utils';
import {
  batchSelectExportLabel,
  BatchSelectIssue,
  isBatchSelectColumn,
  resolveBatchDraftRowSelects,
  resolveBatchSelectCell
} from '../../utils/animal-batch-grid-paste.util';
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
  readonly pageSizeOptions = ANIMAL_BATCH_PAGE_SIZE_OPTIONS;
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
  page = 1;
  pageSize = ANIMAL_BATCH_DEFAULT_PAGE_SIZE;
  draftReady = false;
  feedback: { type: 'success' | 'error'; message: string } | null = null;
  savingBatch = false;
  templateDownloading = false;
  selectIssueCount = 0;
  pendingSelectCheckCount = 0;
  batchTableAlive = true;
  fromPendingRegistrations = false;

  ranchRows: RanchOption[] = [];
  ownerRows: OwnerOptionDto[] = [];
  categoryOptions: LivestockCategory[] = [];

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
  private readonly selectIssues = new Map<string, BatchSelectIssue & { clearOnMiss: boolean }>();
  private ranchCatalogReady = false;
  private ownerCatalogReady = false;
  private catalogsReady = false;
  private readonly pendingBatchSeeds: AnimalBatchDraftRow[];
  /** Full import or manual grid. Only the current page is bound to `form`. */
  private draftRows: AnimalBatchDraftRow[] = [];
  private columnsWithData = new Set<AnimalBatchColumnKey>();

  constructor(
    private readonly fb: FormBuilder,
    private readonly draftStorage: AnimalBatchDraftStorageService,
    private readonly excelImport: AnimalBatchExcelImportService,
    private readonly i18n: I18nService,
    private readonly sessionService: SessionService,
    private readonly userManagementService: UserManagementService,
    private readonly animalApi: AnimalApiService,
    private readonly livestockCategoryApi: LivestockCategoryApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly ngZone: NgZone,
    private readonly modalService: NgbModal,
    private readonly router: Router
  ) {
    this.form = this.fb.group({
      rows: this.fb.array([])
    });
    this.pendingBatchSeeds = this.readPendingBatchSeeds();
  }

  get categorySelectOptions(): CategoryMultiSelectOption[] {
    return this.categoryOptions.map((category) => ({ value: category.category_uuid, label: category.name }));
  }

  categoryIdsForRow(index: number): string[] {
    const raw = String((this.rows.at(index) as FormGroup | null)?.get('categories')?.value ?? '');
    return matchBatchCategoryIds(raw, this.categoryOptions).ids;
  }

  onRowCategoriesChange(index: number, ids: string[]): void {
    (this.rows.at(index) as FormGroup | null)?.get('categories')?.setValue(ids.join(','));
  }

  get rows(): FormArray {
    return this.form.get('rows') as FormArray;
  }

  get totalDataRows(): number {
    return this.draftRows.length;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.draftRows.length / this.pageSize));
  }

  get showingFrom(): number {
    if (this.rows.length === 0 || this.draftRows.length === 0) {
      return 0;
    }
    return this.pageStart + 1;
  }

  get showingTo(): number {
    return this.pageStart + this.rows.length;
  }

  pageRowNumber(localIndex: number): number {
    return this.pageStart + localIndex + 1;
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
    this.clearSelectIssue(this.absoluteIndex(index), 'currentPaddockUuid');
    const ranch = g.get('ranchUuid')?.value;
    if (ranch && this.isKnownRanchUuid(String(ranch))) {
      this.ensurePaddocksLoaded(String(ranch));
    }
  }

  onBatchSelectChange(index: number, key: AnimalBatchColumnKey): void {
    this.clearSelectIssue(this.absoluteIndex(index), key);
    if (key === 'ranchUuid') {
      this.onRanchChange(index);
    }
  }

  selectIssue(index: number, key: AnimalBatchColumnKey): (BatchSelectIssue & { clearOnMiss: boolean }) | null {
    const issue = this.selectIssues.get(this.issueId(this.absoluteIndex(index), key));
    if (!issue || issue.reason === 'pendingCatalog') {
      return null;
    }
    return issue;
  }

  selectIssueMessage(issue: BatchSelectIssue): string {
    const key = issue.reason === 'needsRanch' ? 'animal.batchSelectNeedsRanch' : 'animal.batchSelectUnmatched';
    return this.i18n.translate(key, { value: issue.raw });
  }

  canDismissSelectIssue(key: AnimalBatchColumnKey): boolean {
    return key !== 'ranchUuid' && key !== 'sex';
  }

  applySelectSuggestion(index: number, key: AnimalBatchColumnKey): void {
    const issue = this.selectIssues.get(this.issueId(this.absoluteIndex(index), key));
    if (!issue?.suggestionValue) {
      return;
    }
    const group = this.rows.at(index) as FormGroup | null;
    if (!group) {
      return;
    }
    group.patchValue({ [key]: issue.suggestionValue });
    this.clearSelectIssue(this.absoluteIndex(index), key);
    if (key === 'ranchUuid') {
      this.onRanchChange(index);
    }
  }

  dismissSelectIssue(index: number, key: AnimalBatchColumnKey): void {
    if (!this.canDismissSelectIssue(key)) {
      return;
    }
    const group = this.rows.at(index) as FormGroup | null;
    group?.patchValue({ [key]: '' });
    this.clearSelectIssue(this.absoluteIndex(index), key);
  }

  downloadExcelTemplate(): void {
    if (this.templateDownloading) {
      return;
    }
    this.templateDownloading = true;
    const loads = this.ranchRows.map((ranch) => {
      const cached = this.paddockCache.get(ranch.uuid_ranch);
      if (cached) {
        return of({ ranch, paddocks: cached });
      }
      return this.animalApi.getPaddocksForRanch(ranch.uuid_ranch).pipe(
        catchError(() => of([] as PaddockOptionDto[])),
        map((paddocks) => {
          this.paddockCache.set(ranch.uuid_ranch, paddocks);
          return { ranch, paddocks };
        })
      );
    });

    const source = loads.length > 0 ? forkJoin(loads) : of([]);
    source.pipe(finalize(() => {
      this.templateDownloading = false;
      this.cdr.markForCheck();
    }), takeUntil(this.destroy$)).subscribe({
      next: (groups) => this.emitTemplateDownload(groups),
      error: () => {
        this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchDownloadTemplateError') });
      }
    });
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
    if (target.closest('app-category-multi-select')) {
      return;
    }
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
    const value = String(g.get(key)?.value ?? '').trim();
    const label = batchSelectExportLabel(key, value, this.buildPasteContext(String(g.get('ranchUuid')?.value ?? '')));
    return label ?? value;
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
      const localIndex = origin.row + dr;
      const absoluteIndex = this.pageStart + localIndex;
      if (absoluteIndex >= this.draftRows.length) {
        break;
      }
      const line = matrix[dr];
      const onPage = localIndex < this.rows.length;
      const rowGroup = onPage ? (this.rows.at(localIndex) as FormGroup) : null;
      let rowRanch = onPage
        ? String(rowGroup?.get('ranchUuid')?.value ?? '').trim()
        : String(this.draftRows[absoluteIndex]?.ranchUuid ?? '').trim();
      const overflowPatch: Partial<AnimalBatchDraftRow> = {};

      for (let dc = 0; dc < line.length; dc++) {
        const colIndex = origin.col + dc;
        if (colIndex >= keys.length) {
          break;
        }
        const key = keys[colIndex];
        const resolved = resolveBatchSelectCell(key, line[dc], this.buildPasteContext(rowRanch), rowRanch, true);
        this.storeSelectResolution(absoluteIndex, key, resolved.issue, true);
        const patch: Partial<AnimalBatchDraftRow> = { [key]: resolved.value };
        if (key === 'ranchUuid') {
          patch.currentPaddockUuid = '';
          this.clearSelectIssue(absoluteIndex, 'currentPaddockUuid');
          rowRanch = resolved.issue?.reason === 'pendingCatalog' ? resolved.issue.raw : resolved.value;
          if (this.isKnownRanchUuid(resolved.value)) {
            ranchesToLoad.add(resolved.value);
          }
        }
        if (rowGroup) {
          rowGroup.patchValue(patch);
        } else {
          Object.assign(overflowPatch, patch);
        }
        pastedCells++;
      }

      if (!onPage) {
        this.draftRows[absoluteIndex] = { ...this.draftRows[absoluteIndex], ...overflowPatch };
      }
    }

    for (const ranch of ranchesToLoad) {
      this.ensurePaddocksLoaded(ranch);
    }

    if (pastedCells > 0) {
      this.flushPageToDraft();
      this.refreshColumnDataFlags();
      this.refreshSelectIssueCount();
      this.persistDraftNow();
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
      },
      isRanchCatalogReady: this.ranchCatalogReady,
      isOwnerCatalogReady: this.ownerCatalogReady,
      isPaddockCatalogReady: (ranchUuid: string) => this.paddockCache.has(ranchUuid)
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
    this.flushPageToDraft();
    const n = this.draftRows.length;
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

    const full = this.draftRows[src];
    const template = this.copyFullRow
      ? full
      : (() => {
          const { registrationNumber: _reg, chipNumber: _chip, ...rest } = full;
          return rest;
        })();

    const targetIndices = parsed.indices.filter((idx) => {
      if (this.copyOnlyEmptyTargets && batchDraftRowHasData(this.draftRows[idx])) {
        return false;
      }
      return true;
    });

    if (targetIndices.length === 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchCopyNoTargets') });
      return;
    }

    if (!this.copyOnlyEmptyTargets) {
      const wouldOverwrite = targetIndices.some((idx) => batchDraftRowHasData(this.draftRows[idx]));
      if (wouldOverwrite) {
        const confirmKey = this.copyFullRow ? 'animal.batchCopyOverwriteConfirmFull' : 'animal.batchCopyModelConfirm';
        const ok = globalThis.confirm(this.i18n.translate(confirmKey));
        if (!ok) {
          return;
        }
      }
    }

    for (const idx of targetIndices) {
      this.draftRows[idx] = { ...this.draftRows[idx], ...template };
      const ranch = this.draftRows[idx].ranchUuid;
      if (ranch) {
        this.ensurePaddocksLoaded(String(ranch));
      }
    }
    this.mountCurrentPage();
    this.persistDraftNow();
    this.setFeedback({
      type: 'success',
      message: this.i18n.translate('animal.batchCopyModelDone', { count: String(targetIndices.length) })
    });
  }

  columnHasData(key: AnimalBatchColumnKey): boolean {
    return this.columnsWithData.has(key);
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
    this.flushPageToDraft();
    const emptyDefaults = this.emptyRowControlValues();
    const clearValue = emptyDefaults[key];
    for (let i = 0; i < this.draftRows.length; i++) {
      const patch: Partial<AnimalBatchDraftRow> = { [key]: clearValue };
      if (key === 'ranchUuid') {
        patch.currentPaddockUuid = emptyDefaults.currentPaddockUuid;
      }
      this.draftRows[i] = { ...this.draftRows[i], ...patch };
      this.selectIssues.delete(this.issueId(i, key));
      if (key === 'ranchUuid') {
        this.selectIssues.delete(this.issueId(i, 'currentPaddockUuid'));
      }
    }
    this.refreshSelectIssueCount();
    this.mountCurrentPage();
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
        catchError(() => of([] as PaddockOptionDto[])),
        takeUntil(this.destroy$),
        finalize(() => this.paddockLoading.delete(r))
      )
      .subscribe((list) => {
        this.paddockCache.set(r, list);
        this.reconcilePaddockColumn(r);
        this.reapplyClearedIssues();
        this.cdr.markForCheck();
      });
  }

  private preloadPaddocksForAllRanches(): void {
    const seen = new Set<string>();
    for (const row of this.draftRows) {
      const key = String(row.ranchUuid ?? '').trim();
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
      owners: this.animalApi.getOwners().pipe(catchError(() => of([]))),
      categories: this.livestockCategoryApi.listCategories(false).pipe(catchError(() => of([] as LivestockCategory[])))
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ ranches, owners, categories }) => {
        this.ranchRows = ranches;
        this.ownerRows = owners;
        this.categoryOptions = categories;
        this.ranchCatalogReady = true;
        this.ownerCatalogReady = true;
        this.catalogsReady = true;
        if (this.draftReady) {
          this.reconcileVisibleSelects(false);
          this.preloadPaddocksForAllRanches();
          this.persistDraftNow();
        }
      });

    if (this.pendingBatchSeeds.length > 0) {
      this.fromPendingRegistrations = true;
      this.page = 1;
      this.draftRows = this.pendingBatchSeeds.map((row) => this.normalizeDraftRow(row));
      this.draftReady = true;
      this.mountCurrentPage();
      this.preloadPaddocksForAllRanches();
      this.persistDraftNow();
      return;
    }

    void this.loadStoredDraft();
  }

  private async loadStoredDraft(): Promise<void> {
    let draft: AnimalBatchDraftSnapshot | null = null;
    try {
      draft = await this.draftStorage.load();
    } catch {
      draft = null;
    }
    if (this.destroy$.closed) {
      return;
    }
    if (draft && draft.rows.length > 0) {
      this.pageSize = this.clampPageSize(draft.pageSize ?? ANIMAL_BATCH_DEFAULT_PAGE_SIZE);
      this.page = 1;
      this.draftRows = draft.rows.map((row) => this.normalizeDraftRow(row));
    } else {
      this.useBlankGrid(ANIMAL_BATCH_DEFAULT_PAGE_SIZE);
    }
    this.draftReady = true;
    this.mountCurrentPage();
    if (this.catalogsReady) {
      this.reconcileVisibleSelects(false);
      this.preloadPaddocksForAllRanches();
    }
  }

  private readPendingBatchSeeds(): AnimalBatchDraftRow[] {
    const state = this.router.getCurrentNavigation()?.extras.state as PendingAnimalBatchNavigationState | undefined;
    if (!state?.fromPendingRegistrations || !Array.isArray(state.rows)) {
      return [];
    }
    return state.rows
      .map((row) => ({
        ...emptyBatchDraftRow(),
        registrationNumber: String(row.registrationNumber ?? '').trim(),
        ranchUuid: String(row.ranchUuid ?? '').trim()
      }))
      .filter((row) => row.registrationNumber && row.ranchUuid);
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
      .pipe(
        tap(() => {
          if (!this.suppressDraftPersist) {
            this.flushPageToDraft();
          }
        }),
        debounceTime(ANIMAL_BATCH_PERSIST_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe(() => this.persistDraftNow());
  }

  /** Saves draft immediately (import/rebuild does not emit valueChanges). */
  private persistDraftNow(): void {
    if (this.suppressDraftPersist) {
      return;
    }
    this.flushPageToDraft();
    if (!this.draftRows.some((row) => batchDraftRowHasData(row))) {
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
        const imported = this.resolveImportedRows(parseResult.rows);
        if (imported.length === 0) {
          this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchImportEmpty') });
          return;
        }
        this.page = 1;
        this.draftRows = imported.map((row) => this.normalizeDraftRow(row));
        this.applyOptionalColumnsFromExcelImport(parseResult.optionalColumnsInFile);
        this.clearGridSelection();
        this.mountCurrentPage();
        this.preloadPaddocksForAllRanches();
        this.persistDraftNow();
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

  onPageSizeChange(raw: string): void {
    const next = this.clampPageSize(Number(raw));
    if (!ANIMAL_BATCH_PAGE_SIZE_OPTIONS.includes(next) || next === this.pageSize) {
      return;
    }
    this.flushPageToDraft();
    const blank = !this.draftRows.some((row) => batchDraftRowHasData(row));
    this.pageSize = next;
    this.page = 1;
    if (blank) {
      this.selectIssues.clear();
      this.refreshSelectIssueCount();
      this.draftRows = this.createBlankRows(next);
    }
    this.clearGridSelection();
    this.mountCurrentPage();
    this.persistDraftNow();
  }

  addEmptyRows(): void {
    this.flushPageToDraft();
    const firstNewIndex = this.draftRows.length;
    this.draftRows.push(...this.createBlankRows(this.pageSize));
    this.page = Math.floor(firstNewIndex / this.pageSize) + 1;
    this.clearGridSelection();
    this.mountCurrentPage();
    this.persistDraftNow();
  }

  goToPage(nextPage: number): void {
    const next = Math.min(this.totalPages, Math.max(1, Math.floor(nextPage)));
    if (next === this.page) {
      return;
    }
    this.flushPageToDraft();
    this.page = next;
    this.clearGridSelection();
    this.mountCurrentPage();
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

    const rowNumber = String(this.pageRowNumber(index));
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
    const blank = this.emptyRowControlValues();
    row.reset(blank);
    const absolute = this.absoluteIndex(index);
    if (this.draftRows[absolute]) {
      this.draftRows[absolute] = blank;
    }
    this.clearSelectIssuesForRow(absolute);
    this.refreshColumnDataFlags();
    this.cdr.detectChanges();
  }

  clearBatchTable(): void {
    this.flushPageToDraft();
    const hasData = this.draftRows.some((row) => batchDraftRowHasData(row));

    if (!hasData) {
      this.executeClearBatchTable();
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
      () => this.executeClearBatchTable(),
      () => undefined
    );
  }

  private executeClearBatchTable(): void {
    this.ngZone.run(() => {
      this.setFeedback(null);
      this.selectIssues.clear();
      this.refreshSelectIssueCount();
      this.draftStorage.clear();
      this.suppressDraftPersist = true;
      this.useBlankGrid(ANIMAL_BATCH_DEFAULT_PAGE_SIZE);
      this.clearGridSelection();
      this.mountCurrentPage();
      globalThis.setTimeout(() => {
        this.suppressDraftPersist = false;
      }, ANIMAL_BATCH_PERSIST_DEBOUNCE_MS + 100);
      this.setFeedback({ type: 'success', message: this.i18n.translate('animal.batchClearDone') });
    });
  }

  async saveBatch(): Promise<void> {
    this.setFeedback(null);
    this.flushPageToDraft();
    const filledRows = this.draftRows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => batchDraftRowHasData(row));
    const filled = filledRows.map(({ row }) => row);
    if (filled.length === 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchNoRows') });
      return;
    }
    if (this.pendingSelectCheckCount > 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchSelectIssuesPending') });
      return;
    }
    if (this.selectIssueCount > 0) {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchSelectIssuesBlockSave') });
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
    const unknownCategories = new Set<string>();
    for (const row of filled) {
      for (const name of matchBatchCategoryIds(row.categories ?? '', this.categoryOptions).unknown) {
        unknownCategories.add(name);
      }
    }
    if (unknownCategories.size > 0) {
      this.setFeedback({
        type: 'error',
        message: this.i18n.translate('animal.batchUnknownCategories', { names: [...unknownCategories].join(', ') })
      });
      return;
    }
    const duplicateMessage = this.duplicateRowsMessage(filledRows);
    if (duplicateMessage) {
      this.setFeedback({ type: 'error', message: duplicateMessage });
      return;
    }

    const requestRows = filledRows.map(({ row, index }) => ({
      index,
      animal: this.toCreatePayload(row)
    }));

    this.savingBatch = true;
    const results: AnimalBatchRowResultDto[] = [];
    try {
      for (let offset = 0; offset < requestRows.length; offset += ANIMAL_BATCH_SAVE_CHUNK_SIZE) {
        const requestBody: AnimalBatchCreateRequestBody = {
          rows: requestRows.slice(offset, offset + ANIMAL_BATCH_SAVE_CHUNK_SIZE)
        };
        const batchResult = await firstValueFrom(this.animalApi.createAnimalsBatch(requestBody));
        if (!batchResult) {
          this.dropSavedRows(results);
          this.savingBatch = false;
          this.setFeedback({ type: 'error', message: this.i18n.translate('animal.individualSaveError') });
          return;
        }
        results.push(...batchResult.results);
      }
    } catch (error: unknown) {
      this.dropSavedRows(results);
      this.savingBatch = false;
      this.setFeedback({ type: 'error', message: this.extractApiError(error) });
      return;
    }
    const successes = results.filter((r) => r.success);
    const categoryAssigns = successes.flatMap((result) => {
      const source = filledRows.find((item) => item.index === result.index);
      if (!source || !result.animal_uuid) {
        return [];
      }
      const { ids } = matchBatchCategoryIds(source.row.categories ?? '', this.categoryOptions);
      return ids.map((id) => this.livestockCategoryApi.assign(result.animal_uuid as string, id, null));
    });
    if (categoryAssigns.length > 0) {
      try {
        await this.assignCategoriesInPools(categoryAssigns);
      } catch {
        this.dropSavedRows(successes);
        this.savingBatch = false;
        this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchCategoryAssignError') });
        return;
      }
    }
    this.savingBatch = false;

    const failures = results.filter((r) => !r.success);

    if (failures.length === 0) {
      this.draftStorage.clear();
      this.selectIssues.clear();
      this.refreshSelectIssueCount();
      this.suppressDraftPersist = true;
      this.useBlankGrid(ANIMAL_BATCH_DEFAULT_PAGE_SIZE);
      this.mountCurrentPage();
      globalThis.setTimeout(() => {
        this.suppressDraftPersist = false;
      }, ANIMAL_BATCH_PERSIST_DEBOUNCE_MS + 100);
      this.setFeedback({
        type: 'success',
        message: this.i18n.translate('animal.batchSaveApiDone', { count: String(successes.length) })
      });
      return;
    }

    this.dropSavedRows(successes);
    const failedLabels = failures.map((f) => String(f.index + 1));
    const failedRows = failedLabels.length > 30 ? `${failedLabels.slice(0, 30).join(', ')}…` : failedLabels.join(', ');
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

  private dropSavedRows(results: AnimalBatchRowResultDto[]): void {
    let changed = false;
    for (const result of results) {
      if (!result.success || result.index < 0 || result.index >= this.draftRows.length) {
        continue;
      }
      this.draftRows[result.index] = this.emptyRowControlValues();
      this.clearSelectIssuesForRow(result.index);
      changed = true;
    }
    if (!changed) {
      return;
    }
    this.mountCurrentPage();
    this.persistDraftNow();
  }

  private async assignCategoriesInPools(tasks: ReturnType<LivestockCategoryApiService['assign']>[]): Promise<void> {
    for (let offset = 0; offset < tasks.length; offset += ANIMAL_BATCH_CATEGORY_ASSIGN_POOL) {
      const pool = tasks.slice(offset, offset + ANIMAL_BATCH_CATEGORY_ASSIGN_POOL);
      if (pool.length === 0) {
        continue;
      }
      await firstValueFrom(forkJoin(pool));
    }
  }

  private duplicateRowsMessage(filledRows: { row: AnimalBatchDraftRow; index: number }[]): string | null {
    const registrationHits = new Map<string, number[]>();
    const chipHits = new Map<string, number[]>();
    for (const item of filledRows) {
      const ranch = String(item.row.ranchUuid ?? '').trim();
      const registration = String(item.row.registrationNumber ?? '').trim().toLowerCase();
      if (ranch && registration) {
        const key = `${ranch}\0${registration}`;
        const list = registrationHits.get(key) ?? [];
        list.push(item.index + 1);
        registrationHits.set(key, list);
      }
      const chip = String(item.row.chipNumber ?? '').trim().toLowerCase();
      if (ranch && chip) {
        const key = `${ranch}\0${chip}`;
        const list = chipHits.get(key) ?? [];
        list.push(item.index + 1);
        chipHits.set(key, list);
      }
    }
    for (const rows of registrationHits.values()) {
      if (rows.length > 1) {
        return this.i18n.translate('animal.batchDuplicateRegistration', { rows: this.formatRowList(rows) });
      }
    }
    for (const rows of chipHits.values()) {
      if (rows.length > 1) {
        return this.i18n.translate('animal.batchDuplicateChip', { rows: this.formatRowList(rows) });
      }
    }
    return null;
  }

  private formatRowList(rows: number[]): string {
    if (rows.length <= 12) {
      return rows.join(', ');
    }
    return `${rows.slice(0, 12).join(', ')}…`;
  }

  trackByRow(index: number): number {
    return this.pageStart + index;
  }

  private toSnapshot(): AnimalBatchDraftSnapshot {
    return {
      version: ANIMAL_BATCH_DRAFT_VERSION,
      rowSlotCount: this.draftRows.length,
      pageSize: this.pageSize,
      rows: this.draftRows.map((row) => ({ ...row }))
    };
  }

  private clampPageSize(raw: number): number {
    const n = Math.floor(Number(raw));
    if (!ANIMAL_BATCH_PAGE_SIZE_OPTIONS.includes(n)) {
      return ANIMAL_BATCH_DEFAULT_PAGE_SIZE;
    }
    return n;
  }

  private get pageStart(): number {
    return (this.page - 1) * this.pageSize;
  }

  private absoluteIndex(localIndex: number): number {
    return this.pageStart + localIndex;
  }

  private useBlankGrid(pageSize: number): void {
    this.pageSize = this.clampPageSize(pageSize);
    this.page = 1;
    this.draftRows = this.createBlankRows(this.pageSize);
  }

  private createBlankRows(count: number): AnimalBatchDraftRow[] {
    const safe = Math.max(1, Math.floor(count));
    return Array.from({ length: safe }, () => this.emptyRowControlValues());
  }

  private normalizeDraftRow(seed: AnimalBatchDraftRow): AnimalBatchDraftRow {
    return {
      ...emptyBatchDraftRow(),
      ...seed,
      breedCode: seed.breedCode || '',
      sex: seed.sex || 'MALE',
      originType: seed.originType || 'UNKNOWN',
      categories: seed.categories ?? ''
    };
  }

  private flushPageToDraft(): void {
    const values = this.rows.getRawValue() as AnimalBatchDraftRow[];
    const start = this.pageStart;
    for (let i = 0; i < values.length; i++) {
      if (start + i < this.draftRows.length) {
        this.draftRows[start + i] = values[i];
      }
    }
    this.refreshColumnDataFlags();
  }

  private rowSnapshot(absoluteIndex: number): AnimalBatchDraftRow | null {
    const local = absoluteIndex - this.pageStart;
    if (local >= 0 && local < this.rows.length) {
      return (this.rows.at(local) as FormGroup).getRawValue() as AnimalBatchDraftRow;
    }
    return this.draftRows[absoluteIndex] ?? null;
  }

  private refreshColumnDataFlags(): void {
    const emptyDefaults = this.emptyRowControlValues();
    const keys = this.tableColumns.map((col) => col.key);
    const next = new Set<AnimalBatchColumnKey>();
    for (let i = 0; i < this.draftRows.length && next.size < keys.length; i++) {
      const row = this.rowSnapshot(i);
      if (!row) {
        continue;
      }
      for (const key of keys) {
        if (next.has(key)) {
          continue;
        }
        if (this.columnValueDiffersFromEmpty(key, row[key], emptyDefaults[key])) {
          next.add(key);
        }
      }
    }
    this.columnsWithData = next;
  }

  private mountCurrentPage(): void {
    if (this.draftRows.length === 0) {
      this.draftRows = this.createBlankRows(this.pageSize);
    }
    if (this.page > this.totalPages) {
      this.page = this.totalPages;
    }
    if (this.page < 1) {
      this.page = 1;
    }
    const slice = this.draftRows.slice(this.pageStart, this.pageStart + this.pageSize);
    this.remountBatchTableWithRows(slice);
    this.refreshColumnDataFlags();
  }

  /** Replaces the reactive form so table controls re-bind after clear/import. */
  private replaceFormRows(rows: AnimalBatchDraftRow[]): void {
    this.form = this.fb.group({
      rows: this.fb.array(rows.map((seed) => this.createRowGroup(seed)))
    });
    this.reapplyClearedIssues();
    this.bindDraftAutoSave();
  }

  private remountBatchTableWithRows(rows: AnimalBatchDraftRow[]): void {
    this.batchTableAlive = false;
    this.cdr.detectChanges();
    this.replaceFormRows(rows);
    this.batchTableAlive = true;
    this.cdr.detectChanges();
  }

  private columnsStorageKey(prefix: string): string | null {
    const company = this.sessionService.getUuidCompany();
    const username = this.sessionService.getUsername();
    if (!company?.trim() || !username?.trim()) {
      return null;
    }
    return `${prefix}_${company}_${username}`;
  }

  private loadColumnVisibility(): void {
    const key = this.columnsStorageKey(ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX);
    const legacyKey = this.columnsStorageKey(ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX_LEGACY);
    if (!key || !legacyKey) {
      return;
    }
    const raw = readLocalStorageMigrating(key, legacyKey);
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
    const key = this.columnsStorageKey(ANIMAL_BATCH_COLUMNS_STORAGE_PREFIX);
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
      categories: [seed.categories ?? ''],
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

  private emitTemplateDownload(
    groups: { ranch: RanchOption; paddocks: PaddockOptionDto[] }[]
  ): void {
    try {
      const buffer = this.excelImport.buildTemplateWorkbook({
        sheetData: this.safeSheetName(this.i18n.translate('animal.batchTemplateSheetData'), 'Animales'),
        sheetLists: this.safeSheetName(this.i18n.translate('animal.batchTemplateSheetLists'), 'Listas'),
        sheetPaddocks: this.safeSheetName(this.i18n.translate('animal.batchTemplateSheetPaddocks'), 'Potreros'),
        sheetHelp: this.safeSheetName(this.i18n.translate('animal.batchTemplateSheetHelp'), 'Ayuda'),
        listHeaders: {
          ranches: this.i18n.translate('animal.fieldRanch'),
          owners: this.i18n.translate('animal.fieldOwner'),
          breeds: this.i18n.translate('animal.fieldBreed'),
          sexes: this.i18n.translate('animal.fieldSex'),
          origins: this.i18n.translate('animal.fieldOriginType'),
          categories: this.i18n.translate('livestockCategory.column')
        },
        paddockHeaders: {
          ranch: this.i18n.translate('animal.fieldRanch'),
          paddock: this.i18n.translate('animal.fieldPaddock')
        },
        helpLines: this.i18n.translate('animal.batchTemplateHelp').split('\n'),
        ranchNames: this.ranchRows.map((ranch) => ranch.name),
        ownerNames: this.ownerRows.map((owner) => owner.full_name),
        breedLabels: this.breedCodes.map((code) => this.breedLabel(code)),
        sexLabels: [this.i18n.translate('animal.male'), this.i18n.translate('animal.female')],
        originLabels: [
          this.i18n.translate('animal.originBirth'),
          this.i18n.translate('animal.originPurchase'),
          this.i18n.translate('animal.originTransfer'),
          this.i18n.translate('animal.originUnknown')
        ],
        categoryNames: this.categoryOptions.map((category) => category.name),
        paddocks: groups.flatMap((group) =>
          group.paddocks.map((paddock) => ({ ranchName: group.ranch.name, paddockName: paddock.name }))
        )
      });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'alta-por-lote.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      this.setFeedback({ type: 'error', message: this.i18n.translate('animal.batchDownloadTemplateError') });
    }
  }

  private safeSheetName(name: string, fallback: string): string {
    const cleaned = name.replace(/[\\/?*[\]:]/g, '').trim().slice(0, 31);
    return cleaned || fallback;
  }

  private resolveImportedRows(rows: AnimalBatchDraftRow[]): AnimalBatchDraftRow[] {
    this.selectIssues.clear();
    return rows.map((row, index) => {
      const resolved = resolveBatchDraftRowSelects(row, this.buildPasteContext(''), true);
      for (const item of resolved.issues) {
        this.selectIssues.set(this.issueId(index, item.key), { ...item.issue, clearOnMiss: true });
      }
      return resolved.row;
    });
  }

  private reconcileVisibleSelects(clearOnMiss: boolean): void {
    for (let index = 0; index < this.draftRows.length; index++) {
      this.reconcileRowSelects(index, clearOnMiss);
    }
    this.mountCurrentPage();
  }

  private reconcileRowSelects(index: number, clearOnMiss: boolean): void {
    const row = this.rowSnapshot(index);
    if (!row) {
      return;
    }
    const ranch = this.commitSelectField(index, 'ranchUuid', String(row.ranchUuid ?? ''), '', clearOnMiss);
    const breed = this.commitSelectField(index, 'breedCode', String(row.breedCode ?? ''), ranch, clearOnMiss);
    const sex = this.commitSelectField(index, 'sex', String(row.sex ?? ''), ranch, clearOnMiss);
    const origin = this.commitSelectField(index, 'originType', String(row.originType ?? ''), ranch, clearOnMiss);
    const owner = this.commitSelectField(index, 'currentOwnerUuid', String(row.currentOwnerUuid ?? ''), ranch, clearOnMiss);
    const paddock = this.commitSelectField(index, 'currentPaddockUuid', String(row.currentPaddockUuid ?? ''), ranch, clearOnMiss);
    this.draftRows[index] = {
      ...row,
      ranchUuid: ranch,
      breedCode: breed,
      sex: sex as AnimalBatchDraftRow['sex'],
      originType: origin as AnimalBatchDraftRow['originType'],
      currentOwnerUuid: owner,
      currentPaddockUuid: paddock
    };
    if (this.isKnownRanchUuid(ranch)) {
      this.ensurePaddocksLoaded(ranch);
    }
  }

  private reconcilePaddockColumn(ranchUuid: string): void {
    for (let index = 0; index < this.draftRows.length; index++) {
      const row = this.rowSnapshot(index);
      if (!row || String(row.ranchUuid ?? '') !== ranchUuid) {
        continue;
      }
      const current = String(row.currentPaddockUuid ?? '');
      const next = this.commitSelectField(index, 'currentPaddockUuid', current, ranchUuid, false);
      if (next === current) {
        continue;
      }
      this.draftRows[index] = { ...this.draftRows[index], currentPaddockUuid: next };
      const local = index - this.pageStart;
      if (local >= 0 && local < this.rows.length) {
        (this.rows.at(local) as FormGroup).patchValue({ currentPaddockUuid: next }, { emitEvent: false });
      }
    }
  }

  private commitSelectField(
    rowIndex: number,
    key: AnimalBatchColumnKey,
    currentValue: string,
    ranchUuid: string,
    clearOnMiss: boolean
  ): string {
    const id = this.issueId(rowIndex, key);
    const existing = this.selectIssues.get(id);
    const raw = existing?.reason === 'pendingCatalog' ? existing.raw : currentValue;
    const effectiveClear = existing?.clearOnMiss ?? clearOnMiss;
    if (!String(raw ?? '').trim()) {
      this.selectIssues.delete(id);
      return currentValue;
    }
    const resolved = resolveBatchSelectCell(key, raw, this.buildPasteContext(ranchUuid), ranchUuid, effectiveClear);
    if (!resolved.issue) {
      this.selectIssues.delete(id);
      return resolved.value;
    }
    this.selectIssues.set(id, { ...resolved.issue, clearOnMiss: effectiveClear });
    return resolved.value;
  }

  private storeSelectResolution(
    rowIndex: number,
    key: AnimalBatchColumnKey,
    issue: BatchSelectIssue | null,
    clearOnMiss: boolean
  ): void {
    if (!isBatchSelectColumn(key)) {
      return;
    }
    const id = this.issueId(rowIndex, key);
    if (!issue) {
      this.selectIssues.delete(id);
      return;
    }
    this.selectIssues.set(id, { ...issue, clearOnMiss });
  }

  private reapplyClearedIssues(): void {
    for (const [id, issue] of this.selectIssues) {
      if (!issue.clearOnMiss || issue.reason === 'pendingCatalog') {
        continue;
      }
      const splitAt = id.indexOf(':');
      const rowIndex = Number(id.slice(0, splitAt));
      const key = id.slice(splitAt + 1);
      const row = this.draftRows[rowIndex];
      if (row) {
        this.draftRows[rowIndex] = { ...row, [key]: '' };
      }
      const local = rowIndex - this.pageStart;
      if (local >= 0 && local < this.rows.length) {
        (this.rows.at(local) as FormGroup | null)?.patchValue({ [key]: '' }, { emitEvent: false });
      }
    }
    this.refreshSelectIssueCount();
  }

  private refreshSelectIssueCount(): void {
    let count = 0;
    let pending = 0;
    for (const issue of this.selectIssues.values()) {
      if (issue.reason === 'pendingCatalog') {
        pending++;
      } else {
        count++;
      }
    }
    this.selectIssueCount = count;
    this.pendingSelectCheckCount = pending;
  }

  private issueId(index: number, key: AnimalBatchColumnKey): string {
    return `${index}:${key}`;
  }

  private clearSelectIssue(index: number, key: AnimalBatchColumnKey): void {
    this.selectIssues.delete(this.issueId(index, key));
    this.refreshSelectIssueCount();
  }

  private clearSelectIssuesForRow(index: number): void {
    for (const id of [...this.selectIssues.keys()]) {
      const rowIndex = Number(id.slice(0, id.indexOf(':')));
      if (rowIndex === index) {
        this.selectIssues.delete(id);
      }
    }
    this.refreshSelectIssueCount();
  }

  private isKnownRanchUuid(value: string): boolean {
    return this.ranchRows.some((ranch) => ranch.uuid_ranch === value);
  }
}
