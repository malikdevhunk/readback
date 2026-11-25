// UI strings for the languages the explanation can be written in. Verdicts and findings come from the
// rules engine; the labels around them follow the language the reader chose.
import type { ReasonKey } from './ai';

export interface Strings {
  verdict: { danger: string; caution: string; routine: string };
  severity: { critical: string; high: string; caution: string; info: string };
  gauge: string;
  findings: string;
  plain: string;
  language: string;
  cloudToggle: string;
  explainBtn: string;
  explaining: string;
  downloading: (pct: number) => string;
  tryAgain: string;
  worst: string;
  checks: string;
  ask: string;
  askBtn: string;
  asking: string;
  askLabel: string;
  askPlaceholder: string;
  fields: string;
  receipt: string;
  ranOn: string;
  onDevice: string;
  inCloud: string;
  modelLabel: string;
  timeLabel: string;
  redactedLabel: string;
  none: string;
  localNote: string;
  cloudNote: (n: number) => string;
  seeLocal: string;
  seeCloud: string;
  reasons: Record<ReasonKey, (v?: Record<string, string>) => string>;
}

const nativeName: Record<string, string> = { en: 'English', es: 'español', ja: '日本語', hi: 'हिन्दी' };

const en: Strings = {
  verdict: { danger: 'Do not sign', caution: 'Check before signing', routine: 'Looks routine' },
  severity: { critical: 'Critical', high: 'High', caution: 'Check', info: 'Note' },
  gauge: 'Risk level',
  findings: 'Findings',
  plain: 'In plain words',
  language: 'Explanation language',
  cloudToggle: 'Redacted cloud fallback',
  explainBtn: 'Explain this request',
  explaining: 'Explaining…',
  downloading: (p) => `Downloading Gemini Nano to this device… ${p}%`,
  tryAgain: 'Try again',
  worst: 'Worst case',
  checks: 'Before you sign, check',
  ask: 'Ask about this request',
  askBtn: 'Ask',
  asking: 'Asking…',
  askLabel: 'Your question',
  askPlaceholder: 'Can they take my ETH too?',
  fields: 'All decoded fields',
  receipt: 'Privacy receipt',
  ranOn: 'Ran',
  onDevice: 'On this device',
  inCloud: 'In the cloud',
  modelLabel: 'Model',
  timeLabel: 'Time',
  redactedLabel: 'Redacted',
  none: 'Nothing sent',
  localNote: 'Nothing left your browser.',
  cloudNote: (n) => `${n} ${n === 1 ? 'value was' : 'values were'} replaced with placeholders before sending.`,
  seeLocal: 'See the prompt Gemini Nano read',
  seeCloud: 'See exactly what was sent',
  reasons: {
    langCloud: (v) => `Gemini Nano in Chrome can’t write ${v?.lang ?? ''} yet, so this goes to the cloud model, redacted.`,
    longCloud: (v) => `This request is long (${v?.n} characters), so the cloud model goes first.`,
    longLocal: () => 'Long request kept on this device because cloud fallback is off.',
    cloudOff: () => 'Cloud fallback is off. Only this device is used.',
    nanoReady: () => 'Gemini Nano is ready on this device.',
    noBuiltin: () => 'This browser has no built-in model, so the redacted cloud fallback answers.',
    nanoNotReady: () => 'Gemini Nano isn’t ready here, so the redacted cloud fallback may answer.',
  },
};

