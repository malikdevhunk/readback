import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { decode, DecodeError, type Readback, type Segment, type Flag } from './lib/decode';
import { SAMPLES } from './lib/samples';
import { rehydrate, countRedactions } from './lib/redact';
import { strings, type Strings } from './lib/i18n';
import {
  configured, start, deviceState, route, run, explainPrompt, askPrompt, LANG_NATIVE,
  type DeviceState, type Explanation, type Receipt,
} from './lib/ai';
import { IconStop, IconCaution, IconCheck, IconInfo, IconChip, IconCloud, IconLock, IconMark, IconOffline, IconSparkle, IconShield, IconReceipt, IconDoc, IconArrow, IconTick, IconGithub } from './icons';

const REPO = 'https://github.com/malikdevhunk/readback';
const LEVEL = {
  danger: { Icon: IconStop, step: 3 },
  caution: { Icon: IconCaution, step: 2 },
  routine: { Icon: IconCheck, step: 1 },
} as const;

// The rules engine is deterministic, so each sample's verdict can be shown on its card before it is opened.
const SAMPLE_LEVEL: Record<string, Readback['level']> = Object.fromEntries(
  SAMPLES.map((s) => { try { return [s.id, decode(s.body(), { site: s.site }).level]; } catch { return [s.id, 'caution']; } }),
);

type AiState =
  | { status: 'idle' }
  | { status: 'off' }
  | { status: 'loading'; progress?: number }
  | { status: 'done'; data: Explanation; receipt: Receipt }
  | { status: 'error'; message: string };

type AskState = { status: 'idle' } | { status: 'loading' } | { status: 'done'; q: string; answer: string; receipt: Receipt } | { status: 'error'; message: string };

// Development-only UI review hook (?mockai=device|cloud). Removed from production builds.
const MOCK = import.meta.env.DEV ? new URLSearchParams(location.search).get('mockai') : null;

const store = {
  get: (k: string, d: string) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
};

