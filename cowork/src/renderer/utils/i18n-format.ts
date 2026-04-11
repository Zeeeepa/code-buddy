import i18n from '../i18n/config';

export function getAppLocale(language = i18n.resolvedLanguage || i18n.language): string {
  const normalizedLanguage = `${language || 'en'}`.toLowerCase();
  if (normalizedLanguage.startsWith('zh')) {
    return 'zh-CN';
  }
  if (normalizedLanguage.startsWith('fr')) {
    return 'fr-FR';
  }
  return 'en-US';
}

export function formatAppDateTime(
  value: number | string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(getAppLocale(), {
    ...(options || {
      dateStyle: 'medium',
      timeStyle: 'short',
    }),
  }).format(new Date(value));
}

export function formatAppDate(
  value: number | string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(
    getAppLocale(),
    options || {
      month: 'short',
      day: 'numeric',
    }
  ).format(new Date(value));
}

export function formatAppTime(
  value: number | string | Date,
  options?: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(
    getAppLocale(),
    options || {
      hour: '2-digit',
      minute: '2-digit',
    }
  ).format(new Date(value));
}

export function formatAppNumber(
  value: number,
  options?: Intl.NumberFormatOptions
): string {
  return new Intl.NumberFormat(getAppLocale(), options).format(value);
}

export function getAppListSeparator(language = i18n.resolvedLanguage || i18n.language): string {
  return getAppLocale(language).startsWith('zh') ? '、' : ', ';
}

export function joinAppList(values: string[]): string {
  return values.join(getAppListSeparator());
}
