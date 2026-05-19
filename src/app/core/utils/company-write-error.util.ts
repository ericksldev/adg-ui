import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '../services/i18n.service';

const COMPANY_WRITE_ERROR_CODES: Record<string, string> = {
  COMPANY_NAME_IN_USE: 'errors.companyNameInUse',
  TAX_ID_IN_USE: 'errors.taxIdInUse',
  DUPLICATE_VALUE: 'errors.duplicateValue'
};

export function translateCompanyWriteError(i18n: I18nService, err: unknown, fallbackKey: string): string {
  const message =
    err instanceof HttpErrorResponse ? (err.error?.error?.message as string | undefined) : undefined;
  const i18nKey = message ? COMPANY_WRITE_ERROR_CODES[message] : undefined;
  if (i18nKey) {
    return i18n.translate(i18nKey);
  }
  return i18n.translate(fallbackKey);
}
