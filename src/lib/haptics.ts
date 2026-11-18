const HAPTICS_ENABLED_KEY = 'callanalyzer.haptics.v1';

export type HapticKind = 'tap' | 'success' | 'warning';

const PATTERNS: Record<HapticKind, number | number[]> = {
  tap: 14,
  success: [18, 35, 22],
  warning: [24, 30, 18],
};

export function isHapticsEnabled(): boolean {
  try {
    return localStorage.getItem(HAPTICS_ENABLED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function setHapticsEnabledStorage(enabled: boolean): void {
  try {
    localStorage.setItem(HAPTICS_ENABLED_KEY, enabled ? '1' : '0');
  } catch {
    // ignore storage errors
  }
}

export function triggerHaptic(kind: HapticKind = 'tap'): void {
  if (!isHapticsEnabled()) return;
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(PATTERNS[kind]);
    }
  } catch {
    // ignore unsupported environments
  }
}
