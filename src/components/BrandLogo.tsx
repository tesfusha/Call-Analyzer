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
    <div
      style={{ width: size, height: size }}
      className={`rounded-[22%] overflow-hidden bg-[#02124F] border border-[#DDE4EA]/80 dark:border-white/25 shadow-sm shrink-0 flex items-center justify-center ${className}`}
    >
      <img
        src={BRAND_LOGO_SRC}
        alt="Call Analyzer - ETH logo"
        width={size}
        height={size}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover scale-[1.04]"
      />
    </div>
  );
}
