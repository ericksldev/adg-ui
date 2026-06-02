import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '../services/i18n.service';

const ANIMAL_WRITE_ERROR_MESSAGES: Record<string, string> = {
  'registration_number must be unique within the ranch': 'animal.errorRegistrationDuplicate',
  'chip_number must be unique within the ranch': 'animal.errorChipDuplicate',
  'registration_number is duplicated within this batch for the same ranch': 'animal.errorRegistrationDuplicateBatch',
  'chip_number is duplicated within this batch for the same ranch': 'animal.errorChipDuplicateBatch',
  'Owner not found or inactive': 'animal.errorOwnerNotFound',
  'Paddock not found or does not belong to this ranch': 'animal.errorPaddockNotFound',
  'Invalid or missing breed_code': 'animal.errorInvalidBreed',
  'birth_date is required': 'animal.errorBirthDateRequired',
  'Invalid birth_date': 'animal.errorBirthDateInvalid'
};

export function readApiErrorMessage(err: unknown): string | undefined {
  if (err instanceof HttpErrorResponse) {
    const body = err.error as { error?: { message?: string }; description?: string; message?: string } | null;
    return body?.error?.message ?? body?.description ?? body?.message;
  }
  const e = err as {
    error?: { error?: { message?: string }; description?: string; message?: string };
    message?: string;
  };
  return e?.error?.error?.message ?? e?.error?.description ?? e?.error?.message ?? e?.message;
}

export function translateAnimalWriteError(i18n: I18nService, err: unknown, fallbackKey: string): string {
  const message = readApiErrorMessage(err)?.trim();
  if (!message) {
    return i18n.translate(fallbackKey);
  }
  if (message.startsWith('Animal head limit reached')) {
    return i18n.translate('animal.errorHeadLimit');
  }
  if (message.startsWith('No FEMALE animal found with registration')) {
    return i18n.translate('animal.errorMotherNotFound');
  }
  if (message.startsWith('No MALE animal found with registration')) {
    return i18n.translate('animal.errorFatherNotFound');
  }
  const i18nKey = ANIMAL_WRITE_ERROR_MESSAGES[message];
  if (i18nKey) {
    return i18n.translate(i18nKey);
  }
  return message;
}

export function isDuplicateRegistrationError(err: unknown): boolean {
  const message = readApiErrorMessage(err)?.trim();
  return (
    message === 'registration_number must be unique within the ranch' ||
    message === 'registration_number is duplicated within this batch for the same ranch'
  );
}
