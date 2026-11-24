export type SmsLengthStats = {
  charCount: number;
  encoding: 'GSM-7' | 'UCS-2';
  smsSegments: number;
  charsPerSegment: number;
  remainingInSegment: number;
  isMultiSmsUnicode: boolean;
};

// Standard GSM 03.38 basic alphabet + LF/CR
const GSM7_BASIC_CHARS = new Set<string>([
  '@', '£', '$', '¥', 'è', 'é', 'ù', 'ì', 'ò', 'Ç', '\n', 'Ø', 'ø', '\r', 'Å', 'å',
  'Δ', '_', 'Φ', 'Γ', 'Λ', 'Ω', 'Π', 'Ψ', 'Σ', 'Θ', 'Ξ', 'Æ', 'æ', 'ß', 'É',
  ' ', '!', '"', '#', '¤', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '¡', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'Ä', 'Ö', 'Ñ', 'Ü', '§',
  '¿', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ä', 'ö', 'ñ', 'ü', 'à',
]);

// GSM 03.38 extension table characters cost 2 septets (escape + char)
const GSM7_EXT_CHARS = new Set<string>(['^', '{', '}', '\\', '[', '~', ']', '|', '€']);

export function measureSmsLength(text: string): SmsLengthStats {
  if (!text) {
    return {
      charCount: 0,
      encoding: 'GSM-7',
      smsSegments: 0,
      charsPerSegment: 160,
      remainingInSegment: 160,
      isMultiSmsUnicode: false,
    };
  }

  let isGsm7 = true;
  let gsm7Septets = 0;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (GSM7_BASIC_CHARS.has(ch)) {
      gsm7Septets += 1;
    } else if (GSM7_EXT_CHARS.has(ch)) {
      gsm7Septets += 2;
    } else {
      isGsm7 = false;
      break;
    }
  }

  if (isGsm7) {
    const singleLimit = 160;
    const concatLimit = 153;
    const smsSegments =
      gsm7Septets <= singleLimit ? 1 : Math.ceil(gsm7Septets / concatLimit);
    const charsPerSegment = smsSegments <= 1 ? singleLimit : concatLimit;
    const maxForSegments = smsSegments * charsPerSegment;
    return {
      charCount: gsm7Septets,
      encoding: 'GSM-7',
      smsSegments,
      charsPerSegment,
      remainingInSegment: Math.max(0, maxForSegments - gsm7Septets),
      isMultiSmsUnicode: false,
    };
  }

  const ucs2Units = text.length;
  const singleLimit = 70;
  const concatLimit = 67;
  const smsSegments =
    ucs2Units <= singleLimit ? 1 : Math.ceil(ucs2Units / concatLimit);
  const charsPerSegment = smsSegments <= 1 ? singleLimit : concatLimit;
  const maxForSegments = smsSegments * charsPerSegment;

  return {
    charCount: ucs2Units,
    encoding: 'UCS-2',
    smsSegments,
    charsPerSegment,
    remainingInSegment: Math.max(0, maxForSegments - ucs2Units),
    isMultiSmsUnicode: smsSegments > 1,
  };
}
