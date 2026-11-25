import { lookup, CHAINS } from './known';
import {
  toBig, isUnlimited, short, isAddress, whenFromSeconds, amountText, DECIMALS,
  MAX_UINT160,
} from './format';

export type Level = 'danger' | 'caution' | 'routine';
export type Severity = 'critical' | 'high' | 'caution' | 'info';
export type Tone = 'danger' | 'caution' | 'addr' | 'name' | undefined;

export interface Segment { text: string; tone?: Tone; title?: string }
export interface Flag { severity: Severity; title: string; detail: string; evidence?: string }
export interface Field { label: string; value: string; mono?: boolean }
export interface Entity { placeholder: string; value: string; label?: string }

export interface Readback {
  format: 'typed-data' | 'transaction' | 'calldata' | 'message';
  kind: string;
  level: Level;
  sentence: Segment[];
  flags: Flag[];
  fields: Field[];
  /** Facts for the model. Uses placeholders only; never raw addresses or hex. */
  facts: string[];
  entities: Entity[];
  /** Untrusted free text quoted from the request (for the model, clearly labelled). */
  quoted?: string;
}

export class DecodeError extends Error {
  constructor(message: string, public hint?: string) { super(message); }
}

/* ---------- entity registry: one placeholder per distinct address ---------- */
class Entities {
  list: Entity[] = [];
  private byAddr = new Map<string, Entity>();
  private counters = new Map<string, number>();
  constructor(private owner?: string) {}
  get(addr: string, role: string): Entity {
    const key = addr.toLowerCase();
    const hit = this.byAddr.get(key);
    if (hit) return hit;
    let placeholder: string;
    if (this.owner && key === this.owner.toLowerCase()) placeholder = '[YOUR_WALLET]';
    else {
      const n = (this.counters.get(role) ?? 0) + 1;
      this.counters.set(role, n);
      placeholder = n === 1 ? `[${role}]` : `[${role}_${n}]`;
    }
    const known = lookup(addr);
    const e: Entity = { placeholder, value: addr, label: known?.name };
    this.byAddr.set(key, e);
    this.list.push(e);
    return e;
  }
  /** How the model sees an address: public contract names are fine, private ones are placeholders. */
  ref(addr: string, role: string): string {
    const e = this.get(addr, role);
    return e.label ?? e.placeholder; // public contract names are safe to share; private addresses stay placeholders
  }
}

function addrSeg(addr: string): Segment {
  const k = lookup(addr);
  return k ? { text: k.name, tone: 'name', title: addr } : { text: short(addr), tone: 'addr', title: addr };
}

function tokenInfo(addr: string) {
  const k = lookup(addr);
  const symbol = k?.kind === 'token' ? k.name : undefined;
  return { symbol, decimals: symbol ? DECIMALS[symbol] : undefined };
}

/** "until 3 Jan 2031" or "with no end date", as sentence segments. */
function untilSegs(w: ReturnType<typeof whenFromSeconds>, lead: string): Segment[] {
  if (w.never) return [{ text: lead.replace(/,? until $/, '') + ', ' }, { text: 'with no end date', tone: 'caution' }, { text: '.' }];
  return [{ text: lead }, { text: w.text, tone: w.years > 1 ? 'caution' : undefined }, { text: '.' }];
}

function levelOf(flags: Flag[]): Level {
  if (flags.some((f) => f.severity === 'critical' || f.severity === 'high')) return 'danger';
  if (flags.some((f) => f.severity === 'caution')) return 'caution';
  return 'routine';
}

function chainName(id: unknown): string | undefined {
  const b = toBig(id);
  return b === null ? undefined : CHAINS[b.toString()] ?? `chain ${b.toString()}`;
}

/* --------------------------------- entry ---------------------------------- */
export function decode(raw: string, opts: { site?: string; now?: number } = {}): Readback {
  const text = raw.trim();
  if (!text) throw new DecodeError('Paste a signature request first.');
  if (text.startsWith('{') || text.startsWith('[')) {
    let json: unknown;
    try { json = JSON.parse(text); }
    catch (e) {
      const m = /position (\d+)/.exec(String(e));
      throw new DecodeError('That looks like JSON but it does not parse.', m ? `Check near character ${m[1]}. Copy the whole request, including the last closing brace.` : 'Copy the whole request, including the last closing brace.');
    }
    // eth_signTypedData_v4 params are sometimes pasted as [address, typedData].
    if (Array.isArray(json)) {
      const td = json.find((x) => x && typeof x === 'object') ?? (typeof json[1] === 'string' ? safeParse(json[1]) : undefined);
      const owner = json.find(isAddress);
      if (td) return typedData(td as TypedData, opts, owner);
      throw new DecodeError('This list does not contain typed data.', 'Paste the object that has domain, types, primaryType and message.');
    }
    const o = json as Record<string, unknown>;
    if ('primaryType' in o && 'message' in o) return typedData(o as unknown as TypedData, opts);
    if ('data' in o || 'input' in o) return transaction(o, opts);
    throw new DecodeError('Readback does not recognise this JSON.', 'It reads EIP-712 typed data (domain, types, primaryType, message) and transactions (to, data, value).');
  }
  if (/^0x[0-9a-fA-F]*$/.test(text)) {
    if (text.length === 66) return blindHash(text);
    if (text.length >= 10) return transaction({ data: text }, opts);
    throw new DecodeError('That hex is too short to be a call.', 'Calldata starts with a 4-byte selector, for example 0x095ea7b3.');
  }
  return message(text, opts);
}

