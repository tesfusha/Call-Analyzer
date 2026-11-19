import { useState } from 'react';
import { Check, Copy, Download, ExternalLink, Smartphone, WifiOff, X } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '@/src/hooks/usePWAInstall';

export function PWAInstallButton({
  variant = 'button',
}: {
  variant?: 'button' | 'card' | 'compact';
}) {
  const { isInstallable, isInstalled, isIOS, isInIframe, install } = usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = async () => {
    if (!currentUrl || typeof navigator === 'undefined' || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  if (variant === 'compact') {
    if (isInstalled || !isInstallable) return null;
    return (
      <button
        type="button"
        onClick={() => void install()}
        aria-label="Install app on phone"
        title="Install app"
        className="min-h-[44px] px-2.5 flex items-center justify-center gap-1 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
      >
        <Download size={14} />
        <span className="hidden xs:inline">Install</span>
      </button>
    );
  }

  if (variant === 'button') {
    if (isInstalled) return null;
    if (!isInstallable && !isIOS) return null;

    return (
      <>
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              void install();
            } else {
              setGuideOpen(true);
            }
          }}
          className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center justify-center gap-2 whitespace-nowrap transition-colors"
        >
          <Download size={15} />
          {isInstallable ? 'Install App' : 'Install on iOS'}
        </button>

        {guideOpen && (
          <InstallGuideModal
            isIOS={isIOS}
            isInIframe={isInIframe}
            currentUrl={currentUrl}
            copiedUrl={copiedUrl}
            onCopyUrl={handleCopyUrl}
            onClose={() => setGuideOpen(false)}
          />
        )}
      </>
    );
  }

  return (
    <div className="rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center shrink-0">
            <Smartphone size={18} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#08246B] dark:text-white">
              Install App on Your Phone (PWA)
            </h2>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
              {isInstalled
                ? 'Installed and running in standalone app mode'
                : isInstallable
                  ? 'Ready to install directly on your home screen with offline support'
                  : isInIframe
                    ? 'Open the app directly in Chrome (outside the AI Studio preview frame) to install on your home screen'
                    : 'Add to your home screen via Chrome or Safari for a full-screen offline app'}
            </p>
          </div>
        </div>

        {!isInstalled && (
          <div className="flex flex-wrap items-center gap-2">
            {isInstallable ? (
              <button
                type="button"
                onClick={() => void install()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download size={15} />
                Install App
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)] flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <Download size={15} className="text-[#FF6A00]" />
                How to install
              </button>
            )}
          </div>
        )}
      </div>

      {guideOpen && (
        <InstallGuideModal
          isIOS={isIOS}
          isInIframe={isInIframe}
          currentUrl={currentUrl}
          copiedUrl={copiedUrl}
          onCopyUrl={handleCopyUrl}
          onClose={() => setGuideOpen(false)}
        />
      )}
    </div>
  );
}

function InstallGuideModal({
  isIOS,
  isInIframe,
  currentUrl,
  copiedUrl,
  onCopyUrl,
  onClose,
}: {
  isIOS: boolean;
  isInIframe: boolean;
  currentUrl: string;
  copiedUrl: boolean;
  onCopyUrl: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Install app on phone"
    >
      <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-[#08246B] dark:text-white">
            {isIOS ? 'Install on iPhone / iPad' : 'Install on Android Phone'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close install guide"
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            <X size={18} />
          </button>
        </div>

        {isIOS ? (
          <ol className="space-y-2 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] list-decimal pl-4">
            <li>Open this app directly in Safari (not inside an embedded preview frame).</li>
            <li>Tap the Share button in Safari&apos;s toolbar.</li>
            <li>Scroll down and tap Add to Home Screen.</li>
          </ol>
        ) : (
          <ol className="space-y-2 text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] list-decimal pl-4">
            {isInIframe && (
              <li>
                You are currently inside an embedded preview frame. Open the app URL directly in a normal Chrome tab first (or tap Share in AI Studio to get the direct link).
              </li>
            )}
            <li>Open the direct app URL in Android Chrome.</li>
            <li>Tap the Chrome menu (⋮) and choose Install app (or Add to Home screen → Install).</li>
          </ol>
        )}

        {currentUrl && (
          <div className="space-y-2">
            <div className="rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-3 flex items-center justify-between gap-2">
              <span className="text-[11px] font-mono text-[#08246B] dark:text-white truncate">
                {currentUrl}
              </span>
              <button
                type="button"
                onClick={onCopyUrl}
                className="min-h-[36px] px-3 rounded-lg bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                {copiedUrl ? <Check size={13} /> : <Copy size={13} />}
                {copiedUrl ? 'Copied' : 'Copy URL'}
              </button>
            </div>
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full min-h-[42px] px-4 py-2 rounded-xl bg-[#2B2E34] dark:bg-[var(--dark-elevated)] hover:opacity-90 text-xs font-semibold text-white flex items-center justify-center gap-1.5 whitespace-nowrap"
            >
              <ExternalLink size={14} />
              Open direct Chrome tab
            </a>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 z-40 flex items-center gap-2 rounded-xl bg-[#2B2E34] dark:bg-[var(--dark-surface)] border border-[#FF6A00] px-3 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff size={14} className="text-[#FF6A00]" />
      <span>Offline Mode — Local data active</span>
    </div>
  );
}
