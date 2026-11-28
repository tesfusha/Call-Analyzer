import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Database,
  Fingerprint,
  Lock,
  ShieldCheck,
  Smartphone,
  Trash2,
  X,
} from 'lucide-react';
import { APP_CONTACT_EMAIL, APP_NAME, APP_VERSION } from '@/src/lib/appInfo';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';

export function PrivacyPolicyModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useBackHandler({
    id: 'privacy-policy-modal',
    active: open,
    priority: 72,
    onBack: onClose,
  });

  const modalNode = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="privacy-policy-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.08 : 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
        >
          <motion.div
            key="privacy-policy-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.1 : 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Privacy Policy"
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col max-h-[88dvh] overflow-hidden shadow-xl"
          >
            {/* Header */}
            <div className="shrink-0 px-5 py-4 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#10B981]/15 text-[#10B981] flex items-center justify-center shrink-0">
                  <ShieldCheck size={19} />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-[#08246B] dark:text-white truncate">
                    Privacy Policy
                  </h2>
                  <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                    {APP_NAME} · v{APP_VERSION}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close Privacy Policy"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 space-y-4 text-xs leading-relaxed text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              <div className="rounded-xl bg-[#10B981]/10 border border-[#10B981]/30 p-3.5 text-[#065F46] dark:text-[#6EE7B7]">
                <p className="font-semibold">
                  Your call logs, contacts, notes, and schedules never leave your device.
                </p>
                <p className="mt-1 opacity-90">
                  We built {APP_NAME} with local-first storage so your private communication history stays strictly on your phone — never uploaded, never sold, and never shared with third parties.
                </p>
              </div>

              <section className="space-y-1.5">
                <h3 className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                  <Smartphone size={14} className="text-[#FF6A00]" />
                  1. On-Device Data (Stored Locally Only)
                </h3>
                <p>
                  All imported or synced call history, phonebook contacts, birthdays, notes, tags, call reminders, streaks, scores, and PIN hashes are stored strictly inside your device&apos;s private IndexedDB storage, isolated per signed-in user ID.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                  <Database size={14} className="text-[#FF6A00]" />
                  2. Minimal Cloud Account Data
                </h3>
                <p>
                  When you sign in with Google or Email, Firebase Authentication secures your account. Only your display name, email, optional phone number, avatar choice, theme/tariff/calendar preferences, and support chat messages you voluntarily send are stored in your private Firebase workspace.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                  <Lock size={14} className="text-[#FF6A00]" />
                  3. Android Permissions We Request
                </h3>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong className="text-[#08246B] dark:text-white">Call Log &amp; Phone State:</strong> Used solely on-device to analyze call durations, detect unreturned missed calls, and estimate Ethio Telecom / Safaricom ETB costs.
                  </li>
                  <li>
                    <strong className="text-[#08246B] dark:text-white">Contacts:</strong> Used on-device to match caller names, birthdays, and relationship milestones.
                  </li>
                  <li>
                    <strong className="text-[#08246B] dark:text-white">Notifications &amp; Alarms:</strong> Used to deliver your scheduled callback, birthday, holiday, and missed-call follow-up alerts on time.
                  </li>
                </ul>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                  <Fingerprint size={14} className="text-[#FF6A00]" />
                  4. Biometric &amp; PIN Protection
                </h3>
                <p>
                  Fingerprint App Lock and Fingerprint Sign-In use the Android Keystore hardware-backed security module. Your fingerprint data never leaves Android&apos;s secure enclave, and your 4-digit PIN is stored only as a salted cryptographic hash.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-xs font-bold text-[#08246B] dark:text-white flex items-center gap-1.5">
                  <Trash2 size={14} className="text-[#FF6A00]" />
                  5. Export &amp; Permanent Account Deletion
                </h3>
                <p>
                  You can export a full local backup (JSON, CSV, Excel, or PDF) or delete all local device data at any time in <strong>Settings → Data &amp; Backup</strong>. You can also permanently delete your account and cloud profile from <strong>Settings → Data &amp; Backup → Delete my account</strong>.
                </p>
                <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)] pt-1">
                  Questions? Contact us at{' '}
                  <a
                    href={`mailto:${APP_CONTACT_EMAIL}`}
                    className="font-semibold text-[#FF6A00] hover:underline"
                  >
                    {APP_CONTACT_EMAIL}
                  </a>
                  .
                </p>
              </section>
            </div>

            {/* Footer */}
            <div className="shrink-0 px-5 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/90 dark:bg-[var(--dark-canvas)]/90 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white transition-colors"
              >
                Got it
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalNode;
  return createPortal(modalNode, document.body);
}
