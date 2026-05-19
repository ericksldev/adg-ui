import { Paddock, PaddockPayload } from '../models/paddock.model';
import { PaddockFormValue } from '../components/paddock-form/paddock-form.component';

export function paddockToFormValue(paddock: Paddock): PaddockFormValue {
  return {
    name: paddock.name ?? '',
    sizeInHectares: paddock.size_in_hectares != null ? String(paddock.size_in_hectares) : '',
    grassType: paddock.grass_type ?? '',
    waterSource: paddock.water_source ?? '',
    maximumCapacity: paddock.maximum_capacity != null ? String(paddock.maximum_capacity) : '',
    description: paddock.description ?? ''
  };
}

export function formValueToPaddockPayload(value: PaddockFormValue, ranchUuid: string): PaddockPayload {
  return {
    ranch_uuid: ranchUuid,
    name: value.name.trim(),
    size_in_hectares: parseOptionalNumber(value.sizeInHectares),
    grass_type: emptyToNull(value.grassType),
    water_source: emptyToNull(value.waterSource),
    maximum_capacity: parseOptionalInteger(value.maximumCapacity),
    description: emptyToNull(value.description)
  };
}

export function formValueToPaddockUpdatePayload(value: PaddockFormValue): Partial<PaddockPayload> {
  return {
    name: value.name.trim(),
    size_in_hectares: parseOptionalNumber(value.sizeInHectares),
    grass_type: emptyToNull(value.grassType),
    water_source: emptyToNull(value.waterSource),
    maximum_capacity: parseOptionalInteger(value.maximumCapacity),
    description: emptyToNull(value.description)
  };
}

function formFieldToString(value: string | number | null | undefined): string {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function emptyToNull(value: string | number | null | undefined): string | null {
  const trimmed = formFieldToString(value);
  return trimmed.length ? trimmed : null;
}

function parseOptionalNumber(value: string | number | null | undefined): number | null {
  const trimmed = formFieldToString(value);
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (Number.isNaN(n) || n < 0) {
    return null;
  }
  return n;
}

function parseOptionalInteger(value: string | number | null | undefined): number | null {
  const trimmed = formFieldToString(value);
  if (!trimmed) {
    return null;
  }
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) {
    return null;
  }
  return n;
}
