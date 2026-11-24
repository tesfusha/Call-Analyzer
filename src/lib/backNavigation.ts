import { useEffect, useRef, useState } from 'react';

export type BackHandlerEntry = {
  id: string;
  priority: number;
  order: number;
  onBack: () => void;
  hasUnsavedChanges?: () => boolean;
  unsavedMessage?: string;
};

export type DiscardPromptState = {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
};

type DiscardListener = (state: DiscardPromptState | null) => void;
type StackCountListener = (count: number) => void;

const backStack: BackHandlerEntry[] = [];
const discardListeners = new Set<DiscardListener>();
const stackCountListeners = new Set<StackCountListener>();

let nextOrder = 1;
let activeDiscardPrompt: DiscardPromptState | null = null;
let lastExitAttemptAt = 0;

function notifyStackCount() {
  const count = backStack.length;
  stackCountListeners.forEach((listener) => listener(count));
}

function setDiscardPrompt(next: DiscardPromptState | null) {
  activeDiscardPrompt = next;
  discardListeners.forEach((listener) => listener(next));
}

export function getBackStackCount(): number {
  return backStack.length;
}

export function upsertBackEntry(
  id: string,
  opts: {
    priority?: number;
    onBack: () => void;
    hasUnsavedChanges?: () => boolean;
    unsavedMessage?: string;
  },
) {
  const existingIdx = backStack.findIndex((entry) => entry.id === id);
  const priority = opts.priority ?? 50;
  if (existingIdx >= 0) {
    backStack[existingIdx] = {
      ...backStack[existingIdx],
      priority,
      onBack: opts.onBack,
      hasUnsavedChanges: opts.hasUnsavedChanges,
      unsavedMessage: opts.unsavedMessage,
    };
  } else {
    backStack.push({
      id,
      priority,
      order: nextOrder++,
      onBack: opts.onBack,
      hasUnsavedChanges: opts.hasUnsavedChanges,
      unsavedMessage: opts.unsavedMessage,
    });
    notifyStackCount();
  }
}

export function removeBackEntry(id: string) {
  const idx = backStack.findIndex((entry) => entry.id === id);
  if (idx >= 0) {
    backStack.splice(idx, 1);
    notifyStackCount();
  }
}

function getTopBackEntry(): BackHandlerEntry | null {
  if (backStack.length === 0) return null;
  let top = backStack[0];
  for (let i = 1; i < backStack.length; i++) {
    const candidate = backStack[i];
    if (
      candidate.priority > top.priority ||
      (candidate.priority === top.priority && candidate.order > top.order)
    ) {
      top = candidate;
    }
  }
  return top;
}

export function useBackHandler({
  id,
  active,
  onBack,
  hasUnsavedChanges,
  unsavedMessage = 'You have unsaved changes. Discard them and go back?',
  priority = 50,
}: {
  id: string;
  active: boolean;
  onBack: () => void;
  hasUnsavedChanges?: () => boolean;
  unsavedMessage?: string;
  priority?: number;
}) {
  const onBackRef = useRef(onBack);
  const hasUnsavedRef = useRef(hasUnsavedChanges);
  const messageRef = useRef(unsavedMessage);

  useEffect(() => {
    onBackRef.current = onBack;
    hasUnsavedRef.current = hasUnsavedChanges;
    messageRef.current = unsavedMessage;
  }, [onBack, hasUnsavedChanges, unsavedMessage]);

  useEffect(() => {
    if (!active) {
      removeBackEntry(id);
      return;
    }
    upsertBackEntry(id, {
      priority,
      onBack: () => onBackRef.current(),
      hasUnsavedChanges: () => Boolean(hasUnsavedRef.current?.()),
      unsavedMessage: messageRef.current,
    });
    return () => {
      removeBackEntry(id);
    };
  }, [active, id, priority]);
}

export function useDiscardPrompt(): DiscardPromptState | null {
  const [prompt, setPrompt] = useState<DiscardPromptState | null>(activeDiscardPrompt);

  useEffect(() => {
    discardListeners.add(setPrompt);
    return () => {
      discardListeners.delete(setPrompt);
    };
  }, []);

  return prompt;
}

export function subscribeBackStackCount(listener: StackCountListener): () => void {
  stackCountListeners.add(listener);
  return () => {
    stackCountListeners.delete(listener);
  };
}

export type BackDispatchResult = 'handled' | 'exit-warning' | 'exit-now';

export function dispatchBackNavigation({
  isLocked,
  onMinimizeApp,
  canStepBackTab,
  stepBackTab,
  showExitToast,
  onExitApp,
}: {
  isLocked: boolean;
  onMinimizeApp: () => void;
  canStepBackTab: () => boolean;
  stepBackTab: () => void;
  showExitToast: () => void;
  onExitApp: () => void;
}): BackDispatchResult {
  // 1. If a discard-changes confirmation dialog is currently open, Back cancels it safely.
  if (activeDiscardPrompt) {
    activeDiscardPrompt.onCancel();
    return 'handled';
  }

  // 2. Never bypass App Lock on Back — minimize app cleanly instead.
  if (isLocked) {
    onMinimizeApp();
    return 'handled';
  }

  // 3. Close top registered modal, drawer, popover, or sub-screen.
  const top = getTopBackEntry();
  if (top) {
    if (top.hasUnsavedChanges?.()) {
      const targetBack = top.onBack;
      const message =
        top.unsavedMessage || 'You have unsaved changes. Discard them and go back?';
      setDiscardPrompt({
        open: true,
        message,
        onConfirm: () => {
          setDiscardPrompt(null);
          targetBack();
        },
        onCancel: () => {
          setDiscardPrompt(null);
        },
      });
      return 'handled';
    }
    top.onBack();
    return 'handled';
  }

  // 4. Step back through tab navigation history.
  if (canStepBackTab()) {
    stepBackTab();
    return 'handled';
  }

  // 5. On the root tab with no history, require double-back within 2 seconds to exit.
  const now = Date.now();
  if (now - lastExitAttemptAt <= 2000) {
    lastExitAttemptAt = 0;
    onExitApp();
    return 'exit-now';
  }

  lastExitAttemptAt = now;
  showExitToast();
  return 'exit-warning';
}

export function resetExitBackTimer() {
  lastExitAttemptAt = 0;
}
