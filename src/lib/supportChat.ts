import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  clampStr,
  db,
  handleFirestoreError,
} from '@/src/lib/firebase';
import type {
  SupportMessage,
  SupportSenderRole,
  SupportThread,
  SupportThreadStatus,
} from '@/src/types/call';

function toMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (val && typeof (val as { toMillis?: () => number }).toMillis === 'function') {
    return (val as { toMillis: () => number }).toMillis();
  }
  return typeof val === 'number' ? val : Date.now();
}

function parseThreadDoc(docId: string, raw: Record<string, unknown>): SupportThread {
  const status: SupportThreadStatus = raw.status === 'resolved' ? 'resolved' : 'open';
  const lastMessageSender: SupportSenderRole =
    raw.lastMessageSender === 'admin' ? 'admin' : 'user';
  return {
    uid: typeof raw.uid === 'string' && raw.uid ? raw.uid : docId,
    userName: typeof raw.userName === 'string' && raw.userName ? raw.userName : 'App User',
    userEmail: typeof raw.userEmail === 'string' ? raw.userEmail : '',
    userPhotoUrl: typeof raw.userPhotoUrl === 'string' ? raw.userPhotoUrl : null,
    status,
    lastMessageText: typeof raw.lastMessageText === 'string' ? raw.lastMessageText : '',
    lastMessageSender,
    lastMessageAtMs: toMillis(raw.lastMessageAt),
    unreadByAdmin: Boolean(raw.unreadByAdmin),
    unreadByUser: Boolean(raw.unreadByUser),
    createdAtMs: toMillis(raw.createdAt),
    updatedAtMs: toMillis(raw.updatedAt),
  };
}

function parseMessageDoc(docId: string, raw: Record<string, unknown>): SupportMessage {
  const senderRole: SupportSenderRole = raw.senderRole === 'admin' ? 'admin' : 'user';
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : docId,
    threadUid: typeof raw.threadUid === 'string' ? raw.threadUid : '',
    senderUid: typeof raw.senderUid === 'string' ? raw.senderUid : '',
    senderRole,
    senderName: typeof raw.senderName === 'string' ? raw.senderName : senderRole === 'admin' ? 'Admin' : 'User',
    text: typeof raw.text === 'string' ? raw.text : '',
    createdAtMs: toMillis(raw.createdAt),
  };
}

export function subscribeUserSupportThread(
  userUid: string,
  onChange: (thread: SupportThread | null) => void,
): Unsubscribe {
  const ref = doc(db, 'supportThreads', userUid);
  return onSnapshot(
    ref,
    (snap) => {
      if (!snap.exists()) {
        onChange(null);
        return;
      }
      onChange(parseThreadDoc(snap.id, snap.data() as Record<string, unknown>));
    },
    () => {
      // Fail gracefully when offline
      onChange(null);
    },
  );
}

export function subscribeAdminSupportThreads(
  onChange: (threads: SupportThread[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const colRef = collection(db, 'supportThreads');
  return onSnapshot(
    colRef,
    (snap) => {
      const list = snap.docs
        .map((d) => parseThreadDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => b.lastMessageAtMs - a.lastMessageAtMs);
      onChange(list);
    },
    (error) => {
      onError?.(error);
    },
  );
}

export function subscribeSupportMessages(
  threadUid: string,
  options: { asAdmin?: boolean },
  onChange: (messages: SupportMessage[]) => void,
  onError?: (err: unknown) => void,
): Unsubscribe {
  const colRef = collection(db, 'supportThreads', threadUid, 'messages');
  const q = options.asAdmin
    ? colRef
    : query(colRef, where('threadUid', '==', threadUid));
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs
        .map((d) => parseMessageDoc(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => a.createdAtMs - b.createdAtMs);
      onChange(list);
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function sendUserSupportMessage(input: {
  text: string;
  userName?: string | null;
  userPhotoUrl?: string | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified || !user.email) {
    throw new Error('Please sign in with a verified account to message Admin.');
  }

  const cleanText = clampStr(input.text, 800);
  if (!cleanText) {
    throw new Error('Please enter a message.');
  }

  const threadUid = user.uid;
  const senderName =
    clampStr(input.userName || user.displayName || user.email.split('@')[0] || 'User', 120) ||
    'User';
  const userEmail = clampStr(user.email, 254);
  const rawPhoto = input.userPhotoUrl || user.photoURL || null;
  const userPhotoUrl = rawPhoto ? rawPhoto.slice(0, 500) : null;
  const preview = clampStr(cleanText, 300);

  const threadRef = doc(db, 'supportThreads', threadUid);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const msgRef = doc(db, 'supportThreads', threadUid, 'messages', msgId);

  const path = `supportThreads/${threadUid}`;
  try {
    const existing = await getDoc(threadRef);
    const batch = writeBatch(db);

    if (!existing.exists()) {
      batch.set(threadRef, {
        uid: threadUid,
        userName: senderName,
        userEmail,
        userPhotoUrl,
        status: 'open',
        lastMessageText: preview,
        lastMessageSender: 'user',
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: true,
        unreadByUser: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(threadRef, {
        userName: senderName,
        userEmail,
        userPhotoUrl,
        status: 'open',
        lastMessageText: preview,
        lastMessageSender: 'user',
        lastMessageAt: serverTimestamp(),
        unreadByAdmin: true,
        unreadByUser: false,
        updatedAt: serverTimestamp(),
      });
    }

    batch.set(msgRef, {
      id: msgId,
      threadUid,
      senderUid: user.uid,
      senderRole: 'user',
      senderName,
      text: cleanText,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function sendAdminSupportReply(input: {
  threadUid: string;
  text: string;
  adminName?: string | null;
}): Promise<void> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('Admin authentication required.');
  }

  const cleanText = clampStr(input.text, 800);
  if (!cleanText) {
    throw new Error('Please enter a reply.');
  }

  const threadRef = doc(db, 'supportThreads', input.threadUid);
  const msgId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const msgRef = doc(db, 'supportThreads', input.threadUid, 'messages', msgId);
  const senderName = clampStr(input.adminName || 'Admin Support', 120) || 'Admin Support';
  const preview = clampStr(cleanText, 300);

  const path = `supportThreads/${input.threadUid}`;
  try {
    const batch = writeBatch(db);
    batch.update(threadRef, {
      status: 'open',
      lastMessageText: preview,
      lastMessageSender: 'admin',
      lastMessageAt: serverTimestamp(),
      unreadByAdmin: false,
      unreadByUser: true,
      updatedAt: serverTimestamp(),
    });
    batch.set(msgRef, {
      id: msgId,
      threadUid: input.threadUid,
      senderUid: user.uid,
      senderRole: 'admin',
      senderName,
      text: cleanText,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function markThreadReadByUser(userUid: string): Promise<void> {
  const path = `supportThreads/${userUid}`;
  try {
    await updateDoc(doc(db, 'supportThreads', userUid), {
      unreadByUser: false,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Ignore if thread does not exist yet or offline
  }
}

export async function markThreadReadByAdmin(threadUid: string): Promise<void> {
  const path = `supportThreads/${threadUid}`;
  try {
    await updateDoc(doc(db, 'supportThreads', threadUid), {
      unreadByAdmin: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function setSupportThreadStatus(
  threadUid: string,
  status: SupportThreadStatus,
): Promise<void> {
  const path = `supportThreads/${threadUid}`;
  try {
    await updateDoc(doc(db, 'supportThreads', threadUid), {
      status,
      unreadByAdmin: false,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
