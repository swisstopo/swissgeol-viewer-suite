export function parseBoolean(value: string, defaultValue = true): boolean {
  switch (value.toLowerCase()) {
    case 'true':
      return true;
    case 'false':
      return false;
    default:
      return defaultValue;
  }
}
