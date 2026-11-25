// Well-known contracts on Ethereum mainnet and major L2s. Addresses are lower-case.
// A spender or contract that is not in this list is "unknown", not "bad".
export interface Known {
  name: string;
  kind: 'token' | 'protocol' | 'marketplace' | 'router';
}

export const KNOWN: Record<string, Known> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { name: 'USDC', kind: 'token' },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { name: 'USDT', kind: 'token' },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'DAI', kind: 'token' },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'WETH', kind: 'token' },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { name: 'WBTC', kind: 'token' },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { name: 'UNI', kind: 'token' },
  '0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d': { name: 'Bored Ape Yacht Club', kind: 'token' },
  '0xed5af388653567af2f388e6224dc7c4b3241c544': { name: 'Azuki', kind: 'token' },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': { name: 'Uniswap Permit2', kind: 'protocol' },
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': { name: 'Uniswap Universal Router', kind: 'router' },
  '0x66a9893cc07d91d95644aedd05d03f95e1dba8af': { name: 'Uniswap Universal Router v4', kind: 'router' },
  '0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45': { name: 'Uniswap SwapRouter02', kind: 'router' },
  '0x111111125421ca6dc452d289314280a0f8842a65': { name: '1inch Router v6', kind: 'router' },
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': { name: '0x Exchange Proxy', kind: 'router' },
  '0x00000000000000adc04c56bf30ac9d3c0aaf14dc': { name: 'Seaport 1.5', kind: 'marketplace' },
  '0x0000000000000068f116a894984e2db1123eb395': { name: 'Seaport 1.6', kind: 'marketplace' },
  '0x1e0049783f008a0085193e00003d00cd54003c71': { name: 'OpenSea Conduit', kind: 'marketplace' },
  '0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9': { name: 'Aave v2 Pool', kind: 'protocol' },
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': { name: 'Aave v3 Pool', kind: 'protocol' },
};

export const CHAINS: Record<string, string> = {
  '1': 'Ethereum',
  '10': 'Optimism',
  '56': 'BNB Chain',
  '137': 'Polygon',
  '8453': 'Base',
  '42161': 'Arbitrum One',
  '11155111': 'Sepolia testnet',
};

export function lookup(addr: string | undefined): Known | undefined {
  if (!addr) return undefined;
  return KNOWN[addr.toLowerCase()];
}
