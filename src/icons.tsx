import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };
const base = ({ size = 20, ...p }: P) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true, ...p,
});

export const IconStop = (p: P) => (<svg {...base(p)}><path d="M8.2 2.5h7.6l5.7 5.7v7.6l-5.7 5.7H8.2l-5.7-5.7V8.2z" /><path d="M8.5 8.5l7 7M15.5 8.5l-7 7" /></svg>);
export const IconCaution = (p: P) => (<svg {...base(p)}><path d="M12 3.2 2.4 20h19.2z" /><path d="M12 9.5v4.5M12 17.2v.1" /></svg>);
export const IconCheck = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="m8 12.3 2.7 2.7L16.2 9.5" /></svg>);
export const IconInfo = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.6v.1" /></svg>);
export const IconChip = (p: P) => (<svg {...base(p)}><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9.5 2.5V6M14.5 2.5V6M9.5 18v3.5M14.5 18v3.5M2.5 9.5H6M2.5 14.5H6M18 9.5h3.5M18 14.5h3.5" /></svg>);
export const IconCloud = (p: P) => (<svg {...base(p)}><path d="M7 18.5h10.5a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5z" /></svg>);
export const IconLock = (p: P) => (<svg {...base(p)}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>);
export const IconOffline = (p: P) => (<svg {...base(p)}><path d="M3 3l18 18" /><path d="M8.5 8.6A5.9 5.9 0 0 0 6.6 9.1 4.75 4.75 0 0 0 7 18.5h10.5M20.6 16a4 4 0 0 0-2.5-5.45A6 6 0 0 0 11 5.1" /></svg>);
export const IconChevron = (p: P) => (<svg {...base(p)}><path d="m9 6 6 6-6 6" /></svg>);
export const IconMark = ({ size = 28, ...p }: P) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" {...p}>
    <defs>
      <linearGradient id="rbm" x1="3" y1="2" x2="29" y2="30" gradientUnits="userSpaceOnUse"><stop stopColor="#8f7bff" /><stop offset="1" stopColor="#27d3e6" /></linearGradient>
    </defs>
    <rect width="32" height="32" rx="9" fill="url(#rbm)" />
    <g fill="none" stroke="#0a0e1c" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6.5 20.5c2.8 0 3.9-8 6.8-8s2.3 5.4 4.7 5.4 2.5-3.6 4.6-3.6" />
      <path d="M6.5 25.5h19" />
      <path d="M22.3 7.8 25.6 11l-3.3 3.2" />
    </g>
  </svg>
);

export const IconSparkle = (p: P) => (<svg {...base(p)}><path d="M12 3c.6 4.6 2.4 6.4 7 7-4.6.6-6.4 2.4-7 7-.6-4.6-2.4-6.4-7-7 4.6-.6 6.4-2.4 7-7z" /><path d="M19 3v3M17.5 4.5h3" /></svg>);
export const IconShield = (p: P) => (<svg {...base(p)}><path d="M12 3 4.5 6v5.6c0 4.5 3 8 7.5 9.4 4.5-1.4 7.5-4.9 7.5-9.4V6z" /><path d="m8.8 12 2.3 2.3 4.2-4.4" /></svg>);
export const IconReceipt = (p: P) => (<svg {...base(p)}><path d="M6 3h12v18l-2.2-1.5L13.6 21 12 19.5 10.4 21l-2.2-1.5L6 21z" /><path d="M9 8h6M9 12h6M9 16h3" /></svg>);
export const IconDoc = (p: P) => (<svg {...base(p)}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>);
export const IconBolt = (p: P) => (<svg {...base(p)}><path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" /></svg>);
export const IconArrow = (p: P) => (<svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6" /></svg>);
export const IconTick = (p: P) => (<svg {...base(p)} strokeWidth={2.25}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>);
export const IconGithub = (p: P) => (<svg {...base(p)}><path d="M9 19c-4.3 1.4-4.3-2.5-6-3m12 5v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1.1-.3-3.5 1.3a12.3 12.3 0 0 0-6.2 0C6.5 2.8 5.4 3.1 5.4 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></svg>);
