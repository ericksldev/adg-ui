import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '../services/i18n.service';

const USER_WRITE_ERROR_CODES: Record<string, string> = {
  EMAIL_IN_USE: 'errors.emailInUse',
  USERNAME_IN_USE: 'errors.usernameInUse',
  ID_CARD_IN_USE: 'errors.idCardInUse',
  DUPLICATE_VALUE: 'errors.duplicateValue',
  CANNOT_DEACTIVATE_SELF: 'errors.cannotDeactivateSelf'
};

export function translateUserWriteError(i18n: I18nService, err: unknown, fallbackKey: string): string {
  const message =
    err instanceof HttpErrorResponse ? (err.error?.error?.message as string | undefined) : undefined;
  const i18nKey = message ? USER_WRITE_ERROR_CODES[message] : undefined;
  if (i18nKey) {
    return i18n.translate(i18nKey);
  }
  return i18n.translate(fallbackKey);
}
