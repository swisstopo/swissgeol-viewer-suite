import i18next from 'i18next';

export type TranslatedString = string | TranslationMapping;

export interface TranslationMapping {
  de: string;
  en: string;
  fr: string;
  it: string;
}

export const getTranslatedString = (
  translatedString: TranslatedString | null | undefined,
): string | null | undefined => {
  if (!translatedString) {
    return translatedString;
  }

  if (typeof translatedString === 'string') {
    return translatedString;
  }
  const currentLanguage = i18next.language as keyof TranslationMapping;
  return translatedString[currentLanguage] ?? '';
};