function safeParse(s: string): unknown { try { return JSON.parse(s); } catch { return undefined; } }

/* ------------------------------ typed data -------------------------------- */
interface TypedData {
  domain?: Record<string, unknown>;
  types?: Record<string, unknown>;
  primaryType: string;
  message: Record<string, unknown>;
}

function typedData(td: TypedData, opts: { site?: string; now?: number }, ownerHint?: string): Readback {
  const m = td.message ?? {};
  const d = td.domain ?? {};
  const owner = (isAddress(m.owner) && m.owner) || (isAddress(m.offerer) && m.offerer) || ownerHint;
  const ents = new Entities(owner as string | undefined);
  if (owner) ents.get(owner as string, 'YOUR_WALLET');
  const flags: Flag[] = [];
  const facts: string[] = [];
  const fields: Field[] = [];
  const verifying = isAddress(d.verifyingContract) ? d.verifyingContract : undefined;
  const chain = chainName(d.chainId);

  fields.push({ label: 'Signature type', value: `EIP-712 typed data, primaryType ${td.primaryType}` });
  if (d.name) fields.push({ label: 'Domain name', value: String(d.name) });
  if (chain) fields.push({ label: 'Chain', value: chain });
  if (verifying) fields.push({ label: 'Verifying contract', value: verifying, mono: true });
  if (chain) facts.push(`Network: ${chain}.`);
  if (verifying) facts.push(`The signature is checked by the contract ${ents.ref(verifying, 'CONTRACT')}.`);
  if (!d.chainId) flags.push({ severity: 'caution', title: 'No chain in the domain', detail: 'Without a chainId the same signature can be replayed on other networks.', evidence: 'domain.chainId is missing' });

  if (opts.site) siteCheck(opts.site, String(d.name ?? ''), flags, facts);

  const pt = td.primaryType;
  const now = opts.now ?? Date.now();
  let kind = pt;
  let sentence: Segment[] = [];

  const vk = verifying ? lookup(verifying) : undefined;
  const isPermit2 = vk?.name === 'Uniswap Permit2' || String(d.name) === 'Permit2';

  if (pt === 'Permit' && 'spender' in m && 'value' in m) {
    kind = 'Token permit (EIP-2612)';
    const token = verifying ?? '';
    const { symbol, decimals } = tokenInfo(token);
    const value = toBig(m.value);
    const deadline = whenFromSeconds(toBig(m.deadline), now);
    const spender = String(m.spender);
    sentence = [
      { text: 'You let ' }, addrSeg(spender), { text: ' spend ' },
      { text: amountText(value, decimals, symbol ?? (d.name ? String(d.name) : 'tokens')), tone: isUnlimited(value) ? 'danger' : undefined },
      ...untilSegs(deadline, ' from your wallet. They can use this signature until '),
    ];
    spenderFlags(spender, flags);
    amountFlags(value, 'message.value', flags);
    deadlineFlags(deadline, 'message.deadline', 'use this signature', flags);
    facts.push(`Type: EIP-2612 permit. It gives ${ents.ref(spender, 'SPENDER')} an allowance of ${amountText(value, decimals, symbol)} of ${symbol ?? 'the token ' + ents.ref(token, 'TOKEN')}, owned by [YOUR_WALLET].`);
    facts.push('SCOPE: this allowance covers only this one token. It gives no access to ETH or to any other token or NFT.');
    facts.push(`Signature valid until: ${deadline.text}. No transaction or gas is needed for the spender to use it; they submit it themselves.`);
    fields.push({ label: 'Spender', value: spender, mono: true }, { label: 'Amount', value: amountText(value, decimals, symbol) }, { label: 'Deadline', value: deadline.text });
  } else if (isPermit2 && (pt === 'PermitSingle' || pt === 'PermitBatch')) {
    kind = pt === 'PermitSingle' ? 'Permit2 allowance (PermitSingle)' : 'Permit2 batch allowance (PermitBatch)';
    const spender = String(m.spender);
    const details = (Array.isArray(m.details) ? m.details : [m.details]) as Record<string, unknown>[];
    const sig = whenFromSeconds(toBig(m.sigDeadline), now);
    spenderFlags(spender, flags);
    sentence = [{ text: 'You let ' }, addrSeg(spender), { text: ' pull ' }];
    details.forEach((det, i) => {
      const token = String(det.token);
      const { symbol, decimals } = tokenInfo(token);
      const amt = toBig(det.amount);
      const exp = whenFromSeconds(toBig(det.expiration), now);
      if (i > 0) sentence.push({ text: i === details.length - 1 ? ' and ' : ', ' });
      sentence.push({ text: amountText(amt, decimals, symbol ?? short(token)), tone: isUnlimited(amt) ? 'danger' : undefined });
      amountFlags(amt, `message.details[${i}].amount`, flags, amt === MAX_UINT160 ? '2¹⁶⁰ − 1, the largest value Permit2 accepts' : undefined);
      deadlineFlags(exp, `message.details[${i}].expiration`, 'pull these tokens', flags);
      facts.push(`Token ${i + 1}: ${symbol ?? ents.ref(token, 'TOKEN')}, allowance ${amountText(amt, decimals, symbol)}, allowance expires ${exp.text}.`);
      fields.push({ label: `Token ${i + 1}`, value: symbol ? `${symbol} (${token})` : token, mono: !symbol }, { label: `Amount ${i + 1}`, value: amountText(amt, decimals, symbol) }, { label: `Expires ${i + 1}`, value: exp.text });
    });
    const firstExp = whenFromSeconds(toBig(details[0]?.expiration), now);
    sentence.push(...untilSegs(firstExp, ' from your wallet through Permit2, until '));
    facts.unshift(`Type: Uniswap Permit2 ${pt}. It sets an allowance inside Permit2 so ${ents.ref(spender, 'SPENDER')} can move tokens from [YOUR_WALLET] at any time until it expires, with no further prompt.`);
    facts.push('SCOPE: only the tokens listed above. No access to ETH or to any other token or NFT.');
    facts.push(`This signature must be submitted before ${sig.text}.`);
    fields.push({ label: 'Spender', value: spender, mono: true });
  } else if (isPermit2 && (pt === 'PermitTransferFrom' || pt === 'PermitBatchTransferFrom' || pt === 'PermitWitnessTransferFrom')) {
    kind = 'Permit2 one-time transfer (SignatureTransfer)';
    const spender = String(m.spender);
    const permitted = (Array.isArray(m.permitted) ? m.permitted : [m.permitted]) as Record<string, unknown>[];
    const dl = whenFromSeconds(toBig(m.deadline), now);
    sentence = [{ text: 'You let ' }, addrSeg(spender), { text: ' take ' }];
    permitted.forEach((p, i) => {
      const token = String(p.token);
      const { symbol, decimals } = tokenInfo(token);
      const amt = toBig(p.amount);
      if (i > 0) sentence.push({ text: ', ' });
      sentence.push({ text: amountText(amt, decimals, symbol ?? short(token)), tone: 'danger' });
      amountFlags(amt, `message.permitted[${i}].amount`, flags);
      facts.push(`Token ${i + 1}: ${symbol ?? ents.ref(token, 'TOKEN')}, amount ${amountText(amt, decimals, symbol)}.`);
      fields.push({ label: `Token ${i + 1}`, value: symbol ?? token, mono: !symbol }, { label: `Amount ${i + 1}`, value: amountText(amt, decimals, symbol) });
    });
    sentence.push({ text: ' out of your wallet in one go, any time before ' }, { text: dl.text }, { text: '.' });
    const known = lookup(spender);
    flags.push({ severity: known ? 'caution' : 'critical', title: 'This signature moves tokens directly', detail: known ? `Signing lets ${known.name} transfer the tokens. Only sign if you are doing a swap or payment there right now.` : 'An unknown address can transfer the tokens out of your wallet as soon as you sign. No transaction confirmation follows.', evidence: `primaryType ${pt}` });
    if (!known) flags.push({ severity: 'high', title: 'Spender is not a known contract', detail: 'Readback does not recognise this address. Drainer kits use fresh addresses.', evidence: `message.spender = ${short(spender)}` });
    facts.push('SCOPE: only the listed tokens and amounts, one time. No access to ETH or anything not listed.');
    facts.unshift(`Type: Permit2 SignatureTransfer (${pt}). ${ents.ref(spender, 'SPENDER')} can transfer the listed tokens out of [YOUR_WALLET] once, before ${dl.text}.`);
    fields.push({ label: 'Spender', value: spender, mono: true }, { label: 'Deadline', value: dl.text });
  } else if (pt === 'OrderComponents' && Array.isArray(m.offer) && Array.isArray(m.consideration)) {
    kind = 'Seaport marketplace order';
    seaport(m, ents, flags, facts, fields, (s) => (sentence = s), now);
  } else {
    kind = `Unrecognised typed data (${pt})`;
    flags.push({ severity: 'caution', title: 'Readback does not know this structure', detail: 'The fields are listed below. Make sure you know what the site will do with this signature.', evidence: `primaryType ${pt}` });
    sentence = [{ text: 'You sign a ' }, { text: pt, tone: 'caution' }, { text: ` message for ${d.name ? String(d.name) : 'an unnamed app'}. Readback could not map it to a known action.` }];
    walk(m, '', ents, fields, facts, flags);
  }

  return { format: 'typed-data', kind, level: levelOf(flags), sentence, flags: sortFlags(flags), fields, facts, entities: ents.list };
}

