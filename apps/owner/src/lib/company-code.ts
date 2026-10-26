export const COMPANY_CODE_MAX_LENGTH = 32;
const COMPANY_CODE_PATTERN = /^[A-Z0-9]{1,32}$/;

export function normalizeCompanyCode(value: string): string {
  return value.trim().toUpperCase();
}

export function isValidCompanyCode(value: string): boolean {
  return COMPANY_CODE_PATTERN.test(value);
}
