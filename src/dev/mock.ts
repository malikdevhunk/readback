// DEV ONLY: canned explanation used to review the UI layout without a Firebase project.
// Never imported in production builds (guarded by import.meta.env.DEV).
import type { Readback } from '../lib/decode';
import { explainPrompt, route } from '../lib/ai';
import { InferenceMode } from 'firebase/ai';

export async function mockExplain(rb: Readback, lang: string, where: string) {
  await new Promise((r) => setTimeout(r, where === 'loading' ? 1e9 : 400));
  const prompt = explainPrompt(rb, lang);
  const r = route(lang, prompt.length, true, where === 'device' ? 'available' : 'unsupported');
  const reason = 'blocked' in r ? r.blocked : r.reason;
  return {
    status: 'done' as const,
    data: rb.kind.includes('setApprovalForAll') ? {
      headline: '[OPERATOR] would get every Azuki NFT in your wallet.',
      whatHappens: [
        'This is not a role check. It is an on-chain approval for the whole collection.',
        '[OPERATOR] could transfer any Azuki you hold now or buy later, without asking again.',
        'The approval stays until you revoke it.',
      ],
      worstCase: 'Your Azuki NFTs are moved to another wallet and sold within minutes.',
      checks: ['Real Discord role checks only ask for a sign-in message, never an approval.', 'Is [OPERATOR] a marketplace you are listing on right now?'],
    } : {
      headline: '[SPENDER] could empty your USDC at any time, with no end date.',
      whatHappens: [
        'This is not a login. It sets a Permit2 allowance for [SPENDER].',
        'The amount is the maximum Permit2 allows, so it covers all the USDC in [YOUR_WALLET], now and later.',
        'The spender can submit this signature themselves. You will not see another prompt.',
      ],
      worstCase: '[SPENDER] moves all your USDC out of [YOUR_WALLET] minutes after you sign.',
      checks: ['Did you start a swap on a site you typed yourself?', 'Is [SPENDER] the router of that site? Look it up on a block explorer.', 'If you already signed, revoke the Permit2 allowance.'],
    },
    receipt: { source: where === 'device' ? 'on_device' as const : 'in_cloud' as const, mode: InferenceMode.PREFER_ON_DEVICE, reason, ms: where === 'device' ? 1840 : 2310, sent: prompt, model: where === 'device' ? 'Gemini Nano (Chrome)' : 'gemini-3.5-flash-lite' },
  };
}