function seaport(m: Record<string, unknown>, ents: Entities, flags: Flag[], facts: string[], fields: Field[], setSentence: (s: Segment[]) => void, now: number) {
  const offerer = String(m.offerer);
  const offer = m.offer as Record<string, unknown>[];
  const cons = m.consideration as Record<string, unknown>[];
  const describe = (it: Record<string, unknown>) => {
    const t = Number(toBig(it.itemType) ?? 0n);
    const token = String(it.token);
    const k = lookup(token);
    const amt = toBig(it.startAmount);
    if (t >= 2) return `${t === 4 || t === 5 ? 'any item' : '#' + String(it.identifierOrCriteria)} from ${k?.name ?? short(token)}`;
    if (t === 0) return `${amountText(amt, 18, 'ETH')}`;
    const { symbol, decimals } = tokenInfo(token);
    return amountText(amt, decimals, symbol ?? short(token));
  };
  const toYou = cons.filter((c) => String(c.recipient).toLowerCase() === offerer.toLowerCase());
  const toOthers = cons.filter((c) => String(c.recipient).toLowerCase() !== offerer.toLowerCase());
  const youGetValue = toYou.reduce((s, c) => s + (toBig(c.startAmount) ?? 0n), 0n);
  const end = whenFromSeconds(toBig(m.endTime), now);
  const gives = offer.map(describe);
  const nftOffered = offer.some((o) => Number(toBig(o.itemType) ?? 0n) >= 2);

  const s: Segment[] = [{ text: 'You list ' }, { text: gives.join(', '), tone: nftOffered ? 'caution' : undefined }, { text: ' and receive ' }];
  if (toYou.length === 0 || youGetValue === 0n) s.push({ text: 'nothing', tone: 'danger' });
  else s.push({ text: toYou.map(describe).join(' + ') });
  s.push(...(end.never ? [{ text: '. Anyone can fill this order, ' }, { text: 'with no end date', tone: 'caution' as Tone }, { text: '.' }] : untilSegs(end, '. Anyone can fill this order until ')));
  setSentence(s);

  if (toYou.length === 0 || youGetValue === 0n) flags.push({ severity: 'critical', title: 'You get nothing in return', detail: 'None of the payment in this order goes to your wallet. This is the classic NFT drain: a "free claim" that is really a listing for zero.', evidence: `consideration has no item with recipient = offerer` });
  else if (youGetValue < 1000000000000000n && nftOffered) flags.push({ severity: 'high', title: 'Price is close to zero', detail: `You would receive ${toYou.map(describe).join(' + ')} for the items you list.`, evidence: 'consideration[recipient = offerer].startAmount' });
  for (const c of toOthers) {
    const r = String(c.recipient);
    const k = lookup(r);
    if (!k) flags.push({ severity: toYou.length === 0 ? 'high' : 'caution', title: 'Payment goes to someone else', detail: `${describe(c)} goes to ${short(r)}. Marketplace and creator fees are normal; anything larger is not.`, evidence: `consideration recipient ${short(r)}` });
  }
  if (end.never || end.years > 1) flags.push({ severity: 'caution', title: 'Order stays open a long time', detail: end.never ? 'The listing never expires, so it can be filled at any time.' : `The listing can be filled until ${end.text}.`, evidence: 'message.endTime' });

  facts.push(`Type: Seaport order signed by [YOUR_WALLET]. You give: ${gives.join(', ')}. You receive: ${toYou.length ? toYou.map(describe).join(' + ') : 'nothing'}.`);
  toOthers.forEach((c) => facts.push(`Also paid out: ${describe(c)} to ${ents.ref(String(c.recipient), 'RECIPIENT')}.`));
  facts.push('SCOPE: only the items listed in the offer. Other NFTs, tokens and ETH in the wallet are not part of this order.');
  facts.push(`Order can be filled by anyone until ${end.text}.`);
  fields.push({ label: 'Offer', value: gives.join(', ') }, { label: 'You receive', value: toYou.length ? toYou.map(describe).join(' + ') : 'nothing' }, { label: 'Ends', value: end.text });
}

