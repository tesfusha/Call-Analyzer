import type { CallDirection, CallRecord, SimSlot } from '@/src/types/call';

type CapacitorPluginHandle = {
  remove?: () => Promise<void> | void;
};

type NativeFirebaseAuthPlugin = {
  signInWithGoogle?: (opts?: { skipNativeAuth?: boolean; useCredentialManager?: boolean }) => Promise<{
    credential?: { idToken?: string | null; accessToken?: string | null } | null;
  }>;
  signOut?: () => Promise<void>;
};

type NativeSystemBarsPlugin = {
  setBars?: (opts: { color: string; isDark: boolean }) => Promise<void>;
};

type NativeStatusBarPlugin = {
  setStyle?: (opts: { style: 'DARK' | 'LIGHT' | 'DEFAULT' }) => Promise<void>;
  setBackgroundColor?: (opts: { color: string }) => Promise<void>;
  setOverlaysWebView?: (opts: { overlay: boolean }) => Promise<void>;
};

type NativeAppPlugin = {
  addListener?: (
    eventName: 'appStateChange',
    listener: (state: { isActive: boolean }) => void,
  ) => Promise<CapacitorPluginHandle> | CapacitorPluginHandle;
};

export type NativeCallLogEntry = {
  id?: string | number;
  number?: string;
  name?: string | null;
  direction?: string;
  sim?: string | null;
  timestamp?: number;
  duration?: number;
};

type NativeCallLogPlugin = {
  getRecentCalls?: (opts?: { since?: number }) => Promise<{ calls?: NativeCallLogEntry[] }>;
  startListening?: () => Promise<void>;
  stopListening?: () => Promise<void>;
  addListener?: (
    eventName: 'callLogChanged',
    listener: () => void,
  ) => Promise<CapacitorPluginHandle> | CapacitorPluginHandle;
};

export type NotificationCategory = 'schedule' | 'birthday' | 'holiday' | 'other';

export type NotificationActionId =
  | 'call'
  | 'snooze_15m'
  | 'snooze_60m'
  | 'wish'
  | 'remind_later'
  | 'view'
  | 'clear'
  | 'mute'
  | 'open';

export type NotificationMeta = {
  category?: NotificationCategory;
  number?: string | null;
  contactKey?: string | null;
  eventId?: string | null;
  muteKey?: string | null;
  wishText?: string | null;
};

export type NotificationActionEvent = NotificationMeta & {
  actionId: NotificationActionId | string;
  notificationId?: number;
  idKey?: string;
  title?: string | null;
  body?: string | null;
  timestamp?: number;
};

type NativeAppNotificationPermissionState = 'granted' | 'denied' | 'prompt';

type NativeAppNotificationsPlugin = {
  getPermissionStatus?: () => Promise<{ state?: string }>;
  requestPermission?: () => Promise<{ state?: string }>;
  showNotification?: (
    opts: {
      id: number;
      idKey?: string;
      title: string;
      body: string;
    } & NotificationMeta,
  ) => Promise<void>;
  scheduleNotification?: (
    opts: {
      id: number;
      idKey?: string;
      title: string;
      body: string;
      triggerAtMs: number;
    } & NotificationMeta,
  ) => Promise<void>;
  cancelNotification?: (opts: { id: number }) => Promise<void>;
  getPendingActions?: () => Promise<{ actions?: NotificationActionEvent[] }>;
  addListener?: (
    eventName: 'notificationAction',
    listener: (event: NotificationActionEvent) => void,
  ) => Promise<CapacitorPluginHandle> | CapacitorPluginHandle;
};

