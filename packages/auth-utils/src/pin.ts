import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export async function hashPin(pin: string): Promise<string> {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export async function verifyPin(pin: string, pinHash: string): Promise<boolean> {
  return bcrypt.compare(pin, pinHash);
}

export function isLocked(lockedUntil: string | null): boolean {
  if (!lockedUntil) return false;
  return new Date(lockedUntil) > new Date();
}

export function getLockoutConfig() {
  return {
    maxAttempts: MAX_ATTEMPTS,
    lockoutMinutes: LOCKOUT_MINUTES,
  };
}

export function computeLockedUntil(): Date {
  return new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
}

export function getRemainingAttempts(failedAttempts: number): number {
  return Math.max(0, MAX_ATTEMPTS - failedAttempts);
}