function walk(o: unknown, path: string, ents: Entities, fields: Field[], facts: string[], flags: Flag[], depth = 0) {
  if (depth > 4 || fields.length > 40) return;
  if (o && typeof o === 'object') {
    for (const [k, v] of Object.entries(o)) walk(v, path ? `${path}.${k}` : k, ents, fields, facts, flags, depth + 1);
    return;
  }
  const v = String(o);
  if (/^0x[0-9a-fA-F]{40}$/.test(v)) { fields.push({ label: path, value: v, mono: true }); facts.push(`Field ${path} is the address ${ents.ref(v, 'ADDRESS')}.`); return; }
  const b = toBig(v);
  if (b !== null && isUnlimited(b)) { flags.push({ severity: 'high', title: 'Unlimited number in an unknown request', detail: 'One of the values is the maximum possible. In approvals that means "everything, forever".', evidence: `message.${path}` }); fields.push({ label: path, value: 'maximum value' }); facts.push(`Field ${path} is set to the maximum possible value.`); return; }
  const shown = v.length > 80 ? v.slice(0, 77) + '…' : v;
  fields.push({ label: path, value: shown, mono: /^0x/.test(v) });
  const isNum = /^\d+$/.test(v);
  const isHex = /^0x[0-9a-f]{16,}/i.test(v);
  facts.push(isHex ? `Field ${path} = [HEX_VALUE].` : isNum ? `Field ${path} = ${shown}.` : `Field ${path} = <quoted>${shown.replace(/0x[0-9a-fA-F]{8,}/g, '[HEX_VALUE]')}</quoted> (text from the request, untrusted).`);
}

