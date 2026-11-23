import {
  APP_VERSION_CODE,
  UPDATE_CHECK_INTERVAL_MS,
  UPDATE_VERSION_URL,
} from '@/src/lib/appInfo';
import type { AppUpdateNotice } from '@/src/types/call';

const LAST_CHECK_AT_KEY = 'callanalyzer.updateCheck.lastAt.v1';
const DISMISSED_VERSION_KEY = 'callanalyzer.updateCheck.dismissedCode.v1';

function resolveUpdateManifestUrl(): string {
  const configured =
    typeof import.meta !== 'undefined' &&
    typeof import.meta.env?.VITE_UPDATE_VERSION_URL === 'string'
      ? import.meta.env.VITE_UPDATE_VERSION_URL.trim()
      : '';
  if (configured && isSafeHttpsUrl(configured)) {
    return configured;
  }
  return UPDATE_VERSION_URL;
}

export function isSafeHttpsUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function parseUpdateManifest(payload: unknown): AppUpdateNotice | null {
  if (!payload || typeof payload !== 'object') return null;
  const obj = payload as Record<string, unknown>;
  const versionCode = Number(obj.versionCode);
  const versionName = typeof obj.versionName === 'string' ? obj.versionName.trim() : '';
  const apkUrl = typeof obj.apkUrl === 'string' ? obj.apkUrl.trim() : '';
  const notes = typeof obj.notes === 'string' ? obj.notes.trim() : '';
  const mandatory = Boolean(obj.mandatory);

  if (!Number.isInteger(versionCode) || versionCode <= 0) return null;
  if (!versionName || versionName.length > 40) return null;
  if (!apkUrl || !isSafeHttpsUrl(apkUrl)) return null;

  return {
    versionCode,
    versionName,
    apkUrl,
    notes: notes || 'Includes reliability, performance, and privacy improvements.',
    mandatory,
  };
}

export function getLastUpdateCheckAt(): number {
  try {
    const raw = localStorage.getItem(LAST_CHECK_AT_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

function setLastUpdateCheckAt(ts: number): void {
  try {
    localStorage.setItem(LAST_CHECK_AT_KEY, String(ts));
  } catch {
    // ignore storage failures
  }
}

export function getDismissedUpdateCode(): number {
  try {
    const raw = localStorage.getItem(DISMISSED_VERSION_KEY);
    const parsed = raw ? Number(raw) : 0;
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function dismissUpdateVersionCode(versionCode: number): void {
  try {
    localStorage.setItem(DISMISSED_VERSION_KEY, String(versionCode));
  } catch {
    // ignore storage failures
  }
}

export function isUpdateCheckDue(now = Date.now()): boolean {
  const last = getLastUpdateCheckAt();
  return last === 0 || now - last >= UPDATE_CHECK_INTERVAL_MS;
}

export async function checkForAppUpdate(options?: {
  force?: boolean;
  ignoreDismissed?: boolean;
}): Promise<AppUpdateNotice | null> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  const url = resolveUpdateManifestUrl();
  if (!isSafeHttpsUrl(url)) return null;

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const separator = url.includes('?') ? '&' : '?';
    const requestUrl = `${url}${separator}t=${Date.now()}`;
    const response = await fetch(requestUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!response.ok) return null;

    const json: unknown = await response.json();
    setLastUpdateCheckAt(Date.now());

    const notice = parseUpdateManifest(json);
    if (!notice) return null;
    if (notice.versionCode <= APP_VERSION_CODE) return null;

    if (!notice.mandatory && !options?.ignoreDismissed && !options?.force) {
      if (getDismissedUpdateCode() >= notice.versionCode) {
        return null;
      }
    }

    return notice;
  } catch {
    // Fail silently when offline, blocked, or unreachable.
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}
