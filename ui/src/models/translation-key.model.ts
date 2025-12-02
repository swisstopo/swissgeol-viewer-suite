export type TranslationKey = (string | string[]) & {
  readonly __translation_key__: unique symbol;
};

export const makeTranslationKey = (...keys: string[]): TranslationKey => {
  switch (keys.length) {
    case 0:
      throw new Error('Translation key must not be empty');
    case 1:
      return keys[0] as TranslationKey;
    default:
      return keys as TranslationKey;
  }
};
