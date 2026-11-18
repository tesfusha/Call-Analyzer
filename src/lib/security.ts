const PIN_SALT = 'call-analyzer-eth-pin-v1:';

export async function hashPin(pin: string): Promise<string> {
  const clean = pin.trim();
  const payload = `${PIN_SALT}${clean}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic digest if Web Crypto subtle is unavailable in insecure context
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fallback-${(hash >>> 0).toString(16)}`;
}

export async function verifyPin(pin: string, expectedHash: string): Promise<boolean> {
  if (!expectedHash) return true;
  const computed = await hashPin(pin);
  return computed === expectedHash;
}

export function maskPhoneNumber(number: string, _privacyMode?: boolean): string {
  return number.trim();
}

export function maskPrivateText(
  text: string | null | undefined,
  privacyMode: boolean,
  fallback = 'Hidden in privacy mode',
): string {
  if (!text) return '';
  return privacyMode ? fallback : text;
}