/* --------------------------------- flags ---------------------------------- */
function spenderFlags(spender: string, flags: Flag[]) {
  const k = lookup(spender);
  if (k) flags.push({ severity: 'info', title: `Spender is ${k.name}`, detail: 'A well-known contract. Still only sign if you started this action yourself.', evidence: `spender = ${short(spender)}` });
  else flags.push({ severity: 'high', title: 'Spender is not a known contract', detail: 'Readback does not recognise this address. Look it up on a block explorer before you sign; drainer kits use fresh addresses.', evidence: `spender = ${short(spender)}` });
}

function amountFlags(v: bigint | null, path: string, flags: Flag[], note?: string) {
  if (isUnlimited(v)) flags.push({ severity: 'high', title: 'Unlimited amount', detail: `The spender can take every token of this kind you hold now or later${note ? ` (${note})` : ''}.`, evidence: path });
}

function deadlineFlags(w: ReturnType<typeof whenFromSeconds>, path: string, verb: string, flags: Flag[]) {
  if (w.past) flags.push({ severity: 'info', title: 'Already expired', detail: `This date is in the past, so the spender can no longer ${verb} with it.`, evidence: path });
  else if (w.never) flags.push({ severity: 'high', title: 'Never expires', detail: `The spender can ${verb} at any time in the future.`, evidence: path });
  else if (w.years > 1) flags.push({ severity: 'caution', title: 'Long expiry', detail: `Valid until ${w.text}. A swap only needs minutes.`, evidence: path });
}

function siteCheck(site: string, claimed: string, flags: Flag[], facts: string[]) {
  const host = site.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
  facts.push(`The request came from the site ${host}.`);
  const c = claimed.toLowerCase().replace(/\s+/g, '');
  if (c && host && !host.replace(/\W/g, '').includes(c.replace(/\W/g, '').slice(0, 6)) && !['permit2', 'seaport', 'usdcoin', 'usdc'].includes(c)) {
    flags.push({ severity: 'caution', title: 'Site and app name differ', detail: `You are on ${host}, but the signature names "${claimed}".`, evidence: 'domain.name vs site' });
  }
}

const ORDER: Record<Severity, number> = { critical: 0, high: 1, caution: 2, info: 3 };
function sortFlags(f: Flag[]) { return [...f].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]); }

/* ----------------------------- transactions ------------------------------- */
const SELECTORS: Record<string, string> = {
  '0x095ea7b3': 'approve(address,uint256)',
  '0x39509351': 'increaseAllowance(address,uint256)',
  '0xa22cb465': 'setApprovalForAll(address,bool)',
  '0xa9059cbb': 'transfer(address,uint256)',
  '0x23b872dd': 'transferFrom(address,address,uint256)',
  '0x42842e0e': 'safeTransferFrom(address,address,uint256)',
  '0x87517c45': 'approve(address,address,uint160,uint48)',
};