type NativeFileExportPlugin = {
  saveAndShare?: (opts: {
    filename: string;
    mimeType: string;
    base64Data: string;
    shareTitle?: string;
  }) => Promise<{ saved?: boolean; shared?: boolean; path?: string }>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
  Plugins?: {
    FirebaseAuthentication?: NativeFirebaseAuthPlugin;
    SystemBars?: NativeSystemBarsPlugin;
    StatusBar?: NativeStatusBarPlugin;
    App?: NativeAppPlugin;
    CallLog?: NativeCallLogPlugin;
    AppNotifications?: NativeAppNotificationsPlugin;
    FileExport?: NativeFileExportPlugin;
    [key: string]: unknown;
  };
};

function getCapacitor(): CapacitorGlobal | null {
  if (typeof window === 'undefined') return null;
  const cap = (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
  return cap && typeof cap === 'object' ? cap : null;
}

/**
 * Detects whether the app is running inside a native Android/iOS Capacitor shell
 * or an embedded Android WebView wrapper where browser OAuth popups fail.
 */
export function isNativeCapacitor(): boolean {
  const cap = getCapacitor();
  if (cap) {
    if (typeof cap.isNativePlatform === 'function') {
      try {
        if (cap.isNativePlatform()) return true;
      } catch {
        // fall through
      }
    }
    if (typeof cap.getPlatform === 'function') {
      try {
        const p = cap.getPlatform();
        if (p === 'android' || p === 'ios') return true;
      } catch {
        // fall through
      }
    }
  }
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol;
    if (proto === 'capacitor:' || proto === 'ionic:' || proto === 'file:') return true;
    const ua = navigator.userAgent || '';
    // Android WebView includes "; wv)" in the user agent
    if (/;\s*wv\)/i.test(ua) && /Android/i.test(ua)) return true;
  }
  return false;
}

export function hasNativeGoogleAuth(): boolean {
  const cap = getCapacitor();
  if (!cap) return false;
  if (typeof cap.isPluginAvailable === 'function') {
    try {
      if (cap.isPluginAvailable('FirebaseAuthentication')) {
        return typeof cap.Plugins?.FirebaseAuthentication?.signInWithGoogle === 'function';
      }
    } catch {
      // fall through
    }
  }
  return typeof cap.Plugins?.FirebaseAuthentication?.signInWithGoogle === 'function';
}

export async function runNativeGoogleSignIn(): Promise<{
  idToken: string | null;
  accessToken: string | null;
}> {
  const plugin = getCapacitor()?.Plugins?.FirebaseAuthentication;
  if (!plugin || typeof plugin.signInWithGoogle !== 'function') {
    throw new Error('NATIVE_GOOGLE_AUTH_UNAVAILABLE');
  }
  const result = await plugin.signInWithGoogle({ useCredentialManager: false });
  return {
    idToken: result?.credential?.idToken ?? null,
    accessToken: result?.credential?.accessToken ?? null,
  };
}

export async function runNativeSignOut(): Promise<void> {
  if (!isNativeCapacitor()) return;
  const plugin = getCapacitor()?.Plugins?.FirebaseAuthentication;
  if (plugin && typeof plugin.signOut === 'function') {
    try {
      await plugin.signOut();
    } catch {
      // ignore native sign-out error
    }
  }
}

/**
 * Syncs native Android/iOS top status bar and bottom navigation bar colors &
 * icon contrast using our SystemBars plugin (when present) and/or StatusBar.
 */
export async function syncNativeStatusBar(isDark: boolean, backgroundColor: string): Promise<void> {
  if (!isNativeCapacitor()) return;
  const plugins = getCapacitor()?.Plugins;
  if (!plugins) return;

  try {
    const systemBars = plugins.SystemBars;
    if (systemBars && typeof systemBars.setBars === 'function') {
      await systemBars.setBars({ color: backgroundColor, isDark }).catch(() => {});
    }

    const statusBar = plugins.StatusBar;
    if (statusBar) {
      if (typeof statusBar.setOverlaysWebView === 'function') {
        await statusBar.setOverlaysWebView({ overlay: false }).catch(() => {});
      }
      if (typeof statusBar.setStyle === 'function') {
        await statusBar.setStyle({ style: isDark ? 'DARK' : 'LIGHT' }).catch(() => {});
      }
      if (typeof statusBar.setBackgroundColor === 'function') {
        await statusBar.setBackgroundColor({ color: backgroundColor }).catch(() => {});
      }
    }
  } catch {
    // ignore native status bar errors
  }
}

