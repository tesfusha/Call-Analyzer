import { initializeApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '@/firebase-applet-config.json';

const SAME_ORIGIN_AUTH_HOSTS = new Set([
  'callanalayzereth.vercel.app',
]);

const resolvedAuthDomain =
  typeof window !== 'undefined' && SAME_ORIGIN_AUTH_HOSTS.has(window.location.hostname.toLowerCase())
    ? window.location.host
    : firebaseConfig.authDomain;

const app = initializeApp({
  ...firebaseConfig,
  authDomain: resolvedAuthDomain,
});
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

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