function words(data: string): string[] {
  const body = data.slice(10);
  const out: string[] = [];
  for (let i = 0; i + 64 <= body.length; i += 64) out.push(body.slice(i, i + 64));
  return out;
}
const wAddr = (w: string) => '0x' + w.slice(24);
const wInt = (w: string) => BigInt('0x' + w);

function transaction(o: Record<string, unknown>, opts: { site?: string; now?: number }): Readback {
  const data = String(o.data ?? o.input ?? '0x');
  const to = isAddress(o.to) ? o.to : undefined;
  const from = isAddress(o.from) ? o.from : undefined;
  const ents = new Entities(from);
  const flags: Flag[] = [];
  const facts: string[] = [];
  const fields: Field[] = [];
  const sel = data.slice(0, 10).toLowerCase();
  const sig = SELECTORS[sel];
  const w = words(data);
  const value = toBig(o.value) ?? 0n;
  const chain = chainName(o.chainId);
  const format = to ? 'transaction' : 'calldata';
  const tgt = to ? lookup(to) : undefined;
  const target: Segment = to ? addrSeg(to) : { text: 'the contract you send this to' };
  if (to) fields.push({ label: 'To', value: to, mono: true });
  if (chain) fields.push({ label: 'Chain', value: chain });
  fields.push({ label: 'Function', value: sig ?? `unknown (${sel})`, mono: true });
  if (value > 0n) fields.push({ label: 'ETH sent', value: amountText(value, 18, 'ETH') });
  if (opts.site) siteCheck(opts.site, '', flags, facts);
  if (chain) facts.push(`Network: ${chain}.`);
  if (to) facts.push(`Transaction to ${ents.ref(to, 'CONTRACT')}.`);
  if (value > 0n) facts.push(`It also sends ${amountText(value, 18, 'ETH')}.`);
  let sentence: Segment[] = [];
  let kind = 'Contract call';
  const { symbol, decimals } = to ? tokenInfo(to) : { symbol: undefined, decimals: undefined };
  const tok = symbol ?? (to ? (tgt?.name ?? 'tokens at ' + short(to)) : 'tokens');

  if ((sel === '0x095ea7b3' || sel === '0x39509351') && w.length >= 2) {
    kind = sel === '0x095ea7b3' ? 'Token approval (approve)' : 'Token approval (increaseAllowance)';
    const spender = wAddr(w[0]);
    const amt = wInt(w[1]);
    if (amt === 0n) {
      sentence = [{ text: 'You remove ' }, addrSeg(spender), { text: `’s permission to spend your ${tok}. This revokes an approval.` }];
      facts.push(`This revokes ${ents.ref(spender, 'SPENDER')}'s allowance for ${tok} (sets it to 0).`);
    } else {
      sentence = [{ text: 'You let ' }, addrSeg(spender), { text: ' spend ' }, { text: amountText(amt, decimals, symbol ?? tok), tone: isUnlimited(amt) ? 'danger' : undefined }, { text: ' from your wallet, with no end date.' }];
      spenderFlags(spender, flags);
      amountFlags(amt, 'calldata word 2 (amount)', flags);
      facts.push('SCOPE: this approval covers only this one token contract, up to the amount. It gives no access to ETH or to other tokens or NFTs.');
      facts.push(`ERC-20 approval: ${ents.ref(spender, 'SPENDER')} may spend ${amountText(amt, decimals, symbol)} of ${tok} from [YOUR_WALLET]. ERC-20 approvals do not expire until revoked.`);
    }
    fields.push({ label: 'Spender', value: spender, mono: true }, { label: 'Amount', value: amountText(amt, decimals, symbol) });
  } else if (sel === '0xa22cb465' && w.length >= 2) {
    const operator = wAddr(w[0]);
    const on = wInt(w[1]) !== 0n;
    kind = 'NFT collection approval (setApprovalForAll)';
    if (on) {
      sentence = [{ text: 'You let ' }, addrSeg(operator), { text: ' move ' }, { text: 'every NFT you own', tone: 'danger' }, { text: ' in ' }, target, { text: ', now and in the future, until you revoke it.' }];
      const k = lookup(operator);
      flags.push({ severity: k ? 'caution' : 'critical', title: 'Access to the whole collection', detail: k ? `${k.name} is a known marketplace contract. Only approve if you are listing on it right now.` : 'An unknown operator gets every NFT you hold in this collection. This is how most NFT drains happen.', evidence: 'setApprovalForAll(operator, true)' });
      facts.push('SCOPE: every NFT in this one collection only. Other collections, tokens and ETH are not covered.');
      facts.push(`setApprovalForAll: ${ents.ref(operator, 'OPERATOR')} gets permission to transfer every NFT [YOUR_WALLET] holds in ${to ? ents.ref(to, 'COLLECTION') : 'this collection'}, with no expiry.`);
    } else {
      sentence = [{ text: 'You remove ' }, addrSeg(operator), { text: '’s access to your NFTs in ' }, target, { text: '.' }];
      facts.push(`This revokes an NFT collection approval for ${ents.ref(operator, 'OPERATOR')}.`);
    }
    fields.push({ label: 'Operator', value: operator, mono: true }, { label: 'Approved', value: on ? 'yes' : 'no (revoke)' });
  } else if (sel === '0xa9059cbb' && w.length >= 2) {
    kind = 'Token transfer';
    const rcpt = wAddr(w[0]);
    const amt = wInt(w[1]);
    sentence = [{ text: 'You send ' }, { text: amountText(amt, decimals, symbol ?? tok) }, { text: ' to ' }, addrSeg(rcpt), { text: '.' }];
    facts.push(`Transfer of ${amountText(amt, decimals, symbol)} ${tok} from [YOUR_WALLET] to ${ents.ref(rcpt, 'RECIPIENT')}.`);
    if (!lookup(rcpt)) flags.push({ severity: 'info', title: 'Check the recipient', detail: 'Compare every character of the address, not only the start and end. Address-poisoning scams copy those.', evidence: `recipient = ${short(rcpt)}` });
    fields.push({ label: 'Recipient', value: rcpt, mono: true }, { label: 'Amount', value: amountText(amt, decimals, symbol) });
  } else if ((sel === '0x23b872dd' || sel === '0x42842e0e') && w.length >= 3) {
    kind = 'Transfer from a wallet';
    const src = wAddr(w[0]);
    const dst = wAddr(w[1]);
    const amt = wInt(w[2]);
    sentence = [{ text: 'You move ' }, { text: symbol ? amountText(amt, decimals, symbol) : `item #${amt.toString()} from ` }, ...(symbol ? [] : [target]), { text: ' from ' }, addrSeg(src), { text: ' to ' }, addrSeg(dst), { text: '.' }];
    facts.push(`transferFrom: moves ${symbol ? amountText(amt, decimals, symbol) : 'token id ' + amt.toString()} from ${ents.ref(src, 'FROM')} to ${ents.ref(dst, 'TO')}.`);
    fields.push({ label: 'From', value: src, mono: true }, { label: 'To', value: dst, mono: true });
  } else if (sel === '0x87517c45' && w.length >= 4) {
    kind = 'Permit2 approve (on-chain)';
    const token = wAddr(w[0]); const spender = wAddr(w[1]); const amt = wInt(w[2]);
    const exp = whenFromSeconds(wInt(w[3]), opts.now);
    const ti = tokenInfo(token);
    sentence = [{ text: 'You let ' }, addrSeg(spender), { text: ' pull ' }, { text: amountText(amt, ti.decimals, ti.symbol ?? short(token)), tone: isUnlimited(amt) ? 'danger' : undefined }, ...untilSegs(exp, ' through Permit2 until ')];
    spenderFlags(spender, flags); amountFlags(amt, 'calldata word 3 (amount)', flags); deadlineFlags(exp, 'calldata word 4 (expiration)', 'pull tokens', flags);
    facts.push(`Permit2 approve: ${ents.ref(spender, 'SPENDER')} can pull ${amountText(amt, ti.decimals, ti.symbol)} of ${ti.symbol ?? ents.ref(token, 'TOKEN')} until ${exp.text}.`);
    fields.push({ label: 'Spender', value: spender, mono: true });
  } else if (data === '0x' || data === '') {
    kind = 'Plain ETH transfer';
    sentence = [{ text: 'You send ' }, { text: amountText(value, 18, 'ETH') }, { text: ' to ' }, target, { text: '.' }];
  } else {
    kind = 'Unknown contract call';
    sentence = [{ text: 'You call an unknown function ' }, { text: sel, tone: 'caution' }, { text: ' on ' }, target, { text: '. Readback cannot decode what it does.' }];
    flags.push({ severity: 'caution', title: 'Function not recognised', detail: 'Use a wallet with simulation, or check the contract on a block explorer, before you send this.', evidence: `selector ${sel}` });
    facts.push(`Unknown function selector; ${w.length} argument words; Readback could not decode the action.`);
  }
  if (value > 0n && kind !== 'Plain ETH transfer') flags.push({ severity: 'caution', title: 'Also sends ETH', detail: `This call sends ${amountText(value, 18, 'ETH')} along with it.`, evidence: 'value' });
  return { format, kind, level: levelOf(flags), sentence, flags: sortFlags(flags), fields, facts, entities: ents.list };
}

