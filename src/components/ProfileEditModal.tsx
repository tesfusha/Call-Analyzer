import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Check,
  KeyRound,
  Lock,
  Phone,
  Share2,
  User,
  X,
} from 'lucide-react';
import { CategoryPanel, CategoryTabs, type CategoryItem } from '@/src/components/CategoryTabs';
import {
  ALOHE_AVATARS,
  AVATAR_COLLECTIONS,
  type AvatarCollection,
} from '@/src/lib/avatars';
import { shareContactVcard } from '@/src/lib/export';
import { firstGraphemes } from '@/src/lib/format';
import { useBackHandler } from '@/src/lib/backNavigation';
import { useLockBodyScroll } from '@/src/lib/useLockBodyScroll';
import { useCalls } from '@/src/store/CallsContext';

type ProfileTab = 'profile' | 'avatar' | 'password';

export function ProfileEditModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const {
    authUser,
    authProvider,
    profileName,
    userPhone,
    userPhotoUrl,
    updateUserProfile,
    changeUserPassword,
    showNotice,
  } = useCalls();

  useLockBodyScroll(open);
  const prefersReducedMotion = useReducedMotion();
  const bodyScrollRef = useRef<HTMLDivElement>(null);

  const resolvedCurrentName =
    profileName?.trim() || authUser?.displayName?.trim() || authUser?.email?.split('@')[0] || '';
  const resolvedCurrentPhoto = userPhotoUrl || authUser?.photoURL || null;

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [avatarCollection, setAvatarCollection] = useState<AvatarCollection | 'all'>('vibrent');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setActiveTab('profile');
    setDisplayName(resolvedCurrentName);
    setPhone(userPhone ?? '');
    setSelectedPhotoUrl(resolvedCurrentPhoto);
    setProfileError(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
  }, [open, resolvedCurrentName, userPhone, resolvedCurrentPhoto]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useBackHandler({
    id: 'profile-edit-modal',
    active: open,
    priority: 55,
    onBack: onClose,
    hasUnsavedChanges: () =>
      displayName !== resolvedCurrentName ||
      phone !== (userPhone ?? '') ||
      selectedPhotoUrl !== resolvedCurrentPhoto ||
      Boolean(currentPassword || newPassword || confirmPassword),
    unsavedMessage: 'Discard unsaved profile changes?',
  });

  useEffect(() => {
    if (bodyScrollRef.current) {
      bodyScrollRef.current.scrollTop = 0;
    }
  }, [activeTab, open]);

  const filteredAvatars = useMemo(() => {
    if (avatarCollection === 'all') return ALOHE_AVATARS;
    return ALOHE_AVATARS.filter((item) => item.collection === avatarCollection);
  }, [avatarCollection]);

  const handleSaveProfile = async () => {
    setProfileError(null);
    if (!displayName.trim()) {
      setProfileError('Enter a username or display name.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await updateUserProfile({
        displayName: displayName.trim(),
        phone: phone.trim() || null,
        photoURL: selectedPhotoUrl,
      });
      if (!res.ok) {
        setProfileError(res.error || 'Could not update profile.');
        return;
      }
      onClose();
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setSavingPassword(true);
    try {
      const res = await changeUserPassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });
      if (!res.ok) {
        setPasswordError(res.error || 'Could not change password.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onClose();
    } finally {
      setSavingPassword(false);
    }
  };

  const handleQuickShareMyCard = async () => {
    const shareName = displayName.trim() || resolvedCurrentName || 'Call Analyzer User';
    const sharePhone = phone.trim() || userPhone?.trim() || '';
    if (!sharePhone && !authUser?.email) {
      showNotice('Add your phone number first to share your contact card.', 'warning');
      return;
    }
    const mode = await shareContactVcard({
      name: shareName,
      number: sharePhone,
      email: authUser?.email ?? null,
    });
    if (mode === 'copied') {
      showNotice('Contact details copied to clipboard.', 'success');
    } else if (mode === 'native') {
      showNotice('Contact card saved & share opened.', 'success');
    } else {
      showNotice('Shared your contact card.', 'success');
    }
  };

  const categories: Array<CategoryItem<ProfileTab>> = [
    { key: 'profile', label: 'Profile', icon: User },
    { key: 'avatar', label: 'Avatar', flaticon: 'fi-rr-portrait' },
    { key: 'password', label: 'Password', icon: KeyRound },
  ];

  const activeHeading =
    activeTab === 'profile'
      ? 'Username, Phone & Quick Share'
      : activeTab === 'avatar'
        ? 'Choose Profile Avatar'
        : 'Account Password';

  const modalNode = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="profile-edit-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.1 : 0.18 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#08246B]/55 dark:bg-black/75 p-0 sm:p-4 overscroll-contain"
          onClick={onClose}
        >
          <motion.div
            key="profile-edit-dialog"
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.985 }}
            transition={{ duration: prefersReducedMotion ? 0.12 : 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] flex flex-col max-h-[90dvh] overflow-hidden shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Edit Account Profile"
          >
            {/* Pinned Header */}
            <div className="shrink-0 p-5 pb-3.5 border-b border-[#DDE4EA] dark:border-[var(--dark-border)] space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {selectedPhotoUrl ? (
                    <img
                      src={selectedPhotoUrl}
                      alt={displayName || 'Profile avatar'}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-full object-cover border border-[#DDE4EA] dark:border-[var(--dark-border)] shrink-0 bg-[#EEF2F6] dark:bg-[var(--dark-canvas)]"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#FF6A00] text-white text-base font-bold flex items-center justify-center shrink-0">
                      {firstGraphemes(displayName || authUser?.email || 'U', 1).toLocaleUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-[#08246B] dark:text-white truncate">
                      {displayName.trim() || 'Edit Profile'}
                    </h2>
                    <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] truncate">
                      {authUser?.email || 'Account profile & avatar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleQuickShareMyCard()}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#08246B] dark:text-white hover:border-[#FF6A00] flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Share2 size={14} className="text-[#FF6A00]" />
                    Share card
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close profile editor"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:bg-[#EEF2F6] dark:hover:bg-[var(--dark-elevated)]"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              <CategoryTabs
                items={categories}
                activeKey={activeTab}
                onChange={setActiveTab}
                ariaLabel="Profile editor sections"
                variant="inset"
              />
            </div>

            {/* Scrollable Body */}
            <div ref={bodyScrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pb-5">
              <CategoryPanel activeKey={activeTab} label={activeHeading} transitionStyle="fade" className="space-y-4">
                <div className="pb-2 border-b border-[#DDE4EA]/70 dark:border-[var(--dark-border)]">
                  <h3 className="text-sm font-bold text-[#08246B] dark:text-white">
                    {activeHeading}
                  </h3>
                </div>

                {activeTab === 'profile' && (
                  <div className="space-y-4">
                    {profileError && (
                      <div className="rounded-xl bg-[#FEE2E2] dark:bg-[#EF4444]/15 border border-[#FCA5A5] dark:border-[#EF4444]/40 px-3.5 py-2.5 text-xs font-medium text-[#DC2626] dark:text-[#FCA5A5]">
                        {profileError}
                      </div>
                    )}

                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                        Username / Display name
                      </span>
                      <input
                        type="text"
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        maxLength={120}
                        placeholder="Your name"
                        className="w-full min-h-[44px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                      />
                    </label>

                    <label className="block space-y-1.5">
                      <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] flex items-center gap-1.5">
                        <Phone size={13} className="text-[#FF6A00]" />
                        Phone number
                      </span>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        maxLength={40}
                        placeholder="+251 9XX XXX XXX"
                        className="w-full min-h-[44px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2 text-sm font-mono tabular-nums text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                      />
                    </label>

                    <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-xs font-semibold text-[#08246B] dark:text-white">
                          Quick Contact Share (.vcf)
                        </p>
                        <p className="text-[11px] text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                          Instantly share your name, phone number, and email as a contact card.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleQuickShareMyCard()}
                        className="min-h-[42px] px-4 py-2 rounded-xl bg-[#08246B] hover:bg-[#0D328E] dark:bg-[#FF6A00] dark:hover:bg-[#E65F00] text-xs font-semibold text-white flex items-center gap-1.5 whitespace-nowrap shrink-0"
                      >
                        <Share2 size={14} />
                        Share My Contact
                      </button>
                    </div>
                  </div>
                )}

                {activeTab === 'avatar' && (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {AVATAR_COLLECTIONS.map((col) => {
                          const active = avatarCollection === col.key;
                          return (
                            <button
                              key={col.key}
                              type="button"
                              onClick={() => setAvatarCollection(col.key)}
                              className={`min-h-[34px] px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                                active
                                  ? 'bg-[#FF6A00] text-white'
                                  : 'bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#08246B] dark:hover:text-white'
                              }`}
                            >
                              {col.label}
                            </button>
                          );
                        })}
                      </div>

                      {selectedPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setSelectedPhotoUrl(null)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#DDE4EA] dark:border-[var(--dark-border)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)] hover:text-[#DC2626]"
                        >
                          Use initials
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
                      {filteredAvatars.map((avatar) => {
                        const selected = selectedPhotoUrl === avatar.url;
                        return (
                          <button
                            key={avatar.id}
                            type="button"
                            onClick={() => setSelectedPhotoUrl(avatar.url)}
                            aria-label={`Select ${avatar.label} avatar`}
                            className={`relative aspect-square rounded-2xl p-1.5 border transition-colors flex items-center justify-center bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] ${
                              selected
                                ? 'border-[#FF6A00] ring-2 ring-[#FF6A00]/30'
                                : 'border-[#DDE4EA] dark:border-[var(--dark-border)] hover:border-[#FF6A00]/60'
                            }`}
                          >
                            <img
                              src={avatar.url}
                              alt={avatar.label}
                              loading="lazy"
                              className="w-full h-full rounded-xl object-cover"
                            />
                            {selected && (
                              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#FF6A00] text-white flex items-center justify-center shadow">
                                <Check size={12} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-[11px] text-[#8A93A0] dark:text-[var(--dark-text-muted)]">
                      Tap an avatar and press Save Profile below to apply across your account.
                    </p>
                  </div>
                )}

                {activeTab === 'password' && (
                  <div className="space-y-4">
                    {authProvider === 'google' ? (
                      <div className="rounded-2xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-4 flex items-start gap-3">
                        <Lock size={18} className="text-[#FF6A00] shrink-0 mt-0.5" />
                        <div className="space-y-1 text-xs">
                          <p className="font-semibold text-[#08246B] dark:text-white">
                            Signed in with Google
                          </p>
                          <p className="text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Your password and security credentials are managed in your Google Account settings. You can still update your display name, phone number, and avatar on the other tabs.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <form onSubmit={(e) => void handleChangePassword(e)} className="space-y-3.5">
                        {passwordError && (
                          <div className="rounded-xl bg-[#FEE2E2] dark:bg-[#EF4444]/15 border border-[#FCA5A5] dark:border-[#EF4444]/40 px-3.5 py-2.5 text-xs font-medium text-[#DC2626] dark:text-[#FCA5A5]">
                            {passwordError}
                          </div>
                        )}

                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Current password
                          </span>
                          <input
                            type="password"
                            required
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            placeholder="Enter current password"
                            className="w-full min-h-[44px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                          />
                        </label>

                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            New password (min 6 characters)
                          </span>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            placeholder="Enter new password"
                            className="w-full min-h-[44px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                          />
                        </label>

                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]">
                            Confirm new password
                          </span>
                          <input
                            type="password"
                            required
                            minLength={6}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter new password"
                            className="w-full min-h-[44px] rounded-xl bg-[#EEF2F6] dark:bg-[var(--dark-canvas)] border border-[#DDE4EA] dark:border-[var(--dark-border)] px-3.5 py-2 text-sm text-[#08246B] dark:text-white focus:outline-none focus:border-[#FF6A00]"
                          />
                        </label>

                        <button
                          type="submit"
                          disabled={savingPassword}
                          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center justify-center gap-1.5"
                        >
                          <KeyRound size={14} />
                          {savingPassword ? 'Updating password...' : 'Update password'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </CategoryPanel>
            </div>

            {/* Pinned Footer for Profile & Avatar Tabs */}
            {activeTab !== 'password' && (
              <div className="shrink-0 flex items-center justify-end gap-2 px-5 pt-3.5 pb-[calc(0.875rem+env(safe-area-inset-bottom))] sm:pb-3.5 border-t border-[#DDE4EA] dark:border-[var(--dark-border)] bg-[#F5F7FA]/90 dark:bg-[var(--dark-canvas)]/90">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-[#DDE4EA] dark:border-[var(--dark-border)] bg-white dark:bg-[var(--dark-surface)] text-xs font-semibold text-[#4B5563] dark:text-[var(--dark-text-secondary)]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingProfile}
                  onClick={() => void handleSaveProfile()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] disabled:opacity-50 text-xs font-semibold text-white flex items-center gap-1.5"
                >
                  <Check size={14} />
                  {savingProfile ? 'Saving...' : 'Save profile'}
                </button>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (typeof document === 'undefined') return modalNode;
  return createPortal(modalNode, document.body);
}
