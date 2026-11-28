import { User } from 'lucide-react';
import { avatarColor, initials } from '@/src/lib/format';

export type ContactAvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const SIZE_CLASSES: Record<ContactAvatarSize, string> = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-11 h-11 text-sm',
  xl: 'w-12 h-12 text-base',
};

const ICON_SIZES: Record<ContactAvatarSize, number> = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 18,
  xl: 20,
};

/**
 * Renders 2-letter uppercase initials for named contacts (e.g. "Abel" -> "AB"),
 * or a clean User icon on a neutral slate circle when only a phone number exists
 * (never "+2" or trailing digits).
 */
export function ContactAvatar({
  name,
  number,
  colorKey,
  size = 'md',
  className = '',
}: {
  name?: string | null;
  number: string;
  colorKey?: string;
  size?: ContactAvatarSize;
  className?: string;
}) {
  const label = initials(name, number);
  const sizeClass = SIZE_CLASSES[size];

  if (!label) {
    return (
      <span
        aria-hidden="true"
        className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white bg-[#64748B] dark:bg-[#475569] shrink-0 select-none ${className}`.trim()}
      >
        <User size={ICON_SIZES[size]} strokeWidth={2.2} />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold text-white shrink-0 select-none ${className}`.trim()}
      style={{ backgroundColor: avatarColor(colorKey ?? number) }}
    >
      {label}
    </span>
  );
}