/* -------------------------------- messages -------------------------------- */
function blindHash(hex: string): Readback {
  const flags: Flag[] = [{ severity: 'critical', title: 'Blind signature of a hash', detail: 'You are signing 32 raw bytes with no readable meaning. With eth_sign this can authorise a transaction you never see. Do not sign unless you produced this hash yourself.', evidence: '32-byte hex message' }];
  return {
    format: 'message', kind: 'Raw 32-byte hash (eth_sign)', level: 'danger',
    sentence: [{ text: 'You sign a ' }, { text: 'hash you cannot read', tone: 'danger' }, { text: '. It could stand for anything, including a transfer of your assets.' }],
    flags, fields: [{ label: 'Hash', value: hex, mono: true }], facts: ['The request asks to sign a raw 32-byte hash with no human-readable content (eth_sign style).'], entities: [],
  };
}

function message(text: string, opts: { site?: string; now?: number }): Readback {
  const flags: Flag[] = [];
  const fields: Field[] = [];
  const facts: string[] = [];
  const ents = new Entities();
  const siwe = /^(\S+) wants you to sign in with your Ethereum account:\s*\n(0x[0-9a-fA-F]{40})/m.exec(text);
  const statement = siwe ? text.split('\n').slice(2).find((l) => l.trim() && !/^[A-Z][\w ]+: /.test(l)) : undefined;
  if (siwe) {
    const domain = siwe[1];
    ents.get(siwe[2], 'YOUR_WALLET');
    const uri = /^URI: (.+)$/m.exec(text)?.[1];
    const chainId = /^Chain ID: (\d+)$/m.exec(text)?.[1];
    const exp = /^Expiration Time: (.+)$/m.exec(text)?.[1];
    fields.push({ label: 'Signature type', value: 'Sign-In with Ethereum (EIP-4361)' }, { label: 'Domain', value: domain });
    if (uri) fields.push({ label: 'URI', value: uri });
    if (chainId) fields.push({ label: 'Chain', value: CHAINS[chainId] ?? chainId });
    facts.push(`Type: Sign-In with Ethereum login message for the domain ${domain}. Signing a login message cannot move funds by itself.`);
    let sentence: Segment[] = [{ text: 'You log in to ' }, { text: domain, tone: 'addr' }, { text: ' with your wallet. This alone does not move any funds.' }];
    const uriHost = uri ? uri.replace(/^https?:\/\//, '').split('/')[0] : undefined;
    if (uriHost && uriHost !== domain) flags.push({ severity: 'high', title: 'Domain and URI do not match', detail: `The message names ${domain} but points to ${uriHost}.`, evidence: 'domain vs URI' });
    if (opts.site) {
      const host = opts.site.replace(/^https?:\/\//, '').split('/')[0].toLowerCase();
      facts.push(`The request came from the site ${host}.`);
      if (host !== domain.toLowerCase()) {
        flags.push({ severity: 'high', title: 'You are not on the site this login is for', detail: `The message is for ${domain}, but you said the request came from ${host}. A look-alike site may be relaying a real login.`, evidence: 'SIWE domain vs site' });
        sentence = [{ text: 'You log in to ' }, { text: domain, tone: 'addr' }, { text: ' while you are on ' }, { text: host, tone: 'danger' }, { text: '. The two do not match.' }];
      }
    }
    if (!exp) flags.push({ severity: 'info', title: 'No expiration time', detail: 'Most sign-in messages expire within minutes.', evidence: 'Expiration Time missing' });
    return { format: 'message', kind: 'Sign-In with Ethereum', level: levelOf(flags), sentence, flags: sortFlags(flags), fields, facts, entities: ents.list, quoted: statement?.slice(0, 300) };
  }
  const risky = /(claim|airdrop|verify|validate|sync|migrate|unlock|reward)/i.test(text);
  if (risky) flags.push({ severity: 'caution', title: 'Wording often used in phishing', detail: 'Words like claim, verify or sync appear in many fake sign requests. A real message signature cannot move funds, but check where it is going.', evidence: 'message text' });
  fields.push({ label: 'Signature type', value: 'Plain message (personal_sign)' }, { label: 'Length', value: `${text.length} characters` });
  facts.push('Type: plain text message (personal_sign). On its own it cannot move funds, but the site may use it as proof that you agree to something.');
  return {
    format: 'message', kind: 'Plain text message', level: levelOf(flags),
    sentence: [{ text: 'You sign a plain text message. It cannot move funds by itself.' }],
    flags: sortFlags(flags), fields, facts, entities: ents.list, quoted: text.slice(0, 400).replace(/0x[0-9a-fA-F]{8,}/g, '[HEX_VALUE]'),
  };
}
