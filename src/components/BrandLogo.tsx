import { useState } from 'react';
import { Phone } from 'lucide-react';

export const BRAND_LOGO_SRC = '/logo.png';

export function BrandLogo({
  size = 36,
  className = '',
}: {
  size?: number;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        style={{ width: size, height: size }}
        className={`rounded-xl bg-[#08246B] border border-[#163B96] flex items-center justify-center text-[#FF6A00] shrink-0 ${className}`}
        aria-hidden="true"
      >
        <Phone size={Math.round(size * 0.52)} />
      </div>
    );
  }

  return (
    <img
      src={BRAND_LOGO_SRC}
      alt="Call Analyzer - ETH logo"
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      style={{ width: size, height: size }}
      className={`bg-transparent object-contain shrink-0 ${className}`}
    />
  );
}
