import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { decode, DecodeError, type Readback, type Segment, type Flag } from './lib/decode';
import { SAMPLES } from './lib/samples';
import { rehydrate, countRedactions } from './lib/redact';
import {
  configured, start, deviceState, route, run, explainPrompt, askPrompt, LANG_NAMES,
  type DeviceState, type Explanation, type Receipt,
} from './lib/ai';
import { IconStop, IconCaution, IconCheck, IconInfo, IconChip, IconCloud, IconLock, IconMark, IconOffline } from './icons';

const REPO = 'https://github.com/malikdevhunk/readback';
const LEVEL = {
  danger: { label: 'Do not sign', Icon: IconStop },
  caution: { label: 'Check before signing', Icon: IconCaution },
  routine: { label: 'Looks routine', Icon: IconCheck },
} as const;

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
      <header className="top">
        <a className="brand" href="./" aria-label="Readback home"><IconMark size={28} /><span>Readback</span></a>
        <DeviceStatus device={device} online={online} />
      </header>

      <main className="grid">
        <section className="intake" aria-labelledby="h1">
          <h1 id="h1">Read it back before you sign.</h1>
          <p className="lead">Paste what your wallet is asking you to sign. Readback decodes it on this device and tells you, in plain words, what you would give away.</p>

          <form onSubmit={(e) => { e.preventDefault(); read(); }} noValidate>
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
            <button type="submit" className="btn primary">Read it back</button>
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
            {SAMPLES.map((s) => (
              <li key={s.id}>
                <button type="button" className="sample" onClick={() => openSample(s.id)}>
                  <span className="sample-title">{s.title}</span>
                  <span className="sample-hint">{s.hint}</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="note">Contracts in samples are real mainnet addresses. Wallets, spenders and sites are illustrative.</p>
        </section>
      </main>

      <footer className="foot">
        <p>Readback is a reading aid, not a guarantee. Verdicts come from fixed rules in the <a href={REPO}>open-source code</a>; the AI only explains them.</p>
        <p><a href="./privacy.html">Privacy</a><span aria-hidden="true" className="sep" /> Built by <a href="https://saddammalik.com">Saddam Malik</a></p>
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
      {!online && <span className="status-item"><IconOffline size={16} /> Offline</span>}
      <span className={`status-item tone-${s.tone}`}><IconChip size={16} /> {s.text}</span>
    </div>
  );
}

function Empty() {
  return (
    <div className="empty">
      <h2 className="h-section">What you’ll see here</h2>
      <ol className="steps">
        <li><span><strong>A verdict</strong> from fixed, open rules: do not sign, check first, or routine.</span></li>
        <li><span><strong>One sentence</strong> that says what the signature lets someone do, with the risky part marked.</span></li>
        <li><span><strong>A plain-words explanation</strong> from Gemini, run on this device when Chrome has Gemini Nano. If it has to use the cloud, every address is removed first.</span></li>
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

const SEV: Record<Flag['severity'], { label: string; Icon: typeof IconStop }> = {
  critical: { label: 'Critical', Icon: IconStop },
  high: { label: 'High', Icon: IconCaution },
  caution: { label: 'Check', Icon: IconCaution },
  info: { label: 'Note', Icon: IconInfo },
};

interface ResultProps {
  rb: Readback; ai: AiState; ask: AskState; lang: string; setLang: (l: string) => void;
  allowCloud: boolean; setAllowCloud: (v: boolean) => void; onExplain: () => void;
  question: string; setQuestion: (q: string) => void; onAsk: (e: FormEvent) => void;
}

function Result({ rb, ai, ask, lang, setLang, allowCloud, setAllowCloud, onExplain, question, setQuestion, onAsk }: ResultProps) {
  const L = LEVEL[rb.level];
  return (
    <article className={`result level-${rb.level}`}>
      <div className="verdict">
        <L.Icon size={28} />
        <div>
          <p className="verdict-label">{L.label}</p>
          <p className="kind">{rb.kind}</p>
        </div>
      </div>
      <Sentence parts={rb.sentence} />

      {rb.flags.length > 0 && (
        <ul className="flags" aria-label="Findings">
          {rb.flags.map((f, i) => {
            const S = SEV[f.severity];
            return (
              <li key={i} className={`flag sev-${f.severity}`}>
                <S.Icon size={18} />
                <div className="flag-body">
                  <p className="flag-title"><span className="sev">{S.label}</span>{f.title}</p>
                  <p className="flag-detail">{f.detail}</p>
                  {f.evidence && <p className="evidence"><code>{f.evidence}</code></p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <section className="explain" aria-labelledby="explain-h">
        <div className="explain-head">
          <h2 id="explain-h" className="h-section">In plain words</h2>
          <div className="controls">
            <label className="select">
              <span className="visually-hidden">Explanation language</span>
              <select value={lang} onChange={(e) => setLang(e.target.value)} name="lang" aria-label="Explanation language">
                {Object.entries(LANG_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="toggle">
              <input type="checkbox" checked={allowCloud} onChange={(e) => setAllowCloud(e.target.checked)} name="cloud" />
              <span>Redacted cloud fallback</span>
            </label>
          </div>
        </div>
        <ExplainBody ai={ai} rb={rb} onExplain={onExplain} />
      </section>

      {ai.status === 'done' && (
        <section className="ask" aria-labelledby="ask-h">
          <h2 id="ask-h" className="h-small">Ask about this request</h2>
          <form onSubmit={onAsk} className="ask-row">
            <label htmlFor="q" className="visually-hidden">Your question</label>
            <input id="q" name="q" type="text" autoComplete="off" placeholder="Can they take my ETH too?" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} />
            <button type="submit" className="btn" disabled={ask.status === 'loading'}>{ask.status === 'loading' ? 'Asking…' : 'Ask'}</button>
          </form>
          {ask.status === 'done' && (<div className="answer"><p><Hydrated text={ask.answer} rb={rb} /></p><ReceiptLine r={ask.receipt} /></div>)}
          {ask.status === 'error' && <p className="field-error" role="alert"><IconCaution size={16} /> {ask.message}</p>}
        </section>
      )}

      <details className="fields">
        <summary>All decoded fields <span className="count">{rb.fields.length}</span></summary>
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

function ExplainBody({ ai, rb, onExplain }: { ai: AiState; rb: Readback; onExplain: () => void }) {
  if (ai.status === 'off') return (
    <div className="ai-off">
      <p>Plain-words explanations are switched off on this copy of Readback because it has no Firebase project connected. The verdict and findings above come from the rules engine and work without AI.</p>
      <p><a href={`${REPO}#run-it-yourself`}>Connect Firebase AI Logic</a> to turn them on.</p>
    </div>
  );
  if (ai.status === 'idle') return <button type="button" className="btn" onClick={onExplain}>Explain this request</button>;
  if (ai.status === 'loading') return (
    <div className="skeleton" aria-busy="true">
      <p className="loading-line">{ai.progress !== undefined && ai.progress < 1 ? `Downloading Gemini Nano to this device… ${Math.round(ai.progress * 100)}%` : 'Explaining…'}</p>
      <span className="bar" style={{ width: '82%' }} /><span className="bar" style={{ width: '64%' }} /><span className="bar" style={{ width: '72%' }} />
    </div>
  );
  if (ai.status === 'error') return (
    <div className="ai-error" role="alert"><p><IconCaution size={16} /> {ai.message}</p><button type="button" className="btn" onClick={onExplain}>Try again</button></div>
  );
  const d = ai.data;
  return (
    <div className="explanation">
      <p className="ex-headline"><Hydrated text={d.headline} rb={rb} /></p>
      <ul className="ex-list">{(d.whatHappens ?? []).map((t, i) => <li key={i}><Hydrated text={t} rb={rb} /></li>)}</ul>
      {d.worstCase && <p className="worst"><strong>Worst case.</strong> <Hydrated text={d.worstCase} rb={rb} /></p>}
      {d.checks?.length > 0 && (<><h3 className="h-small">Before you sign, check</h3><ul className="ex-list checks">{d.checks.map((t, i) => <li key={i}><Hydrated text={t} rb={rb} /></li>)}</ul></>)}
      <ReceiptLine r={ai.receipt} />
    </div>
  );
}

function ReceiptLine({ r }: { r: Receipt }) {
  const local = r.source === 'on_device';
  const n = countRedactions(r.sent);
  return (
    <div className={`receipt ${local ? 'is-local' : 'is-cloud'}`}>
      <p className="receipt-main">
        {local ? <IconChip size={16} /> : <IconCloud size={16} />}
        <span>{local
          ? <>Explained on this device by {r.model} in {(r.ms / 1000).toFixed(1)}&nbsp;s. Nothing left your browser.</>
          : <>Explained in the cloud by {r.model} in {(r.ms / 1000).toFixed(1)}&nbsp;s. {n} {n === 1 ? 'value was' : 'values were'} redacted before sending.</>}
        </span>
      </p>
      <p className="receipt-why">{r.reason}</p>
      <details className="sent">
        <summary>{local ? 'See the prompt Gemini Nano read' : 'See exactly what was sent'}</summary>
        <pre>{r.sent}</pre>
      </details>
    </div>
  );
}
