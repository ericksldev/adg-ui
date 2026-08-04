import { AnimalBatchColumnKey } from '../constants/animal-batch-column-keys';
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
}

const ORIGIN_CODES = ['UNKNOWN', 'BIRTH', 'PURCHASE', 'TRANSFER'] as const;

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function matchByUuidOrLabel(raw: string, options: { uuid: string; label: string }[]): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }
  const n = norm(trimmed);
  for (const opt of options) {
    if (trimmed === opt.uuid || norm(opt.label) === n) {
      return opt.uuid;
    }
  }
  return trimmed;
}

export function normalizePastedCellValue(
  key: AnimalBatchColumnKey,
  raw: string,
  ctx: BatchGridPasteContext,
  rowRanchUuid: string
): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  switch (key) {
    case 'ranchUuid':
      return matchByUuidOrLabel(
        trimmed,
        ctx.ranchRows.map((r) => ({ uuid: r.uuid_ranch, label: r.name }))
      );
    case 'breedCode': {
      const upper = trimmed.toUpperCase();
      if (ctx.breedCodes.includes(upper)) {
        return upper;
      }
      const n = norm(trimmed);
      for (const code of ctx.breedCodes) {
        if (norm(ctx.breedLabel(code)) === n) {
          return code;
        }
      }
      return upper;
    }
    case 'sex': {
      const upper = trimmed.toUpperCase();
      if (upper === 'MALE' || upper === 'FEMALE') {
        return upper;
      }
      const n = norm(trimmed);
      if (n === norm(ctx.maleLabel) || n === 'm' || n === 'macho' || n === 'male') {
        return 'MALE';
      }
      if (n === norm(ctx.femaleLabel) || n === 'f' || n === 'hembra' || n === 'female' || n === 'femea') {
        return 'FEMALE';
      }
      return upper;
    }
    case 'currentOwnerUuid':
      return matchByUuidOrLabel(
        trimmed,
        ctx.ownerRows.map((o) => ({ uuid: o.owner_uuid, label: o.full_name }))
      );
    case 'currentPaddockUuid': {
      const paddocks = ctx.getPaddocksForRanch(rowRanchUuid);
      return matchByUuidOrLabel(
        trimmed,
        paddocks.map((p) => ({ uuid: p.paddock_uuid, label: p.name }))
      );
    }
    case 'originType': {
      const upper = trimmed.toUpperCase();
      if (ORIGIN_CODES.includes(upper as (typeof ORIGIN_CODES)[number])) {
        return upper;
      }
      const n = norm(trimmed);
      for (const code of ORIGIN_CODES) {
        if (norm(ctx.originLabels[code] ?? '') === n) {
          return code;
        }
      }
      return upper;
    }
    default:
      return trimmed;
  }
}
