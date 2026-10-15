import { AnimalBatchColumnKey } from '../constants/animal-batch-column-keys';
import { AnimalBatchDraftRow } from '../models/animal-batch-draft.model';
import { PaddockOptionDto } from '../services/animal-api.service';

export interface BatchGridPasteContext {
  ranchRows: { uuid_ranch: string; name: string }[];
  ownerRows: { owner_uuid: string; full_name: string }[];
  getPaddocksForRanch: (ranchUuid: string) => PaddockOptionDto[];
  breedCodes: readonly string[];
  breedLabel: (code: string) => string;
  maleLabel: string;
  femaleLabel: string;
  originLabels: Record<string, string>;
  /** False until the ranch list request has finished. Empty lists still count as ready. */
  isRanchCatalogReady: boolean;
  isOwnerCatalogReady: boolean;
  isPaddockCatalogReady: (ranchUuid: string) => boolean;
}

export type BatchSelectIssueReason = 'unmatched' | 'needsRanch' | 'pendingCatalog';

export interface BatchSelectIssue {
  raw: string;
  reason: BatchSelectIssueReason;
  suggestionLabel?: string;
  suggestionValue?: string;
}

export interface BatchSelectResolution {
  value: string;
  issue: BatchSelectIssue | null;
}

interface LabeledOption {
  value: string;
  label: string;
}

const ORIGIN_CODES = ['UNKNOWN', 'BIRTH', 'PURCHASE', 'TRANSFER'] as const;
const SELECT_COLUMN_KEYS = new Set<AnimalBatchColumnKey>([
  'ranchUuid',
  'breedCode',
  'sex',
  'currentOwnerUuid',
  'currentPaddockUuid',
  'originType'
]);

export function isBatchSelectColumn(key: AnimalBatchColumnKey): boolean {
  return SELECT_COLUMN_KEYS.has(key);
}

/** Trim, case, accents and repeated spaces. Used only to compare labels. */
export function foldBatchLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function levenshtein(left: string, right: string): number {
  if (left === right) {
    return 0;
  }
  if (!left.length) {
    return right.length;
  }
  if (!right.length) {
    return left.length;
  }
  const prev = new Array<number>(right.length + 1);
  const curr = new Array<number>(right.length + 1);
  for (let j = 0; j <= right.length; j++) {
    prev[j] = j;
  }
  for (let i = 1; i <= left.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= right.length; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= right.length; j++) {
      prev[j] = curr[j];
    }
  }
  return prev[right.length];
}

function suggestOption(raw: string, options: LabeledOption[]): LabeledOption | undefined {
  const query = foldBatchLabel(raw);
  if (query.length < 2 || options.length === 0) {
    return undefined;
  }

  const contained = options.filter((opt) => {
    const label = foldBatchLabel(opt.label);
    if (query.length < 3 || label.length < 3) {
      return false;
    }
    return label.includes(query) || query.includes(label);
  });
  if (contained.length === 1) {
    return contained[0];
  }

  let best: { opt: LabeledOption; dist: number } | undefined;
  let second = Number.POSITIVE_INFINITY;
  for (const opt of options) {
    const label = foldBatchLabel(opt.label);
    if (!label) {
      continue;
    }
    const dist = levenshtein(query, label);
    if (!best || dist < best.dist) {
      second = best ? best.dist : Number.POSITIVE_INFINITY;
      best = { opt, dist };
    } else if (dist < second) {
      second = dist;
    }
  }
  if (!best) {
    return undefined;
  }
  const maxDist = query.length <= 4 ? 1 : 2;
  if (best.dist > maxDist || second <= best.dist) {
    return undefined;
  }
  return best.opt;
}

function resolveLabeledOptions(
  raw: string,
  options: LabeledOption[],
  catalogReady: boolean,
  clearOnMiss: boolean
): BatchSelectResolution {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { value: '', issue: null };
  }
  if (!catalogReady) {
    return {
      value: trimmed,
      issue: { raw: trimmed, reason: 'pendingCatalog' }
    };
  }

  const folded = foldBatchLabel(trimmed);
  for (const opt of options) {
    if (trimmed === opt.value || foldBatchLabel(opt.label) === folded || foldBatchLabel(opt.value) === folded) {
      return { value: opt.value, issue: null };
    }
  }

  const suggestion = suggestOption(trimmed, options);
  return {
    value: clearOnMiss ? '' : trimmed,
    issue: {
      raw: trimmed,
      reason: 'unmatched',
      suggestionLabel: suggestion?.label,
      suggestionValue: suggestion?.value
    }
  };
}