export function hasNativeCallLogPlugin(): boolean {
  const cap = getCapacitor();
  if (!cap) return false;
  return typeof cap.Plugins?.CallLog?.getRecentCalls === 'function';
}

function normaliseNativeDirection(raw?: string): CallDirection {
  const lower = (raw || '').toLowerCase();
  if (lower === 'incoming') return 'incoming';
  if (lower === 'outgoing') return 'outgoing';
  return 'missed';
}

function normaliseNativeSim(raw?: string | null): SimSlot {
  if (raw === 'SIM 1' || raw === 'SIM 2') return raw;
  return null;
}

export async function fetchNativeRecentCalls(sinceMs = 0): Promise<CallRecord[]> {
  const plugin = getCapacitor()?.Plugins?.CallLog;
  if (!plugin || typeof plugin.getRecentCalls !== 'function') return [];
  const res = await plugin.getRecentCalls({ since: sinceMs });
  const rawList = Array.isArray(res?.calls) ? res.calls : [];
  return rawList
    .filter((item) => item && typeof item.number === 'string' && item.number.trim().length > 0)
    .map((item) => ({
      id: item.id ? String(item.id) : `android_${item.timestamp ?? Date.now()}_${item.number}`,
      number: String(item.number).trim(),
      name: typeof item.name === 'string' && item.name.trim() ? item.name.trim() : null,
      direction: normaliseNativeDirection(item.direction),
      sim: normaliseNativeSim(item.sim),
      timestamp: Number(item.timestamp) || Date.now(),
      duration: Math.max(0, Math.round(Number(item.duration) || 0)),
      note: null,
      tag: null,
    }));
}

export async function subscribeNativeCallLog(
  onChanged: () => void,
): Promise<() => void> {
  const cap = getCapacitor();
  const callLog = cap?.Plugins?.CallLog;
  if (!callLog) return () => {};

  const handles: CapacitorPluginHandle[] = [];
  try {
    if (typeof callLog.startListening === 'function') {
      await callLog.startListening().catch(() => {});
    }
    if (typeof callLog.addListener === 'function') {
      const h = await callLog.addListener('callLogChanged', onChanged);
      if (h) handles.push(h);
    }
    const appPlugin = cap?.Plugins?.App;
    if (appPlugin && typeof appPlugin.addListener === 'function') {
      const h = await appPlugin.addListener('appStateChange', ({ isActive }) => {
        if (isActive) onChanged();
      });
      if (h) handles.push(h);
    }
  } catch {
    // ignore listener setup errors
  }

  return () => {
    handles.forEach((h) => {
      try {
        void h.remove?.();
      } catch {
        // ignore
      }
    });
    try {
      void callLog.stopListening?.();
    } catch {
      // ignore
    }
  };
}

export function hasNativeNotificationsPlugin(): boolean {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  return Boolean(
    plugin &&
      (typeof plugin.getPermissionStatus === 'function' ||
        typeof plugin.showNotification === 'function'),
  );
}

function normalisePermState(raw?: string): NativeAppNotificationPermissionState {
  if (raw === 'granted') return 'granted';
  if (raw === 'denied') return 'denied';
  return 'prompt';
}

export async function getNativeNotificationPermission(): Promise<
  NativeAppNotificationPermissionState | 'unsupported'
> {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  if (!plugin || typeof plugin.getPermissionStatus !== 'function') {
    return 'unsupported';
  }
  try {
    const res = await plugin.getPermissionStatus();
    return normalisePermState(res?.state);
  } catch {
    return 'unsupported';
  }
}

