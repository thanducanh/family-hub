const MOJIBAKE_PATTERN = /(Ã|Â|Ä|á»|áº|Æ|Ä‘|�|[\u0080-\u009f])/;
const VIETNAMESE_PATTERN = /[À-ỹĐđ]/;
const CP1252_REVERSE: Record<string, number> = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function mojibakeScore(value: string) {
  const markers = value.match(MOJIBAKE_PATTERN);
  const suspiciousGroups = value.match(/(?:Ã|Â|Ä|á»|áº|Æ|Ä‘|[\u0080-\u009f])/g);
  return (markers ? 3 : 0) + (suspiciousGroups?.length || 0);
}

function toMojibakeBytes(value: string) {
  const bytes: number[] = [];
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const mapped = CP1252_REVERSE[char];
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }
  return new Uint8Array(bytes);
}

function decodeUtf8(bytes: Uint8Array) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

function fixString(value: string) {
  if (!MOJIBAKE_PATTERN.test(value)) return value;
  let current = value;
  for (let index = 0; index < 2; index += 1) {
    const bytes = toMojibakeBytes(current);
    if (!bytes) break;
    const decoded = decodeUtf8(bytes);
    if (!decoded || decoded === current) break;
    const currentScore = mojibakeScore(current);
    const decodedScore = mojibakeScore(decoded);
    if (decodedScore < currentScore || (decodedScore === 0 && VIETNAMESE_PATTERN.test(decoded))) {
      current = decoded;
    } else {
      break;
    }
  }
  return current;
}

export function fixVietnameseMojibake(value: unknown): unknown {
  if (typeof value === "string") return fixString(value);
  if (!value || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(item => fixVietnameseMojibake(item));
  const fixed: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    fixed[key] = fixVietnameseMojibake(item);
  }
  return fixed;
}

export function fixVietnameseMojibakeString(value: unknown) {
  return String(fixVietnameseMojibake(String(value ?? "")));
}