function sexOptions(ctx: BatchGridPasteContext): LabeledOption[] {
  return [
    { value: 'MALE', label: ctx.maleLabel },
    { value: 'FEMALE', label: ctx.femaleLabel },
    { value: 'MALE', label: 'male' },
    { value: 'MALE', label: 'macho' },
    { value: 'MALE', label: 'masculino' },
    { value: 'MALE', label: 'm' },
    { value: 'MALE', label: '1' },
    { value: 'FEMALE', label: 'female' },
    { value: 'FEMALE', label: 'hembra' },
    { value: 'FEMALE', label: 'femenino' },
    { value: 'FEMALE', label: 'femea' },
    { value: 'FEMALE', label: 'f' },
    { value: 'FEMALE', label: '2' }
  ];
}

function originOptions(ctx: BatchGridPasteContext): LabeledOption[] {
  const extras: LabeledOption[] = [
    { value: 'UNKNOWN', label: 'unknown' },
    { value: 'UNKNOWN', label: 'desconocido' },
    { value: 'UNKNOWN', label: 'desconhecido' },
    { value: 'UNKNOWN', label: 'u' },
    { value: 'BIRTH', label: 'birth' },
    { value: 'BIRTH', label: 'nacimiento' },
    { value: 'BIRTH', label: 'nascimento' },
    { value: 'BIRTH', label: 'n' },
    { value: 'PURCHASE', label: 'purchase' },
    { value: 'PURCHASE', label: 'compra' },
    { value: 'PURCHASE', label: 'p' },
    { value: 'TRANSFER', label: 'transfer' },
    { value: 'TRANSFER', label: 'transferencia' },
    { value: 'TRANSFER', label: 't' }
  ];
  return [
    ...ORIGIN_CODES.map((code) => ({ value: code, label: ctx.originLabels[code] ?? code })),
    ...extras
  ];
}

function suggestionPool(options: LabeledOption[]): LabeledOption[] {
  const seen = new Set<string>();
  const unique: LabeledOption[] = [];
  for (const opt of options) {
    if (seen.has(opt.value)) {
      continue;
    }
    seen.add(opt.value);
    unique.push(opt);
  }
  return unique;
}

/**
 * Resolves a select cell to the stored code or UUID.
 * Exact names, codes and UUIDs still match. Accents and extra spaces are ignored.
 * A close name is only suggested; it is never applied by itself.
 */
export function resolveBatchSelectCell(
  key: AnimalBatchColumnKey,
  raw: string,
  ctx: BatchGridPasteContext,
  rowRanchUuid: string,
  clearOnMiss: boolean
): BatchSelectResolution {
  const trimmed = raw.trim();
  if (!isBatchSelectColumn(key)) {
    return { value: trimmed, issue: null };
  }
  if (!trimmed) {
    return { value: '', issue: null };
  }

  if (key === 'ranchUuid') {
    return resolveLabeledOptions(
      trimmed,
      ctx.ranchRows.map((ranch) => ({ value: ranch.uuid_ranch, label: ranch.name })),
      ctx.isRanchCatalogReady,
      clearOnMiss
    );
  }

  if (key === 'currentOwnerUuid') {
    return resolveLabeledOptions(
      trimmed,
      ctx.ownerRows.map((owner) => ({ value: owner.owner_uuid, label: owner.full_name })),
      ctx.isOwnerCatalogReady,
      clearOnMiss
    );
  }

  if (key === 'currentPaddockUuid') {
    const ranch = rowRanchUuid.trim();
    if (!ranch) {
      return {
        value: clearOnMiss ? '' : trimmed,
        issue: { raw: trimmed, reason: 'needsRanch' }
      };
    }
    if (!ctx.isRanchCatalogReady || !ctx.isPaddockCatalogReady(ranch)) {
      return { value: trimmed, issue: { raw: trimmed, reason: 'pendingCatalog' } };
    }
    const paddocks = ctx.getPaddocksForRanch(ranch);
    return resolveLabeledOptions(
      trimmed,
      paddocks.map((paddock) => ({ value: paddock.paddock_uuid, label: paddock.name })),
      true,
      clearOnMiss
    );
  }

  if (key === 'breedCode') {
    return resolveLabeledOptions(
      trimmed,
      ctx.breedCodes.map((code) => ({ value: code, label: ctx.breedLabel(code) })),
      true,
      clearOnMiss
    );
  }

  if (key === 'sex') {
    const resolved = resolveLabeledOptions(trimmed, sexOptions(ctx), true, clearOnMiss);
    if (resolved.issue?.reason === 'unmatched') {
      const suggestion = suggestOption(trimmed, suggestionPool(sexOptions(ctx).slice(0, 2)));
      resolved.issue.suggestionLabel = suggestion?.label;
      resolved.issue.suggestionValue = suggestion?.value;
    }
    return resolved;
  }

  const resolved = resolveLabeledOptions(trimmed, originOptions(ctx), true, clearOnMiss);
  if (resolved.issue?.reason === 'unmatched') {
    const suggestion = suggestOption(
      trimmed,
      ORIGIN_CODES.map((code) => ({ value: code, label: ctx.originLabels[code] ?? code }))
    );
    resolved.issue.suggestionLabel = suggestion?.label;
    resolved.issue.suggestionValue = suggestion?.value;
  }
  return resolved;
}