export async function requestNativeNotificationPermission(): Promise<
  NativeAppNotificationPermissionState | 'unsupported'
> {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  if (!plugin || typeof plugin.requestPermission !== 'function') {
    return 'unsupported';
  }
  try {
    const res = await plugin.requestPermission();
    return normalisePermState(res?.state);
  } catch {
    return 'denied';
  }
}

export function hashNotificationId(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 2_000_000_000) + 100;
}

export async function showNativeNotification(
  idKey: string,
  title: string,
  body: string,
  meta?: NotificationMeta,
): Promise<boolean> {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  if (!plugin || typeof plugin.showNotification !== 'function') return false;
  try {
    await plugin.showNotification({
      id: hashNotificationId(idKey),
      idKey,
      title,
      body,
      category: meta?.category ?? 'other',
      number: meta?.number ?? null,
      contactKey: meta?.contactKey ?? null,
      eventId: meta?.eventId ?? null,
      muteKey: meta?.muteKey ?? null,
      wishText: meta?.wishText ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function scheduleNativeNotification(
  idKey: string,
  title: string,
  body: string,
  triggerAtMs: number,
  meta?: NotificationMeta,
): Promise<boolean> {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  if (!plugin || typeof plugin.scheduleNotification !== 'function') return false;
  try {
    await plugin.scheduleNotification({
      id: hashNotificationId(idKey),
      idKey,
      title,
      body,
      triggerAtMs,
      category: meta?.category ?? 'schedule',
      number: meta?.number ?? null,
      contactKey: meta?.contactKey ?? null,
      eventId: meta?.eventId ?? null,
      muteKey: meta?.muteKey ?? null,
      wishText: meta?.wishText ?? null,
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelNativeNotification(idKey: string): Promise<void> {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  if (!plugin || typeof plugin.cancelNotification !== 'function') return;
  try {
    await plugin.cancelNotification({ id: hashNotificationId(idKey) });
  } catch {
    // ignore
  }
}

export async function consumePendingNotificationActions(): Promise<NotificationActionEvent[]> {
  const plugin = getCapacitor()?.Plugins?.AppNotifications;
  if (!plugin || typeof plugin.getPendingActions !== 'function') return [];
  try {
    const res = await plugin.getPendingActions();
    return Array.isArray(res?.actions) ? res.actions : [];
  } catch {
    return [];
  }
}

export async function subscribeNativeNotificationActions(
  onAction: (event: NotificationActionEvent) => void,
): Promise<() => void> {
  const cap = getCapacitor();
  const plugin = cap?.Plugins?.AppNotifications;
  if (!plugin) return () => {};

  const handles: CapacitorPluginHandle[] = [];
  const flushPending = async () => {
    const pending = await consumePendingNotificationActions();
    pending.forEach(onAction);
  };

  try {
    await flushPending();
    if (typeof plugin.addListener === 'function') {
      const h = await plugin.addListener('notificationAction', onAction);
      if (h) handles.push(h);
    }
    const appPlugin = cap?.Plugins?.App;
    if (appPlugin && typeof appPlugin.addListener === 'function') {
      const h = await appPlugin.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          void flushPending();
        }
      });
      if (h) handles.push(h);
    }
  } catch {
    // ignore listener errors
  }

  return () => {
    handles.forEach((h) => {
      try {
        void h.remove?.();
      } catch {
        // ignore
      }
    });
  };
}

export function hasNativeFileExportPlugin(): boolean {
  return typeof getCapacitor()?.Plugins?.FileExport?.saveAndShare === 'function';
}

export async function runNativeFileExport(opts: {
  filename: string;
  mimeType: string;
  base64Data: string;
  shareTitle?: string;
}): Promise<{ saved?: boolean; shared?: boolean; path?: string } | null> {
  const plugin = getCapacitor()?.Plugins?.FileExport;
  if (!plugin || typeof plugin.saveAndShare !== 'function') return null;
  return plugin.saveAndShare(opts);
}
