import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, finalize, forkJoin, map, of, switchMap } from 'rxjs';
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
  CorralStepGridColumnDto,
  CorralStepGridDto,
  AnimalCorralProfileDto,
  AnimalCorralWorkHistorySessionDto,
  ApplyPaddockDistributionResultDto
} from '../../models/corral-work-session.model';
import { animalBreedLabelKey, animalOriginLabelKey } from 'src/app/features/animals/utils/animal-display.util';
import { CorralWorkSessionApiService } from '../../services/corral-work-session-api.service';
import { CorralActivityQuickStartService } from '../../services/corral-activity-quick-start.service';
import {
  createEmptyStepFindingPresets,
  medicationPresetKey,
  MedicationPreset,
  normalizeStepFindingPresets,
  StepFindingPresets
} from '../../models/corral-finding-presets.model';
import {
  createEmptyStepGridColumnPresets,
  GridColumnPresetEntry,
  normalizeStepGridColumnPresets,
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
  unknownScanContext: 'not_in_step' | null = null;
  unknownAnimalUuid: string | null = null;
  updatingWorkMode = false;
  appendingAnimals = false;
  showAttachPanel = false;
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
    readonly i18n: I18nService
  ) {}

  ngOnInit(): void {
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
    if (this.previewTimer) {
      clearTimeout(this.previewTimer);
    }
    if (this.inventorySearchTimer) {
      clearTimeout(this.inventorySearchTimer);
    }
    if (this.draftPersistTimer) {
      clearTimeout(this.draftPersistTimer);
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
        this.seedQueueScansFromWorkspace(ws);
        if (ws.session.status !== 'CLOSED') {
          this.applyWorkspaceDraft(this.loadWorkspaceDraft());
        } else {
          this.clearWorkspaceDraft();
        }
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
    const apiUuidByRegistration = new Map(
      apiGrid.rows.map((row) => [row.registration_number.trim().toLowerCase(), row.animal_uuid])
    );
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
    const previousByRegistration = new Map(
      previousGrid.rows.map((row) => [row.registration_number.trim().toLowerCase(), row])
    );

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
    const savedNumbers = new Set(savedGrid.rows.map((row) => row.registration_number.trim().toLowerCase()));
    const mergedLocalRows = localRows.filter(
      (row) =>
        !savedUuids.has(row.animal_uuid) && !savedNumbers.has(row.registration_number.trim().toLowerCase())
    );
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

  workModeDescription(mode: CorralStepWorkMode): string {
    return this.i18n.translate(`corralWorkSession.workMode.${mode}_desc`);
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

  get activeQueueScannedUuids(): string[] {
    const stepUuid = this.activeGridData?.uuid_corral_session_step;
    if (!stepUuid) return [];
    return this.queueScannedByStep.get(stepUuid) ?? [];
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

  openLoadAnimalsPanel(): void {
    this.showAttachPanel = true;
    if (this.attachTab === 'inventory' && this.inventoryAnimals.length === 0) {
      this.loadInventory(true);
    }
  }

  clearUnknownScanPrompt(): void {
    this.unknownScanIdentifier = '';
    this.unknownScanContext = null;
    this.unknownAnimalUuid = null;
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

  private addMissingScanAsLocalRow(identifier: string): void {
    if (!this.activeGridData) return;
    const previousGrid = this.activeGrid?.snapshotGrid();
    this.api
      .addUnregisteredStepAnimal(
        this.sessionUuid,
        this.activeGridData.uuid_corral_session_step,
        identifier
      )
      .subscribe({
        next: (grid) => {
          if (!this.workspace) return;
          const merged = previousGrid ? this.preserveLocalRows(grid, previousGrid) : grid;
          this.workspace.grids[this.activeStepIndex] = merged;
          this.activeGrid?.replaceGrid(merged);
          this.markQueueScan(identifier, merged.rows);
          this.focusScannedRow(identifier, merged.rows);
          this.applyScanDefaultsByIdentifier(identifier);
          this.successMessage = this.i18n.translate('corralWorkSession.animalAddedLocalRow');
          this.clearUnknownScanPrompt();
          this.scanInput = '';
          this.schedulePersistWorkspaceDraft();
        },
        error: () => {
          this.activeGrid?.appendLocalSequentialRow(identifier);
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
    this.clearUnknownScanPrompt();
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
    if (presets.defaultObservation === removed) {
      presets.defaultObservation = null;
    }
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
    if (presets.defaultCondition === removed) {
      presets.defaultCondition = null;
    }
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
    if (removed && presets.defaultMedicationKey === medicationPresetKey(removed)) {
      presets.defaultMedicationKey = null;
    }
    this.persistPresets(stepUuid);
  }

  toggleMedicationDefault(index: number): void {
    this.toggleFindingDefault('medication', index);
  }

  isMedicationDefault(preset: MedicationPreset): boolean {
    return this.activePresets.defaultMedicationKey === medicationPresetKey(preset);
  }

  defaultConditionLabel(): string | null {
    const code = this.activePresets.defaultCondition;
    return code ? this.conditionLabel(code) : null;
  }

  defaultMedicationLabel(): string | null {
    const key = this.activePresets.defaultMedicationKey;
    const preset = this.activePresets.medications.find((item) => medicationPresetKey(item) === key);
    return preset ? this.medicationPresetLabel(preset) : null;
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
    presets[columnKey] = entries.map((entry, itemIndex) => {
      const next: GridColumnPresetEntry = { value: entry.value, label: entry.label };
      if (enable && itemIndex === index) {
        next.isDefault = true;
      }
      return next;
    });
    this.persistGridColumnPresets(stepUuid);
  }

  defaultGridColumnPresetLabel(columnKey: string): string | null {
    return this.getGridColumnPresetEntries(columnKey).find((entry) => entry.isDefault)?.label ?? null;
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
      const stored = sessionStorage.getItem(this.presetsStorageKey(stepUuid));
      if (stored) {
        try {
          this.presetsByStep.set(stepUuid, normalizeStepFindingPresets(JSON.parse(stored)));
        } catch {
          this.presetsByStep.set(stepUuid, createEmptyStepFindingPresets());
        }
      } else {
        this.presetsByStep.set(stepUuid, createEmptyStepFindingPresets());
      }
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
      presets.defaultObservation = presets.defaultObservation === text ? null : text;
    } else if (kind === 'condition') {
      const code = presets.conditions[index];
      if (!code) return;
      presets.defaultCondition = presets.defaultCondition === code ? null : code;
    } else {
      const preset = presets.medications[index];
      if (!preset) return;
      const key = medicationPresetKey(preset);
      presets.defaultMedicationKey = presets.defaultMedicationKey === key ? null : key;
    }
    this.persistPresets(stepUuid);
  }

  private persistPresets(stepUuid: string): void {
    const presets = this.presetsByStep.get(stepUuid);
    if (presets) {
      sessionStorage.setItem(this.presetsStorageKey(stepUuid), JSON.stringify(presets));
    }
  }

  private presetsStorageKey(stepUuid: string): string {
    return `corral-finding-presets:${this.sessionUuid}:${stepUuid}`;
  }

  private getGridColumnPresetsForStep(stepUuid: string): StepGridColumnPresets {
    if (!this.gridColumnPresetsByStep.has(stepUuid)) {
      const stored = sessionStorage.getItem(this.gridColumnPresetsStorageKey(stepUuid));
      if (stored) {
        try {
          this.gridColumnPresetsByStep.set(stepUuid, normalizeStepGridColumnPresets(JSON.parse(stored)));
        } catch {
          this.gridColumnPresetsByStep.set(stepUuid, createEmptyStepGridColumnPresets());
        }
      } else {
        this.gridColumnPresetsByStep.set(stepUuid, createEmptyStepGridColumnPresets());
      }
    }
    return this.gridColumnPresetsByStep.get(stepUuid)!;
  }

  private persistGridColumnPresets(stepUuid: string): void {
    const presets = this.gridColumnPresetsByStep.get(stepUuid);
    if (presets) {
      sessionStorage.setItem(this.gridColumnPresetsStorageKey(stepUuid), JSON.stringify(presets));
    }
  }

  private gridColumnPresetsStorageKey(stepUuid: string): string {
    return `corral-grid-presets:${this.sessionUuid}:${stepUuid}`;
  }

  private applyScanDefaultsByIdentifier(identifier: string): void {
    const rows = this.activeGrid?.snapshotGrid()?.rows ?? this.activeGridData?.rows ?? [];
    this.applyScanDefaultsToAnimal(this.findRowByIdentifier(identifier, rows)?.animal_uuid);
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

  onLoadAnimalsPanelToggle(): void {
    this.showAttachPanel = !this.showAttachPanel;
    if (this.showAttachPanel && this.attachTab === 'inventory' && this.inventoryAnimals.length === 0) {
      this.loadInventory(true);
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
        this.successMessage = this.i18n.translate('corralWorkSession.workModeUpdated');
        this.schedulePersistWorkspaceDraft();
      });
  }

  onScanKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();

    if (this.unknownScanIdentifier && this.unknownScanContext) {
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
    const workMode = this.activeWorkMode;

    if (workMode === 'SCAN_DYNAMIC') {
      this.api.lookupAnimal(this.sessionUuid, id).subscribe({
        next: () => this.addScannedAnimalToStep(id),
        error: () => this.addMissingScanAsLocalRow(id)
      });
      return;
    }

    const animalUuid = this.locateRowByIdentifier(id);
    if (animalUuid) {
      this.afterRowLocated(animalUuid, id);
      return;
    }

    this.api.lookupAnimal(this.sessionUuid, id).subscribe({
      next: (animal) => {
        this.unknownScanIdentifier = id;
        this.unknownScanContext = 'not_in_step';
        this.unknownAnimalUuid = animal.animal_uuid;
        this.highlightAnimalUuid = animal.animal_uuid;
        this.loadAnimalHistory(animal.animal_uuid, animal.registration_number);
      },
      error: () => this.addMissingScanAsLocalRow(id)
    });
  }

  private locateRowByIdentifier(identifier: string): string | null {
    const fromGrid = this.activeGrid?.focusRowByIdentifier(identifier) ?? null;
    if (fromGrid) return fromGrid;
    return this.findRowByIdentifier(identifier, this.activeGridData?.rows ?? [])?.animal_uuid ?? null;
  }

  private findRowByIdentifier(
    identifier: string,
    rows: Array<{ animal_uuid: string; registration_number: string; chip_number?: string | null; missing_inventory?: boolean }>
  ): { animal_uuid: string; registration_number: string; chip_number?: string | null; missing_inventory?: boolean } | undefined {
    const key = identifier.trim().toLowerCase();
    return rows.find(
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
    if (this.activeWorkMode === 'PRELOADED_QUEUE') {
      this.recordQueueScan(this.activeGridData.uuid_corral_session_step, animalUuid);
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
    if (this.activeWorkMode !== 'PRELOADED_QUEUE' || !this.activeGridData) return;
    const key = identifier.trim().toLowerCase();
    const matched = rows.find(
      (row) =>
        row.registration_number.trim().toLowerCase() === key ||
        row.chip_number?.trim().toLowerCase() === key
    );
    if (!matched) return;
    this.recordQueueScan(this.activeGridData.uuid_corral_session_step, matched.animal_uuid);
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
    const key = identifier.trim().toLowerCase();
    const matched = rows.find(
      (row) =>
        row.registration_number.trim().toLowerCase() === key ||
        row.chip_number?.trim().toLowerCase() === key
    );
    if (!matched) return;
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

  historyBreedLabel(code?: string | null): string {
    return this.i18n.translate(animalBreedLabelKey(code));
  }

  historyOriginLabel(origin?: string | null): string {
    return this.i18n.translate(animalOriginLabelKey(origin));
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
    this.historyRegistrationNumber = registrationNumber;
    this.historyProfile = null;
    this.historySessions = [];
    this.historyLoading = false;
    this.historyError = false;
    this.historyUnregistered = true;
    this.findingsPanelExpanded = true;
  }

  private loadAnimalHistory(animalUuid: string, registrationNumber: string): void {
    if (!animalUuid || animalUuid.startsWith('local-')) {
      this.showUnregisteredAnimalHistory(registrationNumber);
      return;
    }

    this.historyRegistrationNumber = registrationNumber;
    this.historyProfile = null;
    this.historySessions = [];
    this.historyLoading = true;
    this.historyError = false;
    this.historyUnregistered = false;
    this.findingsPanelExpanded = true;
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
        this.historyError = true;
      }
    });
  }

  private addScannedAnimalToStep(identifier: string): void {
    if (!this.activeGridData) return;
    this.api.scanStepAnimal(this.sessionUuid, this.activeGridData.uuid_corral_session_step, identifier).subscribe({
      next: (grid) => {
        if (!this.workspace) return;
        this.workspace.grids[this.activeStepIndex] = grid;
        this.activeGrid?.replaceGrid(grid);
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

  onGridChange(grid: CorralStepGridDto): void {
    if (!this.workspace) return;
    this.workspace.grids[this.activeStepIndex] = grid;
    this.schedulePersistWorkspaceDraft();
  }

  onWorkspaceDraftChange(): void {
    this.schedulePersistWorkspaceDraft();
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
        ...(grid.work_mode === 'PRELOADED_QUEUE'
          ? {
              scanned_animal_uuids: this.queueScannedByStep.get(grid.uuid_corral_session_step) ?? []
            }
          : {})
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
        this.saveFindingsForGrid(merged, this.paddockSaveMessage(result.apply));
        this.schedulePersistWorkspaceDraft();
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

  private saveFindingsForGrid(grid: CorralStepGridDto, successMessage?: string): void {
    const stepUuid = grid.uuid_corral_session_step;
    const findings = this.rowFindingsByStep.get(stepUuid) ?? this.activeGrid?.getRowFindingsForSave() ?? {};
    const rowsToSave = grid.rows.filter(
      (row) => !this.isMissingInventoryRow(row) && this.hasFindingData(findings[row.animal_uuid])
    );

    const message = successMessage ?? this.i18n.translate('corralWorkSession.stepGridSaved');
    if (rowsToSave.length === 0) {
      if (!this.errorMessage) {
        this.successMessage = message;
      }
      this.schedulePersistWorkspaceDraft();
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
      if (!this.errorMessage) {
        this.successMessage = message;
      }
      this.schedulePersistWorkspaceDraft();
    });
  }

  closeSession(): void {
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

  backToList(): void {
    if (this.activityFocusCode) {
      void this.router.navigate(getCorralActivityShortcutConfig(this.activityFocusCode).listRoute);
      return;
    }
    void this.router.navigate(['/corral-work-session']);
  }
}
