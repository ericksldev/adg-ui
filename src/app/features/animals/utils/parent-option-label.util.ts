import { ParentOptionDto } from '../services/animal-api.service';

export function parentOptionLabel(option: ParentOptionDto, siblings: readonly ParentOptionDto[]): string {
  const key = option.registration_number.trim().toLowerCase();
  const duplicates = siblings.filter((item) => item.registration_number.trim().toLowerCase() === key);
  if (duplicates.length < 2) {
    return option.registration_number;
  }
  const details = [option.chip_number, option.birth_date]
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);
  if (details.length === 0) {
    return `${option.registration_number} (${option.animal_uuid.slice(0, 8)})`;
  }
  return `${option.registration_number} (${details.join(' · ')})`;
}
