import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  type UserCredential,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Opens the OAuth popup synchronously inside the user's click event before
 * Firebase Auth runs async _initialize() / _getRedirectUrl() network calls.
 * Prevents Safari, Firefox, mobile browsers, and slow-network Chrome sessions
 * from losing transient user activation and failing with auth/popup-blocked.
 */
export async function signInWithGooglePopupSync(): Promise<UserCredential> {
  const isIOSStandalone =
    typeof navigator !== 'undefined' &&
    Boolean((navigator as { standalone?: boolean }).standalone);

  if (typeof window === 'undefined' || isIOSStandalone) {
    return signInWithPopup(auth, googleProvider);
  }

  const width = 500;
  const height = 620;
  const left = Math.max(Math.round((window.screen.availWidth - width) / 2), 0);
  const top = Math.max(Math.round((window.screen.availHeight - height) / 2), 0);
  const features = `location=yes,resizable=yes,statusbar=yes,toolbar=no,scrollbars=yes,width=${width},height=${height},top=${top},left=${left}`;

  let preOpened: Window | null = null;
  try {
    preOpened = window.open('', 'call_analyzer_google_auth', features);
  } catch {
    preOpened = null;
  }

  if (!preOpened) {
    return signInWithPopup(auth, googleProvider);
  }

  try {
    const popupDoc = preOpened.document;
    popupDoc.title = 'Connecting to Google…';
    if (popupDoc.body) {
      popupDoc.body.style.margin = '0';
      popupDoc.body.style.minHeight = '100vh';
      popupDoc.body.style.display = 'flex';
      popupDoc.body.style.alignItems = 'center';
      popupDoc.body.style.justifyContent = 'center';
      popupDoc.body.style.background = '#111214';
      popupDoc.body.style.color = '#ffffff';
      popupDoc.body.style.fontFamily = 'system-ui, -apple-system, sans-serif';
      const label = popupDoc.createElement('div');
      label.textContent = 'Connecting to Google Sign-In…';
      label.style.fontSize = '15px';
      label.style.fontWeight = '600';
      popupDoc.body.replaceChildren(label);
    }
  } catch {
    // Ignore restricted popup document access
  }

  const originalOpen = window.open;
  let handedOff = false;
  let restored = false;

  const restoreOpen = () => {
    if (restored) return;
    restored = true;
    if (window.open === wrappedOpen) {
      window.open = originalOpen;
    }
  };

  const wrappedOpen: typeof window.open = (url, target, windowFeatures) => {
    const urlStr = url ? String(url) : '';
    if (
      !handedOff &&
      (urlStr.includes('/__/auth/handler') || urlStr.includes('/emulator/auth/handler'))
    ) {
      handedOff = true;
      restoreOpen();
      if (!preOpened.closed) {
        try {
          preOpened.location.replace(urlStr);
          preOpened.focus();
        } catch {
          try {
            preOpened.location.href = urlStr;
          } catch {
            // Ignore navigation errors
          }
        }
      }
      return preOpened;
    }
    return originalOpen.call(window, url, target, windowFeatures);
  };

  window.open = wrappedOpen;
  const safetyTimer = window.setTimeout(restoreOpen, 15000);

  try {
    return await signInWithPopup(auth, googleProvider);
  } finally {
    window.clearTimeout(safetyTimer);
    restoreOpen();
    if (!handedOff && !preOpened.closed) {
      try {
        preOpened.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

/** Deterministic safe Firestore document ID matching ^[a-zA-Z0-9_-]+$ and <= 128 chars. */
export function toFirestoreDocId(raw: string): string {
  const cleaned = raw
    .trim()
    .replace(/\+/g, 'p_')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
  const base = cleaned || 'item';
  return base.slice(0, 128);
}

const utf8Encoder = new TextEncoder();

export function clampStr(val: string | null | undefined, maxBytes: number): string {
  if (!val || maxBytes <= 0) return '';
  if (utf8Encoder.encode(val).length <= maxBytes) return val;

  let out = '';
  let byteCount = 0;
  for (const ch of val) {
    const chBytes = utf8Encoder.encode(ch).length;
    if (byteCount + chBytes > maxBytes) break;
    out += ch;
    byteCount += chBytes;
  }
  return out;
}
