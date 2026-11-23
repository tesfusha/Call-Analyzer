const PIN_HASH_PREFIX = 'pbkdf2-sha256';
const PIN_PBKDF2_ITERATIONS = 150_000;
const PIN_SALT_BYTES = 16;
const PIN_KEY_BITS = 256;

export type PinLockoutState = {
  failedAttempts: number;
  lockUntil: number;
};

export function isWebCryptoAvailable(): boolean {
  return (
    typeof crypto !== 'undefined' &&
    Boolean(crypto.subtle) &&
    typeof crypto.getRandomValues === 'function'
  );
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!/^[0-9a-f]+$/i.test(hex) || hex.length % 2 !== 0) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function isValidPinHash(expectedHash: string | null | undefined): boolean {
  if (!expectedHash || typeof expectedHash !== 'string') return false;
  const parts = expectedHash.split(':');
  if (parts.length !== 4 || parts[0] !== PIN_HASH_PREFIX) return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < PIN_PBKDF2_ITERATIONS) return false;
  if (!/^[0-9a-f]{32}$/i.test(parts[2])) return false;
  if (!/^[0-9a-f]{64}$/i.test(parts[3])) return false;
  return true;
}

async function derivePinBits(
  pin: string,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array> {
  const encoded = new TextEncoder().encode(pin);
  const keyMaterial = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, [
    'deriveBits',
  ]);
  const saltCopy = new Uint8Array(salt.byteLength);
  saltCopy.set(salt);
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltCopy,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    PIN_KEY_BITS,
  );
  return new Uint8Array(derived);
}

export async function hashPin(pin: string): Promise<string> {
  const clean = pin.trim();
  if (!/^\d{4}$/.test(clean)) {
    throw new Error('Screen lock PIN must be exactly 4 digits.');
  }
  if (!isWebCryptoAvailable()) {
    throw new Error(
      'Web Crypto is unavailable in this browser context. Screen lock PIN cannot be enabled.',
    );
  }
  const salt = new Uint8Array(PIN_SALT_BYTES);
  crypto.getRandomValues(salt);
  const derived = await derivePinBits(clean, salt, PIN_PBKDF2_ITERATIONS);
  return `${PIN_HASH_PREFIX}:${PIN_PBKDF2_ITERATIONS}:${bytesToHex(salt)}:${bytesToHex(derived)}`;
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  const clean = pin.trim();
  if (!/^\d{4}$/.test(clean)) return false;
  if (!expectedHash || !isValidPinHash(expectedHash)) return false;
  if (!isWebCryptoAvailable()) return false;

  const [, iterStr, saltHex, hashHex] = expectedHash.split(':');
  const iterations = Number(iterStr);
  const salt = hexToBytes(saltHex);
  const expectedBytes = hexToBytes(hashHex);
  if (!salt || !expectedBytes || expectedBytes.length !== PIN_KEY_BITS / 8) {
    return false;
  }

  try {
    const computed = await derivePinBits(clean, salt, iterations);
    if (computed.length !== expectedBytes.length) return false;
    let diff = 0;
    for (let i = 0; i < computed.length; i += 1) {
      diff |= computed[i] ^ expectedBytes[i];
    }
    return diff === 0;
  } catch {
    return false;
  }
}

export function getPinLockoutDelayMs(failedAttempts: number): number {
  if (failedAttempts < 5) return 0;
  if (failedAttempts === 5) return 30_000;
  if (failedAttempts === 6) return 60_000;
  if (failedAttempts === 7) return 5 * 60_000;
  return 15 * 60_000;
}

export function readPinLockoutState(storageKey: string): PinLockoutState {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { failedAttempts: 0, lockUntil: 0 };
    const parsed = JSON.parse(raw) as Partial<PinLockoutState> | null;
    const failedAttempts =
      typeof parsed?.failedAttempts === 'number' && parsed.failedAttempts >= 0
        ? Math.floor(parsed.failedAttempts)
        : 0;
    const lockUntil =
      typeof parsed?.lockUntil === 'number' && parsed.lockUntil > 0
        ? Math.floor(parsed.lockUntil)
        : 0;
    return { failedAttempts, lockUntil };
  } catch {
    return { failedAttempts: 0, lockUntil: 0 };
  }
}

export function writePinLockoutState(storageKey: string, state: PinLockoutState): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // ignore storage errors
  }
}

export function clearPinLockoutState(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey);
  } catch {
    // ignore storage errors
  }
}

export function maskPhoneNumber(number: string, privacyMode = false): string {
  const clean = number.trim();
  if (!privacyMode || !clean) return clean;
  const digits = clean.replace(/\D/g, '');
  if (digits.length === 0) return '*'.repeat(Math.min(clean.length, 6));
  if (digits.length <= 2) return '*'.repeat(digits.length);
  if (digits.length <= 6) {
    return `${'*'.repeat(digits.length - 2)}${digits.slice(-2)}`;
  }
  const prefix = clean.startsWith('+') ? '+' : '';
  const head = digits.slice(0, 4);
  const tail = digits.slice(-2);
  return `${prefix}${head}${'*'.repeat(digits.length - 6)}${tail}`;
}

export function formatDisplayNameOrPhone(
  name: string | null | undefined,
  number: string,
  privacyMode = false,
): string {
  const cleanName = name?.trim();
  if (!cleanName) return maskPhoneNumber(number, privacyMode);
  const nameDigits = cleanName.replace(/\D/g, '');
  const numDigits = number.replace(/\D/g, '');
  if (
    cleanName === number.trim() ||
    (nameDigits.length >= 6 && nameDigits === numDigits)
  ) {
    return maskPhoneNumber(number, privacyMode);
  }
  return cleanName;
}

export function maskPrivateText(
  text: string | null | undefined,
  privacyMode: boolean,
  fallback = 'Hidden in privacy mode',
): string {
  if (!text) return '';
  return privacyMode ? fallback : text;
}
