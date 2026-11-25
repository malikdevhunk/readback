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
export const IconMark = (p: P) => (
  <svg {...base(p)} viewBox="0 0 32 32" strokeWidth={2.25}>
    <path d="M5 21c3.2 0 4.3-9 7.5-9s2.6 6 5.2 6 2.7-4 5-4" />
    <path d="M4 26.5h24" />
    <path d="M22.5 7.5 26 11l-3.5 3.5" />
  </svg>
);
