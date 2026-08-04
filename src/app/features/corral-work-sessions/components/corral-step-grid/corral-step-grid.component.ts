import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  QueryList,
  SimpleChanges,
  ViewChildren
} from '@angular/core';
import { I18nService } from 'src/app/core/services/i18n.service';
import {
  CORRAL_VISUAL_CONDITION_CODES,
  CorralStepWorkMode,
  CorralVisualConditionCode
} from '../../constants/corral-activities';
import {
  createEmptyStepFindingPresets,
  MedicationPreset,
  StepFindingPresets
} from '../../models/corral-finding-presets.model';
import {
  GridColumnPresetEntry,
  StepGridColumnPresets
} from '../../models/corral-grid-column-presets.model';
import {
  createEmptyRowFindingState,
  RowFindingState
} from '../../models/corral-row-finding.model';
import { CorralStepGridColumnDto, CorralStepGridDto, CorralStepGridRowDto } from '../../models/corral-work-session.model';

@Component({
  selector: 'app-corral-step-grid',
  templateUrl: './corral-step-grid.component.html',
  styleUrls: ['./corral-step-grid.component.scss']
})
export class CorralStepGridComponent implements OnChanges {
  @Input() grid!: CorralStepGridDto;
  @Input() readonly = false;
  @Input() highlightAnimalUuid: string | null = null;
  @Input() workMode: CorralStepWorkMode = 'SCAN_DYNAMIC';
  @Input() queueScannedUuids: string[] = [];
  @Input() columnPresets: StepGridColumnPresets = {};
  @Input() findingPresets: StepFindingPresets = createEmptyStepFindingPresets();
  @Input() rowFindings: Record<string, RowFindingState> = {};
  @Input() presetValueSeparator = ' - ';
  @Input() showFindingColumns = true;

  @Output() gridChange = new EventEmitter<CorralStepGridDto>();
  @Output() saveRequested = new EventEmitter<CorralStepGridDto>();
  @Output() workspaceDraftChange = new EventEmitter<void>();

  @ViewChildren('dataCell') dataCells!: QueryList<ElementRef<HTMLElement>>;

  readonly sequentialSkeletonCount = 5;

  scannedSectionExpanded = true;
  pendingSectionExpanded = true;

  editableRows: CorralStepGridDto['rows'] = [];
  editableFindings: Record<string, RowFindingState> = {};
  readonly conditionCodes = CORRAL_VISUAL_CONDITION_CODES;
  private currentStepUuid: string | null = null;
  private medicationDrafts: Record<string, { product: string; dose: string; unit: string }> = {};
  private medicationCustomExpanded: Record<string, boolean> = {};
  private conditionSelectDrafts: Record<string, CorralVisualConditionCode | ''> = {};

  constructor(private readonly i18n: I18nService) {}