const hi: Strings = {
  verdict: { danger: 'साइन मत कीजिए', caution: 'साइन करने से पहले जाँचिए', routine: 'सामान्य लग रहा है' },
  severity: { critical: 'गंभीर', high: 'ऊँचा', caution: 'जाँचें', info: 'ध्यान दें' },
  gauge: 'जोखिम का स्तर',
  findings: 'जाँच के नतीजे',
  plain: 'सीधी भाषा में',
  language: 'समझाने की भाषा',
  cloudToggle: 'छिपाए हुए डेटा के साथ क्लाउड बैकअप',
  explainBtn: 'इस रिक्वेस्ट को समझाइए',
  explaining: 'समझा रहे हैं…',
  downloading: (p) => `Gemini Nano आपके डिवाइस पर डाउनलोड हो रहा है… ${p}%`,
  tryAgain: 'फिर कोशिश करें',
  worst: 'सबसे बुरा नतीजा',
  checks: 'साइन करने से पहले ये जाँचिए',
  ask: 'इस रिक्वेस्ट के बारे में पूछिए',
  askBtn: 'पूछें',
  asking: 'पूछ रहे हैं…',
  askLabel: 'आपका सवाल',
  askPlaceholder: 'क्या ये मेरा ETH भी निकाल सकते हैं?',
  fields: 'सारे डिकोड किए हुए फ़ील्ड',
  receipt: 'प्राइवेसी रसीद',
  ranOn: 'कहाँ चला',
  onDevice: 'आपके डिवाइस पर',
  inCloud: 'क्लाउड में',
  modelLabel: 'मॉडल',
  timeLabel: 'समय',
  redactedLabel: 'छिपाए गए',
  none: 'कुछ नहीं भेजा',
  localNote: 'आपके ब्राउज़र से कुछ बाहर नहीं गया।',
  cloudNote: (n) => `भेजने से पहले ${n} वैल्यू को प्लेसहोल्डर से बदल दिया गया।`,
  seeLocal: 'देखिए Gemini Nano ने क्या पढ़ा',
  seeCloud: 'देखिए ठीक-ठीक क्या भेजा गया',
  reasons: {
    langCloud: (v) => `Chrome का Gemini Nano अभी ${nativeName[v?.lang ?? ''] ?? ''} नहीं लिख सकता, इसलिए ये क्लाउड मॉडल के पास गया, पते छिपाकर।`,
    longCloud: (v) => `ये रिक्वेस्ट लंबी है (${v?.n} अक्षर), इसलिए पहले क्लाउड मॉडल चला।`,
    longLocal: () => 'क्लाउड बैकअप बंद है, इसलिए लंबी रिक्वेस्ट आपके डिवाइस पर ही रही।',
    cloudOff: () => 'क्लाउड बैकअप बंद है। सिर्फ़ आपका डिवाइस इस्तेमाल हुआ।',
    nanoReady: () => 'Gemini Nano आपके डिवाइस पर तैयार है।',
    noBuiltin: () => 'इस ब्राउज़र में बिल्ट-इन मॉडल नहीं है, इसलिए पते छिपाकर क्लाउड बैकअप ने जवाब दिया।',
    nanoNotReady: () => 'Gemini Nano यहाँ तैयार नहीं है, इसलिए पते छिपाकर क्लाउड बैकअप जवाब दे सकता है।',
  },
};

