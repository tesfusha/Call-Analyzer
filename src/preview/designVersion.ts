import { useSyncExternalStore } from 'react';

export type DesignVersion = 'v1.0.3' | 'v1.0.5' | 'v1.0.6' | 'v1.0.7';

const STORAGE_KEY = 'callanalyzer.designPreviewVersion.v4';

const listeners = new Set<() => void>();

function readInitialVersion(): DesignVersion {
  if (typeof window === 'undefined') return 'v1.0.3';
  try {
    const params = new URLSearchParams(window.location.search);
    const param = (params.get('v') || params.get('preview') || '').toLowerCase();
    if (param === 'v1.0.3' || param === '1.0.3' || param === '1.0.4' || param === 'v1.0.4' || param === 'original' || param === 'main') {
      return 'v1.0.3';
    }
    if (param === 'v1.0.5' || param === '1.0.5' || param === 'unslop') {
      return 'v1.0.5';
    }
    if (param === 'v1.0.6' || param === '1.0.6' || param === 'simple' || param === 'modern') {
      return 'v1.0.6';
    }
    if (param === 'v1.0.7' || param === '1.0.7' || param === 'business' || param === 'biz') {
      return 'v1.0.7';
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'v1.0.3' || stored === 'v1.0.5' || stored === 'v1.0.6' || stored === 'v1.0.7') {
      return stored;
    }
  } catch {
    // Ignore storage errors in restricted environments
  }
  return 'v1.0.3';
}

let currentVersion: DesignVersion = readInitialVersion();

function applyDomAttribute(version: DesignVersion) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.designVersion = version;
}

export function initDesignVersion(): DesignVersion {
  currentVersion = readInitialVersion();
  applyDomAttribute(currentVersion);
  return currentVersion;
}

export function getDesignVersion(): DesignVersion {
  return currentVersion;
}

export function setDesignVersion(next: DesignVersion): void {
  if (next === currentVersion) {
    applyDomAttribute(next);
    return;
  }
  currentVersion = next;
  applyDomAttribute(next);
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // Ignore storage errors
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useDesignVersion(): DesignVersion {
  return useSyncExternalStore(subscribe, getDesignVersion, () => 'v1.0.3');
}