  columnLabel(column: CorralStepGridColumnDto): string {
    return this.i18n.translate(`corralWorkSession.activity.${column.activity_code}`);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['grid'] && this.grid) {
      this.editableRows = this.grid.rows.map((row) => ({
        ...row,
        values: this.normalizeRowValues(row.values)
      }));

      const stepUuid = this.grid.uuid_corral_session_step;
      if (stepUuid !== this.currentStepUuid) {
        this.currentStepUuid = stepUuid;
        this.editableFindings = { ...this.rowFindings };
        this.medicationDrafts = {};
        this.medicationCustomExpanded = {};
        this.conditionSelectDrafts = {};
      }
    }
    if (changes['workMode'] && this.isQueueMode) {
      this.scannedSectionExpanded = true;
      this.pendingSectionExpanded = true;
    }
  }

  get totalColumnCount(): number {
    return this.grid.columns.length + 1 + (this.showFindingColumns ? 3 : 0);
  }

  get findingColumnSkeletonSlots(): number[] {
    return this.showFindingColumns ? [1, 2, 3] : [];
  }

  toggleScannedSection(): void {
    this.scannedSectionExpanded = !this.scannedSectionExpanded;
  }

  togglePendingSection(): void {
    this.pendingSectionExpanded = !this.pendingSectionExpanded;
  }

  get isQueueMode(): boolean {
    return this.workMode === 'PRELOADED_QUEUE';
  }

  get isSequentialMode(): boolean {
    return this.workMode === 'SCAN_DYNAMIC';
  }

  get showSequentialSkeleton(): boolean {
    return this.isSequentialMode && this.editableRows.length === 0;
  }

  get sequentialSkeletonSlots(): number[] {
    return Array.from({ length: this.sequentialSkeletonCount }, (_, index) => index);
  }

  get queueScannedRows(): CorralStepGridDto['rows'] {
    const rowByUuid = new Map(this.editableRows.map((row) => [row.animal_uuid, row]));
    return this.queueScannedUuids
      .map((uuid) => rowByUuid.get(uuid))
      .filter((row): row is CorralStepGridDto['rows'][number] => Boolean(row));
  }

  get queuePendingRows(): CorralStepGridDto['rows'] {
    const scanned = new Set(this.queueScannedUuids);
    return this.editableRows.filter((row) => !scanned.has(row.animal_uuid));
  }

  get savableRows(): CorralStepGridDto['rows'] {
    return this.editableRows.filter((row) => !this.isLocalRow(row.animal_uuid));
  }

  getColumnPresetEntries(column: CorralStepGridColumnDto): GridColumnPresetEntry[] {
    return this.columnPresets[column.column_key] ?? [];
  }

  isChipPresetColumn(valueType: string): boolean {
    return valueType === 'boolean' || valueType === 'medicine';
  }

  responsivePresetContainerClass(count: number): Record<string, boolean> {
    return {
      'corral-step-grid__cell-presets--responsive': true,
      'corral-step-grid__cell-presets--n1': count <= 1,
      'corral-step-grid__cell-presets--n2': count === 2,
      'corral-step-grid__cell-presets--n4': count >= 3 && count <= 4,
      'corral-step-grid__cell-presets--n6': count >= 5 && count <= 6,
      'corral-step-grid__cell-presets--n-many': count >= 7
    };
  }

  getCellList(animalUuid: string, columnKey: string): string[] {
    const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
    const value = row?.values[columnKey];
    if (Array.isArray(value)) {
      return value.map((item) => String(item));
    }
    if (value === null || value === undefined || value === '') {
      return [];
    }
    return [String(value)];
  }

  isCellPresetActive(animalUuid: string, column: CorralStepGridColumnDto, preset: GridColumnPresetEntry): boolean {
    if (column.value_type === 'medicine') {
      return this.getCellList(animalUuid, column.column_key).includes(preset.value);
    }

    const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
    const value = row?.values[column.column_key];
    if (value === null || value === undefined) {
      return false;
    }

    if (column.value_type === 'boolean') {
      if (typeof value === 'string' && value !== 'true' && value !== 'false') {
        return value === preset.label;
      }
      const matchingPresets = this.getColumnPresetEntries(column).filter(
        (entry) =>
          (entry.value === 'true' && value === true) || (entry.value === 'false' && value === false)
      );
      return matchingPresets.length === 1 && matchingPresets[0].label === preset.label;
    }

    if (column.value_type === 'number') {
      return Number(value) === Number(preset.value);
    }
    return String(value) === preset.value;
  }

  applyCellPreset(animalUuid: string, column: CorralStepGridColumnDto, preset: GridColumnPresetEntry): void {
    if (this.readonly) return;

    if (column.value_type === 'medicine') {
      this.toggleCellListItem(animalUuid, column.column_key, preset.value);
      return;
    }

    if (column.value_type === 'boolean') {
      const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
      if (!row) return;
      row.values[column.column_key] =
        row.values[column.column_key] === preset.label ? null : preset.label;
      this.emitChange();
      return;
    }

    if (this.isCellPresetActive(animalUuid, column, preset)) {
      this.onCellChange(animalUuid, column.column_key, '', column.value_type);
      return;
    }
    this.onCellChange(animalUuid, column.column_key, preset.value, column.value_type);
  }

  toggleCellListItem(animalUuid: string, columnKey: string, value: string): void {
    const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
    if (!row) return;

    const current = this.getCellList(animalUuid, columnKey);
    if (current.includes(value)) {
      const next = current.filter((item) => item !== value);
      row.values[columnKey] = next.length > 0 ? next : null;
    } else {
      row.values[columnKey] = [...current, value];
    }
    this.emitChange();
  }

  removeCellListItem(animalUuid: string, columnKey: string, index: number): void {
    const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
    if (!row || this.readonly) return;

    const current = [...this.getCellList(animalUuid, columnKey)];
    current.splice(index, 1);
    row.values[columnKey] = current.length > 0 ? current : null;
    this.emitChange();
  }

  onCellChange(animalUuid: string, columnKey: string, value: string, valueType: string): void {
    const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
    if (!row) return;
    if (valueType === 'boolean') {
      row.values[columnKey] = value === '' ? null : value === 'true';
    } else if (valueType === 'number') {
      row.values[columnKey] = value === '' ? null : Number(value);
    } else {
      row.values[columnKey] = value === '' ? null : value;
    }
    this.emitChange();
  }

  getCellValue(animalUuid: string, columnKey: string): string {
    const row = this.editableRows.find((item) => item.animal_uuid === animalUuid);
    const val = row?.values[columnKey];
    if (val === null || val === undefined) return '';
    if (Array.isArray(val)) return '';
    if (typeof val === 'boolean') return val ? 'true' : 'false';
    return String(val);
  }

  focusRowByAnimalUuid(animalUuid: string): boolean {
    if (!this.editableRows.some((row) => row.animal_uuid === animalUuid)) return false;
    this.highlightAnimalUuid = animalUuid;
    const firstCell = this.dataCells?.find((cell) => cell.nativeElement.dataset['animal'] === animalUuid);
    firstCell?.nativeElement.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return true;
  }

  focusRowByIdentifier(identifier: string): string | null {
    const trimmed = identifier.replace(/[\u0000-\u001F\u007F]/g, '').trim().toLowerCase();
    const row = this.editableRows.find(
      (r) =>
        r.registration_number.toLowerCase() === trimmed ||
        (r.chip_number && r.chip_number.toLowerCase() === trimmed)
    );
    if (!row) return null;
    this.focusRowByAnimalUuid(row.animal_uuid);
    return row.animal_uuid;
  }

  appendLocalSequentialRow(identifier: string): void {
    const normalized = identifier.trim();
    if (!normalized) return;
    const existing = this.editableRows.find(
      (row) => row.registration_number.toLowerCase() === normalized.toLowerCase()
    );
    if (existing) {
      this.focusRowByAnimalUuid(existing.animal_uuid);
      return;
    }

    const values = Object.fromEntries(this.grid.columns.map((column) => [column.column_key, null]));
    const row: CorralStepGridRowDto = {
      animal_uuid: `local-${normalized}-${Date.now()}`,
      registration_number: normalized,
      chip_number: null,
      values
    };
    this.editableRows = [...this.editableRows, row];
    this.highlightAnimalUuid = row.animal_uuid;
    this.emitChange();
    setTimeout(() => this.focusRowByAnimalUuid(row.animal_uuid));
  }

  replaceGrid(grid: CorralStepGridDto): void {
    this.grid = grid;
    this.editableRows = grid.rows.map((row) => ({
      ...row,
      values: this.normalizeRowValues(row.values)
    }));
    this.emitChange();
  }

  requestSave(): void {
    this.saveRequested.emit({
      ...this.grid,
      rows: this.savableRows.map((row) => ({
        ...row,
        values: this.serializeValuesForSave(row.values)
      }))
    });
  }

  getRowFindingsForSave(): Record<string, RowFindingState> {
    return { ...this.editableFindings };
  }

  snapshotGrid(): CorralStepGridDto {
    return {
      ...this.grid,
      rows: this.editableRows.map((row) => ({
        ...row,
        values: { ...row.values }
      }))
    };
  }

  isLocalRow(animalUuid: string): boolean {
    return animalUuid.startsWith('local-');
  }

  private normalizeRowValues(
    values: CorralStepGridRowDto['values']
  ): CorralStepGridRowDto['values'] {
    const normalized = { ...values };
    for (const column of this.grid.columns) {
      if (column.value_type === 'medicine') {
        const current = normalized[column.column_key];
        if (current == null || current === '') continue;
        if (!Array.isArray(current)) {
          normalized[column.column_key] = [String(current)];
        }
        continue;
      }

      if (column.value_type !== 'boolean') continue;
      const current = normalized[column.column_key];
      if (typeof current !== 'boolean') continue;

      const matchingPresets = this.getColumnPresetEntries(column).filter(
        (preset) =>
          (preset.value === 'true' && current === true) || (preset.value === 'false' && current === false)
      );
      if (matchingPresets.length === 1) {
        normalized[column.column_key] = matchingPresets[0].label;
      }
    }
    return normalized;
  }

  private serializeValuesForSave(
    values: CorralStepGridRowDto['values']
  ): CorralStepGridRowDto['values'] {
    const serialized = { ...values };

    for (const column of this.grid.columns) {
      const raw = serialized[column.column_key];
      if (column.value_type !== 'boolean' || raw == null) continue;

      if (typeof raw === 'string' && raw !== 'true' && raw !== 'false') {
        const preset = this.getColumnPresetEntries(column).find((entry) => entry.label === raw);
        serialized[column.column_key] = preset ? preset.value === 'true' : null;
      }
    }

    return serialized;
  }

  private emitChange(): void {
    this.gridChange.emit({ ...this.grid, rows: this.editableRows });
  }

  rowClass(animalUuid: string): Record<string, boolean> {
    return {
      'corral-grid-row--highlight': this.highlightAnimalUuid === animalUuid,
      'corral-grid-row--queue-scanned': this.isQueueMode && this.queueScannedUuids.includes(animalUuid),
      'corral-grid-row--local': this.isLocalRow(animalUuid)
    };
  }

  getFinding(animalUuid: string): RowFindingState {
    if (!this.editableFindings[animalUuid]) {
      this.editableFindings[animalUuid] = createEmptyRowFindingState();
    }
    return this.editableFindings[animalUuid];
  }

  getMedicationDraft(animalUuid: string): { product: string; dose: string; unit: string } {
    if (!this.medicationDrafts[animalUuid]) {
      this.medicationDrafts[animalUuid] = { product: '', dose: '', unit: '' };
    }
    return this.medicationDrafts[animalUuid];
  }

  isCustomMedicationExpanded(animalUuid: string): boolean {
    return Boolean(this.medicationCustomExpanded[animalUuid]);
  }

  toggleCustomMedicationForm(animalUuid: string): void {
    if (this.readonly) return;
    this.medicationCustomExpanded[animalUuid] = !this.isCustomMedicationExpanded(animalUuid);
    if (!this.medicationCustomExpanded[animalUuid]) {
      this.medicationDrafts[animalUuid] = { product: '', dose: '', unit: '' };
    }
  }

  getConditionSelectDraft(animalUuid: string): CorralVisualConditionCode | '' {
    return this.conditionSelectDrafts[animalUuid] ?? '';
  }

  setConditionSelectDraft(animalUuid: string, code: CorralVisualConditionCode | ''): void {
    this.conditionSelectDrafts[animalUuid] = code;
    if (code) {
      this.toggleConditionPreset(animalUuid, code);
      this.conditionSelectDrafts[animalUuid] = '';
    }
  }

  conditionLabel(code: CorralVisualConditionCode): string {
    return this.i18n.translate(`corralWorkSession.condition.${code}`);
  }

  medicationPresetLabel(preset: MedicationPreset): string {
    const parts = [preset.product];
    if (preset.dose) parts.push(preset.dose);
    if (preset.unit) parts.push(preset.unit);
    return parts.join(' · ');
  }

  isObservationPresetSelected(animalUuid: string, text: string): boolean {
    return this.getFinding(animalUuid).selectedObservationPresets.includes(text);
  }

  isConditionPresetSelected(animalUuid: string, code: CorralVisualConditionCode): boolean {
    return this.getFinding(animalUuid).selectedConditionPresets.includes(code);
  }

  isMedicationPresetSelected(animalUuid: string, preset: MedicationPreset): boolean {
    const key = this.medicationPresetKey(preset);
    return this.getFinding(animalUuid).medications.some((item) => this.medicationPresetKey(item) === key);
  }

  toggleObservationPreset(animalUuid: string, text: string): void {
    if (this.readonly) return;
    const finding = { ...this.getFinding(animalUuid) };
    if (finding.selectedObservationPresets.includes(text)) {
      finding.selectedObservationPresets = finding.selectedObservationPresets.filter((item) => item !== text);
    } else {
      finding.selectedObservationPresets = [...finding.selectedObservationPresets, text];
    }
    finding.observation = finding.selectedObservationPresets.join(this.presetValueSeparator);
    this.updateFinding(animalUuid, finding);
  }

  toggleConditionPreset(animalUuid: string, code: CorralVisualConditionCode): void {
    if (this.readonly) return;
    const finding = { ...this.getFinding(animalUuid) };
    if (finding.selectedConditionPresets.includes(code)) {
      finding.selectedConditionPresets = finding.selectedConditionPresets.filter((item) => item !== code);
    } else {
      finding.selectedConditionPresets = [...finding.selectedConditionPresets, code];
    }
    finding.condition = finding.selectedConditionPresets
      .map((item) => this.conditionLabel(item))
      .join(this.presetValueSeparator);
    this.updateFinding(animalUuid, finding);
  }

  toggleMedicationPreset(animalUuid: string, preset: MedicationPreset): void {
    if (this.readonly) return;
    const finding = { ...this.getFinding(animalUuid) };
    const key = this.medicationPresetKey(preset);
    if (finding.medications.some((item) => this.medicationPresetKey(item) === key)) {
      finding.medications = finding.medications.filter((item) => this.medicationPresetKey(item) !== key);
    } else {
      finding.medications = [...finding.medications, { ...preset }];
    }
    this.updateFinding(animalUuid, finding);
  }

  onFindingObservationChange(animalUuid: string, value: string): void {
    if (this.readonly) return;
    const finding = { ...this.getFinding(animalUuid), observation: value };
    this.updateFinding(animalUuid, finding);
  }

  onFindingConditionChange(animalUuid: string, value: string): void {
    if (this.readonly) return;
    const finding = { ...this.getFinding(animalUuid), condition: value };
    this.updateFinding(animalUuid, finding);
  }

  addCustomFindingMedication(animalUuid: string): void {
    if (this.readonly) return;
    const draft = this.getMedicationDraft(animalUuid);
    const product = draft.product.trim();
    if (!product) return;

    const medication: MedicationPreset = {
      product,
      dose: draft.dose.trim() || undefined,
      unit: draft.unit.trim() || undefined
    };

    const finding = { ...this.getFinding(animalUuid) };
    const key = this.medicationPresetKey(medication);
    if (!finding.medications.some((item) => this.medicationPresetKey(item) === key)) {
      finding.medications = [...finding.medications, medication];
      this.updateFinding(animalUuid, finding);
    }

    this.medicationDrafts[animalUuid] = { product: '', dose: '', unit: '' };
    this.medicationCustomExpanded[animalUuid] = false;
  }

  removeFindingMedication(animalUuid: string, index: number): void {
    if (this.readonly) return;
    const finding = { ...this.getFinding(animalUuid) };
    finding.medications = finding.medications.filter((_, itemIndex) => itemIndex !== index);
    this.updateFinding(animalUuid, finding);
  }

  private updateFinding(animalUuid: string, state: RowFindingState): void {
    this.editableFindings[animalUuid] = state;
    this.workspaceDraftChange.emit();
  }

  private medicationPresetKey(preset: MedicationPreset): string {
    return `${preset.product}|${preset.dose ?? ''}|${preset.unit ?? ''}`;
  }
}