export default function App() {
  const [input, setInput] = useState('');
  const [site, setSite] = useState('');
  const [rb, setRb] = useState<Readback | null>(null);
  const [err, setErr] = useState<{ message: string; hint?: string } | null>(null);
  const [lang, setLang] = useState(() => store.get('rb.lang', 'en'));
  const [allowCloud, setAllowCloud] = useState(() => store.get('rb.cloud', 'yes') === 'yes');
  const [device, setDevice] = useState<DeviceState>('unsupported');
  const [online, setOnline] = useState(() => navigator.onLine);
  const [ai, setAi] = useState<AiState>({ status: 'idle' });
  const [ask, setAsk] = useState<AskState>({ status: 'idle' });
  const [question, setQuestion] = useState('');
  const resultRef = useRef<HTMLElement>(null);
  const inputId = useId();

  useEffect(() => { void start(); }, []);
  useEffect(() => { deviceState(lang).then(setDevice); }, [lang]);
  useEffect(() => {
    const on = () => setOnline(true); const off = () => setOnline(false);
    addEventListener('online', on); addEventListener('offline', off);
    return () => { removeEventListener('online', on); removeEventListener('offline', off); };
  }, []);
  useEffect(() => { store.set('rb.lang', lang); }, [lang]);
  useEffect(() => { store.set('rb.cloud', allowCloud ? 'yes' : 'no'); }, [allowCloud]);

  // ?sample=<id> opens a sample directly (handy for demos and judges).
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('sample');
    const s = SAMPLES.find((x) => x.id === id);
    if (s) { const body = s.body(); setInput(body); setSite(s.site); read(body, s.site, false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function read(text = input, from = site, explainNow = true) {
    setAsk({ status: 'idle' });
    try {
      const r = decode(text, { site: from.trim() || undefined });
      setRb(r); setErr(null);
      if (explainNow && matchMedia('(max-width: 960px)').matches) requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      if (!configured && !(import.meta.env.DEV && MOCK)) setAi({ status: 'off' });
      else if (explainNow) void explain(r);
      else setAi({ status: 'idle' });
    } catch (e) {
      setRb(null); setAi({ status: 'idle' });
      setErr(e instanceof DecodeError ? { message: e.message, hint: e.hint } : { message: 'Readback could not read this request.', hint: String((e as Error).message) });
    }
  }

  async function explain(r = rb, l = lang) {
    if (!r) return;
    if (import.meta.env.DEV && MOCK) { setAi({ status: 'loading' }); const m = await import('./dev/mock'); setAi(await m.mockExplain(r, l, MOCK)); return; }
    if (!configured) { setAi({ status: 'off' }); return; }
    const prompt = explainPrompt(r, l);
    const rt = route(l, prompt.length, allowCloud, device);
    if ('blocked' in rt) { setAi({ status: 'error', message: rt.blocked }); return; }
    setAi({ status: 'loading' });
    try {
      const out = await run<Explanation>('explain', prompt, l, rt, (p) => setAi({ status: 'loading', progress: p }));
      setAi({ status: 'done', data: out.data, receipt: out.receipt });
    } catch (e) {
      setAi({ status: 'error', message: friendly(e, allowCloud, online) });
    }
  }

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    if (!rb || !question.trim()) return;
    const { prompt } = askPrompt(rb, question, lang);
    const rt = route(lang, prompt.length, allowCloud, device);
    if ('blocked' in rt) { setAsk({ status: 'error', message: rt.blocked }); return; }
    setAsk({ status: 'loading' });
    try {
      const out = await run<{ answer: string }>('ask', prompt, lang, rt);
      setAsk({ status: 'done', q: question, answer: out.data.answer, receipt: out.receipt });
    } catch (e2) { setAsk({ status: 'error', message: friendly(e2, allowCloud, online) }); }
  }

  function openSample(id: string) {
    const s = SAMPLES.find((x) => x.id === id)!;
    const body = s.body();
    setInput(body); setSite(s.site);
    history.replaceState(null, '', `?sample=${s.id}`);
    read(body, s.site);
  }

  return (
    <div className="shell">
      <div className="aurora" aria-hidden="true"><i /><i /><i /></div>
      <a className="skip" href="#h1">Skip to the tool</a>
      <header className="top">
        <a className="brand" href="./" aria-label="Readback home"><IconMark size={34} /><span>Readback</span></a>
        <DeviceStatus device={device} online={online} />
      </header>

      <main className={`grid${rb ? ' has-result' : ''}`}>
        <section className="intake" aria-labelledby="h1">
          <p className="eyebrow"><IconShield size={16} /> Wallet signature decoder</p>
          <h1 id="h1">Read it back <span className="grad">before you sign.</span></h1>
          <p className="lead">Paste what your wallet is asking you to sign. Readback decodes it on this device and tells you, in plain words, what you would give away.</p>
          <ul className="trust" aria-label="How it protects you">
            <li><IconChip size={16} /> On-device first</li>
            <li><IconCloud size={16} /> Redacted cloud fallback</li>
            <li><IconLock size={16} /> No wallet connect</li>
          </ul>

          <form className="card editor" onSubmit={(e) => { e.preventDefault(); read(); }} noValidate>
            <div className="editor-bar" aria-hidden="true"><i /><i /><i /><span>request.json</span></div>
            <div className="editor-body">
              <label htmlFor={inputId} className="label">Signature request</label>
              <textarea
                id={inputId} name="request" className="code" spellCheck={false} autoComplete="off" rows={11}
                value={input} onChange={(e) => setInput(e.target.value)}
                placeholder={'{ "primaryType": "Permit", "domain": { … }, "message": { … } }'}
                aria-invalid={err ? true : undefined} aria-describedby={err ? 'input-error' : 'input-help'}
              />
              {err ? (
                <p id="input-error" className="field-error" role="alert"><IconCaution size={16} /> <span><strong>{err.message}</strong>{err.hint ? ' ' + err.hint : ''}</span></p>
              ) : (
                <p id="input-help" className="help">Typed data JSON, a transaction, raw calldata, or a sign-in message. In most wallets, open the request details and copy the raw data.</p>
              )}
              <label htmlFor="site" className="label">Site asking you to sign <span className="optional">optional</span></label>
              <input id="site" name="site" type="text" inputMode="url" autoComplete="off" spellCheck={false} placeholder="app.example.org" value={site} onChange={(e) => setSite(e.target.value)} />
              <button type="submit" className="btn primary">Read it back <IconArrow size={18} /></button>
            </div>
          </form>
        </section>

        <section className="sheet" ref={resultRef} tabIndex={-1} aria-live="polite" aria-label="Readback result">
          {rb ? (
            <Result rb={rb} ai={ai} ask={ask} lang={lang} setLang={(l) => { setLang(l); void explain(rb, l); }}
              allowCloud={allowCloud} setAllowCloud={setAllowCloud} onExplain={() => explain()}
              question={question} setQuestion={setQuestion} onAsk={onAsk} />
          ) : <Empty />}
        </section>

        <section className="samples" aria-labelledby="samples-h">
          <h2 id="samples-h" className="h-small">Or open a real-shaped request</h2>
          <ul>
            {SAMPLES.map((s) => {
              const lv = SAMPLE_LEVEL[s.id] ?? 'caution';
              const T = LEVEL[lv].Icon;
              return (
                <li key={s.id}>
                  <button type="button" className={`sample tone-${lv}`} onClick={() => openSample(s.id)}>
                    <span className="sample-icon" aria-hidden="true"><T size={20} /></span>
                    <span className="sample-text">
                      <span className="sample-title">{s.title}</span>
                      <span className="sample-hint">{s.hint}<span className="sample-verdict"> · {strings('en').verdict[lv]}</span></span>
                    </span>
                    <IconArrow size={16} className="sample-go" />
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="note">Contracts in samples are real mainnet addresses. Wallets, spenders and sites are illustrative.</p>
        </section>
      </main>

      <footer className="foot">
        <p className="credit">Designed, developed and built by <a href="https://saddammalik.com" rel="noopener">Saddam Malik</a></p>
        <p className="foot-note">Readback is a reading aid, not a guarantee. Verdicts come from fixed rules in the open-source code; the AI only explains them.</p>
        <p className="foot-links"><a href={REPO}><IconGithub size={16} /> Source code</a><a href="./privacy.html">Privacy</a></p>
      </footer>
    </div>
  );
}

function friendly(e: unknown, allowCloud: boolean, online: boolean): string {
  const m = String((e as Error)?.message ?? e);
  if (/on-device|ONLY_ON_DEVICE|not available/i.test(m) && !allowCloud) return 'Gemini Nano isn’t available in this browser and cloud fallback is off. Use Chrome on desktop, or allow redacted cloud fallback.';
  if (!online) return 'You’re offline and Gemini Nano isn’t ready on this device, so no model could answer. The verdict above still holds.';
  if (/app.?check|403|permission/i.test(m)) return 'The cloud model refused the request (App Check). Reload the page and try again.';
  if (/quota|429|resource.?exhausted/i.test(m)) return 'The cloud model is busy right now. Try again in a minute.';
  return 'The explanation didn’t come through. The verdict above still holds. Try again.';
}

function DeviceStatus({ device, online }: { device: DeviceState; online: boolean }) {
  const map: Record<DeviceState, { text: string; tone: string }> = {
    available: { text: 'Gemini Nano ready on this device', tone: 'ok' },
    downloadable: { text: 'Gemini Nano can be downloaded', tone: 'wait' },
    downloading: { text: 'Gemini Nano is downloading', tone: 'wait' },
    unavailable: { text: 'No on-device model here', tone: 'off' },
    unsupported: { text: 'No on-device model in this browser', tone: 'off' },
  };
  const s = map[device];
  return (
    <div className="status" role="status">
      {!online && <span className="pill tone-wait"><IconOffline size={16} /> Offline</span>}
      <span className={`pill tone-${s.tone}`}><i className="dot" aria-hidden="true" /> {s.text}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="empty">
      <p className="eyebrow muted"><IconDoc size={16} /> What you’ll see here</p>
      <div className="preview" aria-hidden="true">
        <span className="preview-tag">Example</span>
        <div className="preview-verdict"><IconStop size={26} /><div><b>Do not sign</b><small>Permit2 allowance</small></div><span className="gauge g3"><i /><i /><i /></span></div>
        <p>You let <span className="seg seg-addr">0x5a2b…646d</span> pull <span className="seg seg-danger">unlimited USDC</span> from your wallet, <span className="seg seg-caution">with no end date</span>.</p>
      </div>
      <ol className="steps">
        <li><span className="step-icon"><IconShield size={20} /></span><span><strong>A verdict from open rules.</strong> Do not sign, check first, or routine. Decided by code you can read, never by the AI.</span></li>
        <li><span className="step-icon"><IconSparkle size={20} /></span><span><strong>Plain words from Gemini.</strong> Runs on this device when Chrome has Gemini Nano. If it needs the cloud, every address is removed first.</span></li>
        <li><span className="step-icon"><IconReceipt size={20} /></span><span><strong>A privacy receipt.</strong> See where it ran, how long it took, and exactly what was sent.</span></li>
      </ol>
      <p className="empty-foot"><IconLock size={16} /> Readback never asks you to connect a wallet.</p>
    </div>
  );
}

function Sentence({ parts }: { parts: Segment[] }) {
  return (
    <p className="sentence">
      {parts.map((p, i) => p.tone ? (
        <span key={i} className={`seg seg-${p.tone}`} title={p.title}>{p.text}</span>
      ) : <span key={i}>{p.text}</span>)}
    </p>
  );
}

const SEV: Record<Flag['severity'], { Icon: typeof IconStop }> = {
  critical: { Icon: IconStop },
  high: { Icon: IconCaution },
  caution: { Icon: IconCaution },
  info: { Icon: IconInfo },
};

interface ResultProps {
  rb: Readback; ai: AiState; ask: AskState; lang: string; setLang: (l: string) => void;
  allowCloud: boolean; setAllowCloud: (v: boolean) => void; onExplain: () => void;
  question: string; setQuestion: (q: string) => void; onAsk: (e: FormEvent) => void;
}

function Result({ rb, ai, ask, lang, setLang, allowCloud, setAllowCloud, onExplain, question, setQuestion, onAsk }: ResultProps) {
  const L = LEVEL[rb.level];
  const t = strings(lang);
  return (
    <article className={`result level-${rb.level}`}>
      <div className="verdict-card">
        <div className="verdict">
          <span className="verdict-badge"><L.Icon size={32} /></span>
          <div className="verdict-text">
            <p className="verdict-label" lang={lang}>{t.verdict[rb.level]}</p>
            <p className="kind">{rb.kind}</p>
          </div>
          <span className={`gauge g${L.step}`} role="img" aria-label={`${t.gauge}: ${L.step}/3`} lang={lang}><i /><i /><i /></span>
        </div>
        <Sentence parts={rb.sentence} />
      </div>

      {rb.flags.length > 0 && (
        <ul className="flags" aria-label={t.findings} lang={lang}>
          {rb.flags.map((f, i) => {
            const S = SEV[f.severity];
            return (
              <li key={i} className={`flag sev-${f.severity}`} style={{ ['--i' as string]: i }}>
                <span className="flag-icon"><S.Icon size={18} /></span>
                <div className="flag-body">
                  <p className="flag-title"><span className="sev">{t.severity[f.severity]}</span><span lang="en">{f.title}</span></p>
                  <p className="flag-detail" lang="en">{f.detail}</p>
                  {f.evidence && <p className="evidence"><code>{f.evidence}</code></p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="explain card-inner" aria-labelledby="explain-h" lang={lang}>
        <div className="explain-head">
          <h2 id="explain-h" className="h-section"><IconSparkle size={20} className="spark" /> {t.plain}</h2>
          <label className="toggle">
            <input type="checkbox" checked={allowCloud} onChange={(e) => setAllowCloud(e.target.checked)} name="cloud" />
            <span className="switch" aria-hidden="true" />
            <span>{t.cloudToggle}</span>
          </label>
        </div>
        <fieldset className="langs">
          <legend className="visually-hidden">{t.language}</legend>
          {Object.entries(LANG_NATIVE).map(([k, v]) => (
            <label key={k} className="lang-opt">
              <input type="radio" name="lang" value={k} checked={lang === k} onChange={() => setLang(k)} />
              <span lang={k}>{v}</span>
            </label>
          ))}
        </fieldset>
        <ExplainBody ai={ai} rb={rb} onExplain={onExplain} t={t} lang={lang} />
      </section>

      {ai.status === 'done' && (
        <section className="ask card-inner" aria-labelledby="ask-h" lang={lang}>
          <h2 id="ask-h" className="h-small">{t.ask}</h2>
          <form onSubmit={onAsk} className="ask-row">
            <label htmlFor="q" className="visually-hidden">{t.askLabel}</label>
            <input id="q" name="q" type="text" autoComplete="off" placeholder={t.askPlaceholder} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
            <button type="submit" className="btn" disabled={ask.status === 'loading'}>{ask.status === 'loading' ? t.asking : t.askBtn}</button>
          </form>
          {ask.status === 'done' && (<div className="answer"><p className="answer-q">{ask.q}</p><p><Hydrated text={ask.answer} rb={rb} /></p><ReceiptLine r={ask.receipt} t={t} compact /></div>)}
          {ask.status === 'error' && <p className="field-error" role="alert"><IconCaution size={16} /> {ask.message}</p>}
        </section>
      )}

      <details className="fields">
        <summary><span lang={lang}>{t.fields}</span> <span className="count">{rb.fields.length}</span></summary>
        <dl>
          {rb.fields.map((f, i) => (
            <div key={i} className="field-row"><dt>{f.label}</dt><dd className={f.mono ? 'mono' : undefined}>{f.value}</dd></div>
          ))}
        </dl>
      </details>
    </article>
  );
}

function Hydrated({ text, rb }: { text: string; rb: Readback }) {
  return <>{rehydrate(text, rb.entities).map((p, i) => p.entity ? <span key={i} className={`seg ${p.entity.label ? 'seg-name' : 'seg-addr'}`} title={p.entity.value}>{p.text}</span> : <span key={i}>{p.text}</span>)}</>;
}

function ExplainBody({ ai, rb, onExplain, t, lang }: { ai: AiState; rb: Readback; onExplain: () => void; t: Strings; lang: string }) {
  if (ai.status === 'off') return (
    <div className="ai-off">
      <p>Plain-words explanations are switched off on this copy of Readback because it has no Firebase project connected. The verdict and findings above come from the rules engine and work without AI.</p>
      <p><a href={`${REPO}#run-it-yourself`}>Connect Firebase AI Logic</a> to turn them on.</p>
    </div>
  );
  if (ai.status === 'idle') return <button type="button" className="btn" onClick={onExplain}>{t.explainBtn}</button>;
  if (ai.status === 'loading') return (
    <div className="skeleton" aria-busy="true">
      <p className="loading-line"><IconSparkle size={16} className="pulse" /> {ai.progress !== undefined && ai.progress < 1 ? t.downloading(Math.round(ai.progress * 100)) : t.explaining}</p>
      <span className="bar" style={{ width: '88%' }} /><span className="bar" style={{ width: '64%' }} /><span className="bar" style={{ width: '76%' }} />
    </div>
  );
  if (ai.status === 'error') return (
    <div className="ai-error" role="alert"><p><IconCaution size={16} /> {ai.message}</p><button type="button" className="btn" onClick={onExplain}>{t.tryAgain}</button></div>
  );
  const d = ai.data;
  return (
    <div className="explanation" lang={lang}>
      <p className="ex-headline"><Hydrated text={d.headline} rb={rb} /></p>
      <ul className="ex-list">{(d.whatHappens ?? []).map((x, i) => <li key={i}><Hydrated text={x} rb={rb} /></li>)}</ul>
      {d.worstCase && (
        <div className="worst">
          <IconCaution size={20} />
          <p><strong>{t.worst}</strong><span><Hydrated text={d.worstCase} rb={rb} /></span></p>
        </div>
      )}
      {d.checks?.length > 0 && (
        <div className="checks-box">
          <h3 className="h-small">{t.checks}</h3>
          <ul className="ex-list checks">{d.checks.map((x, i) => <li key={i}><IconTick size={16} /><span><Hydrated text={x} rb={rb} /></span></li>)}</ul>
        </div>
      )}
      <ReceiptLine r={ai.receipt} t={t} />
    </div>
  );
}

function ReceiptLine({ r, t, compact = false }: { r: Receipt; t: Strings; compact?: boolean }) {
  const local = r.source === 'on_device';
  const n = countRedactions(r.sent);
  const why = t.reasons[r.reasonKey]?.(r.reasonVars) ?? r.reason;
  const secs = `${(r.ms / 1000).toFixed(1)} s`;
  const summary = <summary>{local ? t.seeLocal : t.seeCloud}</summary>;
  if (compact) return (
    <div className={`receipt compact ${local ? 'is-local' : 'is-cloud'}`}>
      <p className="receipt-main">{local ? <IconChip size={16} /> : <IconCloud size={16} />}<span>{local ? t.onDevice : t.inCloud} · {r.model} · {secs}</span></p>
      <details className="sent">{summary}<pre lang="en">{r.sent}</pre></details>
    </div>
  );
  return (
    <aside className={`receipt ${local ? 'is-local' : 'is-cloud'}`} aria-label={t.receipt}>
      <div className="receipt-head">
        <p className="receipt-title"><IconReceipt size={18} /> {t.receipt}</p>
        <span className="receipt-badge">{local ? <IconChip size={14} /> : <IconCloud size={14} />}{local ? t.onDevice : t.inCloud}</span>
      </div>
      <dl className="receipt-grid">
        <div><dt>{t.modelLabel}</dt><dd className="mono" lang="en">{r.model}</dd></div>
        <div><dt>{t.timeLabel}</dt><dd className="mono">{secs}</dd></div>
        <div><dt>{t.redactedLabel}</dt><dd className="mono">{local ? t.none : n}</dd></div>
      </dl>
      <p className="receipt-note">{local ? t.localNote : t.cloudNote(n)}</p>
      <p className="receipt-why">{why}</p>
      <details className="sent">{summary}<pre lang="en">{r.sent}</pre></details>
    </aside>
  );
}
