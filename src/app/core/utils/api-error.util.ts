import { HttpErrorResponse } from '@angular/common/http';
import { I18nService } from '../services/i18n.service';

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

export function translateApiError(i18n: I18nService, err: unknown, fallbackKey: string): string {
  const message = readApiErrorMessage(err)?.trim();
  if (!message) {
    return i18n.translate(fallbackKey);
  }
  return i18n.translate(fallbackKey);
}
