export const MAX_UINT256 = (1n << 256n) - 1n;
export const MAX_UINT160 = (1n << 160n) - 1n;
export const MAX_UINT48 = (1n << 48n) - 1n;

export function toBig(v: unknown): bigint | null {
  if (typeof v === 'bigint') return v;
  if (typeof v === 'number' && Number.isFinite(v)) return BigInt(Math.trunc(v));
  if (typeof v === 'string' && /^(0x[0-9a-f]+|\d+)$/i.test(v.trim())) {
    try { return BigInt(v.trim()); } catch { return null; }
  }
  return null;
}

/** "Unlimited" means the max value of the field type, or anything at or above 2^128. */
export function isUnlimited(v: bigint | null): boolean {
  if (v === null) return false;
  return v >= 1n << 128n;
}

export function short(addr: string): string {
  if (!/^0x[0-9a-fA-F]{40}$/.test(addr)) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function isAddress(v: unknown): v is string {
  return typeof v === 'string' && /^0x[0-9a-fA-F]{40}$/.test(v);
}

/** Seconds since epoch → readable date, or a phrase for "never". */
export function whenFromSeconds(v: bigint | null, now = Date.now()): { text: string; years: number; never: boolean; past: boolean } {
  if (v === null) return { text: 'no date given', years: 0, never: false, past: false };
  if (v === 0n) return { text: 'no expiry set', years: Infinity, never: true, past: false };
  if (v >= 32503680000n) return { text: 'never (date set after the year 3000)', years: Infinity, never: true, past: false };
  const ms = Number(v) * 1000;
  const years = (ms - now) / (365.25 * 24 * 3600 * 1000);
  const d = new Date(ms);
  const text = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  return { text, years, never: false, past: ms < now };
}

export function amountText(v: bigint | null, decimals?: number, symbol?: string): string {
  if (v === null) return 'an unreadable amount';
  if (isUnlimited(v)) return `unlimited${symbol ? ' ' + symbol : ''}`;
  if (decimals === undefined) return `${v.toLocaleString('en-US')} base units${symbol ? ' of ' + symbol : ''}`;
  const base = 10n ** BigInt(decimals);
  const whole = v / base;
  const frac = (v % base).toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '');
  if (v > 0n && whole === 0n && !frac) return `less than 0.0001${symbol ? '\u00a0' + symbol : ''}`;
  return `${whole.toLocaleString('en-US')}${frac ? '.' + frac : ''}${symbol ? '\u00a0' + symbol : ''}`;
}

export const DECIMALS: Record<string, number> = { USDC: 6, USDT: 6, DAI: 18, WETH: 18, WBTC: 8, UNI: 18 };