const es: Strings = {
  verdict: { danger: 'No firmes', caution: 'Revisa antes de firmar', routine: 'Parece normal' },
  severity: { critical: 'Crítico', high: 'Alto', caution: 'Revisar', info: 'Nota' },
  gauge: 'Nivel de riesgo',
  findings: 'Hallazgos',
  plain: 'En palabras sencillas',
  language: 'Idioma de la explicación',
  cloudToggle: 'Respaldo en la nube con datos ocultos',
  explainBtn: 'Explicar esta solicitud',
  explaining: 'Explicando…',
  downloading: (p) => `Descargando Gemini Nano en este dispositivo… ${p}%`,
  tryAgain: 'Reintentar',
  worst: 'Peor caso',
  checks: 'Antes de firmar, revisa',
  ask: 'Pregunta sobre esta solicitud',
  askBtn: 'Preguntar',
  asking: 'Preguntando…',
  askLabel: 'Tu pregunta',
  askPlaceholder: '¿Pueden llevarse también mi ETH?',
  fields: 'Todos los campos decodificados',
  receipt: 'Recibo de privacidad',
  ranOn: 'Se ejecutó',
  onDevice: 'En este dispositivo',
  inCloud: 'En la nube',
  modelLabel: 'Modelo',
  timeLabel: 'Tiempo',
  redactedLabel: 'Ocultados',
  none: 'No se envió nada',
  localNote: 'Nada salió de tu navegador.',
  cloudNote: (n) => `${n} ${n === 1 ? 'valor se reemplazó' : 'valores se reemplazaron'} por marcadores antes de enviar.`,
  seeLocal: 'Ver el texto que leyó Gemini Nano',
  seeCloud: 'Ver exactamente qué se envió',
  reasons: {
    langCloud: (v) => `Gemini Nano en Chrome aún no escribe en ${nativeName[v?.lang ?? ''] ?? ''}, así que esto va al modelo en la nube, con datos ocultos.`,
    longCloud: (v) => `La solicitud es larga (${v?.n} caracteres), así que primero responde el modelo en la nube.`,
    longLocal: () => 'La solicitud larga se quedó en este dispositivo porque el respaldo en la nube está desactivado.',
    cloudOff: () => 'El respaldo en la nube está desactivado. Solo se usa este dispositivo.',
    nanoReady: () => 'Gemini Nano está listo en este dispositivo.',
    noBuiltin: () => 'Este navegador no tiene modelo integrado, así que responde el respaldo en la nube con datos ocultos.',
    nanoNotReady: () => 'Gemini Nano no está listo aquí, así que puede responder el respaldo en la nube con datos ocultos.',
  },
};

const ja: Strings = {
  verdict: { danger: '署名しないでください', caution: '署名前に確認を', routine: '通常のリクエストです' },
  severity: { critical: '重大', high: '高', caution: '確認', info: '注記' },
  gauge: 'リスクレベル',
  findings: '検出結果',
  plain: 'やさしい言葉で',
  language: '説明の言語',
  cloudToggle: 'アドレスを伏せたクラウド代替',
  explainBtn: 'このリクエストを説明する',
  explaining: '説明を作成中…',
  downloading: (p) => `Gemini Nano をこの端末にダウンロード中… ${p}%`,
  tryAgain: 'もう一度試す',
  worst: '最悪の場合',
  checks: '署名する前に確認すること',
  ask: 'このリクエストについて質問する',
  askBtn: '質問',
  asking: '質問中…',
  askLabel: '質問',
  askPlaceholder: 'ETH も抜かれますか？',
  fields: 'デコードしたすべての項目',
  receipt: 'プライバシーレシート',
  ranOn: '実行場所',
  onDevice: 'この端末',
  inCloud: 'クラウド',
  modelLabel: 'モデル',
  timeLabel: '時間',
  redactedLabel: '伏せた値',
  none: '送信なし',
  localNote: 'ブラウザの外には何も送られていません。',
  cloudNote: (n) => `送信前に ${n} 個の値をプレースホルダーに置き換えました。`,
  seeLocal: 'Gemini Nano が読んだ内容を見る',
  seeCloud: '送信した内容をそのまま見る',
  reasons: {
    langCloud: (v) => `Chrome の Gemini Nano はまだ${nativeName[v?.lang ?? ''] ?? ''}で書けないため、アドレスを伏せてクラウドモデルに送りました。`,
    longCloud: (v) => `リクエストが長い（${v?.n} 文字）ため、まずクラウドモデルを使いました。`,
    longLocal: () => 'クラウド代替がオフのため、長いリクエストもこの端末内で処理しました。',
    cloudOff: () => 'クラウド代替はオフです。この端末だけを使います。',
    nanoReady: () => 'この端末で Gemini Nano が使えます。',
    noBuiltin: () => 'このブラウザには内蔵モデルがないため、アドレスを伏せたクラウド代替が回答しました。',
    nanoNotReady: () => 'ここでは Gemini Nano の準備ができていないため、アドレスを伏せたクラウド代替が回答することがあります。',
  },
};

export const STRINGS: Record<string, Strings> = { en, hi, es, ja };
export const strings = (lang: string): Strings => STRINGS[lang] ?? en;