export function resolveBatchDraftRowSelects(
  row: AnimalBatchDraftRow,
  ctx: BatchGridPasteContext,
  clearOnMiss: boolean
): { row: AnimalBatchDraftRow; issues: { key: AnimalBatchColumnKey; issue: BatchSelectIssue }[] } {
  const next: AnimalBatchDraftRow = { ...row };
  const issues: { key: AnimalBatchColumnKey; issue: BatchSelectIssue }[] = [];

  const apply = (key: AnimalBatchColumnKey, raw: string, ranchUuid: string): string => {
    const resolved = resolveBatchSelectCell(key, raw, ctx, ranchUuid, clearOnMiss);
    if (resolved.issue) {
      issues.push({ key, issue: resolved.issue });
    }
    return resolved.value;
  };

  next.ranchUuid = apply('ranchUuid', row.ranchUuid, '');
  next.breedCode = apply('breedCode', row.breedCode, next.ranchUuid);
  next.sex = apply('sex', row.sex, next.ranchUuid) as AnimalBatchDraftRow['sex'];
  next.originType = apply('originType', row.originType, next.ranchUuid) as AnimalBatchDraftRow['originType'];
  next.currentOwnerUuid = apply('currentOwnerUuid', row.currentOwnerUuid, next.ranchUuid);
  next.currentPaddockUuid = apply('currentPaddockUuid', row.currentPaddockUuid, next.ranchUuid);
  return { row: next, issues };
}

export function batchSelectExportLabel(
  key: AnimalBatchColumnKey,
  value: string,
  ctx: BatchGridPasteContext
): string | null {
  const stored = value.trim();
  if (!stored || !isBatchSelectColumn(key)) {
    return null;
  }
  if (key === 'ranchUuid') {
    return ctx.ranchRows.find((ranch) => ranch.uuid_ranch === stored)?.name ?? null;
  }
  if (key === 'currentOwnerUuid') {
    return ctx.ownerRows.find((owner) => owner.owner_uuid === stored)?.full_name ?? null;
  }
  if (key === 'currentPaddockUuid') {
    for (const ranch of ctx.ranchRows) {
      const paddock = ctx.getPaddocksForRanch(ranch.uuid_ranch).find((item) => item.paddock_uuid === stored);
      if (paddock) {
        return paddock.name;
      }
    }
    return null;
  }
  if (key === 'breedCode') {
    return ctx.breedCodes.includes(stored) ? ctx.breedLabel(stored) : null;
  }
  if (key === 'sex') {
    if (stored === 'MALE') {
      return ctx.maleLabel;
    }
    if (stored === 'FEMALE') {
      return ctx.femaleLabel;
    }
    return null;
  }
  if (key === 'originType') {
    return ctx.originLabels[stored] ?? null;
  }
  return null;
}
