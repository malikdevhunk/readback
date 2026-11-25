import type { Entity } from './decode';
import { short } from './format';

/** Remove addresses and long hex from free text the user types, using known placeholders where possible. */
export function redactText(text: string, entities: Entity[]): { text: string; count: number } {
  let count = 0;
  const byAddr = new Map(entities.map((e) => [e.value.toLowerCase(), e.placeholder]));
  let out = text.replace(/0x[0-9a-fA-F]{40}/g, (a) => { count++; return byAddr.get(a.toLowerCase()) ?? '[ADDRESS]'; });
  out = out.replace(/0x[0-9a-fA-F]{16,}/g, () => { count++; return '[HEX_VALUE]'; });
  out = out.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, () => { count++; return '[EMAIL]'; });
  return { text: out, count };
}

export interface Piece { text: string; entity?: Entity }

/** Turn model output back into displayable pieces: placeholders become the real (short) address or name. */
export function rehydrate(text: string, entities: Entity[]): Piece[] {
  const map = new Map(entities.map((e) => [e.placeholder, e]));
  const parts = text.split(/(\[[A-Z_0-9]+\])/g);
  return parts.filter(Boolean).map((p) => {
    if (p === '[YOUR_WALLET]') return { text: 'your wallet' };
    const e = map.get(p);
    if (!e) return { text: p };
    return { text: e.placeholder === '[YOUR_WALLET]' ? 'your wallet' : e.label ?? short(e.value), entity: e };
  });
}

export function countRedactions(prompt: string): number {
  return (prompt.match(/\[[A-Z_0-9]+\]/g) ?? []).length;
}
