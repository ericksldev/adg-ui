import { AppLanguage, I18nService } from '../services/i18n.service';

const DATE_LOCALE: Record<AppLanguage, string> = {
  es: 'es-ES',
  en: 'en-US',
  pt: 'pt-BR'
};

export function notAvailableLabel(i18n: I18nService): string {
  return i18n.translate('common.notAvailable');
}

export function formatAppDate(i18n: I18nService, value: Date): string {
  const locale = DATE_LOCALE[i18n.getCurrentLanguage()] ?? DATE_LOCALE.es;
  return value.toLocaleDateString(locale);
}

export function translateMembershipStatus(i18n: I18nService, status: string | null | undefined): string {
  if (!status) {
    return i18n.translate('nav.membership.unknown');
  }
  const key = `saas.membershipStatus.${status.toLowerCase()}`;
  const translated = i18n.translate(key);
  return translated === key ? status : translated;
}

export function translateCorralFilterKey(i18n: I18nService, filterKey: string | null | undefined): string {
  if (!filterKey) {
    return notAvailableLabel(i18n);
  }
  const normalized = filterKey.trim().toLowerCase();
  const key = `corralWorkSession.filterKey.${normalized}`;
  const translated = i18n.translate(key);
  return translated === key ? filterKey : translated;
}

export function translateCorralFilterValue(i18n: I18nService, filterValue: string | null | undefined): string {
  if (!filterValue) {
    return notAvailableLabel(i18n);
  }
  const trimmed = filterValue.trim();
  const key = `corralWorkSession.filterValue.${trimmed}`;
  const translated = i18n.translate(key);
  if (translated !== key) {
    return translated;
  }
  const sexKey = trimmed === 'MALE' ? 'animal.sexMaleApi' : trimmed === 'FEMALE' ? 'animal.sexFemaleApi' : null;
  return sexKey ? i18n.translate(sexKey) : trimmed;
}

const AUTO_STEP_LABEL = /^(?:step|paso|passo)\s+\d+$/i;

export function stepDisplayLabel(
  i18n: I18nService,
  stepOrder: number,
  label?: string | null
): string {
  const trimmed = label?.trim();
  if (!trimmed || AUTO_STEP_LABEL.test(trimmed)) {
    return i18n.translate('corralWorkSession.stepNumber', { order: stepOrder });
  }
  return trimmed;
}
