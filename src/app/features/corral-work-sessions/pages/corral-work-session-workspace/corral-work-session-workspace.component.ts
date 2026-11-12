import { Component, HostListener, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { BreakpointObserver } from '@angular/cdk/layout';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { ConfirmDialogComponent } from 'src/app/shared/components/modals/confirm-dialog/confirm-dialog.component';
import { Observable, Subscription, catchError, finalize, firstValueFrom, forkJoin, map, of, switchMap } from 'rxjs';
import { pageNumbers } from 'src/app/shared/utils/list-query.util';
import { translateApiError } from 'src/app/core/utils/api-error.util';
import { stepDisplayLabel } from 'src/app/core/utils/i18n-display.util';
import { I18nService } from 'src/app/core/services/i18n.service';
import { AnimalListItem } from 'src/app/features/animals/models/animal.model';
import { AnimalApiService, PaddockOptionDto } from 'src/app/features/animals/services/animal-api.service';
import { AnimalService } from 'src/app/features/animals/services/animal.service';
import { CorralStepGridComponent } from '../../components/corral-step-grid/corral-step-grid.component';
import {
  CORRAL_PRELOADED_WORK_MODES,
  CORRAL_STEP_WORK_MODES,
  CORRAL_VISUAL_CONDITION_CODES,
  CorralActivityCode,
  CorralStepWorkMode,
  CorralVisualConditionCode,
  isCorralActivityCode
} from '../../constants/corral-activities';
import { getCorralActivityShortcutConfig } from '../../constants/corral-activity-entry.config';
import {
  CorralSessionAnimalsPreviewDto,
  CorralSessionAnimalsSourceBody,
  CorralSessionSourceFilter,
  CorralSessionWorkspaceDto,
  CorralStepCounterDto,
  CorralStepGridColumnDto,
  CorralStepGridDto,
  AnimalCorralProfileDto,
  AnimalCorralWorkHistorySessionDto,
  AnimalLookupDto,
  ApplyPaddockDistributionResultDto
} from '../../models/corral-work-session.model';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';
import { CorralActivityQuickStartService } from '../../services/corral-activity-quick-start.service';
import { CorralAnimalListSortService } from '../../services/corral-animal-list-sort.service';
import { CorralStepPresetStorageService } from '../../services/corral-step-preset-storage.service';
import {
  CORRAL_ANIMAL_LIST_SORT_MODES,
  CorralAnimalListSortMode
} from '../../models/corral-animal-list-sort.model';
import {
  createEmptyStepFindingPresets,
  medicationPresetKey,
  MedicationPreset,
  StepFindingPresets
} from '../../models/corral-finding-presets.model';
import {
  createEmptyStepGridColumnPresets,
  GridColumnPresetEntry,
  StepGridColumnPresets
} from '../../models/corral-grid-column-presets.model';
import { createEmptyRowFindingState, RowFindingState } from '../../models/corral-row-finding.model';
import { CorralWorkspaceDraft } from '../../models/corral-workspace-draft.model';

@Component({
  selector: 'app-corral-work-session-workspace',
  templateUrl: './corral-work-session-workspace.component.html',
  styleUrls: ['./corral-work-session-workspace.component.scss']
})
export class CorralWorkSessionWorkspaceComponent implements OnInit, OnDestroy {
  @ViewChild(CorralStepGridComponent) activeGrid?: CorralStepGridComponent;

  readonly conditionCodes = CORRAL_VISUAL_CONDITION_CODES;
  readonly workModes = CORRAL_STEP_WORK_MODES;
  readonly preloadedWorkModes = CORRAL_PRELOADED_WORK_MODES;
  readonly animalListSortModes = CORRAL_ANIMAL_LIST_SORT_MODES;
  readonly originTypes = ['BIRTH', 'PURCHASE', 'TRANSFER', 'UNKNOWN'] as const;

  sessionUuid = '';
  activityFocusCode: CorralActivityCode | null = null;
  loading = true;
  saving = false;
  closing = false;
  errorMessage = '';
  successMessage = '';

  workspace: CorralSessionWorkspaceDto | null = null;
  activeStepIndex = 0;
  scanInput = '';
  highlightAnimalUuid: string | null = null;
  historyRegistrationNumber = '';
  historyProfile: AnimalCorralProfileDto | null = null;
  historySessions: AnimalCorralWorkHistorySessionDto[] = [];
  historyLoading = false;
  historyError = false;
  historyUnregistered = false;
  unknownScanIdentifier = '';
  unknownScanContext: 'not_in_step' | 'duplicate_unregistered' | null = null;
  unknownAnimalUuid: string | null = null;
  matchChoices: AnimalLookupDto[] = [];
  pendingUnregisteredChoices: AnimalLookupDto[] = [];
  updatingWorkMode = false;
  animalListSort: CorralAnimalListSortMode = 'SCAN_ORDER';
  appendingAnimals = false;
  showAttachPanel = false;
  headerMenuExpanded = true;
  attachTab: 'paddocks' | 'filters' | 'inventory' = 'paddocks';

  paddockRows: PaddockOptionDto[] = [];
  selectedPaddockUuids = new Set<string>();
  filterMale = false;
  filterFemale = false;
  filterBreedCode = '';
  filterOriginType = '';
  inventorySearch = '';
  inventoryLoading = false;
  inventoryAnimals: AnimalListItem[] = [];
  inventoryTotal = 0;
  inventoryTotalPages = 1;
  inventoryPage = 1;
  inventoryPageSize = 10;
  readonly inventoryPageSizeOptions = [10, 25, 50, 100];
  selectedManualUuids = new Set<string>();
  preview: CorralSessionAnimalsPreviewDto | null = null;
  previewing = false;
  newCounterTitle = '';
  addingCounter = false;
  counterAddOpen = false;
  countersCollapsed = false;
  countersInSidebar = typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;
  openCounterMenuId: string | null = null;
  editingCounterId: string | null = null;
  private layoutSubscription?: Subscription;
  private countersByStep = new Map<string, CorralStepCounterDto[]>();
  private persistedCounterTitles = new Map<string, string>();
  private counterChains = new Map<string, Promise<void>>();

  readonly presetValueSeparator = ' - ';

  findingsPanelExpanded = true;
  findingColumnsExpanded = true;
  presetsConfigExpanded = false;
  presetObservationDraft = '';
  presetMedicationProductDraft = '';
  presetMedicationDoseDraft = '';
  presetMedicationUnitDraft = '';
  presetConditionDraft: CorralVisualConditionCode | '' = '';
  gridColumnPresetDraftByKey: Record<string, string> = {};

  private previewTimer: ReturnType<typeof setTimeout> | null = null;
  private inventorySearchTimer: ReturnType<typeof setTimeout> | null = null;
  private draftPersistTimer: ReturnType<typeof setTimeout> | null = null;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingAutosave = false;
  private silentAutosave = false;
  private historyAnimalUuid: string | null = null;
  /** Most recently scanned animals per step (queue mode). */
  private queueScannedByStep = new Map<string, string[]>();
  private presetsByStep = new Map<string, StepFindingPresets>();
  private gridColumnPresetsByStep = new Map<string, StepGridColumnPresets>();
  private rowFindingsByStep = new Map<string, Record<string, RowFindingState>>();
  private historyRequestId = 0;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: CorralWorkSessionApiService,
    private readonly quickStart: CorralActivityQuickStartService,
    private readonly animalApiService: AnimalApiService,
    private readonly animalService: AnimalService,
    private readonly animalListSortService: CorralAnimalListSortService,
    private readonly stepPresetStorage: CorralStepPresetStorageService,
    private readonly modalService: NgbModal,
    private readonly breakpointObserver: BreakpointObserver,
    readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
    this.layoutSubscription = this.breakpointObserver.observe('(min-width: 768px)').subscribe((state) => {
      this.countersInSidebar = state.matches;
      if (state.matches) {
        this.countersCollapsed = false;
      }
    });
    this.sessionUuid = this.route.snapshot.paramMap.get('sessionUuid') ?? '';
    const entry = this.route.snapshot.queryParamMap.get('entry');
    const activity = this.route.snapshot.queryParamMap.get('activity');
    if (entry === 'activity' && isCorralActivityCode(activity)) {
      this.activityFocusCode = activity;
    }
    if (!this.sessionUuid) {
      void this.router.navigate(['/corral-work-session']);
      return;
    }
    this.findingColumnsExpanded = this.loadFindingColumnsExpanded();
    this.animalListSort = this.animalListSortService.getSort(this.activityFocusCode);
    this.ensureConfiguredThenWorkspace();
  }

  get isActivityFocusMode(): boolean {
    return this.activityFocusCode !== null;
  }

  get workspaceTitleKey(): string {
    return 'corralWorkSession.workTitle';
  }

  get workspaceEntryHint(): string {
    if (!this.activityFocusCode) {
      return '';
    }
    return this.i18n.translate('corralActivityShortcut.workEntryHint', {
      activity: this.activityLabel(this.activityFocusCode)
    });
  }

  get showStepTabs(): boolean {
    return (this.workspace?.grids.length ?? 0) > 1;
  }

  ngOnDestroy(): void {
    this.layoutSubscription?.unsubscribe();
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }
    if (this.inventorySearchTimer) {
      clearTimeout(this.inventorySearchTimer);
    }
    if (this.draftPersistTimer) {
      clearTimeout(this.draftPersistTimer);
    }
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.persistWorkspaceDraft();
  }

  private ensureConfiguredThenWorkspace(): void {
    this.api.getSession(this.sessionUuid).subscribe({
      next: (session) => {
        if (!session.work_configured) {
          if (this.activityFocusCode) {
            this.loading = true;
            this.quickStart
              .configureActivitySession(
                this.sessionUuid,
                this.activityFocusCode,
                getCorralActivityShortcutConfig(this.activityFocusCode).defaultWorkMode
              )
              .pipe(
                catchError(() => {
                  this.errorMessage = this.i18n.translate('corralWorkSession.errorConfigureWork');
                  this.loading = false;
                  return of(null);
                })
              )
              .subscribe((configured) => {
                if (!configured) return;
                this.loadPaddocks(configured.ranch_uuid);
                this.loadWorkspace();
              });
            return;
          }
          void this.router.navigate(['/corral-work-session', this.sessionUuid, 'setup']);
          return;
        }
        this.loadPaddocks(session.ranch_uuid);
        this.loadWorkspace();
      },
      error: () => {
        this.errorMessage = this.i18n.translate('corralWorkSession.errorLoadSession');
        this.loading = false;
      }
    });
  }

  private loadPaddocks(ranchUuid: string): void {
    this.animalApiService.getPaddocksForRanch(ranchUuid).subscribe({
      next: (paddocks) => {
        this.paddockRows = paddocks;
      }
    });
  }

  loadWorkspace(): void {
    this.loading = true;
    this.errorMessage = '';
    this.api
      .getWorkspace(this.sessionUuid)
      .pipe(
        catchError(() => {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorLoadSession');
          return of(null);
        }),
        finalize(() => {
          this.loading = false;
        })
      )
      .subscribe((ws) => {
        if (!ws) return;
        this.workspace = ws;
        this.presetsByStep.clear();
        this.gridColumnPresetsByStep.clear();
        this.seedQueueScansFromWorkspace(ws);
        if (ws.session.status !== 'CLOSED') {
          this.applyWorkspaceDraft(this.loadWorkspaceDraft());
        } else {
          this.clearWorkspaceDraft();
        }
        this.seedCounters(ws);
      });
  }

  private workspaceDraftStorageKey(): string {
    return `corral-workspace-draft:${this.sessionUuid}`;
  }

  private schedulePersistWorkspaceDraft(): void {
    if (this.draftPersistTimer) {
      clearTimeout(this.draftPersistTimer);
    }
    this.draftPersistTimer = setTimeout(() => {
      this.draftPersistTimer = null;
      this.persistWorkspaceDraft();
    }, 250);
  }

  private persistWorkspaceDraft(): void {
    if (!this.workspace || this.isClosed) return;
    this.persistCurrentStepFindings();

    const draft: CorralWorkspaceDraft = {
      version: 1,
      sessionUuid: this.sessionUuid,
      updatedAt: new Date().toISOString(),
      activeStepIndex: this.activeStepIndex,
      findingColumnsExpanded: this.findingColumnsExpanded,
      grids: this.workspace.grids.map((grid) => ({
        ...grid,
        rows: grid.rows.map((row) => ({
          ...row,
          values: { ...row.values }
        }))
      })),
      rowFindingsByStep: Object.fromEntries(this.rowFindingsByStep.entries()),
      queueScannedByStep: Object.fromEntries(this.queueScannedByStep.entries())
    };

    try {
      sessionStorage.setItem(this.workspaceDraftStorageKey(), JSON.stringify(draft));
    } catch {
      // Ignore quota errors; in-memory work remains available until refresh.
    }
  }

  private loadWorkspaceDraft(): CorralWorkspaceDraft | null {
    try {
      const stored = sessionStorage.getItem(this.workspaceDraftStorageKey());
      if (!stored) return null;
      const draft = JSON.parse(stored) as CorralWorkspaceDraft;
      if (draft.version !== 1 || draft.sessionUuid !== this.sessionUuid || !Array.isArray(draft.grids)) {
        return null;
      }
      return draft;
    } catch {
      return null;
    }
  }

  private seedQueueScansFromWorkspace(workspace: CorralSessionWorkspaceDto): void {
    this.queueScannedByStep = new Map(
      workspace.grids
        .filter((grid) => (grid.scanned_animal_uuids?.length ?? 0) > 0)
        .map((grid) => [grid.uuid_corral_session_step, [...(grid.scanned_animal_uuids ?? [])]])
    );
  }

  private applyWorkspaceDraft(draft: CorralWorkspaceDraft | null): void {
    if (!draft || !this.workspace) return;

    this.workspace.grids = this.workspace.grids.map((apiGrid) => {
      const draftGrid = draft.grids.find(
        (item) => item.uuid_corral_session_step === apiGrid.uuid_corral_session_step
      );
      return draftGrid ? this.mergeGridWithDraft(apiGrid, draftGrid) : apiGrid;
    });

    this.rowFindingsByStep = new Map(
      Object.entries(draft.rowFindingsByStep ?? {}).map(([stepUuid, findings]) => [stepUuid, findings])
    );
    this.queueScannedByStep = new Map(
      Object.entries(draft.queueScannedByStep ?? {}).map(([stepUuid, uuids]) => [stepUuid, uuids])
    );

    if (draft.activeStepIndex >= 0 && draft.activeStepIndex < this.workspace.grids.length) {
      this.activeStepIndex = draft.activeStepIndex;
    }
    if (typeof draft.findingColumnsExpanded === 'boolean') {
      this.findingColumnsExpanded = draft.findingColumnsExpanded;
      this.persistFindingColumnsExpanded();
    }
  }

  private findingColumnsStorageKey(): string {
    return `corral-finding-columns-expanded:${this.sessionUuid}`;
  }

  private loadFindingColumnsExpanded(): boolean {
    try {
      const stored = sessionStorage.getItem(this.findingColumnsStorageKey());
      if (stored === null) {
        return true;
      }
      return stored === 'true';
    } catch {
      return true;
    }
  }

  private persistFindingColumnsExpanded(): void {
    try {
      sessionStorage.setItem(this.findingColumnsStorageKey(), String(this.findingColumnsExpanded));
    } catch {
      // Ignore quota errors.
    }
  }

  private isMissingInventoryRow(row: { animal_uuid: string; missing_inventory?: boolean }): boolean {
    return row.missing_inventory === true || row.animal_uuid.startsWith('local-');
  }

  private mergeGridWithDraft(apiGrid: CorralStepGridDto, draftGrid: CorralStepGridDto): CorralStepGridDto {
    const rowByUuid = new Map(apiGrid.rows.map((row) => [row.animal_uuid, row]));
    const registrationCounts = new Map<string, number>();
    for (const row of apiGrid.rows) {
      const key = row.registration_number.trim().toLowerCase();
      registrationCounts.set(key, (registrationCounts.get(key) ?? 0) + 1);
    }
    const apiUuidByRegistration = new Map<string, string>();
    for (const row of apiGrid.rows) {
      const key = row.registration_number.trim().toLowerCase();
      if (registrationCounts.get(key) === 1) {
        apiUuidByRegistration.set(key, row.animal_uuid);
      }
    }
    const orderedUuids: string[] = [];

    for (const draftRow of draftGrid.rows) {
      const registrationKey = draftRow.registration_number.trim().toLowerCase();
      const linkedUuid = this.isMissingInventoryRow(draftRow)
        ? apiUuidByRegistration.get(registrationKey)
        : undefined;
      const linkedRow = linkedUuid ? rowByUuid.get(linkedUuid) : undefined;
      if (linkedRow && !this.isMissingInventoryRow(linkedRow)) {
        if (!orderedUuids.includes(linkedRow.animal_uuid)) {
          orderedUuids.push(linkedRow.animal_uuid);
        }
        continue;
      }
      const targetUuid = linkedUuid ?? draftRow.animal_uuid;
      const existing = rowByUuid.get(targetUuid);
      if (existing) {
        rowByUuid.set(targetUuid, {
          ...existing,
          registration_number: draftRow.registration_number || existing.registration_number,
          chip_number: draftRow.chip_number ?? existing.chip_number,
          missing_inventory: existing.missing_inventory || draftRow.missing_inventory,
          values: { ...existing.values, ...draftRow.values }
        });
      } else {
        rowByUuid.set(targetUuid, {
          ...draftRow,
          animal_uuid: targetUuid,
          values: { ...draftRow.values }
        });
      }
      if (!orderedUuids.includes(targetUuid)) {
        orderedUuids.push(targetUuid);
      }
    }

    for (const apiRow of apiGrid.rows) {
      if (!orderedUuids.includes(apiRow.animal_uuid)) {
        orderedUuids.push(apiRow.animal_uuid);
      }
    }

    return {
      ...apiGrid,
      rows: orderedUuids
        .map((uuid) => rowByUuid.get(uuid))
        .filter((row): row is CorralStepGridDto['rows'][number] => Boolean(row))
    };
  }

  private clearWorkspaceDraft(): void {
    if (this.draftPersistTimer) {
      clearTimeout(this.draftPersistTimer);
      this.draftPersistTimer = null;
    }
    sessionStorage.removeItem(this.workspaceDraftStorageKey());
  }

  private keepSelectedBooleanShortcuts(
    savedGrid: CorralStepGridDto,
    previousGrid: CorralStepGridDto | undefined
  ): CorralStepGridDto {
    if (!previousGrid) return savedGrid;

    const presets = this.getGridColumnPresetsForStep(savedGrid.uuid_corral_session_step);
    const booleanKeys = savedGrid.columns
      .filter((column) => column.value_type === 'boolean')
      .map((column) => column.column_key);
    if (booleanKeys.length === 0) return savedGrid;

    const previousByUuid = new Map(previousGrid.rows.map((row) => [row.animal_uuid, row]));
    const previousRegistrationCounts = new Map<string, number>();
    for (const row of previousGrid.rows) {
      const key = row.registration_number.trim().toLowerCase();
      previousRegistrationCounts.set(key, (previousRegistrationCounts.get(key) ?? 0) + 1);
    }
    const previousByRegistration = new Map<string, CorralStepGridDto['rows'][number]>();
    for (const row of previousGrid.rows) {
      const key = row.registration_number.trim().toLowerCase();
      if (previousRegistrationCounts.get(key) === 1) {
        previousByRegistration.set(key, row);
      }
    }

    return {
      ...savedGrid,
      rows: savedGrid.rows.map((row) => {
        const previous =
          previousByUuid.get(row.animal_uuid) ??
          previousByRegistration.get(row.registration_number.trim().toLowerCase());
        if (!previous) return row;

        const values = { ...row.values };
        for (const columnKey of booleanKeys) {
          const previousValue = previous.values[columnKey];
          if (typeof previousValue !== 'string' || previousValue === 'true' || previousValue === 'false') {
            continue;
          }
          const preset = (presets[columnKey] ?? []).find((entry) => entry.label === previousValue);
          if (!preset || !this.savedBooleanMatchesPreset(values[columnKey], preset.value)) {
            continue;
          }
          values[columnKey] = previousValue;
        }
        return { ...row, values };
      })
    };
  }

  private savedBooleanMatchesPreset(saved: unknown, presetValue: string): boolean {
    const expected = presetValue === 'true';
    if (saved === true || saved === 'true' || saved === 1 || saved === '1') return expected;
    if (saved === false || saved === 'false' || saved === 0 || saved === '0') return !expected;
    return false;
  }

  private preserveLocalRows(savedGrid: CorralStepGridDto, previousGrid: CorralStepGridDto): CorralStepGridDto {
    const localRows = previousGrid.rows.filter((row) => this.isMissingInventoryRow(row));
    if (localRows.length === 0) return savedGrid;

    const savedUuids = new Set(savedGrid.rows.map((row) => row.animal_uuid));
    const savedRegistrationCounts = new Map<string, number>();
    for (const row of savedGrid.rows) {
      const key = row.registration_number.trim().toLowerCase();
      savedRegistrationCounts.set(key, (savedRegistrationCounts.get(key) ?? 0) + 1);
    }
    const consumedRegistrations = new Map<string, number>();
    const mergedLocalRows = localRows.filter((row) => {
      if (savedUuids.has(row.animal_uuid)) {
        return false;
      }
      const key = row.registration_number.trim().toLowerCase();
      const used = consumedRegistrations.get(key) ?? 0;
      const available = savedRegistrationCounts.get(key) ?? 0;
      if (used < available) {
        consumedRegistrations.set(key, used + 1);
        return false;
      }
      return true;
    });
    if (mergedLocalRows.length === 0) return savedGrid;

    return {
      ...savedGrid,
      rows: [...savedGrid.rows, ...mergedLocalRows]
    };
  }

  get activeGridData(): CorralStepGridDto | null {
    return this.workspace?.grids[this.activeStepIndex] ?? null;
  }

  get activityPresetColumns(): CorralStepGridColumnDto[] {
    return (this.activeGridData?.columns ?? []).filter(
      (column) => column.value_type !== 'paddock_current' && column.value_type !== 'paddock_destination'
    );
  }

  get showsPaddockColumns(): boolean {
    return (this.activeGridData?.columns ?? []).some((column) => column.value_type === 'paddock_destination');
  }

  stepActivityCount(grid: CorralStepGridDto): number {
    const step = this.workspace?.session.steps?.find(
      (item) => item.uuid_corral_session_step === grid.uuid_corral_session_step
    );
    return step?.activities.length || grid.columns.length;
  }

  get isClosed(): boolean {
    return this.workspace?.session.status === 'CLOSED';
  }

  get showStepCounters(): boolean {
    return !!this.activeGridData && (!this.isClosed || this.activeCounters.length > 0);
  }

  get sideColumnCollapsed(): boolean {
    return !this.findingsPanelExpanded;
  }

  get sidePanelToggleKey(): string {
    const includesCounters = this.countersInSidebar && this.showStepCounters;
    if (this.findingsPanelExpanded) {
      return includesCounters ? 'corralWorkSession.sidePanelCollapse' : 'corralWorkSession.sidebarCollapse';
    }
    return includesCounters ? 'corralWorkSession.sidePanelExpand' : 'corralWorkSession.sidebarExpand';
  }

  trackCounter(_index: number, counter: CorralStepCounterDto): string {
    return counter.uuid_corral_step_counter;
  }

  @HostListener('document:click')
  closeCounterMenu(): void {
    this.openCounterMenuId = null;
  }

  toggleCountersCollapsed(): void {
    this.countersCollapsed = !this.countersCollapsed;
  }

  openCounterAdd(): void {
    if (this.isClosed) return;
    this.countersCollapsed = false;
    this.counterAddOpen = true;
    this.openCounterMenuId = null;
  }

  toggleCounterMenu(counterId: string, event: Event): void {
    event.stopPropagation();
    this.openCounterMenuId = this.openCounterMenuId === counterId ? null : counterId;
  }

  startCounterRename(counter: CorralStepCounterDto): void {
    this.openCounterMenuId = null;
    this.editingCounterId = counter.uuid_corral_step_counter;
  }

  cancelCounterRename(counter: CorralStepCounterDto): void {
    counter.title = this.persistedCounterTitles.get(counter.uuid_corral_step_counter) ?? counter.title;
    this.editingCounterId = null;
  }

  get activeCounters(): CorralStepCounterDto[] {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return [];
    return this.countersByStep.get(stepUuid) ?? [];
  }

  addCounter(): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    const title = this.newCounterTitle.trim();
    if (!stepUuid || this.isClosed || this.addingCounter || !title) return;
    if (title.length > 80) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorCounterTitle');
      return;
    }
    if (this.hasCounterTitle(stepUuid, title)) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorDuplicateCounter');
      return;
    }

    this.addingCounter = true;
    this.errorMessage = '';
    this.api.createStepCounter(this.sessionUuid, stepUuid, title).subscribe({
      next: (counter) => {
        const list = this.countersForStep(stepUuid);
        list.push(counter);
        this.persistedCounterTitles.set(counter.uuid_corral_step_counter, counter.title);
        this.newCounterTitle = '';
        this.counterAddOpen = false;
        this.addingCounter = false;
      },
      error: (err) => {
        this.addingCounter = false;
        this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorSaveCounter');
      }
    });
  }

  adjustCounter(counter: CorralStepCounterDto, delta: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || this.isClosed || delta === 0) return;
    if (delta < 0 && counter.count <= 0) return;

    const before = counter.count;
    counter.count = Math.max(0, before + delta);
    this.errorMessage = '';
    this.enqueueCounter(counter.uuid_corral_step_counter, () =>
      this.api.updateStepCounter(this.sessionUuid, stepUuid, counter.uuid_corral_step_counter, { delta }).pipe(
        map((saved) => {
          const extra = counter.count - Math.max(0, before + delta);
          counter.count = Math.max(0, saved.count + extra);
          return undefined;
        }),
        catchError((err) => {
          counter.count = Math.max(0, counter.count - delta);
          this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorSaveCounter');
          return of(undefined);
        })
      )
    );
  }

  resetCounter(counter: CorralStepCounterDto): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || this.isClosed || counter.count === 0) return;
    this.openCounterMenuId = null;

    void this.openConfirmDialog(
      'corralWorkSession.counterResetTitle',
      'corralWorkSession.counterResetConfirm',
      { title: counter.title },
      'corralWorkSession.counterReset',
      'btn-primary'
    ).then((confirmed) => {
      if (!confirmed || this.isClosed || counter.count === 0) return;
      const before = counter.count;
      counter.count = 0;
      this.errorMessage = '';
      this.enqueueCounter(counter.uuid_corral_step_counter, () =>
        this.api.updateStepCounter(this.sessionUuid, stepUuid, counter.uuid_corral_step_counter, { count: 0 }).pipe(
          map((saved) => {
            counter.count = Math.max(0, saved.count + counter.count);
            return undefined;
          }),
          catchError((err) => {
            counter.count += before;
            this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorSaveCounter');
            return of(undefined);
          })
        )
      );
    });
  }

  removeCounter(counter: CorralStepCounterDto): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || this.isClosed) return;
    this.openCounterMenuId = null;

    void this.openConfirmDialog(
      'corralWorkSession.counterRemoveTitle',
      'corralWorkSession.counterRemoveConfirm',
      { title: counter.title },
      'corralWorkSession.counterRemove',
      'btn-danger'
    ).then((confirmed) => {
      if (!confirmed || this.isClosed) return;
      const list = this.countersForStep(stepUuid);
      const index = list.findIndex((item) => item.uuid_corral_step_counter === counter.uuid_corral_step_counter);
      if (index < 0) return;
      list.splice(index, 1);
      this.errorMessage = '';
      this.enqueueCounter(counter.uuid_corral_step_counter, () =>
        this.api.deleteStepCounter(this.sessionUuid, stepUuid, counter.uuid_corral_step_counter).pipe(
          catchError((err) => {
            const current = this.countersForStep(stepUuid);
            if (!current.some((item) => item.uuid_corral_step_counter === counter.uuid_corral_step_counter)) {
              current.splice(Math.min(index, current.length), 0, counter);
            }
            this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorSaveCounter');
            return of(undefined);
          })
        )
      );
    });
  }

  commitCounterTitle(counter: CorralStepCounterDto): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || this.isClosed) return;

    const title = counter.title.trim();
    const persisted = this.persistedCounterTitles.get(counter.uuid_corral_step_counter) ?? counter.title;
    if (!title || title.length > 80) {
      counter.title = persisted;
      this.editingCounterId = null;
      if (title.length > 80) {
        this.errorMessage = this.i18n.translate('corralWorkSession.errorCounterTitle');
      }
      return;
    }
    counter.title = title;
    if (title === persisted) {
      this.editingCounterId = null;
      return;
    }
    if (this.hasCounterTitle(stepUuid, title, counter.uuid_corral_step_counter)) {
      counter.title = persisted;
      this.errorMessage = this.i18n.translate('corralWorkSession.errorDuplicateCounter');
      return;
    }

    this.persistedCounterTitles.set(counter.uuid_corral_step_counter, title);
    this.editingCounterId = null;
    this.errorMessage = '';
    this.enqueueCounter(counter.uuid_corral_step_counter, () =>
      this.api.updateStepCounter(this.sessionUuid, stepUuid, counter.uuid_corral_step_counter, { title }).pipe(
        map(() => undefined),
        catchError((err) => {
          counter.title = persisted;
          this.persistedCounterTitles.set(counter.uuid_corral_step_counter, persisted);
          this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorSaveCounter');
          return of(undefined);
        })
      )
    );
  }

  private seedCounters(workspace: CorralSessionWorkspaceDto): void {
    this.countersByStep = new Map(
      workspace.grids.map((grid) => [
        grid.uuid_corral_session_step,
        (grid.counters ?? []).map((counter) => ({ ...counter }))
      ])
    );
    this.persistedCounterTitles = new Map();
    for (const counters of this.countersByStep.values()) {
      for (const counter of counters) {
        this.persistedCounterTitles.set(counter.uuid_corral_step_counter, counter.title);
      }
    }
  }

  private countersForStep(stepUuid: string): CorralStepCounterDto[] {
    const existing = this.countersByStep.get(stepUuid);
    if (existing) return existing;
    const created: CorralStepCounterDto[] = [];
    this.countersByStep.set(stepUuid, created);
    return created;
  }

  private hasCounterTitle(stepUuid: string, title: string, ignoreUuid?: string): boolean {
    const normalized = title.trim().toLowerCase();
    return this.countersForStep(stepUuid).some(
      (counter) =>
        counter.uuid_corral_step_counter !== ignoreUuid && counter.title.trim().toLowerCase() === normalized
    );
  }

  private enqueueCounter(counterUuid: string, task: () => Observable<unknown>): void {
    const previous = this.counterChains.get(counterUuid) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(() => firstValueFrom(task()));
    this.counterChains.set(
      counterUuid,
      next.then(
        () => undefined,
        () => undefined
      )
    );
  }

  get hasAnyAttachSource(): boolean {
    return (
      this.selectedPaddockUuids.size > 0 ||
      this.filterMale ||
      this.filterFemale ||
      Boolean(this.filterBreedCode.trim()) ||
      Boolean(this.filterOriginType) ||
      this.selectedManualUuids.size > 0
    );
  }

  activityLabel(code: CorralActivityCode | string): string {
    return this.i18n.translate(`corralWorkSession.activity.${code}`);
  }

  workModeLabel(mode: CorralStepWorkMode): string {
    return this.i18n.translate(`corralWorkSession.workMode.${mode}`);
  }

  workModeLabelCompact(mode: CorralStepWorkMode): string {
    return this.i18n.translate(`corralWorkSession.workModeCompact.${mode}`);
  }

  animalListSortLabelCompact(mode: CorralAnimalListSortMode): string {
    return this.i18n.translate(`corralActivityShortcut.listSortCompact.${mode}`);
  }

  workModeScanHint(mode: CorralStepWorkMode): string {
    return this.i18n.translate(`corralWorkSession.workMode.${mode}_scanHint`);
  }

  get activeWorkMode(): CorralStepWorkMode {
    return this.activeGridData?.work_mode ?? 'SCAN_DYNAMIC';
  }

  get isPreloadedWorkMode(): boolean {
    return this.preloadedWorkModes.includes(this.activeWorkMode);
  }

  get canLoadAnimals(): boolean {
    return !this.isClosed && this.isPreloadedWorkMode;
  }

  get loadAnimalsButtonTitle(): string | null {
    if (this.canLoadAnimals || this.isClosed) return null;
    return this.i18n.translate('corralWorkSession.loadAnimalsDisabledSequential');
  }

  get activeQueueScannedUuids(): string[] {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return [];
    return this.queueScannedByStep.get(stepUuid) ?? [];
  }

  get lastScannedAnimalUuid(): string | null {
    return this.activeQueueScannedUuids[0] ?? null;
  }

  animalListSortLabel(mode: CorralAnimalListSortMode): string {
    return this.i18n.translate(`corralActivityShortcut.listSort.${mode}`);
  }

  onAnimalListSortChange(mode: CorralAnimalListSortMode): void {
    this.animalListSort = mode;
    this.animalListSortService.setSort(mode, this.activityFocusCode);
  }

  get needsAnimalsForCurrentMode(): boolean {
    return this.isPreloadedWorkMode && (this.activeGridData?.rows.length ?? 0) === 0;
  }

  queueScannedCount(stepUuid: string): number {
    return this.queueScannedByStep.get(stepUuid)?.length ?? 0;
  }

  private normalizeScanIdentifier(value: string): string {
    return value.replace(/[\u0000-\u001F\u007F]/g, '').trim();
  }

  private recordQueueScan(stepUuid: string, animalUuid: string): void {
    const current = this.queueScannedByStep.get(stepUuid) ?? [];
    this.queueScannedByStep.set(stepUuid, [animalUuid, ...current.filter((uuid) => uuid !== animalUuid)]);
  }

  private unrecordQueueScan(stepUuid: string, animalUuid: string): void {
    const current = this.queueScannedByStep.get(stepUuid) ?? [];
    this.queueScannedByStep.set(
      stepUuid,
      current.filter((uuid) => uuid !== animalUuid)
    );
  }

  openLoadAnimalsPanel(): void {
    if (!this.canLoadAnimals) return;
    this.showAttachPanel = true;
    if (this.attachTab === 'inventory' && this.inventoryAnimals.length === 0) {
      this.loadInventory(true);
    }
  }

  clearUnknownScanPrompt(): void {
    this.unknownScanIdentifier = '';
    this.unknownScanContext = null;
    this.unknownAnimalUuid = null;
    this.matchChoices = [];
    this.pendingUnregisteredChoices = [];
  }

  choiceLabel(animal: AnimalLookupDto): string {
    const parts = [animal.registration_number];
    if (animal.chip_number) {
      parts.push(animal.chip_number);
    }
    if (animal.birth_date) {
      parts.push(String(animal.birth_date).slice(0, 10));
    }
    if (animal.sex === 'FEMALE' || animal.sex === 'MALE') {
      parts.push(this.historySexLabel(animal.sex));
    }
    if (parts.length === 1) {
      parts.push(animal.animal_uuid.slice(0, 8));
    }
    return parts.join(' · ');
  }

  chooseMatch(animal: AnimalLookupDto): void {
    const identifier = this.unknownScanIdentifier || animal.registration_number;
    this.matchChoices = [];
    if (this.activeGridData?.rows.some((row) => row.animal_uuid === animal.animal_uuid)) {
      this.afterRowLocated(animal.animal_uuid, identifier);
      this.clearUnknownScanPrompt();
      return;
    }
    if (this.activeWorkMode === 'SCAN_DYNAMIC') {
      this.addScannedAnimalToStep(identifier, animal.animal_uuid);
      this.clearUnknownScanPrompt();
      return;
    }
    this.unknownScanIdentifier = identifier;
    this.unknownScanContext = 'not_in_step';
    this.unknownAnimalUuid = animal.animal_uuid;
    this.highlightAnimalUuid = animal.animal_uuid;
    this.loadAnimalHistory(animal.animal_uuid, animal.registration_number);
  }

  usePendingUnregistered(animal: AnimalLookupDto): void {
    this.afterRowLocated(animal.animal_uuid, animal.registration_number);
    this.clearUnknownScanPrompt();
  }

  addAnotherUnregistered(): void {
    const identifier = this.unknownScanIdentifier.trim();
    this.clearUnknownScanPrompt();
    if (!identifier) {
      return;
    }
    this.addMissingScanAsLocalRow(identifier, true);
  }

  confirmAddUnknownScan(): void {
    const identifier = this.unknownScanIdentifier.trim();
    if (!identifier || !this.activeGridData) return;

    if (this.unknownScanContext === 'not_in_step' && this.unknownAnimalUuid) {
      this.appendingAnimals = true;
      this.api
        .appendAnimalsToStep(this.sessionUuid, this.activeGridData.uuid_corral_session_step, {
          manual_animal_uuids: [this.unknownAnimalUuid]
        })
        .pipe(
          catchError((err) => {
            this.errorMessage =
              translateApiError(this.i18n, err, 'corralWorkSession.errorAppendAnimals');
            return of(null);
          }),
          finalize(() => {
            this.appendingAnimals = false;
          })
        )
        .subscribe((grid) => {
          if (!grid || !this.workspace) return;
          const addedAnimalUuid = this.unknownAnimalUuid;
          this.workspace.grids[this.activeStepIndex] = grid;
          this.activeGrid?.replaceGrid(grid);
          if (addedAnimalUuid) {
            this.recordQueueScan(grid.uuid_corral_session_step, addedAnimalUuid);
            this.activeGrid?.focusRowByAnimalUuid(addedAnimalUuid);
            this.highlightAnimalUuid = addedAnimalUuid;
            this.applyScanDefaultsToAnimal(addedAnimalUuid);
          }
          this.successMessage = this.i18n.translate('corralWorkSession.animalAddedToGrid');
          this.clearUnknownScanPrompt();
          this.scanInput = '';
          this.schedulePersistWorkspaceDraft();
        });
      return;
    }

    this.clearUnknownScanPrompt();
  }

  private addMissingScanAsLocalRow(identifier: string, createNew = false): void {
    if (!this.activeGridData) return;
    const previousGrid = this.activeGrid?.snapshotGrid();
    this.api
      .addUnregisteredStepAnimal(
        this.sessionUuid,
        this.activeGridData.uuid_corral_session_step,
        identifier,
        { createNew }
      )
      .subscribe({
        next: (grid) => {
          if (!this.workspace) return;
          const merged = previousGrid ? this.preserveLocalRows(grid, previousGrid) : grid;
          this.workspace.grids[this.activeStepIndex] = merged;
          this.activeGrid?.replaceGrid(merged);
          const previousIds = new Set((previousGrid?.rows ?? []).map((row) => row.animal_uuid));
          const created = createNew
            ? [...merged.rows].reverse().find((row) => !previousIds.has(row.animal_uuid))
            : undefined;
          if (created) {
            this.recordQueueScan(merged.uuid_corral_session_step, created.animal_uuid);
            this.activeGrid?.focusRowByAnimalUuid(created.animal_uuid);
            this.highlightAnimalUuid = created.animal_uuid;
            this.applyScanDefaultsToAnimal(created.animal_uuid);
          } else {
            this.markQueueScan(identifier, merged.rows);
            this.focusScannedRow(identifier, merged.rows);
            this.applyScanDefaultsByIdentifier(identifier);
          }
          this.successMessage = this.i18n.translate('corralWorkSession.animalAddedLocalRow');
          this.clearUnknownScanPrompt();
          this.scanInput = '';
          this.schedulePersistWorkspaceDraft();
        },
        error: () => {
          this.activeGrid?.appendLocalSequentialRow(identifier, createNew);
          const localGrid = this.activeGrid?.snapshotGrid();
          if (localGrid) {
            this.markQueueScan(identifier, localGrid.rows);
          }
          this.applyScanDefaultsByIdentifier(identifier);
          this.showUnregisteredAnimalHistory(identifier);
          this.successMessage = this.i18n.translate('corralWorkSession.animalAddedLocalRow');
          this.clearUnknownScanPrompt();
          this.scanInput = '';
          this.schedulePersistWorkspaceDraft();
        }
      });
  }

  get activePresets(): StepFindingPresets {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return createEmptyStepFindingPresets();
    return this.getPresetsForStep(stepUuid);
  }

  get activeGridColumnPresets(): StepGridColumnPresets {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return createEmptyStepGridColumnPresets();
    return this.getGridColumnPresetsForStep(stepUuid);
  }

  get activeRowFindings(): Record<string, RowFindingState> {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return {};
    return this.rowFindingsByStep.get(stepUuid) ?? {};
  }

  get availableConditionPresets(): CorralVisualConditionCode[] {
    const used = new Set(this.activePresets.conditions);
    return this.conditionCodes.filter((code) => !used.has(code));
  }

  toggleFindingsPanel(): void {
    this.findingsPanelExpanded = !this.findingsPanelExpanded;
  }

  togglePresetsConfig(): void {
    this.presetsConfigExpanded = !this.presetsConfigExpanded;
  }

  toggleFindingColumns(): void {
    this.findingColumnsExpanded = !this.findingColumnsExpanded;
    this.persistFindingColumnsExpanded();
    this.schedulePersistWorkspaceDraft();
  }

  selectStep(index: number): void {
    this.persistCurrentStepFindings();
    this.persistWorkspaceDraft();
    this.activeStepIndex = index;
    this.openCounterMenuId = null;
    this.editingCounterId = null;
    this.clearUnknownScanPrompt();
    this.closeLoadAnimalsPanelIfUnavailable();
  }

  private persistCurrentStepFindings(): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || !this.activeGrid) return;
    this.rowFindingsByStep.set(stepUuid, this.activeGrid.getRowFindingsForSave());
  }

  conditionLabel(code: CorralVisualConditionCode): string {
    return this.i18n.translate(`corralWorkSession.condition.${code}`);
  }

  stepLabel(stepOrder: number, label?: string | null): string {
    return stepDisplayLabel(this.i18n, stepOrder, label);
  }

  private buildFindingPayload(state: RowFindingState): {
    observation_text: string | null;
    condition_code: CorralVisualConditionCode | null;
    additional_medications:
      | Array<{ product_name: string; dose: string | null; unit: string | null }>
      | undefined;
  } {
    let observation = state.observation.trim();
    let conditionCode: CorralVisualConditionCode | null = null;

    if (state.selectedConditionPresets.length === 1) {
      conditionCode = state.selectedConditionPresets[0];
    } else if (state.selectedConditionPresets.length > 1) {
      const conditionNote = `${this.i18n.translate('corralWorkSession.visualCondition')}: ${state.condition.trim()}`;
      observation = observation ? `${observation}\n${conditionNote}` : conditionNote;
    } else {
      const conditionText = state.condition.trim();
      if (CORRAL_VISUAL_CONDITION_CODES.includes(conditionText as CorralVisualConditionCode)) {
        conditionCode = conditionText as CorralVisualConditionCode;
      } else if (conditionText) {
        const conditionNote = `${this.i18n.translate('corralWorkSession.visualCondition')}: ${conditionText}`;
        observation = observation ? `${observation}\n${conditionNote}` : conditionNote;
      }
    }

    const additionalMedications =
      state.medications.length > 0
        ? state.medications.map((preset) => ({
            product_name: preset.product,
            dose: preset.dose?.trim() || null,
            unit: preset.unit?.trim() || null
          }))
        : undefined;

    return {
      observation_text: observation || null,
      condition_code: conditionCode,
      additional_medications: additionalMedications
    };
  }

  private hasFindingData(state: RowFindingState | undefined): boolean {
    if (!state) return false;
    return Boolean(
      state.observation.trim() ||
        state.condition.trim() ||
        state.selectedObservationPresets.length ||
        state.selectedConditionPresets.length ||
        state.medications.length
    );
  }

  addObservationPreset(): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    const text = this.presetObservationDraft.trim();
    if (!stepUuid || !text) return;
    const presets = this.getPresetsForStep(stepUuid);
    if (!presets.observations.includes(text)) {
      presets.observations = [...presets.observations, text];
      this.persistPresets(stepUuid);
    }
    this.presetObservationDraft = '';
  }

  removeObservationPreset(index: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return;
    const presets = this.getPresetsForStep(stepUuid);
    const removed = presets.observations[index];
    presets.observations = presets.observations.filter((_, i) => i !== index);
    presets.defaultObservations = presets.defaultObservations.filter((item) => item !== removed);
    this.persistPresets(stepUuid);
  }

  toggleObservationDefault(index: number): void {
    this.toggleFindingDefault('observation', index);
  }

  addConditionPreset(): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || !this.presetConditionDraft) return;
    const presets = this.getPresetsForStep(stepUuid);
    if (!presets.conditions.includes(this.presetConditionDraft)) {
      presets.conditions = [...presets.conditions, this.presetConditionDraft];
      this.persistPresets(stepUuid);
    }
    this.presetConditionDraft = '';
  }

  removeConditionPreset(index: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return;
    const presets = this.getPresetsForStep(stepUuid);
    const removed = presets.conditions[index];
    presets.conditions = presets.conditions.filter((_, i) => i !== index);
    presets.defaultConditions = presets.defaultConditions.filter((item) => item !== removed);
    this.persistPresets(stepUuid);
  }

  toggleConditionDefault(index: number): void {
    this.toggleFindingDefault('condition', index);
  }

  addMedicationPreset(): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    const product = this.presetMedicationProductDraft.trim();
    if (!stepUuid || !product) return;
    const presets = this.getPresetsForStep(stepUuid);
    const entry: MedicationPreset = {
      product,
      dose: this.presetMedicationDoseDraft.trim() || undefined,
      unit: this.presetMedicationUnitDraft.trim() || undefined
    };
    presets.medications = [...presets.medications, entry];
    this.persistPresets(stepUuid);
    this.presetMedicationProductDraft = '';
    this.presetMedicationDoseDraft = '';
    this.presetMedicationUnitDraft = '';
  }

  removeMedicationPreset(index: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return;
    const presets = this.getPresetsForStep(stepUuid);
    const removed = presets.medications[index];
    presets.medications = presets.medications.filter((_, i) => i !== index);
    if (removed) {
      const removedKey = medicationPresetKey(removed);
      presets.defaultMedicationKeys = presets.defaultMedicationKeys.filter((key) => key !== removedKey);
    }
    this.persistPresets(stepUuid);
  }

  toggleMedicationDefault(index: number): void {
    this.toggleFindingDefault('medication', index);
  }

  isObservationDefault(text: string): boolean {
    return this.activePresets.defaultObservations.includes(text);
  }

  isConditionDefault(code: CorralVisualConditionCode): boolean {
    return this.activePresets.defaultConditions.includes(code);
  }

  isMedicationDefault(preset: MedicationPreset): boolean {
    return this.activePresets.defaultMedicationKeys.includes(medicationPresetKey(preset));
  }

  defaultObservationLabel(): string | null {
    return this.joinDefaultLabels(this.activePresets.defaultObservations);
  }

  defaultConditionLabel(): string | null {
    return this.joinDefaultLabels(this.activePresets.defaultConditions.map((code) => this.conditionLabel(code)));
  }

  defaultMedicationLabel(): string | null {
    const labels = this.activePresets.defaultMedicationKeys.flatMap((key) => {
      const preset = this.activePresets.medications.find((item) => medicationPresetKey(item) === key);
      return preset ? [this.medicationPresetLabel(preset)] : [];
    });
    return this.joinDefaultLabels(labels);
  }

  addGridColumnPreset(column: CorralStepGridColumnDto): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    const label = this.gridColumnPresetDraftByKey[column.column_key]?.trim();
    if (!stepUuid || !label || column.value_type === 'boolean') return;

    this.appendGridColumnPresetEntry(stepUuid, column.column_key, { value: label, label });
    this.gridColumnPresetDraftByKey[column.column_key] = '';
  }

  addGridColumnBooleanPreset(columnKey: string, value: 'true' | 'false'): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return;

    const customLabel = this.gridColumnPresetDraftByKey[columnKey]?.trim();
    const label = customLabel || this.i18n.translate(value === 'true' ? 'common.yes' : 'common.no');
    this.appendGridColumnPresetEntry(stepUuid, columnKey, { value, label });
    this.gridColumnPresetDraftByKey[columnKey] = '';
  }

  toggleGridColumnPresetDefault(columnKey: string, index: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || this.isClosed) return;

    const presets = this.getGridColumnPresetsForStep(stepUuid);
    const entries = presets[columnKey] ?? [];
    if (!entries[index]) return;

    const enable = !entries[index].isDefault;
    const column = this.activeGridData?.columns.find((item) => item.column_key === columnKey);
    const exclusiveDefault = column?.value_type === 'boolean';
    presets[columnKey] = entries.map((entry, itemIndex) => {
      const next: GridColumnPresetEntry = { value: entry.value, label: entry.label };
      if (itemIndex === index) {
        if (enable) {
          next.isDefault = true;
        }
        return next;
      }
      if (entry.isDefault && !exclusiveDefault) {
        next.isDefault = true;
      }
      return next;
    });
    this.persistGridColumnPresets(stepUuid);
  }

  defaultGridColumnPresetLabel(columnKey: string): string | null {
    return this.joinDefaultLabels(
      this.getGridColumnPresetEntries(columnKey)
        .filter((entry) => entry.isDefault)
        .map((entry) => entry.label)
    );
  }

  removeGridColumnPreset(columnKey: string, index: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return;

    const presets = this.getGridColumnPresetsForStep(stepUuid);
    presets[columnKey] = (presets[columnKey] ?? []).filter((_, itemIndex) => itemIndex !== index);
    if (presets[columnKey].length === 0) {
      delete presets[columnKey];
    }
    this.persistGridColumnPresets(stepUuid);
  }

  getGridColumnPresetEntries(columnKey: string): GridColumnPresetEntry[] {
    return this.activeGridColumnPresets[columnKey] ?? [];
  }

  private appendGridColumnPresetEntry(
    stepUuid: string,
    columnKey: string,
    entry: GridColumnPresetEntry
  ): void {
    const presets = this.getGridColumnPresetsForStep(stepUuid);
    const current = presets[columnKey] ?? [];
    const exists = current.some((item) => item.value === entry.value && item.label === entry.label);
    if (!exists) {
      presets[columnKey] = [...current, entry];
      this.persistGridColumnPresets(stepUuid);
    }
  }

  medicationPresetLabel(preset: MedicationPreset): string {
    const parts = [preset.product];
    if (preset.dose) parts.push(preset.dose);
    if (preset.unit) parts.push(preset.unit);
    return parts.join(' · ');
  }

  private getPresetsForStep(stepUuid: string): StepFindingPresets {
    if (!this.presetsByStep.has(stepUuid)) {
      this.presetsByStep.set(
        stepUuid,
        this.stepPresetStorage.getFindingPresets(this.sessionUuid, stepUuid, this.presetRanchUuid)
      );
    }
    return this.presetsByStep.get(stepUuid)!;
  }

  private toggleFindingDefault(kind: 'observation' | 'condition' | 'medication', index: number): void {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid || this.isClosed) return;

    const presets = this.getPresetsForStep(stepUuid);
    if (kind === 'observation') {
      const text = presets.observations[index];
      if (!text) return;
      presets.defaultObservations = this.toggleDefaultValue(presets.defaultObservations, text);
    } else if (kind === 'condition') {
      const code = presets.conditions[index];
      if (!code) return;
      presets.defaultConditions = this.toggleDefaultValue(presets.defaultConditions, code);
    } else {
      const preset = presets.medications[index];
      if (!preset) return;
      const key = medicationPresetKey(preset);
      presets.defaultMedicationKeys = this.toggleDefaultValue(presets.defaultMedicationKeys, key);
    }
    this.persistPresets(stepUuid);
  }

  private persistPresets(stepUuid: string): void {
    const presets = this.presetsByStep.get(stepUuid);
    if (presets) {
      this.stepPresetStorage.setFindingPresets(this.sessionUuid, stepUuid, this.presetRanchUuid, presets);
    }
  }

  private getGridColumnPresetsForStep(stepUuid: string): StepGridColumnPresets {
    if (!this.gridColumnPresetsByStep.has(stepUuid)) {
      const columnKeys = (this.workspace?.grids ?? [])
        .find((grid) => grid.uuid_corral_session_step === stepUuid)
        ?.columns.map((column) => column.column_key) ?? [];
      this.gridColumnPresetsByStep.set(
        stepUuid,
        this.stepPresetStorage.getGridPresets(this.sessionUuid, stepUuid, this.presetRanchUuid, columnKeys)
      );
    }
    return this.gridColumnPresetsByStep.get(stepUuid)!;
  }

  private persistGridColumnPresets(stepUuid: string): void {
    const presets = this.gridColumnPresetsByStep.get(stepUuid);
    if (presets) {
      this.stepPresetStorage.setGridPresets(this.sessionUuid, stepUuid, this.presetRanchUuid, presets);
    }
  }

  private get presetRanchUuid(): string {
    return this.workspace?.session.ranch_uuid ?? '';
  }

  private toggleDefaultValue<T extends string>(values: T[], item: T): T[] {
    return values.includes(item) ? values.filter((value) => value !== item) : [...values, item];
  }

  private joinDefaultLabels(labels: string[]): string | null {
    const cleaned = labels.map((label) => label.trim()).filter((label) => label.length > 0);
    return cleaned.length > 0 ? cleaned.join(', ') : null;
  }

  private applyScanDefaultsByIdentifier(identifier: string): void {
    const rows = this.activeGrid?.snapshotGrid()?.rows ?? this.activeGridData?.rows ?? [];
    const matches = this.rowsMatchingIdentifier(identifier, rows);
    if (matches.length === 1) {
      this.applyScanDefaultsToAnimal(matches[0].animal_uuid);
    }
  }

  private applyScanDefaultsToAnimal(animalUuid: string | null | undefined): void {
    if (!animalUuid || this.isClosed) return;
    this.activeGrid?.applyColumnDefaults(animalUuid);
  }

  get inventoryPageNumbers(): number[] {
    return pageNumbers(this.inventoryTotalPages);
  }

  get selectedInventoryCount(): number {
    return this.selectedManualUuids.size;
  }

  onAttachTabChange(tab: 'paddocks' | 'filters' | 'inventory'): void {
    this.attachTab = tab;
    if (tab === 'inventory' && this.inventoryAnimals.length === 0 && !this.inventoryLoading) {
      this.loadInventory(true);
    }
  }

  toggleHeaderMenu(): void {
    this.headerMenuExpanded = !this.headerMenuExpanded;
  }

  onLoadAnimalsPanelToggle(): void {
    if (!this.canLoadAnimals) {
      this.showAttachPanel = false;
      return;
    }
    this.showAttachPanel = !this.showAttachPanel;
    if (this.showAttachPanel && this.attachTab === 'inventory' && this.inventoryAnimals.length === 0) {
      this.loadInventory(true);
    }
  }

  private closeLoadAnimalsPanelIfUnavailable(): void {
    if (!this.canLoadAnimals) {
      this.showAttachPanel = false;
    }
  }

  onWorkModeChange(mode: CorralStepWorkMode): void {
    if (!this.activeGridData || this.isClosed || mode === this.activeWorkMode) return;

    this.persistCurrentStepFindings();
    this.persistWorkspaceDraft();
    const previousGrid = this.activeGrid?.snapshotGrid() ?? {
      ...this.activeGridData,
      rows: this.activeGridData.rows.map((row) => ({
        ...row,
        values: { ...row.values }
      }))
    };

    this.updatingWorkMode = true;
    this.errorMessage = '';
    this.api
      .updateStepWorkMode(this.sessionUuid, this.activeGridData.uuid_corral_session_step, mode)
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorUpdateWorkMode');
          return of(null);
        }),
        finalize(() => {
          this.updatingWorkMode = false;
        })
      )
      .subscribe((grid) => {
        if (!grid || !this.workspace) return;
        const merged = this.mergeGridWithDraft(grid, previousGrid);
        this.workspace.grids[this.activeStepIndex] = merged;
        this.activeGrid?.replaceGrid(merged);
        this.closeLoadAnimalsPanelIfUnavailable();
        this.successMessage = this.i18n.translate('corralWorkSession.workModeUpdated');
        this.schedulePersistWorkspaceDraft();
      });
  }

  onScanKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (this.unknownScanIdentifier && this.unknownScanContext === 'not_in_step') {
      const id = this.normalizeScanIdentifier(this.scanInput);
      if (!id || id === this.unknownScanIdentifier) {
        this.confirmAddUnknownScan();
        return;
      }
    }

    this.onScan();
  }

  onScan(): void {
    const id = this.normalizeScanIdentifier(this.scanInput);
    if (!id || !this.activeGridData) return;

    this.clearUnknownScanPrompt();
    this.errorMessage = '';

    const gridMatches = this.rowsMatchingIdentifier(id, this.activeGridData.rows);
    this.api.lookupAnimal(this.sessionUuid, id).subscribe({
      next: (result) => this.resolveScanMatches(id, gridMatches, result.matches ?? []),
      error: () => this.resolveScanMatches(id, gridMatches, [])
    });
  }

  private resolveScanMatches(
    identifier: string,
    gridMatches: Array<{ animal_uuid: string; registration_number: string; chip_number?: string | null }>,
    inventoryMatches: AnimalLookupDto[]
  ): void {
    const gridChoices: AnimalLookupDto[] = gridMatches.map((row) => ({
      animal_uuid: row.animal_uuid,
      registration_number: row.registration_number,
      chip_number: row.chip_number
    }));
    const onGrid = new Set(gridChoices.map((row) => row.animal_uuid));
    const notOnGrid = inventoryMatches.filter((animal) => !onGrid.has(animal.animal_uuid));

    if (notOnGrid.length === 0 && gridChoices.length === 1) {
      this.afterRowLocated(gridChoices[0].animal_uuid, identifier);
      return;
    }
    if (notOnGrid.length === 0 && gridChoices.length > 1) {
      this.unknownScanIdentifier = identifier;
      this.matchChoices = gridChoices;
      return;
    }
    if (notOnGrid.length === 1 && gridChoices.length === 0) {
      this.continueWithSingleLookup(identifier, notOnGrid[0]);
      return;
    }
    if (notOnGrid.length === 0 && gridChoices.length === 0) {
      this.promptUnregisteredScan(identifier);
      return;
    }

    this.unknownScanIdentifier = identifier;
    this.matchChoices = [...gridChoices, ...notOnGrid];
  }

  isAnimalOnActiveStep(animal: AnimalLookupDto): boolean {
    return (this.activeGridData?.rows ?? []).some((row) => row.animal_uuid === animal.animal_uuid);
  }

  private continueWithSingleLookup(identifier: string, animal: AnimalLookupDto): void {
    if (this.activeWorkMode === 'SCAN_DYNAMIC') {
      this.addScannedAnimalToStep(identifier, animal.animal_uuid);
      return;
    }
    this.unknownScanIdentifier = identifier;
    this.unknownScanContext = 'not_in_step';
    this.unknownAnimalUuid = animal.animal_uuid;
    this.highlightAnimalUuid = animal.animal_uuid;
    this.loadAnimalHistory(animal.animal_uuid, animal.registration_number);
  }

  private promptUnregisteredScan(identifier: string): void {
    const pending = this.rowsMatchingIdentifier(identifier, this.activeGridData?.rows ?? []).filter((row) =>
      this.isMissingInventoryRow(row)
    );
    if (pending.length > 0) {
      this.unknownScanIdentifier = identifier;
      this.unknownScanContext = 'duplicate_unregistered';
      this.pendingUnregisteredChoices = pending.map((row) => ({
        animal_uuid: row.animal_uuid,
        registration_number: row.registration_number,
        chip_number: row.chip_number
      }));
      return;
    }
    this.addMissingScanAsLocalRow(identifier);
  }

  private rowsMatchingIdentifier<T extends { registration_number: string; chip_number?: string | null }>(
    identifier: string,
    rows: T[]
  ): T[] {
    const key = identifier.trim().toLowerCase();
    return rows.filter(
      (row) =>
        row.registration_number.trim().toLowerCase() === key ||
        row.chip_number?.trim().toLowerCase() === key
    );
  }

  private afterRowLocated(animalUuid: string, identifier: string): void {
    if (!this.activeGridData) return;
    this.highlightAnimalUuid = animalUuid;
    const row = this.activeGridData.rows.find((item) => item.animal_uuid === animalUuid);
    if (row?.missing_inventory || animalUuid.startsWith('local-')) {
      this.showUnregisteredAnimalHistory(row?.registration_number || identifier);
    } else {
      this.loadAnimalHistory(animalUuid, row?.registration_number || identifier);
    }
    this.recordQueueScan(this.activeGridData.uuid_corral_session_step, animalUuid);
    if (this.activeWorkMode === 'PRELOADED_QUEUE') {
      this.successMessage = this.i18n.translate('corralWorkSession.animalQueued');
    } else {
      this.successMessage = this.i18n.translate('corralWorkSession.animalLocated');
    }
    this.applyScanDefaultsToAnimal(animalUuid);
    this.scanInput = '';
    this.schedulePersistWorkspaceDraft();
  }

  private markQueueScan(
    identifier: string,
    rows: Array<{ animal_uuid: string; registration_number: string; chip_number?: string | null }>
  ): void {
    if (!this.activeGridData) return;
    const matches = this.rowsMatchingIdentifier(identifier, rows);
    if (matches.length !== 1) return;
    this.recordQueueScan(this.activeGridData.uuid_corral_session_step, matches[0].animal_uuid);
    this.activeGrid?.ensureScannedSectionExpanded();
  }

  private focusScannedRow(
    identifier: string,
    rows: Array<{
      animal_uuid: string;
      registration_number: string;
      chip_number?: string | null;
      missing_inventory?: boolean;
    }>
  ): void {
    const matches = this.rowsMatchingIdentifier(identifier, rows);
    if (matches.length !== 1) return;
    const matched = matches[0];
    this.highlightAnimalUuid = matched.animal_uuid;
    this.activeGrid?.focusRowByAnimalUuid(matched.animal_uuid);
    if (matched.missing_inventory || matched.animal_uuid.startsWith('local-')) {
      this.showUnregisteredAnimalHistory(matched.registration_number);
      return;
    }
    this.loadAnimalHistory(matched.animal_uuid, matched.registration_number);
  }

  historySexLabel(sex?: string | null): string {
    if (sex === 'FEMALE') return this.i18n.translate('animal.female');
    if (sex === 'MALE') return this.i18n.translate('animal.male');
    return this.i18n.translate('common.notAvailable');
  }

  formatHistoryValues(activityCode: string, values: string[]): string {
    return values
      .map((value) =>
        activityCode === 'ATTENDANCE'
          ? this.i18n.translate(value === 'true' ? 'common.yes' : 'common.no')
          : value
      )
      .join(', ');
  }

  private showUnregisteredAnimalHistory(registrationNumber: string): void {
    this.historyRequestId += 1;
    this.historyAnimalUuid = null;
    this.historyRegistrationNumber = registrationNumber;
    this.historyProfile = null;
    this.historySessions = [];
    this.historyLoading = false;
    this.historyError = false;
    this.historyUnregistered = true;
    this.findingsPanelExpanded = true;
  }

  private loadAnimalHistory(animalUuid: string, registrationNumber: string, quiet = false): void {
    if (!animalUuid || animalUuid.startsWith('local-')) {
      this.showUnregisteredAnimalHistory(registrationNumber);
      return;
    }

    this.historyAnimalUuid = animalUuid;
    this.historyRegistrationNumber = registrationNumber;
    this.historyError = false;
    this.historyUnregistered = false;
    if (!quiet) {
      this.historyProfile = null;
      this.historySessions = [];
      this.historyLoading = true;
      this.findingsPanelExpanded = true;
    }
    const requestId = ++this.historyRequestId;
    this.api.getAnimalWorkHistory(this.sessionUuid, animalUuid).subscribe({
      next: (history) => {
        if (requestId !== this.historyRequestId) return;
        this.historyRegistrationNumber = history.registration_number || registrationNumber;
        this.historyProfile = history.profile;
        this.historySessions = history.sessions;
        this.historyLoading = false;
      },
      error: () => {
        if (requestId !== this.historyRequestId) return;
        this.historyLoading = false;
        if (!quiet) {
          this.historyError = true;
        }
      }
    });
  }

  private addScannedAnimalToStep(identifier: string, animalUuid?: string): void {
    if (!this.activeGridData) return;
    this.api.scanStepAnimal(this.sessionUuid, this.activeGridData.uuid_corral_session_step, identifier, animalUuid).subscribe({
      next: (grid) => {
        if (!this.workspace) return;
        this.workspace.grids[this.activeStepIndex] = grid;
        this.activeGrid?.replaceGrid(grid);
        this.markQueueScan(identifier, grid.rows);
        this.focusScannedRow(identifier, grid.rows);
        this.applyScanDefaultsByIdentifier(identifier);
        this.successMessage = this.i18n.translate('corralWorkSession.animalAddedToGrid');
        this.scanInput = '';
        this.schedulePersistWorkspaceDraft();
      },
      error: (err) => {
        this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorAnimalNotFound');
      }
    });
  }

  togglePaddock(uuid: string, checked: boolean): void {
    if (checked) {
      this.selectedPaddockUuids.add(uuid);
    } else {
      this.selectedPaddockUuids.delete(uuid);
    }
    this.schedulePreview();
  }

  isPaddockSelected(uuid: string): boolean {
    return this.selectedPaddockUuids.has(uuid);
  }

  onFilterChange(): void {
    this.schedulePreview();
  }

  onInventorySearchInput(): void {
    if (this.inventorySearchTimer) {
      clearTimeout(this.inventorySearchTimer);
    }
    this.inventorySearchTimer = setTimeout(() => this.loadInventory(true), 350);
  }

  onInventoryPageSizeChange(value: string | number): void {
    if (value === 'all') {
      if (this.inventoryPageSize === 0) return;
      this.inventoryPageSize = 0;
    } else {
      const next = typeof value === 'number' ? value : Number.parseInt(value, 10);
      if (!this.inventoryPageSizeOptions.includes(next) || next === this.inventoryPageSize) return;
      this.inventoryPageSize = next;
    }
    this.inventoryPage = 1;
    this.loadInventory();
  }

  goToInventoryPage(page: number): void {
    if (this.inventoryPageSize <= 0 || page < 1 || page > this.inventoryTotalPages || page === this.inventoryPage) {
      return;
    }
    this.inventoryPage = page;
    this.loadInventory();
  }

  loadInventory(reset = false): void {
    if (reset) {
      this.inventoryPage = 1;
    }
    this.inventoryLoading = true;
    const ranchUuid = this.workspace?.session.ranch_uuid;
    this.animalService
      .getAnimals({
        page: this.inventoryPageSize > 0 ? this.inventoryPage : 1,
        size: this.inventoryPageSize > 0 ? this.inventoryPageSize : 0,
        search: this.inventorySearch.trim() || undefined,
        sex: 'ALL',
        status: 'active',
        sortBy: 'registration_number',
        order: 'ASC',
        ranch_uuid: ranchUuid
      })
      .pipe(finalize(() => {
        this.inventoryLoading = false;
      }))
      .subscribe({
        next: (result) => {
          this.inventoryAnimals = result.items;
          this.inventoryTotal = result.pagination?.totalItems ?? this.inventoryAnimals.length;
          this.inventoryTotalPages = Math.max(result.pagination?.totalPages ?? 1, 1);
          if (this.inventoryPage > this.inventoryTotalPages) {
            this.inventoryPage = this.inventoryTotalPages;
          }
        },
        error: () => {
          this.inventoryAnimals = [];
          this.inventoryTotal = 0;
          this.inventoryTotalPages = 1;
        }
      });
  }

  toggleManual(uuid: string, checked: boolean): void {
    if (checked) {
      this.selectedManualUuids.add(uuid);
    } else {
      this.selectedManualUuids.delete(uuid);
    }
    this.schedulePreview();
  }

  isManualSelected(uuid: string): boolean {
    return this.selectedManualUuids.has(uuid);
  }

  isInventoryPageFullySelected(): boolean {
    return this.inventoryAnimals.length > 0 && this.inventoryAnimals.every((a) => this.selectedManualUuids.has(a.animal_uuid));
  }

  toggleSelectAllInventory(checked: boolean): void {
    for (const animal of this.inventoryAnimals) {
      if (checked) {
        this.selectedManualUuids.add(animal.animal_uuid);
      } else {
        this.selectedManualUuids.delete(animal.animal_uuid);
      }
    }
    this.schedulePreview();
  }

  sexLabel(sex: string): string {
    if (sex === 'MALE') return this.i18n.translate('animal.male');
    if (sex === 'FEMALE') return this.i18n.translate('animal.female');
    return sex;
  }

  originLabel(value: string): string {
    const keyMap: Record<string, string> = {
      BIRTH: 'animal.originBirth',
      PURCHASE: 'animal.originPurchase',
      TRANSFER: 'animal.originTransfer',
      UNKNOWN: 'animal.originUnknown'
    };
    const key = keyMap[value];
    return key ? this.i18n.translate(key) : value;
  }

  private buildAttachSourceBody(): CorralSessionAnimalsSourceBody {
    const source_filters: CorralSessionSourceFilter[] = [];
    if (this.filterMale) {
      source_filters.push({ filter_key: 'sex', filter_value: 'MALE' });
    }
    if (this.filterFemale) {
      source_filters.push({ filter_key: 'sex', filter_value: 'FEMALE' });
    }
    if (this.filterBreedCode.trim()) {
      source_filters.push({ filter_key: 'breed_code', filter_value: this.filterBreedCode.trim() });
    }
    if (this.filterOriginType) {
      source_filters.push({ filter_key: 'origin_type', filter_value: this.filterOriginType });
    }
    return {
      source_paddock_uuids: [...this.selectedPaddockUuids],
      source_filters,
      manual_animal_uuids: [...this.selectedManualUuids]
    };
  }

  private schedulePreview(): void {
    this.preview = null;
    if (!this.hasAnyAttachSource) return;
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }
    this.previewTimer = setTimeout(() => this.runPreview(), 450);
  }

  private runPreview(): void {
    if (!this.hasAnyAttachSource) return;
    this.previewing = true;
    this.api
      .previewAnimals(this.sessionUuid, this.buildAttachSourceBody())
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorPreview');
          return of(null);
        }),
        finalize(() => {
          this.previewing = false;
        })
      )
      .subscribe((preview) => {
        if (!preview) return;
        this.preview = preview;
        if (preview.total_count === 0) {
          this.errorMessage = this.i18n.translate('corralWorkSession.errorNoAnimalsMatched');
          return;
        }
        this.errorMessage = '';
      });
  }

  appendAnimalsToCurrentStep(): void {
    if (!this.activeGridData || this.isClosed) return;
    if (!this.hasAnyAttachSource) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorNoSources');
      return;
    }
    if (!this.preview) {
      this.errorMessage = this.i18n.translate('corralWorkSession.errorPreviewRequired');
      this.runPreview();
      return;
    }

    this.appendingAnimals = true;
    this.errorMessage = '';
    this.api
      .appendAnimalsToStep(this.sessionUuid, this.activeGridData.uuid_corral_session_step, this.buildAttachSourceBody())
      .pipe(
        catchError((err) => {
          this.errorMessage =
            translateApiError(this.i18n, err, 'corralWorkSession.errorAppendAnimals');
          return of(null);
        }),
        finalize(() => {
          this.appendingAnimals = false;
        })
      )
      .subscribe((grid) => {
        if (!grid || !this.workspace) return;
        this.workspace.grids[this.activeStepIndex] = grid;
        this.activeGrid?.replaceGrid(grid);
        this.successMessage = this.i18n.translate('corralWorkSession.animalsAppended');
        this.showAttachPanel = false;
        this.schedulePersistWorkspaceDraft();
      });
  }

  onRemoveScannedRow(animalUuid: string): void {
    if (!this.activeGridData || this.isClosed || !animalUuid) return;

    const registrationNumber =
      this.activeGridData.rows.find((row) => row.animal_uuid === animalUuid)?.registration_number || animalUuid;

    void this.confirmRemoveScannedRow(registrationNumber).then((confirmed) => {
      if (confirmed) {
        this.executeRemoveScannedRow(animalUuid);
      }
    });
  }

  private confirmRemoveScannedRow(registrationNumber: string): Promise<boolean> {
    const params = { number: registrationNumber };
    return this.openConfirmDialog(
      'corralWorkSession.removeScannedRowTitle',
      'corralWorkSession.removeScannedRowConfirm',
      params,
      'corralWorkSession.removeScannedRowConfirmButton'
    ).then((firstOk) => {
      if (!firstOk) return false;
      return this.openConfirmDialog(
        'corralWorkSession.removeScannedRowTitle',
        'corralWorkSession.removeScannedRowConfirmAgain',
        params,
        'corralWorkSession.removeScannedRowConfirmAgainButton'
      );
    });
  }

  private confirmTwice(
    titleKey: string,
    messageKey: string,
    confirmKey: string,
    againMessageKey: string,
    againConfirmKey: string,
    confirmButtonClass: string
  ): Promise<boolean> {
    return this.openConfirmDialog(titleKey, messageKey, {}, confirmKey, confirmButtonClass).then((firstOk) => {
      if (!firstOk) return false;
      return this.openConfirmDialog(titleKey, againMessageKey, {}, againConfirmKey, confirmButtonClass);
    });
  }

  private openConfirmDialog(
    titleKey: string,
    messageKey: string,
    messageParams: Record<string, string>,
    confirmKey: string,
    confirmButtonClass = 'btn-danger'
  ): Promise<boolean> {
    const modalRef = this.modalService.open(ConfirmDialogComponent, { centered: true, backdrop: 'static' });
    const dialog = modalRef.componentInstance as ConfirmDialogComponent;
    dialog.titleKey = titleKey;
    dialog.messageKey = messageKey;
    dialog.messageParams = messageParams;
    dialog.confirmKey = confirmKey;
    dialog.cancelKey = 'common.cancel';
    dialog.confirmButtonClass = confirmButtonClass;
    return modalRef.result.then(
      () => true,
      () => false
    );
  }

  private executeRemoveScannedRow(animalUuid: string): void {
    if (!this.activeGridData || this.isClosed || !animalUuid) return;

    const stepUuid = this.activeGridData.uuid_corral_session_step;
    this.unrecordQueueScan(stepUuid, animalUuid);
    if (this.highlightAnimalUuid === animalUuid) {
      this.highlightAnimalUuid = null;
      this.historyAnimalUuid = null;
      this.historyRegistrationNumber = '';
      this.historyProfile = null;
      this.historySessions = [];
    }
    const findings = this.rowFindingsByStep.get(stepUuid);
    if (findings) {
      delete findings[animalUuid];
    }

    if (animalUuid.startsWith('local-')) {
      this.activeGrid?.removeLocalRow(animalUuid);
      this.successMessage = this.i18n.translate('corralWorkSession.scannedRowRemoved');
      this.schedulePersistWorkspaceDraft();
      return;
    }

    const previousGrid = this.activeGrid?.snapshotGrid();
    this.api.removeStepAnimal(this.sessionUuid, stepUuid, animalUuid).subscribe({
      next: (grid) => {
        if (!this.workspace) return;
        const preserved = previousGrid ? this.preserveLocalRows(grid, previousGrid) : grid;
        const merged = {
          ...preserved,
          rows: preserved.rows.filter((row) => row.animal_uuid !== animalUuid)
        };
        this.workspace.grids[this.activeStepIndex] = merged;
        this.activeGrid?.replaceGrid(merged);
        this.successMessage = this.i18n.translate('corralWorkSession.scannedRowRemoved');
        this.schedulePersistWorkspaceDraft();
      },
      error: (err) => {
        this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorRemoveScannedRow');
      }
    });
  }

  onGridChange(grid: CorralStepGridDto): void {
    if (!this.workspace) return;
    this.workspace.grids[this.activeStepIndex] = grid;
    this.schedulePersistWorkspaceDraft();
    this.scheduleAutosave();
  }

  onWorkspaceDraftChange(): void {
    this.schedulePersistWorkspaceDraft();
    this.scheduleAutosave();
  }

  private scheduleAutosave(): void {
    if (this.isClosed) return;
    if (this.saving) {
      this.pendingAutosave = true;
      return;
    }
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
    }
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      this.flushAutosave();
    }, 700);
  }

  private flushAutosave(): void {
    if (this.isClosed || this.saving || !this.activeGrid) return;
    this.silentAutosave = true;
    this.activeGrid.requestSave();
  }

  private activityLimitOrFallback(err: unknown, fallbackKey: string): string {
    const name = (err as { error?: { error?: { name?: string } } })?.error?.error?.name;
    if (name === 'PlanActivityRecordLimitReached') {
      return this.i18n.translate('corralWorkSession.errorActivityRecordLimit');
    }
    return translateApiError(this.i18n, err, fallbackKey);
  }

  onSaveGrid(grid: CorralStepGridDto): void {
    if (!grid || this.isClosed) return;
    const silent = this.silentAutosave;
    this.silentAutosave = false;
    if (silent) {
      this.executeSaveGrid(grid, true);
      return;
    }
    void this.openConfirmDialog(
      'corralWorkSession.saveStepGridTitle',
      'corralWorkSession.saveStepGridConfirm',
      {},
      'corralWorkSession.saveStepGridConfirmButton',
      'btn-primary'
    ).then((confirmed) => {
      if (confirmed) {
        this.executeSaveGrid(grid, false);
      }
    });
  }

  private executeSaveGrid(grid: CorralStepGridDto, silent: boolean): void {
    if (!grid || this.isClosed) return;
    if (this.autosaveTimer) {
      clearTimeout(this.autosaveTimer);
      this.autosaveTimer = null;
    }
    const previousGrid = this.workspace?.grids[this.activeStepIndex];
    const moves = this.paddockMovesFromGrid(grid);
    this.persistCurrentStepFindings();
    this.saving = true;
    this.errorMessage = '';
    this.api
      .saveStepGrid(this.sessionUuid, grid.uuid_corral_session_step, {
        rows: grid.rows.map((r) => ({
          animal_uuid: r.animal_uuid,
          registration_number: r.registration_number,
          missing_inventory: this.isMissingInventoryRow(r),
          values: r.values
        })),
        scanned_animal_uuids: this.queueScannedByStep.get(grid.uuid_corral_session_step) ?? []
      })
      .pipe(
        switchMap((updated) => {
          if (!updated || moves.length === 0) {
            return of({ grid: updated, apply: null as ApplyPaddockDistributionResultDto | null });
          }
          return this.api.applyPaddockDistribution(this.sessionUuid, grid.uuid_corral_session_step, moves).pipe(
            map((apply) => ({ grid: apply?.grid ?? updated, apply })),
            catchError((err) => {
            this.errorMessage = this.activityLimitOrFallback(err, 'paddockMove.errorApply');
              return of({ grid: updated, apply: null as ApplyPaddockDistributionResultDto | null });
            })
          );
        }),
        catchError((err) => {
          this.errorMessage = this.activityLimitOrFallback(err, 'corralWorkSession.errorSaveRecord');
          return of(null);
        }),
        finalize(() => {
          this.saving = false;
          if (this.pendingAutosave) {
            this.pendingAutosave = false;
            this.scheduleAutosave();
          }
        })
      )
      .subscribe((result) => {
        if (!result?.grid || !this.workspace) return;
        const preserved = previousGrid ? this.preserveLocalRows(result.grid, previousGrid) : result.grid;
        const merged = this.keepSelectedBooleanShortcuts(preserved, previousGrid);
        this.workspace.grids[this.activeStepIndex] = merged;
        if (result.apply) {
          this.workspace.session.status = result.apply.session_status;
        }
        this.activeGrid?.replaceGrid(merged);
        this.saveFindingsForGrid(merged, silent ? undefined : this.paddockSaveMessage(result.apply), silent);
        this.refreshVisibleAnimalHistory();
        this.clearWorkspaceDraft();
      });
  }

  private paddockMovesFromGrid(grid: CorralStepGridDto): Array<{ animal_uuid: string; destination_paddock_uuid: string }> {
    if (!grid.columns.some((column) => column.value_type === 'paddock_destination')) return [];
    return grid.rows.flatMap((row) => {
      if (this.isMissingInventoryRow(row)) return [];
      const destination = row.values['paddock_move'];
      if (typeof destination !== 'string' || !destination || destination === row.current_paddock_uuid) return [];
      return [{ animal_uuid: row.animal_uuid, destination_paddock_uuid: destination }];
    });
  }

  private paddockSaveMessage(apply: ApplyPaddockDistributionResultDto | null): string | undefined {
    if (!apply) return undefined;
    const warningText = apply.capacity_warnings
      .map((warning) =>
        this.i18n.translate('paddockMove.capacityWarning', {
          paddock: warning.paddock_name,
          count: warning.projected_count,
          capacity: warning.maximum_capacity
        })
      )
      .join(' ');
    return [this.i18n.translate('paddockMove.moved', { count: apply.moved_count }), warningText]
      .filter((part) => part.length > 0)
      .join(' ');
  }

  private saveFindingsForGrid(grid: CorralStepGridDto, successMessage?: string, silent = false): void {
    const stepUuid = grid.uuid_corral_session_step;
    const findings = this.rowFindingsByStep.get(stepUuid) ?? this.activeGrid?.getRowFindingsForSave() ?? {};
    const rowsToSave = grid.rows.filter(
      (row) => !this.isMissingInventoryRow(row) && this.hasFindingData(findings[row.animal_uuid])
    );

    const message = successMessage ?? (silent ? '' : this.i18n.translate('corralWorkSession.stepGridSaved'));
    if (rowsToSave.length === 0) {
      if (!this.errorMessage && message) {
        this.successMessage = message;
      }
      this.clearWorkspaceDraft();
      return;
    }

    forkJoin(
      rowsToSave.map((row) => {
        const state = findings[row.animal_uuid] ?? createEmptyRowFindingState();
        const findingPayload = this.buildFindingPayload(state);
        return this.api.upsertFinding(this.sessionUuid, {
          animal_uuid: row.animal_uuid,
          uuid_corral_session_step: stepUuid,
          observation_text: findingPayload.observation_text,
          condition_code: findingPayload.condition_code,
          additional_medications: findingPayload.additional_medications
        }).pipe(catchError(() => of(undefined)));
      })
    ).subscribe(() => {
      if (!this.errorMessage && message) {
        this.successMessage = message;
      }
      this.refreshVisibleAnimalHistory();
      this.clearWorkspaceDraft();
    });
  }

  private refreshVisibleAnimalHistory(): void {
    if (!this.historyAnimalUuid || this.historyUnregistered) return;
    this.loadAnimalHistory(this.historyAnimalUuid, this.historyRegistrationNumber, true);
  }

  closeSession(): void {
    if (this.closing || this.isClosed) return;
    void this.confirmTwice(
      'corralWorkSession.closeSessionTitle',
      'corralWorkSession.closeSessionConfirm',
      'corralWorkSession.closeSessionConfirmButton',
      'corralWorkSession.closeSessionConfirmAgain',
      'corralWorkSession.closeSessionConfirmAgainButton',
      'btn-danger'
    ).then((confirmed) => {
      if (confirmed) {
        this.executeCloseSession();
      }
    });
  }

  private executeCloseSession(): void {
    this.closing = true;
    this.api
      .closeSession(this.sessionUuid)
      .pipe(
        catchError((err) => {
          this.errorMessage = translateApiError(this.i18n, err, 'corralWorkSession.errorClose');
          return of(null);
        }),
        finalize(() => {
          this.closing = false;
        })
      )
      .subscribe((session) => {
        if (session && this.workspace) {
          this.workspace.session.status = session.status;
          this.successMessage = this.i18n.translate('corralWorkSession.sessionClosed');
          this.clearWorkspaceDraft();
        }
      });
  }

  openActivitiesSetup(): void {
    const queryParams: Record<string, string> = { returnTo: 'work' };
    if (this.activityFocusCode) {
      queryParams['entry'] = 'activity';
      queryParams['activity'] = this.activityFocusCode;
    }
    void this.router.navigate(['/corral-work-session', this.sessionUuid, 'setup'], { queryParams });
  }
}
